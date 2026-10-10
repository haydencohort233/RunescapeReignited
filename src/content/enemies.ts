import type { LootEntry, EnemyDefinition } from "../engine/types";
export type { LootEntry, EnemyDefinition };

/** Used by any enemy without its own lootTable — a modest chance of bones
 *  or a little GP, and a real chance of nothing. Every table should
 *  usually include a "nothing" weight; this one does. */
export const DEFAULT_LOOT_TABLE: LootEntry[] = [
  { id: "gp", quantityMin: 1, quantityMax: 5, weight: 30 },
  { id: "bones", quantityMin: 1, quantityMax: 1, weight: 20 },
  { weight: 50 }, // nothing
];

export const ENEMY_CATALOG: EnemyDefinition[] = [
  {
    id: "goblin",
    name: "Goblin",
    maxHp: 11,
    attack: 5,
    strength: 5,
    defence: 1,
    ranged: 1,
    magic: 1,
    attackBonus: 0,
    strengthBonus: 0,
    defenceBonus: 0,
    xpReward: 20,
    lootTable: [
      { id: "gp", quantityMin: 1, quantityMax: 10, weight: 40 },
      { id: "bones", quantityMin: 1, quantityMax: 1, weight: 30 },
      { weight: 30 },
    ],
  },
  {
    id: "bandit",
    name: "Bandit",
    maxHp: 30,
    attack: 15,
    strength: 15,
    defence: 10,
    ranged: 1,
    magic: 1,
    attackBonus: 5,
    strengthBonus: 5,
    defenceBonus: 5,
    xpReward: 45,
    lootTable: [
      { id: "gp", quantityMin: 10, quantityMax: 40, weight: 40 },
      { id: "bronze-dagger", quantityMin: 1, quantityMax: 1, weight: 5 },
      { id: "bones", quantityMin: 1, quantityMax: 1, weight: 25 },
      { weight: 30 },
    ],
  },
  {
    id: "den-guardian",
    name: "Den Guardian",
    isBoss: true,
    maxHp: 120,
    attack: 40,
    strength: 45,
    defence: 35,
    ranged: 1,
    magic: 1,
    attackBonus: 20,
    strengthBonus: 25,
    defenceBonus: 15,
    xpReward: 400,
    canFlee: false,
    lootTable: [
      { id: "gp", quantityMin: 100, quantityMax: 300, weight: 40 },
      { id: "dragon-scimitar", quantityMin: 1, quantityMax: 1, weight: 2 },
      { id: "amulet-of-glory", quantityMin: 1, quantityMax: 1, weight: 8 },
      { id: "bones", quantityMin: 2, quantityMax: 4, weight: 30 },
      { weight: 20 },
    ],
  },
];

const ENEMIES_BY_ID = new Map(ENEMY_CATALOG.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDefinition | undefined {
  return ENEMIES_BY_ID.get(id);
}