import type { RecipeInput, SpellDefinition } from "../engine/types";

// The standard spellbook's combat spells, with OSRS levels, max hits, base
// XP and rune costs. A worn staff can stand in for one rune type (the Air
// Staff covers air runes).
const r = (resource: string, amount: number): RecipeInput => ({ resource: `${resource}-rune`, amount });

export const SPELL_CATALOG: SpellDefinition[] = [
  { id: "wind-strike", name: "Wind Strike", levelRequired: 1, maxHit: 2, baseXp: 5.5, runes: [r("air", 1), r("mind", 1)] },
  { id: "water-strike", name: "Water Strike", levelRequired: 5, maxHit: 4, baseXp: 7.5, runes: [r("air", 1), r("water", 1), r("mind", 1)] },
  { id: "earth-strike", name: "Earth Strike", levelRequired: 9, maxHit: 6, baseXp: 9.5, runes: [r("air", 1), r("earth", 2), r("mind", 1)] },
  { id: "fire-strike", name: "Fire Strike", levelRequired: 13, maxHit: 8, baseXp: 11.5, runes: [r("air", 2), r("fire", 3), r("mind", 1)] },
  { id: "wind-bolt", name: "Wind Bolt", levelRequired: 17, maxHit: 9, baseXp: 13.5, runes: [r("air", 2), r("chaos", 1)] },
  { id: "water-bolt", name: "Water Bolt", levelRequired: 23, maxHit: 10, baseXp: 16.5, runes: [r("air", 2), r("water", 2), r("chaos", 1)] },
  { id: "earth-bolt", name: "Earth Bolt", levelRequired: 29, maxHit: 11, baseXp: 19.5, runes: [r("air", 2), r("earth", 3), r("chaos", 1)] },
  { id: "fire-bolt", name: "Fire Bolt", levelRequired: 35, maxHit: 12, baseXp: 22.5, runes: [r("air", 3), r("fire", 4), r("chaos", 1)] },
  { id: "wind-blast", name: "Wind Blast", levelRequired: 41, maxHit: 13, baseXp: 25.5, runes: [r("air", 3), r("death", 1)] },
  { id: "water-blast", name: "Water Blast", levelRequired: 47, maxHit: 14, baseXp: 28.5, runes: [r("air", 3), r("water", 3), r("death", 1)] },
  { id: "earth-blast", name: "Earth Blast", levelRequired: 53, maxHit: 15, baseXp: 31.5, runes: [r("air", 3), r("earth", 4), r("death", 1)] },
  { id: "fire-blast", name: "Fire Blast", levelRequired: 59, maxHit: 16, baseXp: 34.5, runes: [r("air", 4), r("fire", 5), r("death", 1)] },
  { id: "wind-wave", name: "Wind Wave", levelRequired: 62, maxHit: 17, baseXp: 36, runes: [r("air", 5), r("blood", 1)] },
  { id: "water-wave", name: "Water Wave", levelRequired: 65, maxHit: 18, baseXp: 37.5, runes: [r("air", 5), r("water", 7), r("blood", 1)] },
  { id: "earth-wave", name: "Earth Wave", levelRequired: 70, maxHit: 19, baseXp: 40, runes: [r("air", 5), r("earth", 7), r("blood", 1)] },
  { id: "fire-wave", name: "Fire Wave", levelRequired: 75, maxHit: 20, baseXp: 42.5, runes: [r("air", 5), r("fire", 7), r("blood", 1)] },
];

const SPELLS_BY_ID = new Map(SPELL_CATALOG.map((s) => [s.id, s]));

export function getSpell(id: string | undefined): SpellDefinition | undefined {
  return id ? SPELLS_BY_ID.get(id) : undefined;
}
