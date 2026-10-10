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
import { ACHIEVEMENT_CATALOG } from "./content/achivements";
import { preloadImages } from "./lib/imagePreloader";
import {
  HP_BAR_BACKGROUND,
  HP_BAR_FILL,
  HP_BAR_POISONED_FILL,
  hitsplatIconPath,
} from "./content/assetPaths";

/** Lives inside GameEngineProvider so it can read engine state — App itself
 *  can't, since it's the component that mounts the provider. */
function AppContent() {
  const [activeView, setActiveView] = useState<View>("home");
  const { engine, suspended } = useGame();

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
    <div className="app">
      <h1 className="app-title">Idle Engine</h1>
      <NavBar
        activeView={activeView}
        onChange={setActiveView}
        alerts={{ achievements: hasUnclaimedAchievement }}
      />
      {activeView === "home" && <HomeView />}
      {activeView === "map" && <MapView />}
      {activeView === "quests" && <QuestsPanel />}
      {activeView === "buildings" && <BuildingsPanel />}
      {activeView === "skills" && <SkillsPanel />}
      {activeView === "inventory" && <InventoryPanel />}
      {activeView === "equipment" && <EquipmentPanel />}
      {activeView === "statistics" && <StatisticsPanel />}
      {activeView === "achievements" && <AchievementsPanel />}
      {activeView === "settings" && <SettingsPanel />}
    </div>
  );
}

export default function App() {
  return (
    <GameEngineProvider>
      <NotificationOverlay />
      <AppContent />
    </GameEngineProvider>
  );
}