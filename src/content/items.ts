import type { ItemDefinition } from "../engine/types";

// Single source of truth for every item. stats are rough OSRS-wiki-ish
// approximations (aggregate attack/strength/defence, not the full OSRS
// stab/slash/crush/magic/ranged breakdown) — fine for now, tune later.
export const ITEM_CATALOG: ItemDefinition[] = [
  {
    id: "wooden-bow-u",
    name: "Wooden Bow (u)",
    description: "An unstrung wooden bow. Needs a bowstring before it can be used.",
    category: "material",
    rarity: "common",
    stackable: true, // intermediate crafting material — most non-equipment items stack
    actions: ["drop", "examine"],
  },
  {
    id: "wooden-bow",
    name: "Wooden Bow",
    description: "A simple bow carved from ash wood, strung and ready to use.",
    category: "weapon",
    rarity: "common",
    stackable: false, // equipment — always one instance per copy
    equipSlot: "weapon",
    stats: { attack: 8 },
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "bronze-dagger",
    name: "Bronze Dagger",
    description: "A basic dagger. Weak, but fast.",
    category: "weapon",
    rarity: "common",
    stackable: false,
    equipSlot: "weapon",
    stats: { attack: 4, strength: 3 },
    weaponType: "stab",
    attackSpeedMs: 1800, // fast, low damage
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "bronze-warhammer",
    name: "Bronze Warhammer",
    description: "A heavy, slow hammer. Hits like a truck.",
    category: "weapon",
    rarity: "common",
    stackable: false,
    equipSlot: "weapon",
    stats: { attack: 3, strength: 12 },
    weaponType: "crush",
    attackSpeedMs: 4800, // slow, high damage — the other end of the tradeoff
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "bronze-full-helm",
    name: "Bronze Full Helm",
    description: "A full helmet made of bronze.",
    category: "armor",
    rarity: "common",
    stackable: false,
    equipSlot: "head",
    stats: { defence: 5 },
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "bronze-platebody",
    name: "Bronze Platebody",
    description: "Sturdy bronze armor for the torso.",
    category: "armor",
    rarity: "common",
    stackable: false,
    equipSlot: "body",
    stats: { defence: 15 },
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "wooden-shield",
    name: "Wooden Shield",
    description: "A simple wooden shield. Better than nothing.",
    category: "armor",
    rarity: "common",
    stackable: false,
    equipSlot: "shield",
    stats: { defence: 4 },
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "leather-boots",
    name: "Leather Boots",
    description: "Basic leather footwear.",
    category: "armor",
    rarity: "common",
    stackable: false,
    equipSlot: "feet",
    stats: { defence: 1 },
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "leather-gloves",
    name: "Leather Gloves",
    description: "Basic leather gloves.",
    category: "armor",
    rarity: "common",
    stackable: false,
    equipSlot: "hands",
    stats: { defence: 1 },
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "ardougne-cloak",
    name: "Ardougne Cloak",
    description: "A cloak awarded for completing tasks in Ardougne.",
    category: "armor",
    rarity: "uncommon",
    stackable: false,
    equipSlot: "cape",
    actions: ["equip", "drop", "examine"], // cosmetic — no combat stats
  },
  {
    id: "gold-ring",
    name: "Gold Ring",
    description: "A plain gold ring. More decorative than useful.",
    category: "armor",
    rarity: "uncommon",
    stackable: false,
    equipSlot: "ring",
    actions: ["equip", "drop", "examine"], // cosmetic — no combat stats
  },
  {
    id: "bronze-arrow",
    name: "Bronze Arrow",
    description: "Ammunition for a bow.",
    category: "weapon",
    rarity: "common",
    // Simplification: ammo isn't stack-while-equipped yet (that's a real
    // OSRS special case worth its own pass later) — treated as ordinary
    // equipment for now, one instance per copy.
    stackable: false,
    equipSlot: "ammo",
    stats: { strength: 7 },
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "amulet-of-glory",
    name: "Amulet of Glory",
    description: "A powerful amulet with a limited number of teleport charges.",
    category: "armor",
    rarity: "rare",
    stackable: false,
    equipSlot: "neck",
    // No maxDurability set — teleport charges are a natural future use of
    // durability, but durability stays unwired until you decide to use it.
    teleportTo: "town",
    stats: { defence: 3 },
    actions: ["equip", "drop", "examine", "teleport"],
  },
  {
    id: "dragon-scimitar",
    name: "Dragon Scimitar",
    description: "A fearsome curved blade, prized by adventurers.",
    category: "weapon",
    rarity: "legendary",
    stackable: false,
    equipSlot: "weapon",
    stats: { attack: 67, strength: 66 },
    weaponType: "slash",
    attackSpeedMs: 2400, // medium-fast, medium-high damage
    equipRequirement: { kind: "skillLevel", skill: "attack", atLeast: 60 },
    actions: ["equip", "drop", "examine"],
  },
  {
    id: "shark",
    name: "Shark",
    description: "A cooked shark. A reliable source of food.",
    category: "consumable",
    rarity: "common",
    stackable: true,
    actions: ["eat", "drop", "examine"],
  },
  {
    id: "bones",
    name: "Bones",
    description: "The bones of a defeated enemy.",
    category: "material",
    rarity: "common",
    stackable: true,
    actions: ["drop", "examine"],
  },
];

export function getItemDef(itemDefId: string): ItemDefinition | undefined {
  return ITEM_CATALOG.find((i) => i.id === itemDefId);
}

/** Case-insensitive lookup BY DISPLAY NAME — an in-memory array scan over
 *  the catalog, not a filesystem/folder scan. This is what lets
 *  `<Abyssal Whip>` work in RichText without needing the category folder
 *  spelled out in the tag — the catalog already knows which folder (via
 *  assetFolder) and extension (via animated) that item uses. */
export function getItemDefByName(name: string): ItemDefinition | undefined {
  const lower = name.toLowerCase();
  return ITEM_CATALOG.find((i) => i.name.toLowerCase() === lower);
}