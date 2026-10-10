// The player's theme choice. "system" follows the OS setting; "light" and
// "dark" pin it. Either way data-theme is set on <html> to the theme
// actually in effect, so the CSS only needs one rule per palette. Stored
// per browser — it's a display preference, not game progress, so it
// doesn't belong in the save.

export type ThemeChoice = "system" | "light" | "dark";

const THEME_KEY = "idlegame:theme";
const darkQuery = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined;
let currentChoice: ThemeChoice = "system";

export function getThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage blocked (private mode etc.) — fall back to the system theme.
  }
  return "system";
}

export function applyTheme(choice: ThemeChoice): void {
  currentChoice = choice;
  const resolved = choice === "system" ? (darkQuery?.matches ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = resolved;
}

export function setThemeChoice(choice: ThemeChoice): void {
  applyTheme(choice);
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Not persisted, but still applied for this session.
  }
}

/** Re-applies "Match system" when the OS theme changes mid-session. */
darkQuery?.addEventListener?.("change", () => {
  if (currentChoice === "system") applyTheme("system");
});
