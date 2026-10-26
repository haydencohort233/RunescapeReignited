import type { FurnitureDefinition, FurnitureSkin, HouseContent, PathStyle, RecipeInput, RoomCosmetic, ServantDefinition } from "../engine/types";

/**
 * The player house (Construction). Every number here is proposed: levels,
 * costs and XP follow OSRS where a piece has a match, build times are
 * picked for an idle game. Decided: the plank bed builds in 10 minutes for
 * +30 minutes of offline time, the mahogany bed in 2 hours for +2 hours;
 * beds are 1 wide and 2 deep, tables 1 by 1 (Oct 21).
 *
 * Sizes are grid squares facing front (SMALL, WIDE, LARGE, LONG below): `width` along the wall, `depth` into
 * the room (floor and rug pieces) or height (wall pieces). The floor is
 * 8 by 4 and the wall 8 by 2 (engine/tuning.ts). Rugs lie on the floor
 * under everything else: they only block other rugs.
 *
 * ART. `art` is the file name in public/assets/furniture/, without .png:
 *   <art>.png        facing front (required for the art to show)
 *   <art>_side.png   facing left; the game flips it for facing right
 *   <art>_back.png   facing back
 * A missing side or back image falls back to the front one. Draw the
 * piece with its feet on the bottom edge, centred, the rest transparent.
 * Pieces are drawn at their pixel size: 128 pixels of art is one floor
 * cell wide (ART_PX_PER_CELL in components/house/roomGeometry.ts), so a
 * 64-pixel chair takes half a cell. `surfaceAt` is where a table's top
 * is, as a fraction of the art's height from the top. Pieces without art
 * use the drawings in components/house/furnitureSprites.ts.
 */

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

const planks = (amount: number): RecipeInput => ({ resource: "plank", amount });
const oak = (amount: number): RecipeInput => ({ resource: "oak-plank", amount });
const mahogany = (amount: number): RecipeInput => ({ resource: "mahogany-plank", amount });
const bronze = (amount: number): RecipeInput => ({ resource: "bronze-bar", amount });
const flax = (amount: number): RecipeInput => ({ resource: "flax", amount });

type Piece = Omit<FurnitureDefinition, "kind" | "slot" | "width" | "depth"> & Partial<Pick<FurnitureDefinition, "width" | "depth">>;

/** Standard sizes, in grid squares (one square = 64 px of art, decided
 *  Oct 25): pieces keep to these so they stay in proportion. Width runs
 *  along the wall, depth into the room. A rare odd size is allowed. */
const SMALL = { width: 1, depth: 1 }; // 64 px wide: chairs, stools, plants
const WIDE = { width: 2, depth: 1 }; // 128 px wide, shallow: benches, bookcases
const LARGE = { width: 2, depth: 2 }; // 128 px wide: tables, ranges, rugs, wall pieces
const LONG = { width: 2, depth: 4 }; // beds (decided Oct 21: 1 wide, 2 deep in the old squares)

/** Unsized pieces default to Large; every catalog entry names its size. */
const floor = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "floor", width: 2, depth: 2, ...p });
const wall = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "wall", width: 2, depth: 2, ...p });
const surface = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "surface", width: 2, depth: 2, ...p });
const rug = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "rug", width: 2, depth: 2, ...p });
const facility = (p: Piece): FurnitureDefinition => ({ kind: "facility", slot: "floor", width: 2, depth: 2, ...p });
/** Garden pieces: the yard only. */
const garden = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "floor", width: 1, depth: 1, areas: ["yard"], facings: ["front"], ...p });

