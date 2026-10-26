// Whether the right-hand player sidebar is open. A per-browser display
// preference like the theme, so it lives in localStorage, not the save.
// Mirrored onto <html> as data-sidebar so things outside the app shell
// (the toast overlay) can make room for it in CSS.

const SIDEBAR_KEY = "idlegame:sidebar";

export function getSidebarOpen(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) !== "collapsed";
  } catch {
    return true;
  }
}

/** Remembers the player's usual setting. What's showing right now (the
 *  house may hide it) is mirrored onto <html data-sidebar> by App. */
export function applySidebarOpen(open: boolean): void {
  try {
    if (open) window.localStorage.removeItem(SIDEBAR_KEY);
    else window.localStorage.setItem(SIDEBAR_KEY, "collapsed");
  } catch {
    // Not remembered, but still applied for this session.
  }
}

// The house screen hides the sidebar on wide screens while it's open
// (decided Oct 26); the player can still open it. Leaving the house goes
// back to their usual setting.
const houseListeners = new Set<(open: boolean) => void>();
let houseOpen = false;

export function setHouseScreenOpen(open: boolean): void {
  if (open === houseOpen) return;
  houseOpen = open;
  houseListeners.forEach((l) => l(open));
}

export function subscribeHouseScreen(listener: (open: boolean) => void): () => void {
  houseListeners.add(listener);
  return () => houseListeners.delete(listener);
}

export function isHouseScreenOpen(): boolean {
  return houseOpen;
}
