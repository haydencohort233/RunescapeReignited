import type { ItemDefinition } from "../engine/types";

/** An inventory filter: a chip to tap, and words that select it from the
 *  search box too ("armor" and "armour" both find all armour). */
export interface ItemFilter {
  id: string;
  label: string;
  aliases: string[];
  matches: (def: ItemDefinition, equipped: boolean) => boolean;
}

const isJewellery = (def: ItemDefinition) => def.equipSlot === "neck" || def.equipSlot === "ring";
const isRune = (def: ItemDefinition) => def.id.endsWith("-rune");

export const ITEM_FILTERS: ItemFilter[] = [
  { id: "equipped", label: "Equipped", aliases: ["worn", "wearing"], matches: (_, equipped) => equipped },
  {
    id: "weapons",
    label: "Weapons",
    aliases: ["weapon"],
    matches: (def) => def.equipSlot === "weapon",
  },
  {
    id: "armour",
    label: "Armour",
    aliases: ["armor", "armours", "armors"],
    matches: (def) => def.category === "armor" && !isJewellery(def) && def.equipSlot !== "cape",
  },
  { id: "jewellery", label: "Jewellery", aliases: ["jewelry", "jewel", "amulet", "ring"], matches: isJewellery },
  { id: "ammo", label: "Ammo", aliases: ["ammunition", "arrows"], matches: (def) => def.equipSlot === "ammo" },
  { id: "food", label: "Food", aliases: ["foods", "consumable"], matches: (def) => !!def.healAmount },
  { id: "tools", label: "Tools", aliases: ["tool"], matches: (def) => !!def.tool },
  { id: "runes", label: "Runes", aliases: ["rune", "magic"], matches: isRune },
  {
    id: "materials",
    label: "Materials",
    aliases: ["material", "resources", "resource"],
    matches: (def) => def.category === "material" && !isRune(def),
  },
];

/** Whether `def` matches what's typed in the search box: its name, or a
 *  filter's name (from 3 letters, so "arm" already finds armour). */
export function matchesSearch(def: ItemDefinition, equipped: boolean, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (def.name.toLowerCase().includes(q)) return true;
  if (q.length < 3) return false;
  return ITEM_FILTERS.some(
    (f) => [f.label.toLowerCase(), ...f.aliases].some((word) => word.startsWith(q)) && f.matches(def, equipped)
  );
}