export const FURNITURE_CATALOG: FurnitureDefinition[] = [
  // ── Seating ──
  floor({ id: "crude-wooden-chair", ...SMALL, name: "Crude Wooden Chair", description: "It holds you up. Mostly.", levelRequired: 1, cost: [planks(2)], buildTimeMs: 1 * MIN, xp: 58, emoji: "🪑" }),
  floor({ id: "wooden-chair", ...SMALL, name: "Wooden Chair", description: "A proper chair, with a back and everything.", levelRequired: 8, cost: [planks(3)], buildTimeMs: 2 * MIN, xp: 87, emoji: "🪑" }),
  floor({ id: "oak-stool", ...SMALL, name: "Oak Stool", description: "Three legs, no back, no complaints.", art: "oak_stool", levelRequired: 15, cost: [oak(1)], buildTimeMs: 3 * MIN, xp: 60, emoji: "🪑" }),
  floor({ id: "oak-chair", ...SMALL, name: "Oak Chair", description: "Solid oak. Sit back and admire your work.", art: "oak_chair", levelRequired: 19, cost: [oak(2)], buildTimeMs: 5 * MIN, xp: 120, emoji: "🪑" }),
  floor({ id: "oak-bench", ...WIDE, name: "Oak Bench", description: "Room for two, if you're friendly.", art: "oak_bench", areas: ["inside", "yard"], levelRequired: 20, cost: [oak(3)], buildTimeMs: 8 * MIN, xp: 180, emoji: "🪑" }),

  // ── Tables and stands (things sit on top) ──
  floor({ id: "nightstand", ...SMALL, name: "Nightstand", description: "A little table for beside the bed.", art: "nightstand", surfaceSlots: 1, surfaceAt: 0.12, levelRequired: 8, cost: [planks(2)], buildTimeMs: 2 * MIN, xp: 70, emoji: "🟫" }),
  floor({ id: "wooden-table", ...LARGE, name: "Wooden Table", description: "A small table with room on top for a candle or a plant.", surfaceSlots: 1, levelRequired: 10, cost: [planks(4)], buildTimeMs: 3 * MIN, xp: 115, emoji: "🟫" }),
  floor({ id: "oak-table", ...LARGE, name: "Oak Dining Table", description: "A sturdy oak table. Two things fit on top.", art: "dining_table", surfaceSlots: 2, surfaceAt: 0.12, levelRequired: 22, cost: [oak(4)], buildTimeMs: 8 * MIN, xp: 240, emoji: "🟫" }),
  floor({ id: "writing-desk", ...WIDE, name: "Writing Desk", description: "Ink, quill and somewhere to write it all down.", art: "writing_desk", levelRequired: 18, cost: [oak(3)], buildTimeMs: 8 * MIN, xp: 180, emoji: "🟫" }),

  // ── Storage-looking things (decor for now) ──
  floor({ id: "barrel", ...SMALL, name: "Barrel", description: "Holds something. Possibly ale.", art: "barrel", areas: ["inside", "yard"], levelRequired: 3, cost: [planks(3)], buildTimeMs: 2 * MIN, xp: 60, emoji: "🛢️" }),
  floor({ id: "washbasin", ...SMALL, name: "Washbasin", description: "Somewhere to wash off the soot.", art: "washbasin", levelRequired: 6, cost: [planks(2), bronze(1)], buildTimeMs: 3 * MIN, xp: 80, emoji: "🫧" }),
  floor({ id: "wooden-chest", ...SMALL, name: "Wooden Chest", description: "A sturdy chest with an iron lock.", art: "wood_chest", levelRequired: 7, cost: [planks(3)], buildTimeMs: 2 * MIN, xp: 75, emoji: "🧰" }),
  floor({ id: "cupboard", ...WIDE, name: "Cupboard", description: "Plates, cups and the odd spider.", art: "cupboard", levelRequired: 12, cost: [planks(4)], buildTimeMs: 4 * MIN, xp: 120, emoji: "🗄️" }),
  floor({ id: "wooden-bookcase", ...WIDE, name: "Wooden Bookcase", description: "Shelves for books you'll read one day.", art: "bookcase", facings: ["front", "right", "left"], levelRequired: 4, cost: [planks(4)], buildTimeMs: 2 * MIN, xp: 115, emoji: "📚" }),
  floor({ id: "wardrobe", ...WIDE, name: "Wardrobe", description: "Every outfit you own, and room for more.", art: "wardrobe", facings: ["front", "right", "left"], levelRequired: 27, cost: [oak(3)], buildTimeMs: 10 * MIN, xp: 210, emoji: "🚪" }),

  // ── Light and display ──
  floor({ id: "floor-candelabrum", ...SMALL, name: "Floor Candelabrum", description: "Three candles on a tall bronze stand.", art: "floor_candelabrum", levelRequired: 16, cost: [bronze(2)], buildTimeMs: 3 * MIN, xp: 90, emoji: "🕯️" }),
  floor({ id: "armour-stand", ...SMALL, name: "Armour Stand", description: "Shows off a full suit of armour.", art: "armor_stand", levelRequired: 24, cost: [oak(2), bronze(3)], buildTimeMs: 12 * MIN, xp: 230, emoji: "🛡️" }),
  floor({ id: "weapon-rack", ...WIDE, name: "Weapon Rack", description: "A sword and a bow, close at hand.", art: "weapon_rack", levelRequired: 32, cost: [oak(4), bronze(2)], buildTimeMs: 15 * MIN, xp: 280, emoji: "⚔️" }),

  // ── Beds: the best placed bed raises the offline cap ──
  floor({
    id: "plank-bed", ...LONG,
    name: "Plank Bed",
    description: "A bed knocked together from planks. Rest longer while you're away (+30 minutes offline).",
    art: "wooden_bed",
    levelRequired: 1,
    cost: [planks(3)],
    buildTimeMs: 10 * MIN,
    xp: 117,
    offlineCapBonusMs: 30 * MIN,
    emoji: "🛏️",
    skins: ["gilded-plank-bed"],
  }),
  floor({ id: "oak-bed", ...LONG, name: "Oak Bed", description: "A sturdy oak bed (+1 hour offline).", levelRequired: 30, cost: [oak(5)], buildTimeMs: 45 * MIN, xp: 210, offlineCapBonusMs: 1 * HOUR, emoji: "🛏️" }),
  floor({ id: "mahogany-bed", ...LONG, name: "Mahogany Bed", description: "A grand four-poster in dark mahogany (+2 hours offline).", levelRequired: 50, cost: [mahogany(4)], buildTimeMs: 2 * HOUR, xp: 840, offlineCapBonusMs: 2 * HOUR, emoji: "🛏️" }),

  // ── Rugs: lie under furniture ──
  rug({ id: "blue-rug", ...LARGE, name: "Blue Rug", description: "A small woven rug.", art: "blue_rug", levelRequired: 2, cost: [flax(4)], buildTimeMs: 1 * MIN, xp: 30, emoji: "🟦" }),
  rug({ id: "red-rug", ...LARGE, name: "Red Rug", description: "A rich red rug.", art: "red_rug", levelRequired: 13, cost: [flax(8)], buildTimeMs: 2 * MIN, xp: 60, emoji: "🟥" }),

  // ── Wall pieces (don't rotate) ──
  wall({ id: "wall-torch", ...LARGE, name: "Wall Lantern", description: "Keeps the corners bright.", art: "wall_lantern", levelRequired: 1, cost: [planks(1)], buildTimeMs: 30 * SEC, xp: 20, emoji: "🏮" }),
  wall({ id: "wooden-shelves", ...LARGE, name: "Wall Shelf", description: "A shelf with room for one more thing.", art: "wall_shelf", surfaceSlots: 1, surfaceAt: 0.78, levelRequired: 6, cost: [planks(3)], buildTimeMs: 2 * MIN, xp: 87, emoji: "➖" }),
  wall({ id: "stone-window", ...LARGE, name: "Stone Window", description: "Lets the light in. Mind the draught.", art: "stone_window", levelRequired: 10, cost: [planks(2), bronze(1)], buildTimeMs: 3 * MIN, xp: 100, emoji: "🪟" }),
  wall({ id: "red-banner", ...LARGE, name: "Red Banner", description: "Hang your colours.", art: "red_banner", levelRequired: 14, cost: [planks(1), flax(4)], buildTimeMs: 3 * MIN, xp: 100, emoji: "🚩" }),
  wall({ id: "landscape-painting", ...LARGE, name: "Landscape Painting", description: "Mountains and a lake, somewhere north of here.", art: "painting", levelRequired: 15, cost: [planks(2), flax(3)], buildTimeMs: 5 * MIN, xp: 100, emoji: "🖼️" }),
  wall({ id: "shield-display", ...LARGE, name: "Shield Display", description: "A round shield, polished and hung.", art: "shield_display", levelRequired: 25, cost: [oak(1), bronze(3)], buildTimeMs: 10 * MIN, xp: 200, emoji: "🛡️" }),

  // ── Surface pieces (sit on a table, stand or shelf) ──
  surface({ id: "potted-plant", name: "Potted Fern", description: "A bit of green on the table.", art: "potted_fern", levelRequired: 1, cost: [planks(1)], buildTimeMs: 30 * SEC, xp: 31, emoji: "🪴" }),
  surface({ id: "bronze-candlestick", name: "Bronze Candlestick", description: "A candle in a bronze holder.", levelRequired: 12, cost: [bronze(1)], buildTimeMs: 1 * MIN, xp: 40, emoji: "🕯️" }),

  // ── Garden: the yard only (proposed levels and costs, Oct 24) ──
  garden({ id: "fern", ...SMALL, name: "Fern", description: "A leafy fern by the path.", levelRequired: 1, cost: [planks(1)], buildTimeMs: 30 * SEC, xp: 31, emoji: "🌿" }),
  garden({ id: "small-tree", ...SMALL, name: "Small Tree", description: "A young tree. Give it a few years.", levelRequired: 5, cost: [planks(2)], buildTimeMs: 2 * MIN, xp: 70, emoji: "🌳" }),
  garden({ id: "wooden-fence", ...SMALL, name: "Wooden Fence", description: "Keeps the chickens out. In theory. Joins up with fences next to it.", connects: true, facings: undefined, levelRequired: 8, cost: [planks(2)], buildTimeMs: 1 * MIN, xp: 60, emoji: "🪵" }),
  garden({ id: "flower-bed", ...WIDE, name: "Flower Bed", description: "Bright flowers in a wooden border.", levelRequired: 10, cost: [planks(2), flax(3)], buildTimeMs: 3 * MIN, xp: 90, emoji: "🌷" }),
  garden({ id: "lamp-post", ...SMALL, name: "Lamp Post", description: "Lights the way home.", levelRequired: 20, cost: [oak(2), bronze(2)], buildTimeMs: 10 * MIN, xp: 220, emoji: "🏮" }),
  garden({ id: "small-fountain", ...LARGE, name: "Small Fountain", description: "Water trickles over the stones.", art: "small_fountain", levelRequired: 25, cost: [oak(4), bronze(4)], buildTimeMs: 30 * MIN, xp: 400, emoji: "⛲" }),

  // ── Facilities: crafting stations that work at home ──
  facility({ id: "workbench", ...WIDE, name: "Workbench", description: "Saw logs into planks at home.", art: "workbench", station: "sawmill", levelRequired: 5, cost: [planks(3)], buildTimeMs: 5 * MIN, xp: 100, emoji: "🪚" }),
  facility({ id: "kitchen-range", ...LARGE, name: "Cooking Range", description: "A stone range. Cook at home.", art: "cooking_range", station: "range", levelRequired: 10, cost: [planks(4), bronze(2)], buildTimeMs: 10 * MIN, xp: 150, emoji: "🍳" }),
  facility({ id: "small-anvil", ...SMALL, name: "Anvil", description: "Smith bars into gear at home.", art: "anvil", station: "anvil", levelRequired: 15, cost: [planks(2), bronze(3)], buildTimeMs: 15 * MIN, xp: 200, emoji: "⚒️" }),
  facility({ id: "small-furnace", ...LARGE, name: "Small Furnace", description: "Smelt ore into bars at home.", station: "furnace", levelRequired: 25, cost: [oak(4), bronze(4)], buildTimeMs: 30 * MIN, xp: 320, emoji: "🏭" }),
  facility({ id: "stone-altar", ...LARGE, name: "Stone Altar", description: "Offer bones here for twice the Prayer XP of burying them.", art: "stone_altar", station: "altar", levelRequired: 30, cost: [oak(4), bronze(4)], buildTimeMs: 30 * MIN, xp: 400, emoji: "⛪" }),
];

