import { useEffect, useRef, useState } from "react";
import { GameEngine } from "./gameEngine";
import { NotificationQueue } from "./notificationQueue";
import { loadGame, saveGame, createAutoSaver, exportSaveText, importSaveFromFileText } from "./save";
import { showText } from "../lib/dialog";
import { GAME_CONTENT } from "../content";
import { ACHIEVEMENT_CATALOG } from "../content/achivements";
import type { GameNotification, GameState } from "./types";

const LIVE_TICK_MS = 1000;
const DEFAULT_AUTOSAVE_MS = 10_000;

/** Identifies this tab to other tabs of the game (see the single-tab guard
 *  below). Module-level so React StrictMode's double-mount reuses it. */
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Owns a single GameEngine instance for the lifetime of the component tree.
 * On mount: loads a save if present, resolves whatever time elapsed since
 * the save was written (offline catch-up), and starts a 1s live tick.
 *
 * The engine instance lives in useState (not useRef) specifically so that
 * importing a save can swap in a whole new GameEngine and have effects
 * (notifications subscription, tick loop, autosave) properly re-subscribe
 * to it via the [engine] dependency array — a ref mutation wouldn't trigger
 * that re-subscription on its own.
 */
export function useGameEngine() {
  const [engine, setEngine] = useState<GameEngine>(() => {
    // Created up front so a "your save couldn't be read" message from
    // loadGame actually reaches the player.
    const notifications = new NotificationQueue();
    const loaded = loadGame(GAME_CONTENT, notifications);
    const instance = loaded ?? new GameEngine(GAME_CONTENT, { notifications });
    instance.resolveElapsed();
    instance.checkAchievements(ACHIEVEMENT_CATALOG); // catch anything already met (e.g. from an imported save)
    return instance;
  });

  const [state, setState] = useState<GameState>(() => ({ ...engine.getState() }));
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [autosaveMs, setAutosaveMs] = useState(DEFAULT_AUTOSAVE_MS);
  /** True once the game has been opened in another tab — see below. */
  const [suspended, setSuspended] = useState(false);
  const autoSaverRef = useRef<ReturnType<typeof createAutoSaver> | null>(null);

  const refreshState = () => setState({ ...engine.getState() });

  // Nearly every player action (buy, craft, equip...) pushes a notification,
  // so refreshing the state snapshot here makes the UI reflect the action
  // immediately instead of on the next 1s tick.
  useEffect(() => {
    const unsubscribe = engine.notifications.subscribe((list) => {
      setNotifications(list);
      setState({ ...engine.getState() });
    });
    return unsubscribe;
  }, [engine]);

  // Single-tab guard. Two tabs running the same save each simulate and
  // autosave, overwriting each other's progress. The newest tab wins: it
  // announces itself, and any older tab stops ticking and saving.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("idlegame");
    channel.onmessage = (event) => {
      if (event.data?.type === "claim" && event.data.tabId !== TAB_ID) setSuspended(true);
    };
    channel.postMessage({ type: "claim", tabId: TAB_ID });
    return () => channel.close();
  }, []);

  useEffect(() => {
    if (suspended) return;
    const tick = () => {
      engine.resolveElapsed();
      engine.checkAchievements(ACHIEVEMENT_CATALOG);
      setState({ ...engine.getState() });
    };
    const id = window.setInterval(tick, LIVE_TICK_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    const autoSaver = createAutoSaver(engine, autosaveMs);
    autoSaverRef.current = autoSaver;

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      autoSaver.stop();
    };
    // autosaveMs intentionally excluded: changing it calls setIntervalMs via
    // the actions object below rather than tearing down/rebuilding the whole
    // effect (which would also momentarily drop the tick loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, suspended]);

  const importText = (text: string) => {
    try {
      const imported = importSaveFromFileText(text.trim(), GAME_CONTENT);
      imported.checkAchievements(ACHIEVEMENT_CATALOG);
      setEngine(imported); // swaps the whole engine — effects re-subscribe automatically
      saveGame(imported); // persist immediately so a refresh doesn't lose the import
    } catch (err) {
      engine.notifications.push("error", `Couldn't import that save: ${(err as Error).message}`, { severity: "error" });
    }
  };

  const actions = {
    /** For the few actions that don't push a notification (Attack Now,
     *  tending a gather node): re-render right away. */
    refresh: refreshState,

    saveNow: () => saveGame(engine),

    exportSave: () =>
      void showText(
        "Export save",
        "Copy this text and keep it somewhere safe. Paste it into Import save to restore it.",
        exportSaveText(engine)
      ),

    /** Same as importing a file, from pasted text. */
    importSaveText: (text: string) => importText(text),

    importSave: async (file: File) => importText(await file.text()),

    resetAll: () => {
      engine.resetAll();
      saveGame(engine);
      refreshState();
    },

    clearResource: (resourceId: string) => {
      engine.clearResource(resourceId);
      refreshState();
    },

    clearAllResources: () => {
      engine.clearAllResources();
      refreshState();
    },

    setAutosaveMs: (ms: number) => {
      setAutosaveMs(ms);
      autoSaverRef.current?.setIntervalMs(ms);
    },
  };

  return { engine, state, notifications, autosaveMs, suspended, actions };
}