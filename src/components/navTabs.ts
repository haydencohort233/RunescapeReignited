// The game's tabs, shared by the desktop nav and the phone's bottom bar.

export type View =
  | "home"
  | "map"
  | "quests"
  | "buildings"
  | "skills"
  | "inventory"
  | "equipment"
  | "statistics"
  | "achievements"
  | "settings";

/** Every tab. `icon` is used where space is short (the phone's bottom
 *  bar and the drawer header); `mobile` says which tabs the bottom bar
 *  holds. The rest live in the drawer's header on phones. */
export const TABS: { id: View; label: string; icon: string; mobile?: boolean }[] = [
  { id: "home", label: "Home", icon: "🏠", mobile: true },
  { id: "map", label: "Map", icon: "🗺️", mobile: true },
  { id: "quests", label: "Quests", icon: "📜", mobile: true },
  { id: "buildings", label: "Buildings", icon: "🏗️", mobile: true },
  { id: "skills", label: "Skills", icon: "📈", mobile: true },
  { id: "inventory", label: "Inventory", icon: "🎒", mobile: true },
  { id: "equipment", label: "Equipment", icon: "⚔️", mobile: true },
  { id: "statistics", label: "Statistics", icon: "📊" },
  { id: "achievements", label: "Achievements", icon: "🏆" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];
