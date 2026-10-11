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

/** A positive whole number of units — what every buy/sell/craft quantity
 *  must be. Rejects NaN, Infinity, fractions and anything <= 0, which a
 *  UI bug or a cleared number input could otherwise pass through. */
export function isWholeQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

/** A worn stack (arrows) is recorded in its equipment slot as
 *  `stack:<itemDefId>`, where a non-stackable item records its instanceId.
 *  The whole stack counts as worn. */
const STACK_PREFIX = "stack:";

export function stackEquipId(itemDefId: string): string {
  return `${STACK_PREFIX}${itemDefId}`;
}

/** The item a slot's value refers to, whether a worn stack or an instance. */
export function wornItemDefId(state: GameState, equipValue: string): string | undefined {
  return equipValue.startsWith(STACK_PREFIX)
    ? equipValue.slice(STACK_PREFIX.length)
    : state.inventory[equipValue]?.itemDefId;
}

/** How many of `id` the player owns and could hand over: the stacked count
 *  plus any instances that aren't currently worn. Equipped items never
 *  count, so a delivery or recipe can't consume the sword in your hand, or
 *  the arrows in your quiver. */
export function countOwned(state: GameState, id: ResourceId): number {
  const worn = new Set(Object.values(state.equipment));
  let count = worn.has(stackEquipId(id)) ? 0 : (state.resources[id]?.amount ?? 0);
  for (const instance of Object.values(state.inventory)) {
    if (instance.itemDefId === id && !worn.has(instance.instanceId)) count++;
  }
  return count;
}
