import type { CraftingRecipe } from "../engine/types";

// Recipes cover both "craft something from materials" (Fletching a bow) and
// "gather something from nothing but time" (picking flax) — a gathering
// recipe is just one with an empty inputs array. No engine change needed
// for that; startCraftJob already handles zero-cost recipes correctly.
export const WOODEN_BOW_RECIPE: CraftingRecipe = {
  id: "wooden-bow",
  name: "Wooden Bow",
  skill: "fletching",
  xpPerItem: 5,
  timePerItemMs: 2000,
  inputs: [{ resource: "wood", amount: 1 }],
  output: { kind: "item", itemDefId: "wooden-bow-u", quantity: 1, stackable: true },
};

export const PICK_FLAX_RECIPE: CraftingRecipe = {
  id: "pick-flax",
  name: "Flax",
  skill: "farming",
  xpPerItem: 2,
  timePerItemMs: 1500,
  inputs: [],
  output: { kind: "resource", resource: "flax", amount: 1 },
};

export const CHOP_NORMAL_TREE_RECIPE: CraftingRecipe = {
  id: "chop-normal-tree",
  name: "Normal Tree",
  skill: "woodcutting",
  xpPerItem: 3,
  timePerItemMs: 3000,
  inputs: [],
  output: { kind: "resource", resource: "wood", amount: 1 },
};

export const CHOP_WILLOW_TREE_RECIPE: CraftingRecipe = {
  id: "chop-willow-tree",
  name: "Willow Tree",
  skill: "woodcutting",
  xpPerItem: 15, // meaningfully higher than Normal Tree's 3 — better XP for the harder requirement
  timePerItemMs: 4000,
  inputs: [],
  output: { kind: "resource", resource: "willow-logs", amount: 1 },
  unlockCondition: { kind: "skillLevel", skill: "woodcutting", atLeast: 30 },
};

export const RECIPE_CATALOG: CraftingRecipe[] = [
  WOODEN_BOW_RECIPE,
  PICK_FLAX_RECIPE,
  CHOP_NORMAL_TREE_RECIPE,
  CHOP_WILLOW_TREE_RECIPE,
];

export function getRecipe(id: string): CraftingRecipe | undefined {
  return RECIPE_CATALOG.find((r) => r.id === id);
}