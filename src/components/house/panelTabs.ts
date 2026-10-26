// The house's panels (decided Oct 25): Build, Storage, Scenery, Houses and
// Servant. HousePanels.tsx draws them; HouseView.tsx places them.

export type PanelTab = "build" | "storage" | "scenery" | "houses" | "servant";

export const PANEL_TABS: { id: PanelTab; label: string; icon: string }[] = [
  { id: "build", label: "Build", icon: "🔨" },
  { id: "storage", label: "Storage", icon: "📦" },
  { id: "scenery", label: "Scenery", icon: "🎨" },
  { id: "houses", label: "Houses", icon: "🏘️" },
  { id: "servant", label: "Servant", icon: "🛎️" },
];

/** What the yard painter puts down: a path style, or the eraser. */
export type PaintTool = { kind: "path"; pathId: string } | { kind: "erase" } | null;
