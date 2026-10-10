// The player's theme choice. "system" follows the OS setting via the
// prefers-color-scheme rules in index.css; "light"/"dark" pin it by setting
// data-theme on <html>. Stored per browser — it's a display preference, not
// game progress, so it doesn't belong in the save.

export type ThemeChoice = "system" | "light" | "dark";

const THEME_KEY = "idlegame:theme";

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
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
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
