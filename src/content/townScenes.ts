/**
 * Town scenes: the picture you see on the Home tab when you arrive
 * somewhere, Neopets-style, with a name tag on everything you can click.
 *
 * HOW TO MOVE THINGS
 * Every position is a percentage of the picture: x 0 is the left edge,
 * x 100 the right edge, y 0 the top, y 100 the bottom. A spot's x/y is
 * where the bottom middle of its building sits (where it touches the
 * ground), so its name tag floats above that point.
 *
 * The easy way: Settings > Dev tools > "Scene layout editor". Then on
 * Home you can drag buildings, trees, rocks and path points around, and
 * press "Copy layout" to get this location's block with the new numbers.
 * Paste it over the matching block below.
 *
 * WHAT'S IN A SCENE
 * - theme: the ground and tree colours (see SCENE_THEMES).
 * - river / lake / cliff: optional. river is the y where the bank starts
 *   at the bottom; lake and cliff are the y where they end at the top.
 *   bridge: true puts a bridge where the first path meets the river.
 * - plaza: the round clearing paths meet at (null for none).
 * - spots: one per amenity id (content/amenities.ts). Optional extras:
 *   sprite (pick a different drawing), label (different name tag),
 *   roof and sign (shop colours and the emoji on the sign).
 * - paths: each is a list of points; the dirt road curves smoothly
 *   through them. Add a middle point to bend a road.
 * - decor: trees, willows, bushes, rocks, stumps, log piles and ponds.
 *   size scales it (1 is normal). Later entries draw in front, but the
 *   game sorts by y anyway so things lower on screen overlap the ones
 *   behind them.
 *
 * The phone layout uses the same numbers in a taller picture, so things
 * spread out vertically on their own. An amenity with no spot here still
 * shows up (bottom row), and a test lists which ones are missing.
 */

/** A point on the picture, in percent (0 to 100). */
export interface ScenePoint {
  x: number;
  y: number;
}

/** The drawings available for spots (see components/scene/sprites.ts). */
export type SpotSprite =
  "shop" | "board" | "oven" | "furnace" | "anvil" | "trees" | "oaks" | "willows" | "fishing" | "rocks" | "flax" | "cave" | "camp" | "cottage";

export interface SceneSpot extends ScenePoint {
  /** Overrides the drawing picked from the amenity's kind. */
  sprite?: SpotSprite;
  /** Overrides the name tag ("Aggie's House" instead of "Aggie"). */
  label?: string;
  /** Shop roof colour, any CSS colour. */
  roof?: string;
  /** Emoji on a shop's round sign. */
  sign?: string;
  /** Size multiplier, 1 is normal. */
  size?: number;
}

export type DecorKind = "tree" | "pine" | "willow" | "bush" | "rock" | "stump" | "logs" | "pond";

export interface SceneDecor extends ScenePoint {
  kind: DecorKind;
  /** 1 is normal size. */
  size?: number;
}

export type SceneThemeId = "town" | "camp" | "lake" | "darkForest" | "grove" | "quarry" | "swamp";

export interface TownScene {
  theme: SceneThemeId;
  river?: number;
  bridge?: boolean;
  lake?: number;
  cliff?: number;
  plaza: ScenePoint | null;
  spots: Record<string, SceneSpot>;
  paths: ScenePoint[][];
  decor: SceneDecor[];
}

export interface SceneTheme {
  /** Ground colour in the middle and at the edges. */
  ground: [string, string];
  path: string;
  pathEdge: string;
  /** Tree canopy colours, picked per tree. */
  trees: string[];
  /** Little flowers scattered on the grass. */
  flowers: string[];
  /** How many flowers and grass tufts (1 is normal). */
  scatter: number;
  /** Darker edges and fireflies. */
  dark?: boolean;
  /** Soft light beams across the picture. */
  sunbeams?: boolean;
}

