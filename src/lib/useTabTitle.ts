import { useEffect, useState } from "react";
import type { GameEngine } from "../engine/gameEngine";
import type { ActiveAction } from "../engine/types";
import { activityLabel } from "../content/display";
import { usePreferences } from "./preferences";

const BASE_TITLE = "Idle Engine";

/** True while the player can't see the page: another tab, or another
 *  window in front of this one. */
function isAway(): boolean {
  return document.hidden || !document.hasFocus();
}

/** The browser tab's title: what you're doing ("Burning Oak Logs - Idle
 *  Engine"), and a ❗ in front when a level up, quest step or achievement
 *  arrived while you were away. Cleared when you come back. */
export function useTabTitle(engine: GameEngine, action: ActiveAction | null): void {
  const prefs = usePreferences();
  const [alert, setAlert] = useState(false);

  useEffect(() => {
    let seen = new Set(engine.notifications.getAll().map((n) => n.id));
    const unsubscribe = engine.notifications.subscribe((list) => {
      const fresh = list.filter((n) => !seen.has(n.id));
      seen = new Set(list.map((n) => n.id));
      if (fresh.some((n) => n.type === "achievement" || n.type === "quest") && isAway()) setAlert(true);
    });
    const clear = () => {
      if (!isAway()) setAlert(false);
    };
    window.addEventListener("focus", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [engine]);

  const label = action ? activityLabel(action) : null;
  const showAlert = alert && prefs.titleAlert;
  useEffect(() => {
    document.title = `${showAlert ? "❗ " : ""}${label ? `${label} - ` : ""}${BASE_TITLE}`;
  }, [label, showAlert]);
}
