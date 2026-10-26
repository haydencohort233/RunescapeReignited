import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngineProvider } from "./engine/GameEngineContext";
import { useGame } from "./engine/GameEngineContext";
import NavBar, { BottomNav, type View } from "./components/NavBar";
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
import PlayerSidebar, { PlayerDrawer, PlayerStrip } from "./components/PlayerSidebar";
import { CompactActionBar } from "./components/ActivityCard";
import { applySidebarOpen, getSidebarOpen, isHouseScreenOpen, subscribeHouseScreen } from "./lib/sidebar";
import { useTabTitle } from "./lib/useTabTitle";
import { DialogHost } from "./components/ui/DialogHost";
import { QuestCompleteWatcher } from "./components/QuestCompleteWatcher";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { engine, state, suspended } = useGame();

  useEffect(() => applySidebarOpen(sidebarOpen), [sidebarOpen]);
  // In the house the sidebar starts hidden (the toggle still opens it);
  // leaving the house returns to the usual setting.
  const [inHouse, setInHouse] = useState(isHouseScreenOpen);
  const [houseSidebar, setHouseSidebar] = useState(false);
  useEffect(
    () =>
      subscribeHouseScreen((open) => {
        setInHouse(open);
        setHouseSidebar(false);
      }),
    []
  );
  const showSidebar = inHouse ? houseSidebar : sidebarOpen;
  useEffect(() => {
    document.documentElement.dataset.sidebar = showSidebar ? "open" : "collapsed";
  }, [showSidebar]);
  useTabTitle(engine, state.activeAction);

  const changeView = useCallback((view: View) => {
    setFocusSkillId(undefined);
    setActiveView(view);
    window.scrollTo({ top: 0 });
  }, []);
  // Combat skills open the combat hub (Equipment), as in Melvor.
  const openSkill = (skillId: string) => {
    if (COMBAT_SKILLS.has(skillId)) {
      changeView("equipment");
      return;
    }
    setFocusSkillId(skillId);
    setActiveView("skills");
  };
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Starting a fight (or a dungeon wave after the regear stop) switches to
  // the Equipment tab, where the fight is. Not on load: a save reopened
  // mid-fight stays wherever the player was.
  const fighting = state.activeAction?.kind === "combat";
  const wasFighting = useRef(fighting);
  useEffect(() => {
    if (fighting && !wasFighting.current) changeView("equipment");
    wasFighting.current = fighting;
  }, [fighting, changeView]);

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
    <div className={`shell${showSidebar ? "" : " is-sidebar-collapsed"}`}>
      <aside className="shell-nav">
        <div className="shell-brand">
          <h1 className="app-title">Idle Engine</h1>
          <span className="text-faint text-small">v{__APP_VERSION__}</span>
        </div>
        <NavBar activeView={activeView} onChange={changeView} alerts={{ achievements: hasUnclaimedAchievement }} />
      </aside>

      <main className={`shell-main${activeView === "map" ? " is-map" : ""}`}>
        <div className="shell-top">
          <PlayerStrip
            onOpen={() => {
              // Wide screens have the sidebar for this; phones get the drawer.
              if (window.matchMedia("(min-width: 1024px)").matches) {
                if (inHouse) setHouseSidebar(true);
                else setSidebarOpen(true);
              }
              else setDrawerOpen(true);
            }}
            alert={hasUnclaimedAchievement}
          />
          <CompactActionBar onOpenFight={() => changeView("equipment")} />
        </div>
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
          aria-expanded={showSidebar}
          onClick={() => (inHouse ? setHouseSidebar((open) => !open) : setSidebarOpen((open) => !open))}
          title={showSidebar ? "Hide sidebar" : "Show sidebar"}
        >
          {showSidebar ? "Hide ›" : "‹"}
        </button>
        {showSidebar && <PlayerSidebar onOpenSkill={openSkill} />}
      </aside>

      <BottomNav activeView={activeView} onChange={changeView} />
      <PlayerDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        onOpenSkill={openSkill}
        onOpenView={changeView}
        alerts={{ achievements: hasUnclaimedAchievement }}
      />
    </div>
  );
}

export default function App() {
  return (
    <GameEngineProvider>
      <NotificationOverlay />
      <AppContent />
      <DialogHost />
      <QuestCompleteWatcher />
    </GameEngineProvider>
  );
}
