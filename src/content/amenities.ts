import type { UnlockCondition } from "../engine/types";

/**
 * Something present AT a location that the player can interact with —
 * a shop, a resource node ("Flax Field"), a crafting station ("Furnace"),
 * or (later) a dungeon entrance. Deliberately a discriminated union so
 * adding a new kind (combat encounter, quest giver, whatever comes next)
 * is additive — existing kinds and the UI code that renders them don't
 * need to change.
 *
 * Not every location has the same amenities, and that's the point: two
 * locations can both be "unlocked" but offer completely different things
 * to do there.
 */
interface BaseAmenity {
  id: string;
  locationId: string;
  name: string;
  description: string;
  /** Optional gate on the amenity itself, separate from the location's own
   *  unlockCondition — e.g. a location could be open to visit, but one
   *  specific amenity there stays locked until a quest is done. */
  unlockCondition?: UnlockCondition;
}

export interface ShopAmenity extends BaseAmenity {
  kind: "shop";
  shopId: string; // references content/shops.ts
}

export interface ResourceNodeAmenity extends BaseAmenity {
  kind: "resourceNode";
  actionLabel: string; // "Pick Flax" / "Chop Tree"
  recipeId: string; // references content/recipes.ts
  /** "batch" = pick a fixed quantity and stop (Flax: Pick x1/x5/x25).
   *  "session" = open-ended, runs until the time cap (or a missed
   *  keep-alive) — Woodcutting-style. */
  gatherMode: "batch" | "session";
  /** Session-mode tuning — ignored for batch mode. Omit maxDurationMs to
   *  use the engine default (8h). Omit requiresKeepAliveEveryMs for a node
   *  that doesn't need periodic attention. */
  maxDurationMs?: number;
  requiresKeepAliveEveryMs?: number;
}

export interface CraftingStationAmenity extends BaseAmenity {
  kind: "craftingStation";
  // Placeholder — no station-gated recipes exist yet (Fletching doesn't
  // require one currently). This proves the shape exists for when it does.
}

export interface DungeonEntranceAmenity extends BaseAmenity {
  kind: "dungeonEntrance";
  // Placeholder — combat/dungeons aren't designed yet. Having this variant
  // exist now means the Amenity system won't need restructuring once they are.
}

export interface JobBoardAmenity extends BaseAmenity {
  kind: "jobBoard";
  boardId: string; // references content/jobBoards.ts
}

export interface CombatEncounterAmenity extends BaseAmenity {
  kind: "combatEncounter";
  enemyId: string; // references content/enemies.ts
}

export type Amenity =
  | ShopAmenity
  | ResourceNodeAmenity
  | CraftingStationAmenity
  | DungeonEntranceAmenity
  | JobBoardAmenity
  | CombatEncounterAmenity;

export const AMENITY_CATALOG: Amenity[] = [
  {
    id: "bobs-shop",
    locationId: "town",
    kind: "shop",
    name: "Bob's Famous Axes",
    description: "A shop run by Bob.",
    shopId: "bobs-famous-axes",
  },
  {
    id: "town-job-board",
    locationId: "town",
    kind: "jobBoard",
    name: "Town Notice Board",
    description: "A board where locals post tasks for anyone willing to help.",
    boardId: "town-board",
  },
  {
    id: "town-furnace",
    locationId: "town",
    kind: "craftingStation",
    name: "Furnace",
    description: "A stone furnace for smithing. Nothing usable here yet.",
  },
  {
    id: "lake-shore-flax-field",
    locationId: "lake-shore",
    kind: "resourceNode",
    name: "Flax Field",
    description: "Wild flax growing near the water.",
    actionLabel: "Pick Flax",
    recipeId: "pick-flax",
    gatherMode: "batch",
  },
  // Normal Trees: same recipe at TWO locations — proves a resource can be
  // available in multiple areas without any special-casing.
  {
    id: "town-trees",
    locationId: "town",
    kind: "resourceNode",
    name: "Trees",
    description: "A stand of ordinary trees.",
    actionLabel: "Chop Tree",
    recipeId: "chop-normal-tree",
    gatherMode: "session",
  },
  {
    id: "dark-forest-trees",
    locationId: "dark-forest",
    kind: "resourceNode",
    name: "Trees",
    description: "More of the same trees, deeper in.",
    actionLabel: "Chop Tree",
    recipeId: "chop-normal-tree",
    gatherMode: "session",
  },
  // Willow Trees: only referenced by ONE amenity anywhere — exclusive to
  // Lake Shore. Also demonstrates the keep-alive option and a distinct
  // output resource per node type.
  {
    id: "lake-shore-willows",
    locationId: "lake-shore",
    kind: "resourceNode",
    name: "Willow Trees",
    description: "Willows growing along the shoreline. Slower, but better wood.",
    actionLabel: "Chop Willow",
    recipeId: "chop-willow-tree",
    gatherMode: "session",
    requiresKeepAliveEveryMs: 2 * 60 * 60 * 1000, // 2 hours — your "click the tree" idea
  },
  {
    id: "dark-forest-den",
    locationId: "dark-forest",
    kind: "dungeonEntrance",
    name: "Overgrown Den",
    description: "A dark opening in the undergrowth. Something lives in there.",
    // Not wired to the Den Guardian boss yet — that's a dungeon-sequence
    // concern (Phase 4, deliberately deferred).
  },
  {
    id: "dark-forest-goblin",
    locationId: "dark-forest",
    kind: "combatEncounter",
    name: "Goblin",
    description: "A goblin, spoiling for a fight.",
    enemyId: "goblin",
  },
];

export function getAmenitiesAtLocation(locationId: string): Amenity[] {
  return AMENITY_CATALOG.filter((a) => a.locationId === locationId);
}