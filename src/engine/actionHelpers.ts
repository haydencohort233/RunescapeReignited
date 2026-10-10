import type { GameEngine } from "./gameEngine";
import type { CraftingRecipe, EnemyDefinition, MapLocation } from "./types";
import { describeAction } from "./activeAction";
import { requestConfirm } from "../lib/dialog";

/**
 * Only one action (crafting, gathering, traveling, or fighting) can run at
 * a time. These wrap the engine's start* methods with a confirmation prompt
 * when something else is already in progress, so a misclick doesn't
 * silently discard progress — instead it asks "stop X, start Y instead?"
 * and only proceeds if confirmed. Shared here rather than duplicated per
 * call site (Home's crafting section, AmenityEntry's resource nodes,
 * MapView's travel button all route through this).
 *
 * Asks with an in-page dialog (lib/dialog.ts) rather than window.confirm,
 * which some embedded hosts block outright.
 */

/** Returns true if it's safe to proceed (nothing was active, or the player
 *  confirmed stopping it and it actually stopped — a boss fight can refuse).
 *  Returns false otherwise. */
async function confirmStopCurrentAction(engine: GameEngine, whatComesNext: string): Promise<boolean> {
  const active = engine.getState().activeAction;
  if (!active) return true;
  const proceed = await requestConfirm(
    `Stop ${describeAction(active)}? This will start ${whatComesNext} instead.`,
    { confirmLabel: "Switch" }
  );
  if (!proceed) return false;
  return engine.stopActiveAction();
}

export async function confirmAndStartCraftJob(engine: GameEngine, recipe: CraftingRecipe, quantity: number): Promise<boolean> {
  if (!(await confirmStopCurrentAction(engine, recipe.name))) return false;
  return engine.startCraftJob(recipe, quantity);
}

export async function confirmAndStartGatherSession(
  engine: GameEngine,
  amenityId: string,
  recipe: CraftingRecipe,
  opts?: { maxDurationMs?: number; requiresKeepAliveEveryMs?: number }
): Promise<boolean> {
  if (!(await confirmStopCurrentAction(engine, recipe.name))) return false;
  return engine.startGatherSession(amenityId, recipe, opts);
}

export async function confirmAndStartTravel(engine: GameEngine, from: MapLocation, to: MapLocation): Promise<boolean> {
  if (!(await confirmStopCurrentAction(engine, `traveling to ${to.name}`))) return false;
  return engine.startTravel(from, to);
}

export async function confirmAndStartCombat(
  engine: GameEngine,
  enemy: EnemyDefinition,
  equipmentBonus: Parameters<GameEngine["startCombat"]>[1],
  opts?: Parameters<GameEngine["startCombat"]>[2]
): Promise<boolean> {
  if (!(await confirmStopCurrentAction(engine, `fighting ${enemy.name}`))) return false;
  return engine.startCombat(enemy, equipmentBonus, opts);
}
