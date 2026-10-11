import type { MapLocation } from "../engine/types";

// Coordinates are in an arbitrary map-image space — swap in real art later
// at any resolution, the engine only cares about relative distance, not
// actual pixel size. Placeholder 2000x2000 space for now.
export const MAP_LOCATIONS: MapLocation[] = [
  {
    id: "town",
    name: "Riverside Town",
    x: 1000,
    y: 1000,
    // No unlockCondition — the starting location, always available.
  },
  {
    id: "lumber-camp",
    name: "Lumber Camp",
    x: 1150,
    y: 950,
  },
  {
    id: "lake-shore",
    name: "Lake Shore",
    x: 1300,
    y: 750,
    onArriveSetFlag: "discoveredLakeShore",
    // Always travelable — arriving here for the first time is what sets the
    // discoveredLakeShore flag, which is what the Fishing Hut building has
    // been waiting on.
  },
  {
    id: "dark-forest",
    name: "Dark Forest",
    x: 800,
    y: 1300,
    // Travel requirement example: needs a skill level to enter, not a flag.
    unlockCondition: { kind: "skillLevel", skill: "woodcutting", atLeast: 10 },
    onArriveSetFlag: "discoveredDarkForest",
  },
  {
    id: "hidden-grove",
    name: "Hidden Grove",
    x: 1400,
    y: 600,
    // Chained-unlock example: only reachable after discovering Lake Shore.
    unlockCondition: { kind: "flag", flag: "discoveredLakeShore", label: "Discover Lake Shore first" },
  },
  {
    // Mining: copper and tin rocks.
    id: "quarry",
    name: "Quarry",
    x: 1250,
    y: 1180,
  },
  {
    // Aggie the witch lives here and recharges jewellery.
    id: "draynor-village",
    name: "Draynor Village",
    x: 720,
    y: 920,
  },
];

const LOCATIONS_BY_ID = new Map(MAP_LOCATIONS.map((l) => [l.id, l]));

export function getLocation(id: string): MapLocation | undefined {
  return LOCATIONS_BY_ID.get(id);
}