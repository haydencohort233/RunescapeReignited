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
    unlockCondition: { kind: "flag", flag: "discoveredLakeShore" },
  },
];

export function getLocation(id: string): MapLocation | undefined {
  return MAP_LOCATIONS.find((l) => l.id === id);
}