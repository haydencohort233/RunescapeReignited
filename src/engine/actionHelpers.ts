import type { GameEngine } from "./gameEngine";
import type { CraftingRecipe, MapLocation } from "./types";

/**
 * Only one "action" (crafting, gathering, or traveling) can run at a time.
 * These wrap the engine's start* methods with a confirmation prompt when
 * something else is already in progress, so a misclick doesn't silently
 * discard progress — instead it asks "stop X, start Y instead?" and only
 * proceeds if confirmed. Shared here rather than duplicated per call site
 * (Home's Fletching section, AmenityEntry's resource nodes, MapView's
 * travel button all route through this).
 *
 * Uses window.confirm — deliberately simple for now. Swap the body for a
 * custom modal later without touching any call site, since they all just
 * call these functions.
 */

/** Whatever's currently occupying the player, if anything — crafting and
 *  gathering are mutually exclusive with each other and with travel, so
 *  there's at most one of these active at once. */
function getActiveAction(engine: GameEngine): { name: string; stop: () => void } | null {
  const state = engine.getState();
  if (state.activeCraftJob) {
    const job = state.activeCraftJob;
    return { name: job.recipeName, stop: () => engine.cancelCraftJob() };
  }
  if (state.activeGatherSession) {
    const session = state.activeGatherSession;
    return { name: session.recipeName, stop: () => engine.stopGatherSession() };
  }
  return null;
}

/** Returns true if it's safe to proceed (nothing was active, or the player
 *  confirmed stopping it). Returns false if the player declined. */
function confirmStopCurrentAction(engine: GameEngine, whatComesNext: string): boolean {
  const active = getActiveAction(engine);
  if (!active) return true;
  const proceed = window.confirm(`Do you want to stop ${active.name}? This will start ${whatComesNext} instead.`);
  if (!proceed) return false;
  active.stop();
  return true;
}

export function confirmAndStartCraftJob(engine: GameEngine, recipe: CraftingRecipe, quantity: number): boolean {
  if (!confirmStopCurrentAction(engine, recipe.name)) return false;
  return engine.startCraftJob(recipe, quantity);
}

export function confirmAndStartGatherSession(
  engine: GameEngine,
  amenityId: string,
  recipe: CraftingRecipe,
  opts?: { maxDurationMs?: number; requiresKeepAliveEveryMs?: number }
): boolean {
  if (!confirmStopCurrentAction(engine, recipe.name)) return false;
  return engine.startGatherSession(amenityId, recipe, opts);
}

/** Travel also stops the current action — same "one thing at a time" rule,
 *  and the engine itself refuses to start travel while crafting/gathering
 *  is active, so this confirm step is what actually lets travel proceed
 *  instead of just failing silently. */
export function confirmAndStartTravel(engine: GameEngine, from: MapLocation, to: MapLocation): boolean {
  if (!confirmStopCurrentAction(engine, `traveling to ${to.name}`)) return false;
  return engine.startTravel(from, to);
}