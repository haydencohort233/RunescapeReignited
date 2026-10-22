import type { ItemDefinition, ToolType, UnlockCondition } from "../engine/types";

const level = (skill: string, atLeast: number): UnlockCondition | undefined =>
  atLeast > 1 ? { kind: "skillLevel", skill, atLeast } : undefined;

// ── Tools ── Speeds are proposed: each metal tier is 5% faster than the
// last. Level requirements and shop prices follow OSRS.
const METAL_TIERS = [
  { metal: "bronze", name: "Bronze", speed: 1, level: 1, axeValue: 16, pickValue: 1 },
  { metal: "iron", name: "Iron", speed: 0.95, level: 1, axeValue: 56, pickValue: 140 },
  { metal: "steel", name: "Steel", speed: 0.9, level: 6, axeValue: 200, pickValue: 500 },
  { metal: "mithril", name: "Mithril", speed: 0.85, level: 21, axeValue: 520, pickValue: 1300 },
  { metal: "adamant", name: "Adamant", speed: 0.8, level: 31, axeValue: 1280, pickValue: 3200 },
  { metal: "rune", name: "Rune", speed: 0.75, level: 41, axeValue: 12800, pickValue: 32000 },
];

function tool(id: string, name: string, type: ToolType, speed: number, value: number, description: string, requirement?: UnlockCondition): ItemDefinition {
  return {
    id,
    assetFolder: "Tools",
    name,
    description,
    category: "tool",
    rarity: "common",
    stackable: false,
    value,
    tool: { type, speedMultiplier: speed, requirement },
    actions: ["drop"],
  };
}

const TOOL_ITEMS: ItemDefinition[] = [
  ...METAL_TIERS.map((t) =>
    tool(`${t.metal}-axe`, `${t.name} Axe`, "axe", t.speed, t.axeValue, `A woodcutter's axe.`, level("woodcutting", t.level))
  ),
  ...METAL_TIERS.map((t) =>
    tool(`${t.metal}-pickaxe`, `${t.name} Pickaxe`, "pickaxe", t.speed, t.pickValue, `Used for mining.`, level("mining", t.level))
  ),
  tool("fishing-net", "Fishing Net", "net", 1, 5, "Useful for catching small fish."),
  tool("fishing-rod", "Fishing Rod", "rod", 1, 5, "Useful for catching sardines and trout."),
  tool("harpoon", "Harpoon", "harpoon", 1, 5, "Useful for catching big fish."),
  tool("tinderbox", "Tinderbox", "tinderbox", 1, 1, "Useful for lighting a fire."),
];

// ── Fish ── Raw catches and the food they cook into. Shark (cooked) is
// defined above with the other food.
function rawFish(id: string, name: string, value: number): ItemDefinition {
  return { id, assetFolder: "Fish", name, description: `A raw ${name.slice(4).toLowerCase()}. Cook it at a range.`, category: "material", rarity: "common", stackable: true, value, actions: ["drop"] };
}
function cookedFish(id: string, name: string, heal: number, value: number): ItemDefinition {
  return { id, assetFolder: "Fish", name, description: `Cooked ${name.toLowerCase()}. Heals ${heal} HP.`, category: "consumable", rarity: "common", stackable: true, value, healAmount: heal, equipSlot: "food", actions: ["eat", "equip", "drop"] };
}

const FISH_ITEMS: ItemDefinition[] = [
  rawFish("raw-shrimps", "Raw Shrimps", 5),
  cookedFish("shrimps", "Shrimps", 3, 8),
  rawFish("raw-trout", "Raw Trout", 20),
  cookedFish("trout", "Trout", 7, 25),
  rawFish("raw-tuna", "Raw Tuna", 60),
  cookedFish("tuna", "Tuna", 10, 80),
  rawFish("raw-shark", "Raw Shark", 250),
];

// ── Mining and Smithing ──
const MINING_ITEMS: ItemDefinition[] = [
  { id: "copper-ore", assetFolder: "Ores", name: "Copper Ore", description: "Smelt it with tin ore to make bronze.", category: "material", rarity: "common", stackable: true, value: 5, actions: ["drop"] },
  { id: "tin-ore", assetFolder: "Ores", name: "Tin Ore", description: "Smelt it with copper ore to make bronze.", category: "material", rarity: "common", stackable: true, value: 5, actions: ["drop"] },
  { id: "bronze-bar", assetFolder: "Bars", name: "Bronze Bar", description: "Smith it into bronze gear at an anvil.", category: "material", rarity: "common", stackable: true, value: 12, actions: ["drop"] },
];

