// Display preferences: exact numbers, which toasts show, and the tab title
// alert. Per browser, like the theme (lib/theme.ts), so they live in
// localStorage, not the save.
import { useSyncExternalStore } from "react";
import { setExactNumbers } from "../engine/format";
import type { GameNotification, NotificationType } from "../engine/types";

/** The toast kinds a player can turn off. Errors, warnings and dev
 *  messages always show: they explain why something didn't work. */
export const TOGGLEABLE_NOTIFICATIONS: { type: NotificationType; label: string }[] = [
  { type: "status", label: "Status messages (equipped, started, stopped)" },
  { type: "production", label: "Crafting progress" },
  { type: "reward", label: "Loot and rewards" },
  { type: "quest", label: "Level ups and quests" },
  { type: "achievement", label: "Achievements" },
  { type: "offline-summary", label: "While you were away" },
];

export interface Preferences {
  exactNumbers: boolean;
  /** Master switch for toasts (warnings and errors still show). */
  notifications: boolean;
  /** Per type; missing means on. */
  hiddenTypes: NotificationType[];
  /** "❗" in the tab title for level ups and achievements while away. */
  titleAlert: boolean;
  /** Dev tool: drag things around the Home town scene and copy the new
   *  layout (see content/townScenes.ts). */
  sceneEditor: boolean;
  /** Player sidebar sections the player folded away ("skills", "resources"). */
  collapsedSections: string[];
}

const KEY = "idlegame:prefs";
const DEFAULTS: Preferences = {
  exactNumbers: false,
  notifications: true,
  hiddenTypes: [],
  titleAlert: true,
  sceneEditor: false,
  collapsedSections: [],
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((t: unknown) => typeof t === "string") : []);

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      exactNumbers: parsed.exactNumbers === true,
      notifications: parsed.notifications !== false,
      hiddenTypes: strings(parsed.hiddenTypes) as NotificationType[],
      titleAlert: parsed.titleAlert !== false,
      sceneEditor: parsed.sceneEditor === true,
      collapsedSections: strings(parsed.collapsedSections),
    };
  } catch {
    return DEFAULTS;
  }
}

let current: Preferences = typeof window === "undefined" ? DEFAULTS : load();
setExactNumbers(current.exactNumbers);
const listeners = new Set<() => void>();

export function getPreferences(): Preferences {
  return current;
}

export function setPreferences(patch: Partial<Preferences>): void {
  current = { ...current, ...patch };
  setExactNumbers(current.exactNumbers);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not remembered, but still applied for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences);
}

/** Whether a toast should show under these preferences. */
export function shouldShowToast(n: GameNotification, prefs: Preferences): boolean {
  if (n.severity === "error" || n.severity === "warning" || n.type === "error" || n.type === "debug") return true;
  if (!prefs.notifications) return false;
  return !prefs.hiddenTypes.includes(n.type);
}
