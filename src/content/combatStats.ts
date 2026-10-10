import type { GameState } from "../engine/types";
import { getItemDef } from "./items";

/** Sums attack/strength/defence stats across everything currently
 *  equipped — this is what a caller passes into engine.startCombat()'s
 *  equipmentBonus parameter. */
export function getEquipmentBonuses(state: GameState): {
  attack: number;
  strength: number;
  defence: number;
} {
  let attack = 0;
  let strength = 0;
  let defence = 0;
  for (const instanceId of Object.values(state.equipment)) {
    if (!instanceId) continue;
    const instance = state.inventory[instanceId];
    if (!instance) continue;
    const def = getItemDef(instance.itemDefId);
    if (!def?.stats) continue;
    attack += def.stats.attack ?? 0;
    strength += def.stats.strength ?? 0;
    defence += def.stats.defence ?? 0;
  }
  return { attack, strength, defence };
}