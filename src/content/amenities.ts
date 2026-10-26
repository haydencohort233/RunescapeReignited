import type { StationType, UnlockCondition } from "../engine/types";

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
  /** Which recipes run here: every recipe with this `station`. */
  station: StationType;
}

export interface NpcAmenity extends BaseAmenity {
  kind: "npc";
  npcId: string; // references content/npcs.ts
}

export interface DungeonEntranceAmenity extends BaseAmenity {
  kind: "dungeonEntrance";
  dungeonId: string; // references content/dungeons.ts
}

export interface JobBoardAmenity extends BaseAmenity {
  kind: "jobBoard";
  boardId: string; // references content/jobBoards.ts
}

export interface CombatEncounterAmenity extends BaseAmenity {
  kind: "combatEncounter";
  enemyId: string; // references content/enemies.ts
}

/** The way into the player house. Opens the house in place of the town
 *  picture; the house's rules (content/house.ts portalLocationIds) decide
 *  where it can be used. */
export interface HousePortalAmenity extends BaseAmenity {
  kind: "housePortal";
}

export type Amenity =
  | HousePortalAmenity
  | ShopAmenity
  | ResourceNodeAmenity
  | CraftingStationAmenity
  | DungeonEntranceAmenity
  | JobBoardAmenity
  | CombatEncounterAmenity
  | NpcAmenity;

