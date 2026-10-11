import type { BuildingDefinition } from "../engine/types";

// Static content definitions. Nobody owns one by default unless it sets
// startingQuantity — production only happens once the player buys one.
//
// Every requirement for a building lives in its one entry below, so they're
// easy to change: baseCost is what the first one costs (gold and materials),
// unlockCondition gates buying it (a Construction level, a discovery), and
// constructionXp is what each one bought gives. Note that costScalingFactor
// scales every entry in baseCost, materials included: the 2nd Fishing Hut
// costs 115 Raw Shrimps.
// unlockCondition (if present) gates whether it can be bought/discovered at
// all yet; omit it for buildings available from the very start (still costs
// money, just not gated). Saves store only owned counts, so edits here reach
// existing players.
export const BUILDING_CATALOG: BuildingDefinition[] = [
  {
    id: "base-gp",
    name: "Base Income",
    resource: "gp",
    baseRatePerSecond: 1,
    // No baseCost — not purchased or sellable, just always-on. Set
    // startingQuantity to 0 if GP should start at 0 until the player
    // triggers something.
    startingQuantity: 1,
  },
  {
    // Early building: gold plus logs, no level (proposed).
    id: "lumbermill",
    name: "Lumbermill",
    resource: "wood",
    baseRatePerSecond: 0.5,
    baseCost: [
      { resource: "gp", amount: 10 },
      { resource: "wood", amount: 5 },
    ],
    costScalingFactor: 1.15,
    constructionXp: 30,
  },
  {
    // Early building: gold plus logs, no level (proposed). Its id stays
    // "quarry" so existing saves keep theirs; Quarry is now the Mining
    // location, so the building is called Coal Mine.
    id: "quarry",
    name: "Coal Mine",
    resource: "coal",
    baseRatePerSecond: 0.3,
    baseCost: [
      { resource: "gp", amount: 50 },
      { resource: "wood", amount: 10 },
    ],
    costScalingFactor: 1.15,
    constructionXp: 50,
    // Milestone reveal: once the player has EVER earned 100 gp (not "currently
    // holds" — spending back down below 100 shouldn't re-lock it), the Coal
    // Mine becomes purchasable.
    unlockCondition: { kind: "resourceLifetimeAtLeast", resource: "gp", amount: 100 },
  },
  {
    // Decided: Construction 5, 10,000 gold, 100 raw shrimps and 100 logs.
    // Slower than fishing by hand on purpose: passive income, not a
    // replacement for the skill.
    id: "fishing-hut",
    name: "Fishing Hut",
    resource: "raw-fish",
    baseRatePerSecond: 0.1,
    baseCost: [
      { resource: "gp", amount: 10_000 },
      { resource: "raw-shrimps", amount: 100 },
      { resource: "wood", amount: 100 },
    ],
    costScalingFactor: 1.15,
    constructionXp: 150,
    unlockCondition: {
      kind: "all",
      conditions: [
        { kind: "flag", flag: "discoveredLakeShore", label: "Discover Lake Shore first" },
        { kind: "skillLevel", skill: "construction", atLeast: 5 },
      ],
    },
  },
  {
    // Decided: Construction 15, 100,000 gold and 100 bones.
    id: "hunters-camp",
    name: "Hunter's Camp",
    resource: "pelt",
    baseRatePerSecond: 0.2,
    baseCost: [
      { resource: "gp", amount: 100_000 },
      { resource: "bones", amount: 100 },
    ],
    costScalingFactor: 1.15,
    constructionXp: 400,
    unlockCondition: {
      kind: "all",
      conditions: [
        { kind: "flag", flag: "discoveredDarkForest", label: "Discover the Dark Forest first" },
        { kind: "skillLevel", skill: "construction", atLeast: 15 },
      ],
    },
  },
];