/** One example skin, to exercise the cosmetic data model (Phase 2 adds
 *  the unlocks; a dev tool unlocks it until then). Its art would be
 *  assets/furniture/gilded_plank_bed.png. */
export const SKIN_CATALOG: FurnitureSkin[] = [
  {
    id: "gilded-plank-bed",
    name: "Gilded Plank Bed",
    furnitureId: "plank-bed",
    art: "gilded_plank_bed",
    unlockSource: { kind: "achievement", achievementId: "master-builder" },
  },
];

/** Room looks. `art` is the file in public/assets/house/ (without .png),
 *  drawn on a 1536 x 1024 canvas that lines up with the room's grid (see
 *  roomGeometry.ts); `colors` draw a stand-in until it loads. The first
 *  of each list is the default. */
export const WALLPAPER_CATALOG: RoomCosmetic[] = [{ id: "wood-wall", name: "Timber and Stone", colors: ["#d9c9a8", "#c7b48f"], art: "house_wall_wood" }];

export const FLOOR_CATALOG: RoomCosmetic[] = [{ id: "wood-floor", name: "Wooden Floor", colors: ["#a87a4c", "#7a5432"], art: "house_floor_wood" }];

/** A room-wide rug under everything. Only "none" for now: rugs are
 *  placeable furniture since the art arrived (Oct 22). Kept in the save
 *  for Phase 2 cosmetics. */