export const AMENITY_CATALOG: Amenity[] = [
  {
    id: "town-house-portal",
    locationId: "town",
    kind: "housePortal",
    name: "House Portal",
    description: "Step through to your own house and yard, or visit someone else's with their share code.",
  },
  {
    id: "lumber-camp-sawmill",
    locationId: "lumber-camp",
    kind: "craftingStation",
    name: "Sawmill",
    description: "A saw bench. Cut logs into planks for building.",
    station: "sawmill",
  },
  {
    id: "lumber-camp-sawmill-operator",
    locationId: "lumber-camp",
    kind: "shop",
    name: "Sawmill Operator",
    description: "Pays no mind to splinters. Planks your logs for a fee.",
    shopId: "sawmill-operator",
  },
  {
    id: "town-hans",
    locationId: "town",
    kind: "npc",
    name: "Hans",
    description: "The castle servant. He hears everything that goes on in town.",
    npcId: "hans",
  },
  {
    id: "quarry-doric",
    locationId: "quarry",
    kind: "npc",
    name: "Doric",
    description: "The quarry master, always short of bronze for new tools.",
    npcId: "doric",
  },
  {
    id: "draynor-leela",
    locationId: "draynor-village",
    kind: "npc",
    name: "Leela",
    description: "A friend of Prince Ali, waiting for news from Al-Kharid.",
    npcId: "leela",
  },
  {
    id: "al-kharid-furnace",
    locationId: "al-kharid",
    kind: "craftingStation",
    name: "Furnace",
    description: "The desert furnace. Smelt ore into bars here.",
    station: "furnace",
  },
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
    id: "lumber-camp-job-board",
    locationId: "lumber-camp",
    kind: "jobBoard",
    name: "Camp Job Board",
    description: "The foreman pins up orders for logs, and bounties on the bandits.",
    boardId: "lumber-camp-board",
  },
  {
    id: "lake-shore-job-board",
    locationId: "lake-shore",
    kind: "jobBoard",
    name: "Fishmonger's Board",
    description: "Orders for fresh fish. The rarer the catch, the better the pay.",
    boardId: "lake-shore-board",
  },
  {
    id: "quarry-job-board",
    locationId: "quarry",
    kind: "jobBoard",
    name: "Quarry Job Board",
    description: "The quarry master's orders for ore.",
    boardId: "quarry-board",
  },
  {
    id: "town-armoury",
    locationId: "town",
    kind: "shop",
    name: "Riverside Armoury",
    description: "Weapons, armour and arrows.",
    shopId: "riverside-armoury",
  },
  {
    id: "aubury-runes",
    locationId: "town",
    kind: "shop",
    name: "Aubury's Rune Shop",
    description: "Runes and staves for aspiring mages.",
    shopId: "aubury-runes",
  },
  {
    id: "town-range",
    locationId: "town",
    kind: "craftingStation",
    name: "Range",
    description: "A cooking range. Raw fish cooks here.",
    station: "range",
  },
  {
    id: "town-furnace",
    locationId: "town",
    kind: "craftingStation",
    name: "Furnace",
    description: "A stone furnace. Smelt ore into bars here.",
    station: "furnace",
  },
  {
    id: "town-anvil",
    locationId: "town",
    kind: "craftingStation",
    name: "Anvil",
    description: "Hammer bars into weapons, armour and tools.",
    station: "anvil",
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
  // Regular Trees: same recipe at TWO locations — proves a resource can be
  // available in multiple areas without any special-casing.
  {
    id: "town-trees",
    locationId: "town",
    kind: "resourceNode",
    name: "Regular Trees",
    description: "A stand of ordinary trees.",
    actionLabel: "Chop Tree",
    recipeId: "chop-normal-tree",
    gatherMode: "session",
  },
  {
    id: "dark-forest-trees",
    locationId: "dark-forest",
    kind: "resourceNode",
    name: "Regular Trees",
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
    dungeonId: "overgrown-den",
  },
  {
    id: "dark-forest-goblin",
    locationId: "dark-forest",
    kind: "combatEncounter",
    name: "Goblin",
    description: "A goblin, spoiling for a fight.",
    enemyId: "goblin",
  },
  // ── Lake Shore fishing ──
  {
    id: "lake-shore-net-spot",
    locationId: "lake-shore",
    kind: "resourceNode",
    name: "Net Fishing Spot",
    description: "Shallow water full of shrimps.",
    actionLabel: "Net Shrimps",
    recipeId: "fish-shrimps",
    gatherMode: "session",
  },
  {
    id: "lake-shore-rod-spot",
    locationId: "lake-shore",
    kind: "resourceNode",
    name: "Rod Fishing Spot",
    description: "Trout rise here in the current.",
    actionLabel: "Catch Trout",
    recipeId: "fish-trout",
    gatherMode: "session",
  },
  {
    id: "lake-shore-tuna-spot",
    locationId: "lake-shore",
    kind: "resourceNode",
    name: "Harpoon Fishing Spot",
    description: "Deeper water. Tuna swim here.",
    actionLabel: "Harpoon Tuna",
    recipeId: "fish-tuna",
    gatherMode: "session",
  },
  {
    id: "lake-shore-shark-spot",
    locationId: "lake-shore",
    kind: "resourceNode",
    name: "Shark Fishing Spot",
    description: "Something large circles out past the drop-off.",
    actionLabel: "Harpoon Sharks",
    recipeId: "fish-shark",
    gatherMode: "session",
  },
  {
    id: "lake-shore-fishing-shop",
    locationId: "lake-shore",
    kind: "shop",
    name: "Gerrant's Fishy Business",
    description: "Fishing gear.",
    shopId: "gerrants-fishing",
  },
  // ── Lumber Camp ──
  {
    id: "lumber-camp-trees",
    locationId: "lumber-camp",
    kind: "resourceNode",
    name: "Regular Trees",
    description: "Trees the camp hasn't got to yet.",
    actionLabel: "Chop Tree",
    recipeId: "chop-normal-tree",
    gatherMode: "session",
  },
  {
    id: "lumber-camp-bandit",
    locationId: "lumber-camp",
    kind: "combatEncounter",
    name: "Bandit",
    description: "A bandit who preys on the woodcutters.",
    enemyId: "bandit",
  },
  // ── Hidden Grove ──
  {
    id: "hidden-grove-oaks",
    locationId: "hidden-grove",
    kind: "resourceNode",
    name: "Oak Trees",
    description: "Old oaks in a quiet clearing.",
    actionLabel: "Chop Oak",
    recipeId: "chop-oak-tree",
    gatherMode: "session",
  },
  // ── Quarry ──
  {
    id: "quarry-copper",
    locationId: "quarry",
    kind: "resourceNode",
    name: "Copper Rocks",
    description: "Rocks streaked with copper.",
    actionLabel: "Mine Copper",
    recipeId: "mine-copper",
    gatherMode: "session",
  },
  {
    id: "quarry-tin",
    locationId: "quarry",
    kind: "resourceNode",
    name: "Tin Rocks",
    description: "Rocks with a dull grey tin seam.",
    actionLabel: "Mine Tin",
    recipeId: "mine-tin",
    gatherMode: "session",
  },
  // ── Draynor Village ──
  {
    id: "draynor-aggie",
    locationId: "draynor-village",
    kind: "npc",
    name: "Aggie",
    description: "A witch who knows how to put the magic back into jewellery.",
    npcId: "aggie",
  },
  {
    id: "draynor-servants-guild",
    locationId: "draynor-village",
    kind: "npc",
    name: "Servants' Guild",
    description: "Hire a servant to work the facilities in your house while you're busy elsewhere.",
    npcId: "guildmistress-wren",
  },
];

/** One icon per amenity kind, used wherever amenities are listed. */
export const AMENITY_ICON: Record<Amenity["kind"], string> = {
  housePortal: "🏠",
  shop: "🛒",
  resourceNode: "🌾",
  craftingStation: "🔥",
  dungeonEntrance: "🕳️",
  jobBoard: "📋",
  combatEncounter: "⚔️",
  npc: "💬",
};

export function getAmenitiesAtLocation(locationId: string): Amenity[] {
  return AMENITY_CATALOG.filter((a) => a.locationId === locationId);
}