export type View =
  | "home"
  | "map"
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
    <nav
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid #ccc",
        marginBottom: 16,
        paddingBottom: 8,
      }}
    >
      {/* Scoped keyframes — inline styles alone can't reference @keyframes,
          so this small stylesheet injection is the simplest way to get a
          pulse animation without adding a build-time CSS pipeline. */}
      <style>{`
        @keyframes navAlertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.6); }
          50% { box-shadow: 0 0 0 4px rgba(212, 175, 55, 0); }
        }
      `}</style>
      {TABS.map((tab) => {
        const hasAlert = alerts?.[tab.id];
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              fontWeight: activeView === tab.id ? "bold" : "normal",
              textDecoration: activeView === tab.id ? "underline" : "none",
              border: hasAlert ? "1px solid #d4af37" : undefined,
              borderRadius: hasAlert ? 4 : undefined,
              animation: hasAlert ? "navAlertPulse 1.5s infinite" : undefined,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}