import type { MapLocation } from "../engine/types";

// Coordinates are pixels on the world map art (MAP_WIDTH x MAP_HEIGHT),
// placed where the matching OSRS place is drawn: Riverside Town is
// Lumbridge, Lake Shore is Port Sarim, Dark Forest is Draynor Manor's
// woods, Quarry is the Lumbridge Swamp mine. Travel time comes from road
// length in these units (see roads.ts).

/** Size of the world map art, in the units every x/y on the map uses. */
export const MAP_WIDTH = 2560;
export const MAP_HEIGHT = 1440;

export const MAP_LOCATIONS: MapLocation[] = [
  {
    id: "town",
    name: "Riverside Town",
    x: 1506,
    y: 842,
    // No unlockCondition — the starting location, always available.
  },
  {
    id: "lumber-camp",
    name: "Lumber Camp",
    x: 1592,
    y: 694,
  },
  {
    id: "lake-shore",
    name: "Lake Shore",
    x: 1334,
    y: 846,
    onArriveSetFlag: "discoveredLakeShore",
    // Always travelable — arriving here for the first time is what sets the
    // discoveredLakeShore flag, which is what the Fishing Hut building has
    // been waiting on.
  },
  {
    id: "dark-forest",
    name: "Dark Forest",
    x: 1406,
    y: 708,
    // Travel requirement example: needs a skill level to enter, not a flag.
    unlockCondition: { kind: "skillLevel", skill: "woodcutting", atLeast: 10 },
    onArriveSetFlag: "discoveredDarkForest",
  },
  {
    id: "hidden-grove",
    name: "Hidden Grove",
    x: 1334,
    y: 628,
    // Chained-unlock example: only reachable after discovering Lake Shore.
    unlockCondition: { kind: "flag", flag: "discoveredLakeShore", label: "Discover Lake Shore first" },
  },
  {
    // Mining: copper and tin rocks.
    id: "quarry",
    name: "Quarry",
    x: 1484,
    y: 898,
  },
  {
    // Aggie the witch lives here and recharges jewellery.
    id: "draynor-village",
    name: "Draynor Village",
    x: 1416,
    y: 818,
  },
  {
    // Behind a toll gate east of Lumbridge, as in OSRS: 10 GP there, 100
    // here (Proposed). Prince Ali Rescue waives it.
    id: "al-kharid",
    name: "Al-Kharid",
    x: 1630,
    y: 830,
    travelCost: [{ resource: "gp", amount: 100 }],
    travelCostWaivedBy: "princeAliRescued",
  },
];

const LOCATIONS_BY_ID = new Map(MAP_LOCATIONS.map((l) => [l.id, l]));

export function getLocation(id: string): MapLocation | undefined {
  return LOCATIONS_BY_ID.get(id);
}