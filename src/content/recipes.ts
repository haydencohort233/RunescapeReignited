import type { CraftingRecipe } from "../engine/types";

// Recipes cover both "craft something from materials" (Fletching a bow) and
// "gather something from nothing but time" (picking flax) — a gathering
// recipe is just one with an empty inputs array. No engine change needed
// for that; startCraftJob already handles zero-cost recipes correctly.
export const WOODEN_BOW_RECIPE: CraftingRecipe = {
  // id kept as "wooden-bow" — the crafted:wooden-bow statistic and the
  // Fletching Novice achievement key off it.
  id: "wooden-bow",
  name: "Wooden Bow (u)",
  skill: "fletching",
  xpPerItem: 5,
  timePerItemMs: 2000,
  inputs: [{ resource: "wood", amount: 1 }],
  output: { resource: "wooden-bow-u", amount: 1 },
};

// The full bow chain: Wood -> Wooden Bow (u), Flax -> Bow String, then
// both -> Wooden Bow. Inputs and outputs can be any item, stackable or not.
export const SPIN_FLAX_RECIPE: CraftingRecipe = {
  id: "spin-flax",
  name: "Bow String",
  skill: "crafting",
  xpPerItem: 15,
  timePerItemMs: 2000,
  inputs: [{ resource: "flax", amount: 1 }],
  output: { resource: "bowstring", amount: 1 },
};

export const STRING_WOODEN_BOW_RECIPE: CraftingRecipe = {
  id: "string-wooden-bow",
  name: "Wooden Bow",
  skill: "fletching",
  xpPerItem: 5,
  timePerItemMs: 1800,
  inputs: [
    { resource: "wooden-bow-u", amount: 1 },
    { resource: "bowstring", amount: 1 },
  ],
  // Non-stackable: each one is its own equippable instance.
  output: { resource: "wooden-bow", amount: 1 },
};

export const COOK_FISH_RECIPE: CraftingRecipe = {
  id: "cook-fish",
  name: "Cooked Fish",
  skill: "cooking",
  xpPerItem: 30,
  timePerItemMs: 2400,
  inputs: [{ resource: "raw-fish", amount: 1 }],
  output: { resource: "cooked-fish", amount: 1 },
  activityLabel: "Cooking Fish",
  station: "range",
};

export const PICK_FLAX_RECIPE: CraftingRecipe = {
  id: "pick-flax",
  name: "Flax",
  skill: "farming",
  xpPerItem: 2,
  timePerItemMs: 1500,
  inputs: [],
  output: { resource: "flax", amount: 1 },
  activityLabel: "Picking Flax",
};

export const CHOP_NORMAL_TREE_RECIPE: CraftingRecipe = {
  id: "chop-normal-tree",
  name: "Regular Tree",
  skill: "woodcutting",
  xpPerItem: 3,
  timePerItemMs: 3000,
  inputs: [],
  output: { resource: "wood", amount: 1 },
  bonusDrops: [{ resource: "birds-nest", amount: 1, chance: 0.005 }],
  activityLabel: "Chopping Trees",
  tool: "axe",
};

export const CHOP_WILLOW_TREE_RECIPE: CraftingRecipe = {
  id: "chop-willow-tree",
  name: "Willow Tree",
  skill: "woodcutting",
  xpPerItem: 15, // meaningfully higher than Regular Tree's 3 — better XP for the harder requirement
  timePerItemMs: 4000,
  inputs: [],
  output: { resource: "willow-logs", amount: 1 },
  bonusDrops: [{ resource: "birds-nest", amount: 1, chance: 0.005 }],
  activityLabel: "Chopping Willows",
  unlockCondition: { kind: "skillLevel", skill: "woodcutting", atLeast: 30 },
  tool: "axe",
};

