import type { GameState, WeaponType } from "../engine/types";
import { getItemDef } from "./items";

/** Sums attack/strength/defence stats across everything currently
 *  equipped, plus the worn weapon's speed and stab/slash/crush type — this
 *  is what a caller passes into engine.startCombat()'s equipmentBonus
 *  parameter. Without the weapon fields every fight ran at unarmed speed. */
export function getEquipmentBonuses(state: GameState): {
  attack: number;
  strength: number;
  defence: number;
  attackSpeedMs?: number;
  weaponType?: WeaponType;
} {
  let attack = 0;
  let strength = 0;
  let defence = 0;
  let attackSpeedMs: number | undefined;
  let weaponType: WeaponType | undefined;
  for (const instanceId of Object.values(state.equipment)) {
    if (!instanceId) continue;
    const instance = state.inventory[instanceId];
    if (!instance) continue;
    const def = getItemDef(instance.itemDefId);
    if (!def) continue;
    if (def.equipSlot === "weapon") {
      attackSpeedMs = def.attackSpeedMs;
      weaponType = def.weaponType;
    }
    if (!def.stats) continue;
    attack += def.stats.attack ?? 0;
    strength += def.stats.strength ?? 0;
    defence += def.stats.defence ?? 0;
  }
  return { attack, strength, defence, attackSpeedMs, weaponType };
}