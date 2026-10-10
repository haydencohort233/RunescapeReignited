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

const TABS: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "map", label: "Map" },
  { id: "quests", label: "Quests" },
  { id: "buildings", label: "Buildings" },
  { id: "skills", label: "Skills" },
  { id: "inventory", label: "Inventory" },
  { id: "equipment", label: "Equipment" },
  { id: "statistics", label: "Statistics" },
  { id: "achievements", label: "Achievements" },
  { id: "settings", label: "Settings" },
];

interface NavBarProps {
  activeView: View;
  onChange: (view: View) => void;
  /** Tabs to show a pulsing "something's waiting here" indicator on — e.g.
   *  an earned-but-unclaimed achievement. Generic by design: any tab can
   *  opt into this by passing alerts={{ someTab: true }} from App.tsx,
   *  not just Achievements. */
  alerts?: Partial<Record<View, boolean>>;
}

/** Persists across every view — only the content below it swaps out. */
export default function NavBar({ activeView, onChange, alerts }: NavBarProps) {
  return (
    <nav className="tabs" aria-label="Game sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab${alerts?.[tab.id] ? " has-alert" : ""}`}
          aria-current={activeView === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