// ── Runes ── Bought from Aubury until Runecrafting exists. Values are
// proposed, roughly OSRS shop prices.
function rune(element: string, value: number): ItemDefinition {
  const name = `${element[0].toUpperCase()}${element.slice(1)} Rune`;
  return { id: `${element}-rune`, assetFolder: "Runes", name, description: `Used to cast spells.`, category: "material", rarity: "common", stackable: true, value, actions: ["drop"] };
}

const RUNE_ITEMS: ItemDefinition[] = [
  rune("air", 4),
  rune("water", 4),
  rune("earth", 4),
  rune("fire", 4),
  rune("mind", 3),
  rune("chaos", 90),
  rune("death", 180),
  rune("blood", 400),
];

// ── Metal armour and arrows, iron to rune ── Added with their wiki art.
// Defence and ranged strength are rough OSRS values (one aggregate
// defence number, like the bronze set); levels follow OSRS, prices are
// OSRS shop values. The bronze set is defined further down.
const ARMOUR_TIERS = [
  { metal: "iron", name: "Iron", level: 1, helm: [6, 154], body: [21, 560], legs: [11, 280], kite: [8, 238] },
  { metal: "steel", name: "Steel", level: 5, helm: [9, 550], body: [32, 2000], legs: [17, 1000], kite: [12, 850] },
  { metal: "mithril", name: "Mithril", level: 20, helm: [13, 1430], body: [46, 5200], legs: [24, 2600], kite: [17, 2210] },
  { metal: "adamant", name: "Adamant", level: 30, helm: [19, 3520], body: [65, 12800], legs: [33, 6400], kite: [24, 5440] },
  { metal: "rune", name: "Rune", level: 40, helm: [30, 35200], body: [82, 65000], legs: [51, 64000], kite: [35, 54400] },
];

function armour(metal: string, name: string, piece: string, slot: ItemDefinition["equipSlot"], [defence, value]: number[], defenceLevel: number): ItemDefinition {
  return {
    id: `${metal}-${piece.toLowerCase().replace(/ /g, "-")}`,
    assetFolder: `Armor/${name}`,
    name: `${name} ${piece}`,
    description: `${piece === "Kiteshield" ? "A large" : "Solid"} ${name.toLowerCase()} ${piece.toLowerCase()}.`,
    category: "armor",
    rarity: "common",
    stackable: false,
    value,
    equipSlot: slot,
    stats: { defence },
    equipRequirement: level("defence", defenceLevel),
    actions: ["equip", "drop"],
  };
}

const ARMOUR_ITEMS: ItemDefinition[] = [
  armour("bronze", "Bronze", "Kiteshield", "shield", [5, 68], 1),
  ...ARMOUR_TIERS.flatMap((t) => [
    armour(t.metal, t.name, "Full Helm", "head", t.helm, t.level),
    armour(t.metal, t.name, "Platebody", "body", t.body, t.level),
    armour(t.metal, t.name, "Platelegs", "legs", t.legs, t.level),
    armour(t.metal, t.name, "Kiteshield", "shield", t.kite, t.level),
  ]),
];

const ARROW_TIERS = [
  { metal: "iron", name: "Iron", strength: 10, value: 3, level: 1 },
  { metal: "steel", name: "Steel", strength: 16, value: 12, level: 5 },
  { metal: "mithril", name: "Mithril", strength: 22, value: 32, level: 20 },
  { metal: "adamant", name: "Adamant", strength: 31, value: 80, level: 30 },
  { metal: "rune", name: "Rune", strength: 49, value: 200, level: 40 },
];

const ARROW_ITEMS: ItemDefinition[] = ARROW_TIERS.map((t) => ({
  id: `${t.metal}-arrow`,
  assetFolder: "Ammo",
  name: `${t.name} Arrow`,
  description: "Ammunition for a bow.",
  category: "weapon",
  rarity: "common",
  stackable: true,
  value: t.value,
  equipSlot: "ammo",
  stats: { rangedStrength: t.strength },
  equipRequirement: level("ranged", t.level),
  actions: ["equip", "drop"],
}));

