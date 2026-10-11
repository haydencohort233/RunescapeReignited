import type { GameState } from "../engine/types";
import { getItemDef } from "./items";
import { computeEquipmentBonuses, type EquipmentBonuses } from "../engine/equipmentBonuses";

/** Sums every worn item's bonuses, plus the weapon's speed, type, attack
 *  style and special attack. What a caller passes into
 *  engine.startCombat()'s equipmentBonus parameter. */
export function getEquipmentBonuses(state: GameState): EquipmentBonuses {
  return computeEquipmentBonuses(state, getItemDef);
}
