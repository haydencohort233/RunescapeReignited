import { TABS, type View } from "./navTabs";
export type { View };

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

/** Phones: the main tabs as a bar along the bottom of the screen. */
export function BottomNav({ activeView, onChange }: Pick<NavBarProps, "activeView" | "onChange">) {
  return (
    <nav className="bottom-nav" aria-label="Game sections">
      {TABS.filter((t) => t.mobile).map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="bottom-tab"
          aria-current={activeView === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          <span className="bottom-tab-icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="bottom-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
