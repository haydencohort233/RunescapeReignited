import type { GameState, ResourceId } from "./types";

/**
 * One ledger for everything the player owns, keyed by id:
 *   - Currencies and stackable items (gp, wood, bones, sharks) are a count
 *     in `state.resources`.
 *   - Non-stackable items (equipment) are individual instances in
 *     `state.inventory`, because each copy can be worn or carry durability.
 * Recipes, shops, jobs and loot all speak in plain { id, amount } and never
 * need to know which of the two an id lives in.
 */

/** How many of `id` the player owns and could hand over: the stacked count
 *  plus any instances that aren't currently worn. Equipped items never
 *  count, so a delivery or recipe can't consume the sword in your hand. */
export function countOwned(state: GameState, id: ResourceId): number {
  let count = state.resources[id]?.amount ?? 0;
  const worn = new Set(Object.values(state.equipment));
  for (const instance of Object.values(state.inventory)) {
    if (instance.itemDefId === id && !worn.has(instance.instanceId)) count++;
  }
  return count;
}
