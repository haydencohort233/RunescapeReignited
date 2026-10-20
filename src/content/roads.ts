import type { RoadDefinition } from "../engine/types";

// Roads between world-map locations, in map-art pixels (see mapLocations.ts).
// Travel follows the shortest chain of roads, so a place with one road in
// is a dead end you walk back out of. `via` points bend a road to follow
// the paths on the art; list them from `from` towards `to`.
// validateContent() checks every location can be reached from the start.
export const ROADS: RoadDefinition[] = [
  { from: "town", to: "draynor-village", via: [{ x: 1462, y: 832 }] },
  { from: "town", to: "quarry" },
  { from: "town", to: "lumber-camp", via: [{ x: 1530, y: 760 }] },
  { from: "draynor-village", to: "lake-shore" },
  { from: "draynor-village", to: "dark-forest" },
  // Port Sarim north past Falador to the grove.
  { from: "lake-shore", to: "hidden-grove", via: [{ x: 1300, y: 760 }] },
  // Through the toll gate. A dead end, so no other trip pays the toll.
  { from: "town", to: "al-kharid" },
  // Agility shortcuts: quicker, but only once the level is reached.
  {
    from: "draynor-village",
    to: "hidden-grove",
    name: "Stepping stones",
    requires: { kind: "skillLevel", skill: "agility", atLeast: 20 },
  },
];
