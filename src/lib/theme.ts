// The player's theme choice. Dark is the default; "system" follows the OS
// setting and "light" pins parchment. Either way data-theme is set on <html> to the theme
// actually in effect, so the CSS only needs one rule per palette. Stored
// per browser — it's a display preference, not game progress, so it
// doesn't belong in the save.

export type ThemeChoice = "system" | "light" | "dark";

const THEME_KEY = "idlegame:theme";
const darkQuery = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined;
let currentChoice: ThemeChoice = "dark";

export function getThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Storage blocked (private mode etc.), fall back to the default.
  }
  return "dark";
}

export function applyTheme(choice: ThemeChoice): void {
  currentChoice = choice;
  const resolved = choice === "system" ? (darkQuery?.matches ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = resolved;
}

export function setThemeChoice(choice: ThemeChoice): void {
  applyTheme(choice);
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Not persisted, but still applied for this session.
  }
}

/** Re-applies "Match system" when the OS theme changes mid-session. */
darkQuery?.addEventListener?.("change", () => {
  if (currentChoice === "system") applyTheme("system");
});