// Firemaking: burning logs leaves ashes, and now and then a lump of coal.
export const BURN_LOGS_RECIPE: CraftingRecipe = {
  id: "burn-logs",
  name: "Burn Logs",
  skill: "firemaking",
  xpPerItem: 40,
  timePerItemMs: 2400,
  inputs: [{ resource: "wood", amount: 1 }],
  output: { resource: "ashes", amount: 1 },
  bonusDrops: [{ resource: "coal", amount: 1, chance: 0.1 }],
  activityLabel: "Burning Logs",
  tool: "tinderbox",
};

export const BURN_WILLOW_LOGS_RECIPE: CraftingRecipe = {
  id: "burn-willow-logs",
  name: "Burn Willow Logs",
  skill: "firemaking",
  xpPerItem: 90,
  timePerItemMs: 2400,
  inputs: [{ resource: "willow-logs", amount: 1 }],
  output: { resource: "ashes", amount: 1 },
  bonusDrops: [{ resource: "coal", amount: 1, chance: 0.15 }],
  activityLabel: "Burning Willow Logs",
  unlockCondition: { kind: "skillLevel", skill: "firemaking", atLeast: 30 },
  tool: "tinderbox",
};

const lvl = (skill: string, atLeast: number) => ({ kind: "skillLevel" as const, skill, atLeast });

export const CHOP_OAK_TREE_RECIPE: CraftingRecipe = {
  id: "chop-oak-tree",
  name: "Oak Tree",
  skill: "woodcutting",
  xpPerItem: 37.5,
  timePerItemMs: 4000,
  inputs: [],
  output: { resource: "oak-logs", amount: 1 },
  bonusDrops: [{ resource: "birds-nest", amount: 1, chance: 0.005 }],
  activityLabel: "Chopping Oaks",
  unlockCondition: lvl("woodcutting", 15),
  tool: "axe",
};

export const BURN_OAK_LOGS_RECIPE: CraftingRecipe = {
  id: "burn-oak-logs",
  name: "Burn Oak Logs",
  skill: "firemaking",
  xpPerItem: 60,
  timePerItemMs: 2400,
  inputs: [{ resource: "oak-logs", amount: 1 }],
  output: { resource: "ashes", amount: 1 },
  bonusDrops: [{ resource: "coal", amount: 1, chance: 0.12 }],
  activityLabel: "Burning Oak Logs",
  unlockCondition: lvl("firemaking", 15),
  tool: "tinderbox",
};

// ── Fishing ── Levels, XP and tools follow OSRS. Base times are proposed.
function fishing(id: string, name: string, output: string, xp: number, ms: number, level: number, tool: "net" | "rod" | "harpoon"): CraftingRecipe {
  return {
    id,
    name,
    skill: "fishing",
    xpPerItem: xp,
    timePerItemMs: ms,
    inputs: [],
    output: { resource: output, amount: 1 },
    activityLabel: `Catching ${name}`,
    unlockCondition: level > 1 ? lvl("fishing", level) : undefined,
    tool,
  };
}

export const FISH_SHRIMPS_RECIPE = fishing("fish-shrimps", "Shrimps", "raw-shrimps", 10, 3000, 1, "net");
export const FISH_TROUT_RECIPE = fishing("fish-trout", "Trout", "raw-trout", 50, 4000, 20, "rod");
export const FISH_TUNA_RECIPE = fishing("fish-tuna", "Tuna", "raw-tuna", 80, 5000, 35, "harpoon");
export const FISH_SHARK_RECIPE = fishing("fish-shark", "Sharks", "raw-shark", 110, 7000, 76, "harpoon");

// ── Cooking ── Only at a range (decided: no cooking on fires yet).
function cooking(id: string, name: string, input: string, output: string, xp: number, level: number): CraftingRecipe {
  return {
    id,
    name,
    skill: "cooking",
    xpPerItem: xp,
    timePerItemMs: 2400,
    inputs: [{ resource: input, amount: 1 }],
    output: { resource: output, amount: 1 },
    activityLabel: `Cooking ${name}`,
    unlockCondition: level > 1 ? lvl("cooking", level) : undefined,
    station: "range",
  };
}

