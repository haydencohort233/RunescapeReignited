import type { GameEngine } from "./gameEngine";
import type { CraftingRecipe, MapLocation } from "./types";
import { describeAction } from "./activeAction";

/**
 * Only one action (crafting, gathering, traveling, or fighting) can run at
 * a time. These wrap the engine's start* methods with a confirmation prompt
 * when something else is already in progress, so a misclick doesn't
 * silently discard progress — instead it asks "stop X, start Y instead?"
 * and only proceeds if confirmed. Shared here rather than duplicated per
 * call site (Home's crafting section, AmenityEntry's resource nodes,
 * MapView's travel button all route through this).
 *
 * Uses window.confirm — deliberately simple for now. Swap the body for a
 * custom modal later without touching any call site, since they all just
 * call these functions.
 */

/** Returns true if it's safe to proceed (nothing was active, or the player
 *  confirmed stopping it and it actually stopped — a boss fight can refuse).
 *  Returns false otherwise. */
function confirmStopCurrentAction(engine: GameEngine, whatComesNext: string): boolean {
  const active = engine.getState().activeAction;
  if (!active) return true;
  const proceed = window.confirm(`Do you want to stop ${describeAction(active)}? This will start ${whatComesNext} instead.`);
  if (!proceed) return false;
  return engine.stopActiveAction();
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

export function confirmAndStartTravel(engine: GameEngine, from: MapLocation, to: MapLocation): boolean {
  if (!confirmStopCurrentAction(engine, `traveling to ${to.name}`)) return false;
  return engine.startTravel(from, to);
}