// Single source of truth for every item. `value` is the base GP value
// shops pay a fraction of (engine/tuning.ts); items without one can't be
// sold. stats are rough OSRS-wiki-ish
// approximations (aggregate attack/strength/defence, not the full OSRS
// stab/slash/crush/magic/ranged breakdown) — fine for now, tune later.
export const ITEM_CATALOG: ItemDefinition[] = [
  // ── Materials — produced by buildings and gathering, spent by recipes ──
  {
    id: "wood",
    assetFolder: "Logs",
    name: "Wood",
    description: "Logs from an ordinary tree.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 4,
    actions: ["drop"],
  },
  {
    id: "willow-logs",
    assetFolder: "Logs",
    name: "Willow Logs",
    description: "Logs cut from a willow tree.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 8,
    actions: ["drop"],
  },
  {
    id: "coal",
    assetFolder: "Ores",
    name: "Coal",
    description: "Hey, this is not for colouring books.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 15,
    actions: ["drop"],
  },
  {
    id: "raw-fish",
    assetFolder: "Fish",
    name: "Raw Fish",
    description: "A fresh catch. Needs cooking.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 5,
    actions: ["drop"],
  },
  {
    id: "pelt",
    assetFolder: "Materials",
    name: "Pelt",
    description: "An animal hide, ready for tanning.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 10,
    actions: ["drop"],
  },
  {
    id: "flax",
    assetFolder: "Materials",
    name: "Flax",
    description: "A plant fibre that can be spun into bowstring.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 2,
    actions: ["drop"],
  },
  {
    id: "bowstring",
    assetFolder: "Materials",
    name: "Bow String",
    description: "Spun from flax. Strings an unstrung bow.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 10,
    actions: ["drop"],
  },
  {
    id: "cooked-fish",
    assetFolder: "Fish",
    name: "Cooked Fish",
    description: "Simple, filling, and not burnt. Mostly.",
    category: "consumable",
    rarity: "common",
    stackable: true,
    value: 8,
    healAmount: 5,
    equipSlot: "food",
    actions: ["eat", "equip", "drop"],
  },
  {
    id: "wooden-bow-u",
    assetFolder: "Weapons/Bows",
    name: "Wooden Bow (u)",
    description: "An unstrung wooden bow. Needs a bowstring before it can be used.",
    category: "material",
    rarity: "common",
    stackable: true, // intermediate crafting material — most non-equipment items stack
    value: 10,
    actions: ["drop"],
  },
  {
    id: "wooden-bow",
    assetFolder: "Weapons/Bows",
    name: "Wooden Bow",
    description: "A simple bow carved from ash wood, strung and ready to use. Needs arrows.",
    category: "weapon",
    rarity: "common",
    stackable: false, // equipment — always one instance per copy
    value: 40,
    equipSlot: "weapon",
    attackStyle: "ranged",
    attackSpeedMs: 2400,
    stats: { ranged: 8 },
    actions: ["equip", "drop"],
  },
  {
    id: "bronze-dagger",
    assetFolder: "Weapons/Bronze",
    name: "Bronze Dagger",
    description: "A basic dagger. Weak, but fast.",
    category: "weapon",
    rarity: "common",
    stackable: false,
    value: 50,
    equipSlot: "weapon",
    stats: { attack: 4, strength: 3 },
    weaponType: "stab",
    attackSpeedMs: 1800, // fast, low damage
    actions: ["equip", "drop"],
  },
  {
    id: "bronze-warhammer",
    assetFolder: "Weapons/Bronze",
    name: "Bronze Warhammer",
    description: "A heavy, slow hammer. Hits like a truck.",
    category: "weapon",
    rarity: "common",
    stackable: false,
    value: 80,
    equipSlot: "weapon",
    stats: { attack: 3, strength: 12 },
    weaponType: "crush",
    attackSpeedMs: 4800, // slow, high damage — the other end of the tradeoff
    actions: ["equip", "drop"],
  },
  {
    id: "bronze-full-helm",
    assetFolder: "Armor/Bronze",
    name: "Bronze Full Helm",
    description: "A full helmet made of bronze.",
    category: "armor",
    rarity: "common",
    stackable: false,
    value: 60,
    equipSlot: "head",
    stats: { defence: 5 },
    actions: ["equip", "drop"],
  },
  {
    id: "bronze-platebody",
    assetFolder: "Armor/Bronze",
    name: "Bronze Platebody",
    description: "Sturdy bronze armor for the torso.",
    category: "armor",
    rarity: "common",
    stackable: false,
    value: 160,
    equipSlot: "body",
    stats: { defence: 15 },
    actions: ["equip", "drop"],
  },
  {
    id: "wooden-shield",
    assetFolder: "Armor/Wooden",
    name: "Wooden Shield",
    description: "A simple wooden shield. Better than nothing.",
    category: "armor",
    rarity: "common",
    stackable: false,
    value: 20,
    equipSlot: "shield",
    stats: { defence: 4 },
    actions: ["equip", "drop"],
  },
  {
    id: "leather-boots",
    assetFolder: "Armor/Leather",
    name: "Leather Boots",
    description: "Basic leather footwear.",
    category: "armor",
    rarity: "common",
    stackable: false,
    value: 10,
    equipSlot: "feet",
    stats: { defence: 1 },
    actions: ["equip", "drop"],
  },
  {
    id: "leather-gloves",
    assetFolder: "Armor/Leather",
    name: "Leather Gloves",
    description: "Basic leather gloves.",
    category: "armor",
    rarity: "common",
    stackable: false,
    value: 10,
    equipSlot: "hands",
    stats: { defence: 1 },
    actions: ["equip", "drop"],
  },
  {
    id: "ardougne-cloak",
    assetFolder: "Capes",
    name: "Ardougne Cloak",
    description: "A cloak awarded for completing tasks in Ardougne.",
    category: "armor",
    rarity: "uncommon",
    stackable: false,
    equipSlot: "cape",
    actions: ["equip", "drop"], // cosmetic — no combat stats
  },
  {
    id: "gold-ring",
    assetFolder: "Jewellery",
    name: "Gold Ring",
    description: "A plain gold ring. More decorative than useful.",
    category: "armor",
    rarity: "uncommon",
    stackable: false,
    value: 350,
    equipSlot: "ring",
    actions: ["equip", "drop"], // cosmetic — no combat stats
  },
  {
    id: "bronze-arrow",
    assetFolder: "Ammo",
    name: "Bronze Arrow",
    description: "Ammunition for a bow.",
    category: "weapon",
    rarity: "common",
    // Worn as a whole stack in the ammo slot (see ledger.ts stackEquipId).
    stackable: true,
    value: 2,
    equipSlot: "ammo",
    stats: { rangedStrength: 7 }, // only Ranged uses it, so melee ignores it
    actions: ["equip", "drop"],
  },
  {
    id: "amulet-of-glory",
    assetFolder: "Jewellery",
    name: "Amulet of Glory",
    description: "A powerful amulet with a limited number of teleport charges.",
    category: "armor",
    rarity: "rare",
    stackable: false,
    value: 1000,
    equipSlot: "neck",
    // Each teleport uses a charge; Aggie in Draynor Village refills them.
    teleportTo: "town",
    maxCharges: 4,
    unchargedDescription: "An uncharged amulet of glory. Maybe Aggie in Draynor Village can recharge it.",
    rechargeCostGp: 500, // per charge — proposed, tune freely
    stats: { defence: 3 },
    actions: ["equip", "drop", "teleport"],
  },
  {
    id: "dragon-scimitar",
    assetFolder: "Weapons/Dragon",
    name: "Dragon Scimitar",
    description: "A fearsome curved blade, prized by adventurers.",
    category: "weapon",
    rarity: "legendary",
    stackable: false,
    value: 60000,
    equipSlot: "weapon",
    stats: { attack: 67, strength: 66 },
    weaponType: "slash",
    attackSpeedMs: 2400, // medium-fast, medium-high damage
    equipRequirement: { kind: "skillLevel", skill: "attack", atLeast: 60 },
    specialAttack: "sever",
    actions: ["equip", "drop"],
  },
  {
    id: "shark",
    assetFolder: "Fish",
    name: "Shark",
    description: "A cooked shark. A reliable source of food.",
    category: "consumable",
    rarity: "common",
    stackable: true,
    value: 300,
    healAmount: 20,
    equipSlot: "food",
    actions: ["eat", "equip", "drop"],
  },
  {
    id: "birds-nest",
    assetFolder: "Materials",
    name: "Bird's Nest",
    description: "A nest that fell out of a tree. Something might be inside one day.",
    category: "material",
    rarity: "uncommon",
    stackable: true,
    value: 50,
    actions: ["drop"],
  },
  {
    id: "ashes",
    assetFolder: "Materials",
    name: "Ashes",
    description: "A heap of ashes, left over from a fire. Can be scattered for Prayer XP.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 2,
    actions: ["drop"],
  },
  {
    id: "bones",
    assetFolder: "Bones",
    name: "Bones",
    description: "The bones of a defeated enemy. Bury them for Prayer XP.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 2,
    actions: ["drop"],
  },
  ...TOOL_ITEMS,
  ...FISH_ITEMS,
  ...MINING_ITEMS,
  ...RUNE_ITEMS,
  ...ARMOUR_ITEMS,
  ...ARROW_ITEMS,
  // Planks for the player house: sawn at the Sawmill (Lumber Camp), or
  // bought from the sawmill operator.
  { id: "plank", assetFolder: "Planks", name: "Plank", description: "A plank of wood. Build furniture with it.", category: "material", rarity: "common", stackable: true, value: 50, actions: ["drop"] },
  { id: "oak-plank", assetFolder: "Planks", name: "Oak Plank", description: "A sturdy oak plank.", category: "material", rarity: "common", stackable: true, value: 125, actions: ["drop"] },
  { id: "mahogany-plank", assetFolder: "Planks", name: "Mahogany Plank", description: "A fine, dark plank for the best furniture.", category: "material", rarity: "uncommon", stackable: true, value: 1050, actions: ["drop"] },
  {
    id: "oak-logs",
    assetFolder: "Logs",
    name: "Oak Logs",
    description: "Logs cut from an oak tree.",
    category: "material",
    rarity: "common",
    stackable: true,
    value: 20,
    actions: ["drop"],
  },
  {
    id: "air-staff",
    assetFolder: "Weapons",
    name: "Air Staff",
    description: "A magical staff that provides unlimited air runes.",
    category: "weapon",
    rarity: "uncommon",
    stackable: false,
    value: 1500,
    equipSlot: "weapon",
    attackStyle: "magic",
    attackSpeedMs: 3000,
    stats: { magic: 10, attack: 2, defence: 2 },
    infiniteRunes: ["air-rune"],
    weaponType: "crush",
    actions: ["equip", "drop"],
  },
  {
    id: "dragon-dagger",
    assetFolder: "Weapons/Dragon",
    name: "Dragon Dagger",
    description: "A powerful dagger. Its special attack, Puncture, strikes twice.",
    category: "weapon",
    rarity: "rare",
    stackable: false,
    value: 30000,
    equipSlot: "weapon",
    stats: { attack: 40, strength: 40 },
    weaponType: "stab",
    attackSpeedMs: 2400,
    equipRequirement: { kind: "skillLevel", skill: "attack", atLeast: 60 },
    specialAttack: "puncture",
    actions: ["equip", "drop"],
  },
  {
    id: "bronze-platelegs",
    assetFolder: "Armor/Bronze",
    name: "Bronze Platelegs",
    description: "Bronze leg armour.",
    category: "armor",
    rarity: "common",
    stackable: false,
    value: 80,
    equipSlot: "legs",
    stats: { defence: 10 },
    actions: ["equip", "drop"],
  },
  {
    // The degrading-gear example: Barrows-style, it wears down with every
    // attack and breaks into "Dharok's Greataxe 0", which Bob repairs.
    // No drop source yet; spawn it from the dev tools to test.
    id: "dharoks-greataxe",
    assetFolder: "Weapons/Barrows",
    name: "Dharok's Greataxe",
    description: "A huge axe once wielded by Dharok the Wretched. It degrades with use.",
    category: "weapon",
    rarity: "legendary",
    stackable: false,
    value: 100000,
    equipSlot: "weapon",
    stats: { attack: 103, strength: 105 },
    weaponType: "slash",
    attackSpeedMs: 4200,
    equipRequirement: {
      kind: "all",
      conditions: [
        { kind: "skillLevel", skill: "attack", atLeast: 70 },
        { kind: "skillLevel", skill: "strength", atLeast: 70 },
      ],
    },
    maxDurability: 10000, // attacks until it breaks
    brokenItemId: "dharoks-greataxe-0",
    repairCostGp: 100000,
    actions: ["equip", "drop"],
  },
  {
    id: "dharoks-greataxe-0",
    assetFolder: "Weapons/Barrows",
    name: "Dharok's Greataxe 0",
    description: "Broken. It can't be wielded until Bob repairs it.",
    category: "misc",
    rarity: "legendary",
    stackable: false,
    repairsTo: "dharoks-greataxe",
    actions: ["drop"],
  },
];

// Looked up constantly during render (inventory rows, rich text, resource
// names), so index once instead of scanning the catalog every call.
const ITEMS_BY_ID = new Map(ITEM_CATALOG.map((i) => [i.id, i]));
const ITEMS_BY_LOWER_NAME = new Map(ITEM_CATALOG.map((i) => [i.name.toLowerCase(), i]));

export function getItemDef(itemDefId: string): ItemDefinition | undefined {
  return ITEMS_BY_ID.get(itemDefId);
}

/** Case-insensitive lookup BY DISPLAY NAME — an in-memory array scan over
 *  the catalog, not a filesystem/folder scan. This is what lets
 *  `<Abyssal Whip>` work in RichText without needing the category folder
 *  spelled out in the tag — the catalog already knows which folder (via
 *  assetFolder) and extension (via animated) that item uses. */
export function getItemDefByName(name: string): ItemDefinition | undefined {
  return ITEMS_BY_LOWER_NAME.get(name.toLowerCase());
}