export const COOK_SHRIMPS_RECIPE = cooking("cook-shrimps", "Shrimps", "raw-shrimps", "shrimps", 30, 1);
export const COOK_TROUT_RECIPE = cooking("cook-trout", "Trout", "raw-trout", "trout", 70, 15);
export const COOK_TUNA_RECIPE = cooking("cook-tuna", "Tuna", "raw-tuna", "tuna", 100, 30);
export const COOK_SHARK_RECIPE = cooking("cook-shark", "Shark", "raw-shark", "shark", 210, 80);

// ── Mining ── Copper and tin first (decided), at the Quarry.
function mining(id: string, name: string, output: string, xp: number, ms: number): CraftingRecipe {
  return {
    id,
    name,
    skill: "mining",
    xpPerItem: xp,
    timePerItemMs: ms,
    inputs: [],
    output: { resource: output, amount: 1 },
    activityLabel: `Mining ${name}`,
    tool: "pickaxe",
  };
}

export const MINE_COPPER_RECIPE = mining("mine-copper", "Copper", "copper-ore", 17.5, 3600);
export const MINE_TIN_RECIPE = mining("mine-tin", "Tin", "tin-ore", 17.5, 3600);

// ── Smithing ── Smelt at the furnace, smith at the anvil.
export const SMELT_BRONZE_RECIPE: CraftingRecipe = {
  id: "smelt-bronze-bar",
  name: "Bronze Bar",
  skill: "smithing",
  xpPerItem: 6.25,
  timePerItemMs: 2400,
  inputs: [
    { resource: "copper-ore", amount: 1 },
    { resource: "tin-ore", amount: 1 },
  ],
  output: { resource: "bronze-bar", amount: 1 },
  activityLabel: "Smelting Bronze",
  station: "furnace",
};

function smith(output: string, name: string, bars: number, level: number, amount = 1): CraftingRecipe {
  return {
    id: `smith-${output}`,
    name,
    skill: "smithing",
    xpPerItem: 12.5 * bars,
    timePerItemMs: 2400,
    inputs: [{ resource: "bronze-bar", amount: bars }],
    output: { resource: output, amount },
    activityLabel: `Smithing ${name}`,
    unlockCondition: level > 1 ? lvl("smithing", level) : undefined,
    station: "anvil",
  };
}

export const SMITHING_RECIPES: CraftingRecipe[] = [
  smith("bronze-dagger", "Bronze Dagger", 1, 1),
  smith("bronze-axe", "Bronze Axe", 1, 1),
  smith("bronze-pickaxe", "Bronze Pickaxe", 2, 1),
  smith("bronze-full-helm", "Bronze Full Helm", 2, 7),
  smith("bronze-warhammer", "Bronze Warhammer", 3, 9),
  smith("bronze-platelegs", "Bronze Platelegs", 3, 16),
  smith("bronze-platebody", "Bronze Platebody", 5, 18),
  smith("bronze-arrow", "Bronze Arrows (15)", 1, 5, 15),
];

// Prayer: bury bones and scatter ashes, one at a time like any other
// recipe. 1 second each (proposed). Bones give OSRS's 4.5 XP; ashes give
// 2 (proposed, OSRS's plain ashes give none).
function prayer(itemId: string, name: string, xp: number, verb: string, activity: string): CraftingRecipe {
  return {
    id: `${verb.toLowerCase()}-${itemId}`,
    name,
    skill: "prayer",
    xpPerItem: xp,
    timePerItemMs: 1000,
    inputs: [{ resource: itemId, amount: 1 }],
    verb,
    extraStatistic: `buried:${itemId}`,
    activityLabel: activity,
  };
}

export const BURY_BONES_RECIPE = prayer("bones", "Bury Bones", 4.5, "Bury", "Burying Bones");
export const SCATTER_ASHES_RECIPE = prayer("ashes", "Scatter Ashes", 2, "Scatter", "Scattering Ashes");

