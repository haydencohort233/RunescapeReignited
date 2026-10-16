import { createContext } from "react";

/** Set inside a modal that shows one thing (a building opened from the
 *  town scene): cards render as an always-open panel, with no header to
 *  collapse, since the modal's title already names it. */
export const CardPanelContext = createContext(false);