export const SCENE_THEMES: Record<SceneThemeId, SceneTheme> = {
  town: {
    ground: ["#9bd067", "#6faa45"],
    path: "#ecd9a2",
    pathEdge: "#c4a46a",
    trees: ["#3f8f3a", "#4fa245", "#2f7a2e"],
    flowers: ["#ffffff", "#ffd84d", "#ff8fb1"],
    scatter: 1,
  },
  camp: {
    ground: ["#a3cc6a", "#78a84a"],
    path: "#dcc08c",
    pathEdge: "#b0915d",
    trees: ["#3c8a37", "#2e7430", "#4f9c43"],
    flowers: ["#ffffff", "#ffd84d"],
    scatter: 1,
  },
  lake: { ground: ["#a8d872", "#7cb84f"], path: "#eedc9f", pathEdge: "#c9ad6d", trees: ["#3f8f3a", "#58a84a"], flowers: ["#ffffff", "#9fd3ff"], scatter: 1 },
  darkForest: {
    ground: ["#4d7a43", "#2b4f29"],
    path: "#8f7d58",
    pathEdge: "#5e5038",
    trees: ["#1f4a23", "#173a1b", "#2b5a2c"],
    flowers: ["#c7e86b"],
    scatter: 0.7,
    dark: true,
  },
  grove: {
    ground: ["#b2e47c", "#7fc057"],
    path: "#efe0aa",
    pathEdge: "#c8ad72",
    trees: ["#3a8a3c", "#55a84e", "#6fbf5c"],
    flowers: ["#ffffff", "#ffd84d", "#ff8fb1", "#c99bff"],
    scatter: 2.5,
    sunbeams: true,
  },
  quarry: { ground: ["#d6bf93", "#b0946a"], path: "#eadbb5", pathEdge: "#a88a5e", trees: ["#6d8f45", "#5a7d3a"], flowers: [], scatter: 0.6 },
  swamp: {
    ground: ["#8fb876", "#62875a"],
    path: "#cdb98c",
    pathEdge: "#9e8a62",
    trees: ["#4b7a3e", "#3d6a33", "#5a8a49"],
    flowers: ["#e8e2ff", "#ffffff"],
    scatter: 1,
  },
};

