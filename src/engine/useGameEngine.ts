import { useEffect, useRef, useState } from "react";
import { GameEngine, createInitialState } from "./gameEngine";
import { loadGame, saveGame, createAutoSaver, exportSaveToFile, importSaveFromFileText } from "./save";
import { registerStartingContent } from "../content/bootstrap";
import { ACHIEVEMENT_CATALOG } from "../content/achivements";
import type { GameNotification, GameState } from "./types";

const LIVE_TICK_MS = 1000;
const DEFAULT_AUTOSAVE_MS = 10_000;

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
    const loaded = loadGame();
    const instance = loaded ?? new GameEngine(createInitialState());
    registerStartingContent(instance); // must run before resolveElapsed so newly-added
    // catalog content (or content already owned in the loaded save) is in place
    // before we compute what happened while away.
    instance.resolveElapsed();
    instance.checkAchievements(ACHIEVEMENT_CATALOG); // catch anything already met (e.g. from an imported save)
    return instance;
  });

  const [state, setState] = useState<GameState>(() => ({ ...engine.getState() }));
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [autosaveMs, setAutosaveMs] = useState(DEFAULT_AUTOSAVE_MS);
  const autoSaverRef = useRef<ReturnType<typeof createAutoSaver> | null>(null);

  const refreshState = () => setState({ ...engine.getState() });

  useEffect(() => {
    const unsubscribe = engine.notifications.subscribe(setNotifications);
    return unsubscribe;
  }, [engine]);

  useEffect(() => {
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
  }, [engine]);

  const actions = {
    saveNow: () => saveGame(engine),

    exportSave: () => exportSaveToFile(engine),

    importSave: async (file: File) => {
      try {
        const text = await file.text();
        const imported = importSaveFromFileText(text);
        registerStartingContent(imported); // same reason as the initial load — ensures
        // catalog content exists even if the imported save predates it.
        imported.checkAchievements(ACHIEVEMENT_CATALOG);
        setEngine(imported); // swaps the whole engine — effects re-subscribe automatically
        saveGame(imported); // persist immediately so a refresh doesn't lose the import
      } catch (err) {
        engine.notifications.push(
          "error",
          `Couldn't import that save file: ${(err as Error).message}`,
          { severity: "error" }
        );
      }
    },

    resetAll: () => {
      engine.resetAll();
      registerStartingContent(engine); // resetAll() wipes back to createInitialState(),
      // which has no producers — reinstate the starting catalog immediately
      // rather than leaving the player with literally nothing to click.
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

  return { engine, state, notifications, autosaveMs, actions };
}