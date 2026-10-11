import type { AttackStyle, GameState, ItemDefinition, WeaponType } from "./types";
import { wornItemDefId } from "./ledger";

/** Everything combat reads from worn gear, summed across every slot. */
export interface EquipmentBonuses {
  attack: number;
  strength: number;
  defence: number;
  /** Ranged accuracy. */
  ranged: number;
  rangedStrength: number;
  /** Magic accuracy. */
  magic: number;
  attackSpeedMs?: number;
  weaponType?: WeaponType;
  /** Melee unless the weapon says otherwise. */
  attackStyle: AttackStyle;
  specialAttack?: string;
  /** Runes worn gear supplies without limit. */
  infiniteRunes: string[];
  /** The stack worn in the ammo slot. */
  ammoItemId?: string;
  /** The stack worn in the food slot. */
  foodItemId?: string;
}

export function computeEquipmentBonuses(
  state: GameState,
  getDef: (itemDefId: string) => ItemDefinition | undefined
): EquipmentBonuses {
  const b: EquipmentBonuses = {
    attack: 0,
    strength: 0,
    defence: 0,
    ranged: 0,
    rangedStrength: 0,
    magic: 0,
    attackStyle: "melee",
    infiniteRunes: [],
  };
  for (const [slot, equipValue] of Object.entries(state.equipment)) {
    if (!equipValue) continue;
    const itemDefId = wornItemDefId(state, equipValue);
    const def = itemDefId ? getDef(itemDefId) : undefined;
    if (!def) continue;
    if (slot === "food") {
      b.foodItemId = def.id;
      continue;
    }
    if (slot === "ammo") b.ammoItemId = def.id;
    if (slot === "weapon") {
      b.attackSpeedMs = def.attackSpeedMs;
      b.weaponType = def.weaponType;
      b.attackStyle = def.attackStyle ?? "melee";
      b.specialAttack = def.specialAttack;
    }
    b.infiniteRunes.push(...(def.infiniteRunes ?? []));
    const s = def.stats;
    if (!s) continue;
    b.attack += s.attack ?? 0;
    b.strength += s.strength ?? 0;
    b.defence += s.defence ?? 0;
    b.ranged += s.ranged ?? 0;
    b.rangedStrength += s.rangedStrength ?? 0;
    b.magic += s.magic ?? 0;
  }
  return b;
}