export const RUG_CATALOG: RoomCosmetic[] = [{ id: "none", name: "No rug", colors: [] }];

/** Outside looks (decided Oct 25: the outside is customized like the
 *  room). Drawn from `colors` until art exists; the first is the default.
 *  All free for now (proposed); Phase 2 adds unlocks. */
export const FRONT_CATALOG: RoomCosmetic[] = [
  { id: "timber-front", name: "Timber and Plaster", colors: ["#d9c9a8", "#6b4220", "#9a9184"] },
  { id: "stone-front", name: "Grey Stone", colors: ["#a39e94", "#5e5a52", "#7d786f"] },
  { id: "brick-front", name: "Red Brick", colors: ["#a8553d", "#5a2a1c", "#8a8278"] },
  { id: "log-front", name: "Log Cabin", colors: ["#8a5a2e", "#4f3016", "#6f675b"] },
];

export const ROOF_CATALOG: RoomCosmetic[] = [
  { id: "red-roof", name: "Red Tiles", colors: ["#8a3b2a", "#6e2c1f"] },
  { id: "slate-roof", name: "Slate", colors: ["#4b5563", "#374151"] },
  { id: "thatch-roof", name: "Thatch", colors: ["#c9a35a", "#a07f3c"] },
  { id: "green-roof", name: "Green Tiles", colors: ["#3f6b3a", "#2f5229"] },
];

