import type { GameEngine } from "./gameEngine";
import type { ActiveAction, CraftingRecipe, EnemyDefinition, MapLocation } from "./types";
import { formatDuration, formatNumber } from "./format";
import { requestSwitch, type ActivityPreview } from "../lib/dialog";

/**
 * Only one action (crafting, gathering, traveling, or fighting) can run at
 * a time. These wrap the engine's start* methods with a "switch activity?"
 * prompt when something else is already in progress, so a misclick doesn't
 * silently discard progress — it shows what's running and what would
 * replace it, and only proceeds if confirmed. Shared here rather than
 * duplicated per call site (Home's crafting section, AmenityEntry's
 * resource nodes, MapView's travel button all route through this).
 *
 * Asks with an in-page dialog (lib/dialog.ts) rather than window.confirm,
 * which some embedded hosts block outright.
 */

/** What's running now, with how far along it is. */
function previewActive(action: ActiveAction, now: number): ActivityPreview {
  const elapsed = "startedAt" in action ? Math.max(0, now - action.startedAt) : 0;
  switch (action.kind) {
    case "craft":
      return {
        kind: "craft",
        skill: action.skill,
        title: action.recipeName,
        detail: `${formatNumber(action.quantityCompleted)} of ${formatNumber(action.quantityTotal)} done`,
      };
    case "gather":
      return {
        kind: "gather",
        skill: action.skill,
        title: action.recipeName,
        detail: `${formatNumber(action.quantityGathered)} gathered · ${formatDuration(elapsed)} in`,
      };
    case "travel":
      return {
        kind: "travel",
        title: action.destinationName,
        detail: `${Math.min(99, Math.floor((elapsed / action.durationMs) * 100))}% of the way`,
      };
    case "combat":
      return {
        kind: "combat",
        title: action.enemyName,
        detail: `Enemy at ${formatNumber(action.enemyCurrentHp)}/${formatNumber(action.enemyMaxHp)} HP`,
      };
  }
}

/** Returns true if it's safe to proceed (nothing was active, or the player
 *  confirmed stopping it and it actually stopped — a boss fight can refuse).
 *  Returns false otherwise. */
async function confirmStopCurrentAction(engine: GameEngine, next: ActivityPreview): Promise<boolean> {
  const active = engine.getState().activeAction;
  if (!active) return true;
  if (!(await requestSwitch(previewActive(active, engine.now()), next))) return false;
  return engine.stopActiveAction();
}

export async function confirmAndStartCraftJob(engine: GameEngine, recipe: CraftingRecipe, quantity: number): Promise<boolean> {
  const next: ActivityPreview = { kind: "craft", skill: recipe.skill, title: recipe.name, detail: `${formatNumber(quantity)} to make` };
  if (!(await confirmStopCurrentAction(engine, next))) return false;
  return engine.startCraftJob(recipe, quantity);
}

export async function confirmAndStartGatherSession(
  engine: GameEngine,
  amenityId: string,
  recipe: CraftingRecipe,
  opts?: { maxDurationMs?: number; requiresKeepAliveEveryMs?: number }
): Promise<boolean> {
  const next: ActivityPreview = { kind: "gather", skill: recipe.skill, title: recipe.name, detail: "Runs until you stop it" };
  if (!(await confirmStopCurrentAction(engine, next))) return false;
  return engine.startGatherSession(amenityId, recipe, opts);
}

export async function confirmAndStartTravel(engine: GameEngine, from: MapLocation, to: MapLocation): Promise<boolean> {
  const toll = engine.getTravelToll(to);
  const tollText = toll.length > 0 ? `, toll ${toll.map((c) => `${formatNumber(c.amount)} ${c.resource === "gp" ? "GP" : c.resource}`).join(", ")}` : "";
  const next: ActivityPreview = { kind: "travel", title: to.name, detail: `About ${formatDuration(engine.getTravelDurationEstimate(from, to))}${tollText}` };
  if (!(await confirmStopCurrentAction(engine, next))) return false;
  return engine.startTravel(from, to);
}

export async function confirmAndStartCombat(
  engine: GameEngine,
  enemy: EnemyDefinition,
  equipmentBonus: Parameters<GameEngine["startCombat"]>[1],
  opts?: Parameters<GameEngine["startCombat"]>[2]
): Promise<boolean> {
  if (!(await confirmStopCurrentAction(engine, { kind: "combat", title: enemy.name }))) return false;
  return engine.startCombat(enemy, equipmentBonus, opts);
}