// Offering at the Stone Altar in the player house: twice the XP of
// burying (proposed; OSRS altars give more), a little slower. Still counts
// toward buried:<id>, so bone achievements keep counting.
const offering = (base: CraftingRecipe, name: string, activity: string): CraftingRecipe => ({
  ...base,
  id: `offer-${base.inputs[0].resource}`,
  name,
  xpPerItem: base.xpPerItem * 2,
  timePerItemMs: 2000,
  verb: "Offer",
  activityLabel: activity,
  station: "altar",
});

export const OFFER_BONES_RECIPE = offering(BURY_BONES_RECIPE, "Offer Bones", "Offering Bones");
export const OFFER_ASHES_RECIPE = offering(SCATTER_ASHES_RECIPE, "Offer Ashes", "Offering Ashes");

// Sawing planks (proposed numbers): an idle way to make the house's
// materials, at the Sawmill in Lumber Camp or a workbench at home.
const sawing = (id: string, name: string, logs: string, plank: string, xp: number, ms: number, level: number): CraftingRecipe => ({
  id,
  name,
  skill: "construction",
  xpPerItem: xp,
  timePerItemMs: ms,
  inputs: [{ resource: logs, amount: 1 }],
  output: { resource: plank, amount: 1 },
  verb: "Saw",
  activityLabel: `Sawing ${name}s`,
  station: "sawmill",
  ...(level > 1 ? { unlockCondition: lvl("construction", level) } : {}),
});

export const SAW_PLANK_RECIPE = sawing("saw-plank", "Plank", "wood", "plank", 3, 3000, 1);
export const SAW_OAK_PLANK_RECIPE = sawing("saw-oak-plank", "Oak Plank", "oak-logs", "oak-plank", 6, 4000, 1);

export const RECIPE_CATALOG: CraftingRecipe[] = [
  WOODEN_BOW_RECIPE,
  SPIN_FLAX_RECIPE,
  STRING_WOODEN_BOW_RECIPE,
  COOK_FISH_RECIPE,
  PICK_FLAX_RECIPE,
  CHOP_NORMAL_TREE_RECIPE,
  CHOP_WILLOW_TREE_RECIPE,
  BURN_LOGS_RECIPE,
  BURN_WILLOW_LOGS_RECIPE,
  CHOP_OAK_TREE_RECIPE,
  BURN_OAK_LOGS_RECIPE,
  FISH_SHRIMPS_RECIPE,
  FISH_TROUT_RECIPE,
  FISH_TUNA_RECIPE,
  FISH_SHARK_RECIPE,
  COOK_SHRIMPS_RECIPE,
  COOK_TROUT_RECIPE,
  COOK_TUNA_RECIPE,
  COOK_SHARK_RECIPE,
  MINE_COPPER_RECIPE,
  MINE_TIN_RECIPE,
  SMELT_BRONZE_RECIPE,
  ...SMITHING_RECIPES,
  BURY_BONES_RECIPE,
  SCATTER_ASHES_RECIPE,
  SAW_PLANK_RECIPE,
  SAW_OAK_PLANK_RECIPE,
  OFFER_BONES_RECIPE,
  OFFER_ASHES_RECIPE,
];

/** Recipes that turn materials into something anywhere, shown on the Home
 *  tab. Gathering recipes (no inputs) are started from resource nodes, and
 *  station recipes from their station, instead. */
export const PROCESSING_RECIPES: CraftingRecipe[] = RECIPE_CATALOG.filter((r) => r.inputs.length > 0 && !r.station);

/** Recipes made at a station type, for that station's card. */
export function recipesAtStation(station: CraftingRecipe["station"]): CraftingRecipe[] {
  return RECIPE_CATALOG.filter((r) => r.station === station);
}

const RECIPES_BY_ID = new Map(RECIPE_CATALOG.map((r) => [r.id, r]));

export function getRecipe(id: string): CraftingRecipe | undefined {
  return RECIPES_BY_ID.get(id);
}