export const GROUND_CATALOG: RoomCosmetic[] = [
  { id: "grass-ground", name: "Grass", colors: ["#6fa046", "#4f7f2f", "#86b25a"] },
  { id: "meadow-ground", name: "Meadow", colors: ["#8fb85a", "#6a9a3e", "#a8c86e"] },
  { id: "dirt-ground", name: "Dirt", colors: ["#9a7b52", "#7a5d3a", "#86b25a"] },
  { id: "snow-ground", name: "Snow", colors: ["#eef3f7", "#c9d6e0", "#dfe8ee"] },
  { id: "sand-ground", name: "Sand", colors: ["#e3cf98", "#c9b27a", "#d8c487"] },
];

export const SKY_CATALOG: RoomCosmetic[] = [
  { id: "day-sky", name: "Day", colors: ["#8ec5e8", "#d6ecf5"] },
  { id: "sunset-sky", name: "Sunset", colors: ["#f08a5d", "#f9d29d"] },
  { id: "night-sky", name: "Night", colors: ["#1b2340", "#3b4a7a"] },
];

/** Paths painted in the yard, one tile per square (decided Oct 25).
 *  Costs are per tile and come back when a tile is cleared (proposed). */
export const PATH_CATALOG: PathStyle[] = [
  { id: "dirt-path", name: "Dirt Path", colors: ["#a3825a", "#7d6040"], levelRequired: 1, cost: [] },
  { id: "plank-path", name: "Plank Path", colors: ["#b97d45", "#7f5129"], levelRequired: 3, cost: [planks(1)] },
  { id: "stone-path", name: "Stone Path", colors: ["#b3ab9c", "#7d766a"], levelRequired: 5, cost: [planks(1), bronze(1)] },
  { id: "cobble-path", name: "Cobblestones", colors: ["#8f8b84", "#5e5a52"], levelRequired: 15, cost: [bronze(2)] },
];

