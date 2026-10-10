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
};

export const PICK_FLAX_RECIPE: CraftingRecipe = {
  id: "pick-flax",
  name: "Flax",
  skill: "farming",
  xpPerItem: 2,
  timePerItemMs: 1500,
  inputs: [],
  output: { resource: "flax", amount: 1 },
};

export const CHOP_NORMAL_TREE_RECIPE: CraftingRecipe = {
  id: "chop-normal-tree",
  name: "Normal Tree",
  skill: "woodcutting",
  xpPerItem: 3,
  timePerItemMs: 3000,
  inputs: [],
  output: { resource: "wood", amount: 1 },
};

export const CHOP_WILLOW_TREE_RECIPE: CraftingRecipe = {
  id: "chop-willow-tree",
  name: "Willow Tree",
  skill: "woodcutting",
  xpPerItem: 15, // meaningfully higher than Normal Tree's 3 — better XP for the harder requirement
  timePerItemMs: 4000,
  inputs: [],
  output: { resource: "willow-logs", amount: 1 },
  unlockCondition: { kind: "skillLevel", skill: "woodcutting", atLeast: 30 },
};

export const RECIPE_CATALOG: CraftingRecipe[] = [
  WOODEN_BOW_RECIPE,
  SPIN_FLAX_RECIPE,
  STRING_WOODEN_BOW_RECIPE,
  COOK_FISH_RECIPE,
  PICK_FLAX_RECIPE,
  CHOP_NORMAL_TREE_RECIPE,
  CHOP_WILLOW_TREE_RECIPE,
];

/** Recipes that turn materials into something, shown on the Home tab.
 *  Gathering recipes (no inputs) are started from resource nodes instead. */
export const PROCESSING_RECIPES: CraftingRecipe[] = RECIPE_CATALOG.filter((r) => r.inputs.length > 0);

const RECIPES_BY_ID = new Map(RECIPE_CATALOG.map((r) => [r.id, r]));

export function getRecipe(id: string): CraftingRecipe | undefined {
  return RECIPES_BY_ID.get(id);
}