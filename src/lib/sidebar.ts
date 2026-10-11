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

export function applySidebarOpen(open: boolean): void {
  document.documentElement.dataset.sidebar = open ? "open" : "collapsed";
  try {
    if (open) window.localStorage.removeItem(SIDEBAR_KEY);
    else window.localStorage.setItem(SIDEBAR_KEY, "collapsed");
  } catch {
    // Not remembered, but still applied for this session.
  }
}
