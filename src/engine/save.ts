import { GameEngine } from "./gameEngine";
import { NotificationQueue } from "./notificationQueue";
import type { GameContent } from "./types";

const SAVE_KEY = "idlegame:save";

export function saveGame(engine: GameEngine): boolean {
  try {
    const json = engine.serialize();
    window.localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch (err) {
    engine.notifications.push("error", "Couldn't save your game — check your device storage.", {
      severity: "error",
    });
    engine.notifications.push("debug", `Save failed: ${(err as Error).message}`, {
      severity: "error",
      devOnly: true,
    });
    return false;
  }
}

export function loadGame(content: GameContent, notifications?: NotificationQueue): GameEngine | null {
  let json: string | null = null;
  try {
    json = window.localStorage.getItem(SAVE_KEY);
    if (!json) return null;
    return GameEngine.deserialize(json, content, { notifications });
  } catch (err) {
    // Keep the unreadable save under a separate key before the fresh game's
    // first autosave overwrites it, so it can still be recovered by hand.
    const backupKey = `${SAVE_KEY}:corrupt:${Date.now()}`;
    let backedUp = false;
    if (json) {
      try {
        window.localStorage.setItem(backupKey, json);
        backedUp = true;
      } catch {
        // Storage full — nothing more we can do here.
      }
    }
    if (notifications) {
      notifications.push(
        "error",
        backedUp
          ? `Your save couldn't be read, so a fresh game started. The old save was kept in browser storage as "${backupKey}".`
          : "Your save couldn't be read, so a fresh game started.",
        { severity: "error" }
      );
      notifications.push("debug", `Load failed: ${(err as Error).message}`, {
        severity: "error",
        devOnly: true,
      });
    }
    return null;
  }
}

export function deleteSave(): void {
  window.localStorage.removeItem(SAVE_KEY);
}

/** Debounced auto-save — call on every state change; actual writes are throttled.
 *  Returns a stop function AND lets you retune the interval without tearing
 *  down/rebuilding the whole subscription (used by the settings panel). */
export function createAutoSaver(engine: GameEngine, intervalMs = 10_000) {
  let id = window.setInterval(() => saveGame(engine), intervalMs);

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") saveGame(engine);
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  // pagehide fires where beforeunload doesn't (mobile browsers, bfcache).
  const onBeforeUnload = () => saveGame(engine);
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("pagehide", onBeforeUnload);

  return {
    setIntervalMs(newIntervalMs: number) {
      window.clearInterval(id);
      id = window.setInterval(() => saveGame(engine), newIntervalMs);
    },
    stop() {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
    },
  };
}

// ── Export / import — a save is just the engine's serialized JSON, with a
// tiny wrapper so a corrupted/foreign file fails fast with a clear message
// instead of silently loading garbage. ──────────────────────────────────

interface SaveFile {
  exportedAt: number;
  data: string; // engine.serialize() output
}

/** The exported save as text — a download where the host allows it, and
 *  copy/paste everywhere (some embedded hosts block downloads). */
export function exportSaveText(engine: GameEngine): string {
  const payload: SaveFile = { exportedAt: Date.now(), data: engine.serialize() };
  return JSON.stringify(payload);
}

/**
 * Parses an imported save file's text content. Returns a new GameEngine on
 * success. Throws on malformed input — caller should catch and surface a
 * notification (kept as a throw here, not a notification push, since this
 * runs before we necessarily have an engine instance to attach a queue to).
 */
export function importSaveFromFileText(
  text: string,
  content: GameContent,
  notifications?: NotificationQueue
): GameEngine {
  let payload: SaveFile;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!payload || typeof payload.data !== "string") {
    throw new Error("That file doesn't look like a save from this game.");
  }
  // This will throw its own error if payload.data itself isn't valid GameState JSON.
  return GameEngine.deserialize(payload.data, content, { notifications });
}