/** Where the house portal is (proposed: Riverside Town). More portals are
 *  just more ids here. */
export const HOUSE_PORTAL_LOCATIONS = ["town"];

/** Servants (Phase 4). Levels, order limits and the hiring fee are
 *  decided; rates and wages too (decided Oct 20). Hired at the Servants'
 *  Guild in Draynor Village. They only work facilities standing in the
 *  house (decided Oct 22). */
export const SERVANT_CATALOG: ServantDefinition[] = [
  {
    id: "butler",
    name: "Butler",
    description: "A dependable butler. Slow, but cheap to keep.",
    portrait: "🤵",
    art: "hans",
    levelRequired: 20,
    rateShare: 0.2,
    wagePerSecond: 1,
    orderLimit: 500,
    hireCostGp: 100,
  },
  {
    id: "servant",
    name: "Servant",
    description: "A capable servant who works at a good pace.",
    portrait: "🧹",
    art: "leela",
    levelRequired: 40,
    rateShare: 0.3,
    wagePerSecond: 3,
    orderLimit: 1000,
    hireCostGp: 100,
  },
  {
    id: "demon-butler",
    name: "Demon Butler",
    description: "Fast, tireless and expensive. Don't ask where he came from.",
    portrait: "😈",
    art: "den_guardian",
    levelRequired: 60,
    rateShare: 0.5,
    wagePerSecond: 5,
    orderLimit: 1500,
    hireCostGp: 100,
  },
];

export const HOUSE_CONTENT: HouseContent = {
  furniture: FURNITURE_CATALOG,
  skins: SKIN_CATALOG,
  wallpapers: WALLPAPER_CATALOG,
  floors: FLOOR_CATALOG,
  rugs: RUG_CATALOG,
  fronts: FRONT_CATALOG,
  roofs: ROOF_CATALOG,
  grounds: GROUND_CATALOG,
  skies: SKY_CATALOG,
  paths: PATH_CATALOG,
  portalLocationIds: HOUSE_PORTAL_LOCATIONS,
  servants: SERVANT_CATALOG,
};

const FURNITURE_BY_ID = new Map(FURNITURE_CATALOG.map((f) => [f.id, f]));

export function getFurniture(id: string): FurnitureDefinition | undefined {
  return FURNITURE_BY_ID.get(id);
}
