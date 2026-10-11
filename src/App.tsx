import { useEffect, useState } from "react";
import { GameEngineProvider } from "./engine/GameEngineContext";
import { useGame } from "./engine/GameEngineContext";
import NavBar, { type View } from "./components/NavBar";
import HomeView from "./components/HomeView";
import MapView from "./components/MapView";
import QuestsPanel from "./components/QuestsPanel";
import BuildingsPanel from "./components/BuildingsPanel";
import SkillsPanel from "./components/SkillsPanel";
import InventoryPanel from "./components/InventoryPanel";
import EquipmentPanel from "./components/EquipmentPanel";
import StatisticsPanel from "./components/StatisticsPanel";
import AchievementsPanel from "./components/AchievementsPanel";
import SettingsPanel from "./components/SettingsPanel";
import NotificationOverlay from "./components/NotificationOverlay";
import PlayerSidebar, { PlayerStrip } from "./components/PlayerSidebar";
import { applySidebarOpen, getSidebarOpen } from "./lib/sidebar";
import { DialogHost } from "./components/ui/DialogHost";
import { ACHIEVEMENT_CATALOG } from "./content/achivements";
import { preloadImages } from "./lib/imagePreloader";
import {
  HP_BAR_BACKGROUND,
  HP_BAR_FILL,
  HP_BAR_POISONED_FILL,
  hitsplatIconPath,
} from "./content/assetPaths";

const COMBAT_SKILLS = new Set(["attack", "strength", "defence", "ranged", "magic"]);

/** Lives inside GameEngineProvider so it can read engine state — App itself
 *  can't, since it's the component that mounts the provider. */
function AppContent() {
  const [activeView, setActiveView] = useState<View>("home");
  const [focusSkillId, setFocusSkillId] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(getSidebarOpen);
  const { engine, suspended } = useGame();

  useEffect(() => applySidebarOpen(sidebarOpen), [sidebarOpen]);

  const changeView = (view: View) => {
    setFocusSkillId(undefined);
    setActiveView(view);
  };
  // Combat skills open the combat hub (Equipment), as in Melvor.
  const openSkill = (skillId: string) => {
    if (COMBAT_SKILLS.has(skillId)) {
      changeView("equipment");
      return;
    }
    setFocusSkillId(skillId);
    setActiveView("skills");
  };

  // Shared UI chrome (HP bar layers, hitsplat icons) is needed the moment
  // combat starts, so request it at app startup rather than mid-fight.
  useEffect(() => {
    void preloadImages([
      HP_BAR_BACKGROUND,
      HP_BAR_FILL,
      HP_BAR_POISONED_FILL,
      hitsplatIconPath("hit"),
      hitsplatIconPath("block"),
      hitsplatIconPath("miss"),
    ]);
  }, []);

  const hasUnclaimedAchievement = ACHIEVEMENT_CATALOG.some(
    (a) => engine.isAchievementEarned(a.id) && !engine.isAchievementClaimed(a.id)
  );

  if (suspended) {
    return (
      <div className="app">
        <h1 className="app-title">Idle Engine</h1>
        <div className="card">
          <p>The game was opened in another tab, so this one has paused to keep your progress from being overwritten.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Play here instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`shell${sidebarOpen ? "" : " is-sidebar-collapsed"}`}>
      <aside className="shell-nav">
        <div className="shell-brand">
          <h1 className="app-title">Idle Engine</h1>
          <span className="text-faint text-small">v{__APP_VERSION__}</span>
        </div>
        <NavBar activeView={activeView} onChange={changeView} alerts={{ achievements: hasUnclaimedAchievement }} />
      </aside>

      <main className="shell-main">
        <PlayerStrip />
        {activeView === "home" && <HomeView />}
        {activeView === "map" && <MapView />}
        {activeView === "quests" && <QuestsPanel />}
        {activeView === "buildings" && <BuildingsPanel />}
        {activeView === "skills" && <SkillsPanel selectedSkillId={focusSkillId} onSelectSkill={setFocusSkillId} />}
        {activeView === "inventory" && <InventoryPanel onOpenSkill={openSkill} />}
        {activeView === "equipment" && <EquipmentPanel />}
        {activeView === "statistics" && <StatisticsPanel />}
        {activeView === "achievements" && <AchievementsPanel />}
        {activeView === "settings" && <SettingsPanel />}
      </main>

      <aside className="shell-side" aria-label="Player">
        <button
          type="button"
          className="sidebar-toggle btn btn-ghost"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((open) => !open)}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? "Hide ›" : "‹"}
        </button>
        {sidebarOpen && <PlayerSidebar onOpenSkill={openSkill} />}
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <GameEngineProvider>
      <NotificationOverlay />
      <AppContent />
      <DialogHost />
    </GameEngineProvider>
  );
}