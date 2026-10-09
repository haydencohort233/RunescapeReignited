import { useEffect, useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import type { Amenity } from "../content/amenities";
import { getShopAtLocation } from "../content/shops";
import { getJobBoardAtLocation } from "../content/jobBoards";
import { getMsUntilNextDailyReset, formatCountdown } from "../engine/time";
import { getRecipe } from "../content/recipes";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { confirmAndStartCraftJob, confirmAndStartGatherSession } from "../engine/actionHelpers";
import ShopNpcEntry from "./ShopNpcEntry";
import ShopBrowsePanel from "./ShopBrowsePanel";
import JobBoardBrowsePanel from "./JobBoardBrowsePanel";
import CombatPanel from "./CombatPanel";

export const AMENITY_ICON: Record<Amenity["kind"], string> = {
  shop: "🛒",
  resourceNode: "🌾",
  craftingStation: "🔥",
  dungeonEntrance: "🕳️",
  jobBoard: "📋",
  combatEncounter: "⚔️",
};

/** Renders one amenity at the CURRENT location, fully interactive.
 *  Dispatches on `kind` — each variant gets whatever interaction makes
 *  sense for it (shop -> Talk/Browse, resourceNode -> batch pick or an
 *  open-ended session depending on gatherMode, the still-unbuilt kinds ->
 *  a placeholder action). Adding a new kind later means adding one more
 *  case here, not restructuring this file. */
export default function AmenityEntry({ amenity }: { amenity: Amenity }) {
  const { engine, state } = useGame();
  const [browsingShop, setBrowsingShop] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickMenuPos, setQuickMenuPos] = useState<{ x: number; y: number } | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!quickMenuPos) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setQuickMenuPos(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [quickMenuPos]);

  // Live countdowns (session time remaining, keep-alive window) need a
  // per-second re-render independent of the engine's own tick, same
  // reasoning as MapView's travel countdown.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const locked = !!amenity.unlockCondition && !!describeUnmetCondition(amenity.unlockCondition, state);
  if (locked) {
    return (
      <div style={{ border: "1px dashed #ccc", borderRadius: 6, padding: 8, color: "#888" }}>
        {AMENITY_ICON[amenity.kind]} {amenity.name} (Locked)
        <div style={{ fontSize: 12 }}>
          {amenity.unlockCondition && describeUnmetCondition(amenity.unlockCondition, state)}
        </div>
      </div>
    );
  }

  // Shops reuse the existing Map-tab components wholesale — same
  // interaction, just surfaced here too since this is where players spend
  // most of their time.
  if (amenity.kind === "shop") {
    const shop = getShopAtLocation(amenity.locationId);
    if (!shop) return null;
    return browsingShop ? (
      <ShopBrowsePanel shop={shop} onClose={() => setBrowsingShop(false)} />
    ) : (
      <ShopNpcEntry shop={shop} onBrowse={() => setBrowsingShop(true)} />
    );
  }

  // Job boards: a single click toggles the browse panel directly — no
  // Talk/Browse split like shops, since a bulletin board isn't an NPC with
  // something to say.
  if (amenity.kind === "jobBoard") {
    const board = getJobBoardAtLocation(amenity.locationId);
    if (!board) return null;
    return panelOpen ? (
      <JobBoardBrowsePanel board={board} onClose={() => setPanelOpen(false)} />
    ) : (
      <div
        onClick={() => setPanelOpen(true)}
        style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8, cursor: "pointer" }}
      >
        {AMENITY_ICON[amenity.kind]} {amenity.name}
        <div style={{ fontSize: 12, color: "#666" }}>
          Resets in {formatCountdown(getMsUntilNextDailyReset(Date.now()))}
        </div>
      </div>
    );
  }

  if (amenity.kind === "combatEncounter") {
    return <CombatPanel enemyId={amenity.enemyId} />;
  }

  const placeholderAction = () => {
    const message =
      amenity.kind === "dungeonEntrance"
        ? "Dungeons aren't implemented yet."
        : "Nothing usable here yet.";
    engine.notifications.push("status", message, { severity: "warning" });
    setPanelOpen(false);
    setQuickMenuPos(null);
  };

  if (amenity.kind === "craftingStation" || amenity.kind === "dungeonEntrance") {
    return (
      <div>
        <div
          onClick={() => setPanelOpen((open) => !open)}
          style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8, cursor: "pointer" }}
        >
          {AMENITY_ICON[amenity.kind]} {amenity.name}
        </div>
        {panelOpen && (
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 4px" }}>{amenity.description}</p>
            <button onClick={placeholderAction}>{amenity.kind === "dungeonEntrance" ? "Enter" : "Use"}</button>
          </div>
        )}
      </div>
    );
  }

  // From here down: amenity.kind === "resourceNode"
  const recipe = getRecipe(amenity.recipeId);
  if (!recipe) return null;

  // The RECIPE can also gate things (e.g. Woodcutting 30 for Willow) —
  // separate from the amenity's own unlockCondition checked above, since a
  // location/amenity being open doesn't mean every recipe available there
  // is too.
  if (recipe.unlockCondition) {
    const recipeLockReason = describeUnmetCondition(recipe.unlockCondition, state);
    if (recipeLockReason) {
      return (
        <div style={{ border: "1px dashed #ccc", borderRadius: 6, padding: 8, color: "#888" }}>
          {AMENITY_ICON[amenity.kind]} {amenity.name} (Locked)
          <div style={{ fontSize: 12 }}>{recipeLockReason}</div>
        </div>
      );
    }
  }

  const session = state.activeGatherSession;
  const thisNodeIsActive = session?.amenityId === amenity.id;

  if (amenity.gatherMode === "batch") {
    const gather = (quantity: number) => confirmAndStartCraftJob(engine, recipe, quantity);
    const actions = (
      <>
        <button onClick={() => gather(1)} style={{ textAlign: "left" }}>
          {amenity.actionLabel} x1
        </button>
        <button onClick={() => gather(5)} style={{ textAlign: "left" }}>
          {amenity.actionLabel} x5
        </button>
        <button onClick={() => gather(25)} style={{ textAlign: "left" }}>
          {amenity.actionLabel} x25
        </button>
      </>
    );
    return (
      <div>
        <div
          onClick={() => {
            setQuickMenuPos(null);
            setPanelOpen((open) => !open);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setPanelOpen(false);
            setQuickMenuPos({ x: e.clientX, y: e.clientY });
          }}
          style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8, cursor: "pointer" }}
        >
          {AMENITY_ICON[amenity.kind]} {amenity.name}
        </div>
        {panelOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 4px" }}>{amenity.description}</p>
            {actions}
          </div>
        )}
        {quickMenuPos && (
          <div
            ref={quickMenuRef}
            style={{
              position: "fixed",
              left: quickMenuPos.x,
              top: quickMenuPos.y,
              background: "white",
              border: "1px solid #999",
              borderRadius: 4,
              padding: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {actions}
          </div>
        )}
      </div>
    );
  }

  // gatherMode === "session" — open-ended, Start/Stop/Tend.
  const maxDurationMs = amenity.maxDurationMs;
  const requiresKeepAliveEveryMs = amenity.requiresKeepAliveEveryMs;

  const start = () =>
    confirmAndStartGatherSession(engine, amenity.id, recipe, { maxDurationMs, requiresKeepAliveEveryMs });

  let statusLine: string | null = null;
  let keepAliveDueSoon = false;
  if (thisNodeIsActive && session) {
    const now = Date.now();
    const capEndsAt = session.startedAt + session.maxDurationMs;
    const remainingMs = Math.max(0, capEndsAt - now);
    statusLine = `Gathered ${session.quantityGathered.toLocaleString()} so far — session ends in ${Math.ceil(
      remainingMs / 60000
    )}m`;
    if (session.requiresKeepAliveEveryMs !== undefined && session.lastKeepAliveAt !== undefined) {
      const keepAliveRemainingMs = Math.max(
        0,
        session.lastKeepAliveAt + session.requiresKeepAliveEveryMs - now
      );
      keepAliveDueSoon = keepAliveRemainingMs < 15 * 60 * 1000; // under 15 min left
      statusLine += ` — needs attention in ${Math.ceil(keepAliveRemainingMs / 60000)}m`;
    }
  }

  return (
    <div>
      <div
        onClick={() => setPanelOpen((open) => !open)}
        style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8, cursor: "pointer" }}
      >
        {AMENITY_ICON[amenity.kind]} {amenity.name}
        {thisNodeIsActive && " (gathering...)"}
      </div>

      {statusLine && (
        <p style={{ fontSize: 12, color: keepAliveDueSoon ? "#b91c1c" : "#666", margin: "2px 0 0" }}>
          {statusLine}
        </p>
      )}

      {panelOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: "#666", margin: "0 0 2px" }}>{amenity.description}</p>
          {thisNodeIsActive ? (
            <>
              {requiresKeepAliveEveryMs !== undefined && (
                <button onClick={() => engine.keepGatherSessionAlive()} style={{ textAlign: "left" }}>
                  Tend to it
                </button>
              )}
              <button onClick={() => engine.stopGatherSession()} style={{ textAlign: "left" }}>
                Stop
              </button>
            </>
          ) : (
            <button onClick={start} disabled={!!session} style={{ textAlign: "left" }}>
              {amenity.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}