export const TOWN_SCENES: Record<string, TownScene> = {
  town: {
    theme: "town",
    river: 92,
    bridge: true,
    plaza: { x: 49.8, y: 58.7 },
    spots: {
      "bobs-shop": { x: 22, y: 36 },
      "town-job-board": { x: 50, y: 31 },
      "town-armoury": { x: 78, y: 36 },
      "aubury-runes": { x: 34.3, y: 56.2 },
      "town-range": { x: 65.5, y: 56.2 },
      "town-furnace": { x: 28.1, y: 81.4 },
      "town-anvil": { x: 48.9, y: 79.6 },
      "town-trees": { x: 74.1, y: 79.6 },
    },
    paths: [
      [{ x: 52.8, y: 100 }, { x: 49.8, y: 78.7 }, { x: 49.8, y: 58.7 }],
      [{ x: 22, y: 39 }, { x: 33, y: 48 }, { x: 49.8, y: 58.7 }],
      [{ x: 50, y: 34 }, { x: 51.4, y: 48.4 }, { x: 49.8, y: 58.7 }],
      [{ x: 78, y: 39 }, { x: 64, y: 47 }, { x: 49.8, y: 58.7 }],
      [{ x: 34.3, y: 59.2 }, { x: 42, y: 60 }, { x: 49.8, y: 58.7 }],
      [{ x: 65.5, y: 59.2 }, { x: 58.7, y: 56.9 }, { x: 49.8, y: 58.7 }],
      [{ x: 28.1, y: 84.4 }, { x: 42.1, y: 73.5 }, { x: 49.8, y: 58.7 }],
      [{ x: 48.9, y: 82.6 }, { x: 52.2, y: 71.7 }, { x: 49.8, y: 58.7 }],
      [{ x: 74.1, y: 82.6 }, { x: 61.3, y: 72.1 }, { x: 49.8, y: 58.7 }],
    ],
    decor: [
      { kind: "tree", x: 9, y: 0.3, size: 0.9 },
      { kind: "tree", x: 99.1, y: 2.5, size: 1.3 },
      { kind: "tree", x: 42.3, y: 5, size: 0.9 },
      { kind: "tree", x: 61.8, y: 7.1 },
      { kind: "tree", x: 91.3, y: 8.3, size: 1.4 },
      { kind: "tree", x: 30.4, y: 8.8, size: 1.1 },
      { kind: "tree", x: 69.4, y: 10.5 },
      { kind: "tree", x: 14.5, y: 11.4, size: 1.3 },
      { kind: "tree", x: 99.9, y: 12.1, size: 1.2 },
      { kind: "tree", x: 26, y: 13.1 },
      { kind: "tree", x: 3.9, y: 14.4, size: 1.3 },
      { kind: "tree", x: 93.4, y: 14.6, size: 1.3 },
      { kind: "tree", x: 66.7, y: 15.5, size: 1.3 },
      { kind: "tree", x: 94, y: 19.7, size: 1.4 },
      { kind: "tree", x: 3.8, y: 29, size: 0.9 },
      { kind: "tree", x: 93, y: 29.3, size: 1.2 },
      { kind: "tree", x: 99.1, y: 30, size: 1.4 },
      { kind: "tree", x: 92.5, y: 37.8, size: 1.3 },
      { kind: "tree", x: 95, y: 51.4, size: 0.9 },
      { kind: "tree", x: 96.1, y: 57.6, size: 0.8 },
      { kind: "tree", x: 2.1, y: 63.7, size: 1.2 },
      { kind: "tree", x: 97.4, y: 67.7, size: 1.4 },
      { kind: "tree", x: 99.1, y: 77.3, size: 1.3 },
      { kind: "tree", x: 6.7, y: 78.9, size: 0.8 },
      { kind: "tree", x: 1, y: 80.4, size: 0.9 },
      { kind: "tree", x: 91.4, y: 81, size: 0.9 },
    ],
  },
  "lumber-camp": {
    theme: "camp",
    plaza: { x: 50.8, y: 54.1 },
    spots: {
      "lumber-camp-job-board": { x: 33.3, y: 36.7 },
      "lumber-camp-trees": { x: 67.3, y: 34.2 },
      "lumber-camp-bandit": { x: 51.7, y: 85.6 },
    },
    paths: [
      [{ x: 53.8, y: 100 }, { x: 52.3, y: 77.2 }, { x: 50.8, y: 54.1 }],
      [{ x: 33.3, y: 39.7 }, { x: 43.4, y: 47.6 }, { x: 50.8, y: 54.1 }],
      [{ x: 67.3, y: 37.2 }, { x: 58.3, y: 46.8 }, { x: 50.8, y: 54.1 }],
      [{ x: 51.7, y: 88.6 }, { x: 54.5, y: 73.2 }, { x: 50.8, y: 54.1 }],
    ],
    decor: [
      { kind: "tree", x: 99.8, y: 2.2, size: 0.8 },
      { kind: "tree", x: 35.7, y: 5.4, size: 1.2 },
      { kind: "tree", x: 71.8, y: 5.6, size: 0.9 },
      { kind: "tree", x: 8.6, y: 6.1, size: 0.9 },
      { kind: "tree", x: 84.3, y: 6.3, size: 1.2 },
      { kind: "tree", x: 2.7, y: 6.3, size: 1.2 },
      { kind: "tree", x: 76.6, y: 7.6, size: 1.2 },
      { kind: "tree", x: 94.1, y: 8, size: 1.1 },
      { kind: "tree", x: 36.7, y: 11.2 },
      { kind: "tree", x: 40.8, y: 11.3, size: 0.9 },
      { kind: "tree", x: 4.7, y: 12.7, size: 1.1 },
      { kind: "tree", x: 51.8, y: 13, size: 0.9 },
      { kind: "tree", x: 28.5, y: 13.8, size: 0.8 },
      { kind: "tree", x: 0.2, y: 14.8 },
      { kind: "tree", x: 80.1, y: 15.2, size: 1.2 },
      { kind: "tree", x: 4, y: 17.9, size: 1.3 },
      { kind: "tree", x: 94.6, y: 26.4, size: 0.8 },
      { kind: "tree", x: 2.1, y: 27.9, size: 1.2 },
      { kind: "tree", x: 7.3, y: 34, size: 1.2 },
      { kind: "tree", x: 95.3, y: 37.1 },
      { kind: "tree", x: 8.3, y: 40.8, size: 0.9 },
      { kind: "tree", x: 1.3, y: 43.9, size: 1.3 },
      { kind: "tree", x: 94, y: 51.7 },
      { kind: "tree", x: 9.7, y: 54.5, size: 1.3 },
      { kind: "tree", x: 91.1, y: 54.8, size: 1.1 },
      { kind: "tree", x: 93.6, y: 63.9, size: 1.3 },
      { kind: "tree", x: 94.1, y: 71.2, size: 1.2 },
      { kind: "tree", x: 1.7, y: 74.2, size: 0.9 },
      { kind: "tree", x: 99.9, y: 77.4 },
      { kind: "tree", x: 96.4, y: 81.2, size: 1.1 },
      { kind: "tree", x: 5.4, y: 88.3, size: 1.3 },
      { kind: "tree", x: 92.6, y: 91.6, size: 1.4 },
      { kind: "tree", x: 96.6, y: 92.7, size: 1.3 },
      { kind: "tree", x: 37.8, y: 94.2, size: 1.2 },
      { kind: "tree", x: 67.2, y: 94.5 },
      { kind: "tree", x: 83.9, y: 95, size: 0.9 },
      { kind: "tree", x: 4.6, y: 95, size: 0.9 },
      { kind: "tree", x: 25.2, y: 97.6, size: 1.2 },
      { kind: "tree", x: 19.7, y: 97.7, size: 1.2 },
      { kind: "tree", x: 1.8, y: 99.2, size: 1.2 },
      { kind: "tree", x: 15.4, y: 99.4, size: 1.4 },
      { kind: "tree", x: 34.4, y: 99.4, size: 0.8 },
      { kind: "stump", x: 8.4, y: 77.9 },
      { kind: "stump", x: 22.9, y: 36.6 },
      { kind: "stump", x: 15.9, y: 38 },
      { kind: "stump", x: 65.4, y: 58.6 },
      { kind: "stump", x: 57, y: 44.4 },
      { kind: "stump", x: 84.2, y: 90.4 },
      { kind: "logs", x: 67.8, y: 64.1 },
    ],
  },
  "lake-shore": {
    theme: "lake",
    lake: 46,
    plaza: { x: 49.9, y: 76.7 },
    spots: {
      "lake-shore-net-spot": { x: 20, y: 41 },
      "lake-shore-rod-spot": { x: 41, y: 25 },
      "lake-shore-tuna-spot": { x: 60, y: 41 },
      "lake-shore-shark-spot": { x: 79, y: 25 },
      "lake-shore-job-board": { x: 33.9, y: 63.3 },
      "lake-shore-flax-field": { x: 67.3, y: 60.8 },
      "lake-shore-willows": { x: 31.3, y: 86.6 },
      "lake-shore-fishing-shop": { x: 67.2, y: 88.2 },
    },
    paths: [
      [{ x: 52.9, y: 100 }, { x: 48.9, y: 89.8 }, { x: 49.9, y: 76.7 }],
      [{ x: 33.9, y: 66.3 }, { x: 41, y: 71.8 }, { x: 49.9, y: 76.7 }],
      [{ x: 67.3, y: 63.8 }, { x: 61.8, y: 72.7 }, { x: 49.9, y: 76.7 }],
      [{ x: 31.3, y: 89.6 }, { x: 38, y: 84.7 }, { x: 49.9, y: 76.7 }],
      [{ x: 67.2, y: 91.2 }, { x: 58, y: 86.1 }, { x: 49.9, y: 76.7 }],
    ],
    decor: [
      { kind: "tree", x: 7.6, y: 53, size: 0.9 },
      { kind: "tree", x: 3.6, y: 53, size: 0.9 },
      { kind: "tree", x: 93.5, y: 53, size: 1.3 },
      { kind: "tree", x: 8.9, y: 53, size: 1.3 },
      { kind: "tree", x: 0.8, y: 57.8, size: 0.9 },
      { kind: "tree", x: 92.3, y: 64, size: 1.2 },
      { kind: "tree", x: 96.7, y: 71 },
      { kind: "tree", x: 9.1, y: 71.9, size: 1.4 },
      { kind: "tree", x: 95.3, y: 77.5, size: 1.3 },
      { kind: "tree", x: 4.6, y: 78.2, size: 1.1 },
      { kind: "tree", x: 98.6, y: 80.4 },
      { kind: "tree", x: 90.3, y: 84.4, size: 1.3 },
      { kind: "tree", x: 8.8, y: 87.5, size: 1.3 },
      { kind: "tree", x: 1.5, y: 89.3, size: 0.9 },
      { kind: "tree", x: 94.9, y: 90.2 },
      { kind: "tree", x: 4.9, y: 93.1, size: 1.2 },
      { kind: "tree", x: 55.1, y: 95.5, size: 1.3 },
      { kind: "tree", x: 78.8, y: 96.8, size: 1.2 },
      { kind: "tree", x: 8.8, y: 97, size: 1.4 },
      { kind: "tree", x: 12.8, y: 98.8 },
      { kind: "tree", x: 97.3, y: 98.9, size: 1.3 },
    ],
  },
  "dark-forest": {
    theme: "darkForest",
    plaza: { x: 50.4, y: 55.5 },
    spots: {
      "dark-forest-trees": { x: 34.1, y: 37.9 },
      "dark-forest-den": { x: 65.6, y: 39.3 },
      "dark-forest-goblin": { x: 51.5, y: 83.5 },
    },
    paths: [
      [{ x: 53.4, y: 100 }, { x: 48.7, y: 76.6 }, { x: 50.4, y: 55.5 }],
      [{ x: 34.1, y: 40.9 }, { x: 43.5, y: 50.4 }, { x: 50.4, y: 55.5 }],
      [{ x: 65.6, y: 42.3 }, { x: 57.4, y: 48.3 }, { x: 50.4, y: 55.5 }],
      [{ x: 51.5, y: 86.5 }, { x: 51.3, y: 73.1 }, { x: 50.4, y: 55.5 }],
    ],
    decor: [
      { kind: "tree", x: 1.2, y: 2.7, size: 1.2 },
      { kind: "tree", x: 64.6, y: 5.4, size: 1.2 },
      { kind: "tree", x: 8.9, y: 6.9, size: 1.2 },
      { kind: "tree", x: 2.1, y: 7.6, size: 1.4 },
      { kind: "tree", x: 46.9, y: 8.3, size: 0.8 },
      { kind: "tree", x: 83.6, y: 9.1, size: 0.9 },
      { kind: "tree", x: 15.2, y: 9.2, size: 1.3 },
      { kind: "tree", x: 24.1, y: 9.4, size: 1.2 },
      { kind: "tree", x: 92.4, y: 9.4, size: 0.9 },
      { kind: "tree", x: 74.5, y: 10.4, size: 1.1 },
      { kind: "tree", x: 29.9, y: 11.3 },
      { kind: "tree", x: 4.2, y: 11.9, size: 0.8 },
      { kind: "tree", x: 54.5, y: 12.3 },
      { kind: "tree", x: 60.9, y: 14.5 },
      { kind: "tree", x: 19.8, y: 15.4, size: 0.9 },
      { kind: "tree", x: 81.8, y: 15.6, size: 1.1 },
      { kind: "tree", x: 64.9, y: 15.7 },
      { kind: "tree", x: 91.7, y: 16.6, size: 1.2 },
      { kind: "tree", x: 47.6, y: 16.8 },
      { kind: "tree", x: 10.6, y: 17, size: 0.9 },
      { kind: "tree", x: 96.6, y: 18.5, size: 0.8 },
      { kind: "tree", x: 4.7, y: 20.2 },
      { kind: "tree", x: 8.4, y: 21.5, size: 1.1 },
      { kind: "tree", x: 4.5, y: 26.7, size: 1.2 },
      { kind: "tree", x: 1, y: 29.2, size: 1.3 },
      { kind: "tree", x: 4.2, y: 33.6 },
      { kind: "tree", x: 91.2, y: 34, size: 0.8 },
      { kind: "tree", x: 95.4, y: 36.3, size: 1.1 },
      { kind: "tree", x: 0.2, y: 37.2, size: 1.2 },
      { kind: "tree", x: 97.2, y: 48.2, size: 0.8 },
      { kind: "tree", x: 92.5, y: 49.6, size: 1.2 },
      { kind: "tree", x: 2.6, y: 52.4, size: 0.9 },
      { kind: "tree", x: 8.7, y: 53.7, size: 1.4 },
      { kind: "tree", x: 4.4, y: 56.9 },
      { kind: "tree", x: 0.2, y: 57.8, size: 0.9 },
      { kind: "tree", x: 94.6, y: 63.5 },
      { kind: "tree", x: 7.3, y: 66, size: 1.4 },
      { kind: "tree", x: 98.8, y: 66.1, size: 1.1 },
      { kind: "tree", x: 97.4, y: 71, size: 0.8 },
      { kind: "tree", x: 5.4, y: 74.5, size: 1.1 },
      { kind: "tree", x: 0.4, y: 75.7 },
      { kind: "tree", x: 99.8, y: 78.8, size: 1.1 },
      { kind: "tree", x: 96.3, y: 81, size: 1.3 },
      { kind: "tree", x: 5.7, y: 81.4, size: 1.2 },
      { kind: "tree", x: 93.3, y: 84.8, size: 1.4 },
      { kind: "tree", x: 98.4, y: 86.5, size: 1.4 },
      { kind: "tree", x: 84.5, y: 94.5, size: 1.4 },
      { kind: "tree", x: 12.1, y: 94.7, size: 1.1 },
      { kind: "tree", x: 36.2, y: 94.7, size: 1.1 },
      { kind: "tree", x: 56.2, y: 96.1, size: 1.1 },
      { kind: "tree", x: 66.7, y: 96.5, size: 0.8 },
      { kind: "tree", x: 60.7, y: 97.8, size: 1.2 },
      { kind: "tree", x: 51.6, y: 98.3, size: 1.1 },
      { kind: "tree", x: 23.7, y: 98.5, size: 0.8 },
      { kind: "tree", x: 95.6, y: 99.2, size: 0.8 },
      { kind: "tree", x: 72.9, y: 99.3 },
      { kind: "tree", x: 30.8, y: 99.8, size: 1.3 },
    ],
  },
  "hidden-grove": {
    theme: "grove",
    plaza: null,
    spots: {
      "hidden-grove-oaks": { x: 50.7, y: 62.2 },
    },
    paths: [
      [{ x: 53.7, y: 100 }, { x: 50.8, y: 82.9 }, { x: 50.7, y: 65.2 }],
    ],
    decor: [
      { kind: "tree", x: 92.5, y: 3.8, size: 0.9 },
      { kind: "tree", x: 5.2, y: 6.1, size: 1.2 },
      { kind: "tree", x: 85.6, y: 7.6, size: 1.1 },
      { kind: "tree", x: 28.5, y: 8.4, size: 1.2 },
      { kind: "tree", x: 75, y: 9.8 },
      { kind: "tree", x: 80.1, y: 10, size: 1.1 },
      { kind: "tree", x: 37.8, y: 10.1, size: 1.4 },
      { kind: "tree", x: 32.5, y: 11.7, size: 1.1 },
      { kind: "tree", x: 91.5, y: 12.1, size: 1.2 },
      { kind: "tree", x: 1.4, y: 13.8 },
      { kind: "tree", x: 5.8, y: 15, size: 1.1 },
      { kind: "tree", x: 97.8, y: 16.3, size: 0.9 },
      { kind: "tree", x: 67.5, y: 16.6, size: 1.2 },
      { kind: "tree", x: 86.3, y: 16.7, size: 1.1 },
      { kind: "tree", x: 33.3, y: 16.9 },
      { kind: "tree", x: 97.1, y: 31.1 },
      { kind: "tree", x: 0.2, y: 38, size: 1.2 },
      { kind: "tree", x: 96.7, y: 40.7, size: 1.3 },
      { kind: "tree", x: 7, y: 45.3, size: 1.2 },
      { kind: "tree", x: 96.9, y: 49.5, size: 1.3 },
      { kind: "tree", x: 99.3, y: 58.4, size: 0.8 },
      { kind: "tree", x: 8.7, y: 63, size: 0.8 },
      { kind: "tree", x: 99.2, y: 76.6, size: 1.2 },
      { kind: "tree", x: 93.7, y: 80, size: 0.9 },
      { kind: "tree", x: 99.1, y: 83.7, size: 0.9 },
      { kind: "tree", x: 92.3, y: 86.3, size: 1.2 },
      { kind: "tree", x: 8.3, y: 87.4, size: 0.9 },
      { kind: "tree", x: 90.6, y: 93.3, size: 1.3 },
      { kind: "tree", x: 41, y: 96 },
      { kind: "tree", x: 94.1, y: 96.3 },
      { kind: "tree", x: 16, y: 98.9, size: 1.4 },
      { kind: "tree", x: 36.8, y: 99.7, size: 0.9 },
      { kind: "tree", x: 67.7, y: 99.8, size: 1.4 },
      { kind: "tree", x: 6.8, y: 99.9, size: 1.2 },
    ],
  },
  quarry: {
    theme: "quarry",
    cliff: 22,
    plaza: { x: 49.6, y: 58 },
    spots: {
      "quarry-job-board": { x: 30, y: 41.5 },
      "quarry-copper": { x: 66.6, y: 43.9 },
      "quarry-tin": { x: 52, y: 82.5 },
    },
    paths: [
      [{ x: 52.6, y: 100 }, { x: 47.8, y: 78.9 }, { x: 49.6, y: 58 }],
      [{ x: 30, y: 44.5 }, { x: 38.3, y: 52.1 }, { x: 49.6, y: 58 }],
      [{ x: 66.6, y: 46.9 }, { x: 57.2, y: 51.9 }, { x: 49.6, y: 58 }],
      [{ x: 52, y: 85.5 }, { x: 52.2, y: 73.1 }, { x: 49.6, y: 58 }],
    ],
    decor: [
      { kind: "tree", x: 0, y: 26.8, size: 1.2 },
      { kind: "tree", x: 93, y: 32.8, size: 1.2 },
      { kind: "tree", x: 94.2, y: 37.9 },
      { kind: "tree", x: 93.1, y: 49.1, size: 1.3 },
      { kind: "tree", x: 97.1, y: 51.9, size: 1.1 },
      { kind: "tree", x: 99.5, y: 57.3, size: 0.9 },
      { kind: "tree", x: 93, y: 61.2, size: 1.2 },
      { kind: "tree", x: 6.2, y: 71.3, size: 1.3 },
      { kind: "tree", x: 95.3, y: 73.2, size: 1.1 },
      { kind: "tree", x: 5.1, y: 90.5, size: 0.8 },
      { kind: "tree", x: 87.9, y: 94.2, size: 1.1 },
      { kind: "tree", x: 41.1, y: 95.2, size: 1.3 },
      { kind: "tree", x: 23.5, y: 96.8 },
      { kind: "rock", x: 28.3, y: 76.4, size: 0.9 },
      { kind: "rock", x: 29.3, y: 86.7 },
      { kind: "rock", x: 41.8, y: 28.7, size: 0.8 },
      { kind: "rock", x: 13.9, y: 76.7, size: 0.7 },
      { kind: "rock", x: 65.1, y: 72.2, size: 1.2 },
      { kind: "rock", x: 46.2, y: 86.2, size: 0.6 },
      { kind: "rock", x: 23, y: 67.9, size: 1.5 },
      { kind: "rock", x: 91.4, y: 79, size: 0.8 },
      { kind: "rock", x: 82.1, y: 58.1, size: 1.4 },
      { kind: "rock", x: 77.5, y: 93.1, size: 1.2 },
      { kind: "rock", x: 78.4, y: 93.5, size: 1.4 },
      { kind: "rock", x: 51.1, y: 44, size: 0.9 },
      { kind: "rock", x: 70.4, y: 95.7, size: 0.9 },
      { kind: "rock", x: 14.6, y: 66.9, size: 0.7 },
    ],
  },
  "draynor-village": {
    theme: "swamp",
    plaza: null,
    spots: {
      "draynor-aggie": { x: 52, y: 58.7, label: "Aggie's House" },
    },
    paths: [
      [{ x: 55, y: 100 }, { x: 55.8, y: 81 }, { x: 52, y: 61.7 }],
    ],
    decor: [
      { kind: "pond", x: 14, y: 87, size: 1.2 },
      { kind: "pond", x: 88, y: 23 },
      { kind: "pond", x: 86, y: 87, size: 0.9 },
      { kind: "tree", x: 38.4, y: 6.9 },
      { kind: "tree", x: 4.5, y: 7.5 },
      { kind: "willow", x: 23.6, y: 10.4, size: 1.3 },
      { kind: "willow", x: 9.7, y: 10.8 },
      { kind: "tree", x: 45.3, y: 10.9, size: 1.3 },
      { kind: "willow", x: 0.1, y: 11.1, size: 0.8 },
      { kind: "tree", x: 55.3, y: 11.7, size: 1.1 },
      { kind: "willow", x: 32.2, y: 12.2, size: 1.2 },
      { kind: "willow", x: 37.2, y: 13.5, size: 0.9 },
      { kind: "willow", x: 68.8, y: 14.6 },
      { kind: "tree", x: 42.5, y: 14.8, size: 1.4 },
      { kind: "willow", x: 5.2, y: 18.2, size: 1.3 },
      { kind: "tree", x: 92.5, y: 24.1, size: 1.1 },
      { kind: "tree", x: 1.2, y: 51, size: 1.3 },
      { kind: "tree", x: 96, y: 55.1, size: 1.3 },
      { kind: "tree", x: 9.8, y: 56.3, size: 1.3 },
      { kind: "tree", x: 1.3, y: 71.9, size: 1.2 },
      { kind: "willow", x: 97.2, y: 74, size: 1.3 },
      { kind: "willow", x: 4.8, y: 80.7, size: 1.3 },
      { kind: "tree", x: 94.5, y: 82.5, size: 1.1 },
      { kind: "willow", x: 8.2, y: 89.4, size: 1.3 },
      { kind: "tree", x: 3.5, y: 94.8, size: 1.1 },
      { kind: "willow", x: 62, y: 95.5, size: 0.9 },
      { kind: "willow", x: 17.5, y: 97.2, size: 1.1 },
      { kind: "willow", x: 8.3, y: 98.1, size: 1.2 },
      { kind: "willow", x: 58.6, y: 99.9, size: 1.2 },
    ],
  },
};

/** The scene for a location, or a plain one for a location with none. */
export function getTownScene(locationId: string): TownScene {
  return TOWN_SCENES[locationId] ?? { theme: "town", plaza: { x: 50, y: 60 }, spots: {}, paths: [], decor: [] };
}
