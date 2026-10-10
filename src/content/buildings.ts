import type { BuildingDefinition } from "../engine/types";

// Static content definitions. Nobody owns one by default unless it sets
// startingQuantity — production only happens once the player buys one.
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
    id: "lumbermill",
    name: "Lumbermill",
    resource: "wood",
    baseRatePerSecond: 0.5,
    baseCost: [{ resource: "gp", amount: 10 }],
    costScalingFactor: 1.15,
    // No unlockCondition — available from the start, just costs GP.
  },
  {
    id: "quarry",
    name: "Quarry",
    resource: "coal",
    baseRatePerSecond: 0.3,
    baseCost: [{ resource: "gp", amount: 50 }],
    costScalingFactor: 1.15,
    // Milestone reveal: once the player has EVER earned 100 gp (not "currently
    // holds" — spending back down below 100 shouldn't re-lock it), the Quarry
    // becomes purchasable. This is the "magically appears at 100 gold" case.
    unlockCondition: { kind: "resourceLifetimeAtLeast", resource: "gp", amount: 100 },
  },
  {
    id: "fishing-hut",
    name: "Fishing Hut",
    resource: "raw-fish",
    baseRatePerSecond: 0.4,
    baseCost: [{ resource: "gp", amount: 30 }],
    costScalingFactor: 1.15,
    // Map-driven unlock: discovering Lake Shore for the first time sets this
    // flag (GameEngine.arriveAt) — confirmed working, this is the reference
    // example the pattern below (Hunter's Camp / Dark Forest) copies.
    unlockCondition: { kind: "flag", flag: "discoveredLakeShore" },
  },
  {
    id: "hunters-camp",
    name: "Hunter's Camp",
    resource: "pelt",
    baseRatePerSecond: 0.2,
    baseCost: [{ resource: "gp", amount: 40 }],
    costScalingFactor: 1.15,
    // Same pattern, second location — proves this isn't a one-off special
    // case: discovering Dark Forest unlocks this the same way Lake Shore
    // unlocks the Fishing Hut.
    unlockCondition: { kind: "flag", flag: "discoveredDarkForest" },
  },
];