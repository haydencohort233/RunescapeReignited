import type { FurnitureDefinition, FurnitureSkin, HouseContent, RecipeInput, RoomCosmetic } from "../engine/types";

/**
 * The player house (Construction). Every number here is proposed: levels,
 * costs and XP follow OSRS where a piece has a match, build times are
 * picked for an idle game. Decided: the plank bed builds in 10 minutes for
 * +30 minutes of offline time, the mahogany bed in 2 hours for +2 hours;
 * beds are 1 wide and 2 deep, tables 1 by 1 (Oct 21).
 *
 * Sizes are grid cells facing front: `width` along the wall, `depth` into
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

/** A 1x1 piece unless the entry says otherwise. */
const floor = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "floor", width: 1, depth: 1, ...p });
const wall = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "wall", width: 1, depth: 1, ...p });
const surface = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "surface", width: 1, depth: 1, ...p });
const rug = (p: Piece): FurnitureDefinition => ({ kind: "furniture", slot: "rug", width: 1, depth: 1, ...p });
const facility = (p: Piece): FurnitureDefinition => ({ kind: "facility", slot: "floor", width: 1, depth: 1, ...p });

export const FURNITURE_CATALOG: FurnitureDefinition[] = [
  // ── Seating ──
  floor({ id: "crude-wooden-chair", name: "Crude Wooden Chair", description: "It holds you up. Mostly.", levelRequired: 1, cost: [planks(2)], buildTimeMs: 1 * MIN, xp: 58, emoji: "🪑" }),
  floor({ id: "wooden-chair", name: "Wooden Chair", description: "A proper chair, with a back and everything.", levelRequired: 8, cost: [planks(3)], buildTimeMs: 2 * MIN, xp: 87, emoji: "🪑" }),
  floor({ id: "oak-stool", name: "Oak Stool", description: "Three legs, no back, no complaints.", art: "oak_stool", levelRequired: 15, cost: [oak(1)], buildTimeMs: 3 * MIN, xp: 60, emoji: "🪑" }),
  floor({ id: "oak-chair", name: "Oak Chair", description: "Solid oak. Sit back and admire your work.", art: "oak_chair", levelRequired: 19, cost: [oak(2)], buildTimeMs: 5 * MIN, xp: 120, emoji: "🪑" }),
  floor({ id: "oak-bench", name: "Oak Bench", description: "Room for two, if you're friendly.", art: "oak_bench", levelRequired: 20, cost: [oak(3)], buildTimeMs: 8 * MIN, xp: 180, emoji: "🪑" }),

  // ── Tables and stands (things sit on top) ──
  floor({ id: "nightstand", name: "Nightstand", description: "A little table for beside the bed.", art: "nightstand", surfaceSlots: 1, surfaceAt: 0.12, levelRequired: 8, cost: [planks(2)], buildTimeMs: 2 * MIN, xp: 70, emoji: "🟫" }),
  floor({ id: "wooden-table", name: "Wooden Table", description: "A small table with room on top for a candle or a plant.", surfaceSlots: 1, levelRequired: 10, cost: [planks(4)], buildTimeMs: 3 * MIN, xp: 115, emoji: "🟫" }),
  floor({ id: "oak-table", name: "Oak Dining Table", description: "A sturdy oak table. Two things fit on top.", art: "dining_table", surfaceSlots: 2, surfaceAt: 0.12, levelRequired: 22, cost: [oak(4)], buildTimeMs: 8 * MIN, xp: 240, emoji: "🟫" }),
  floor({ id: "writing-desk", name: "Writing Desk", description: "Ink, quill and somewhere to write it all down.", art: "writing_desk", levelRequired: 18, cost: [oak(3)], buildTimeMs: 8 * MIN, xp: 180, emoji: "🟫" }),

  // ── Storage-looking things (decor for now) ──
  floor({ id: "barrel", name: "Barrel", description: "Holds something. Possibly ale.", art: "barrel", levelRequired: 3, cost: [planks(3)], buildTimeMs: 2 * MIN, xp: 60, emoji: "🛢️" }),
  floor({ id: "washbasin", name: "Washbasin", description: "Somewhere to wash off the soot.", art: "washbasin", levelRequired: 6, cost: [planks(2), bronze(1)], buildTimeMs: 3 * MIN, xp: 80, emoji: "🫧" }),
  floor({ id: "wooden-chest", name: "Wooden Chest", description: "A sturdy chest with an iron lock.", art: "wood_chest", levelRequired: 7, cost: [planks(3)], buildTimeMs: 2 * MIN, xp: 75, emoji: "🧰" }),
  floor({ id: "cupboard", name: "Cupboard", description: "Plates, cups and the odd spider.", art: "cupboard", levelRequired: 12, cost: [planks(4)], buildTimeMs: 4 * MIN, xp: 120, emoji: "🗄️" }),
  floor({ id: "wooden-bookcase", name: "Wooden Bookcase", description: "Shelves for books you'll read one day.", art: "bookcase", facings: ["front", "right", "left"], levelRequired: 4, cost: [planks(4)], buildTimeMs: 2 * MIN, xp: 115, emoji: "📚" }),
  floor({ id: "wardrobe", name: "Wardrobe", description: "Every outfit you own, and room for more.", art: "wardrobe", facings: ["front", "right", "left"], levelRequired: 27, cost: [oak(3)], buildTimeMs: 10 * MIN, xp: 210, emoji: "🚪" }),

  // ── Light and display ──
  floor({ id: "floor-candelabrum", name: "Floor Candelabrum", description: "Three candles on a tall bronze stand.", art: "floor_candelabrum", levelRequired: 16, cost: [bronze(2)], buildTimeMs: 3 * MIN, xp: 90, emoji: "🕯️" }),
  floor({ id: "armour-stand", name: "Armour Stand", description: "Shows off a full suit of armour.", art: "armor_stand", levelRequired: 24, cost: [oak(2), bronze(3)], buildTimeMs: 12 * MIN, xp: 230, emoji: "🛡️" }),
  floor({ id: "weapon-rack", name: "Weapon Rack", description: "A sword and a bow, close at hand.", art: "weapon_rack", levelRequired: 32, cost: [oak(4), bronze(2)], buildTimeMs: 15 * MIN, xp: 280, emoji: "⚔️" }),

  // ── Beds: the best placed bed raises the offline cap ──
  floor({
    id: "plank-bed",
    name: "Plank Bed",
    description: "A bed knocked together from planks. Rest longer while you're away (+30 minutes offline).",
    art: "wooden_bed",
    depth: 2,
    levelRequired: 1,
    cost: [planks(3)],
    buildTimeMs: 10 * MIN,
    xp: 117,
    offlineCapBonusMs: 30 * MIN,
    emoji: "🛏️",
    skins: ["gilded-plank-bed"],
  }),
  floor({ id: "oak-bed", name: "Oak Bed", description: "A sturdy oak bed (+1 hour offline).", depth: 2, levelRequired: 30, cost: [oak(5)], buildTimeMs: 45 * MIN, xp: 210, offlineCapBonusMs: 1 * HOUR, emoji: "🛏️" }),
  floor({ id: "mahogany-bed", name: "Mahogany Bed", description: "A grand four-poster in dark mahogany (+2 hours offline).", depth: 2, levelRequired: 50, cost: [mahogany(4)], buildTimeMs: 2 * HOUR, xp: 840, offlineCapBonusMs: 2 * HOUR, emoji: "🛏️" }),

  // ── Rugs: lie under furniture ──
  rug({ id: "blue-rug", name: "Blue Rug", description: "A small woven rug.", art: "blue_rug", levelRequired: 2, cost: [flax(4)], buildTimeMs: 1 * MIN, xp: 30, emoji: "🟦" }),
  rug({ id: "red-rug", name: "Red Rug", description: "A rich red rug.", art: "red_rug", levelRequired: 13, cost: [flax(8)], buildTimeMs: 2 * MIN, xp: 60, emoji: "🟥" }),

  // ── Wall pieces (don't rotate) ──
  wall({ id: "wall-torch", name: "Wall Lantern", description: "Keeps the corners bright.", art: "wall_lantern", levelRequired: 1, cost: [planks(1)], buildTimeMs: 30 * SEC, xp: 20, emoji: "🏮" }),
  wall({ id: "wooden-shelves", name: "Wall Shelf", description: "A shelf with room for one more thing.", art: "wall_shelf", surfaceSlots: 1, surfaceAt: 0.78, levelRequired: 6, cost: [planks(3)], buildTimeMs: 2 * MIN, xp: 87, emoji: "➖" }),
  wall({ id: "stone-window", name: "Stone Window", description: "Lets the light in. Mind the draught.", art: "stone_window", levelRequired: 10, cost: [planks(2), bronze(1)], buildTimeMs: 3 * MIN, xp: 100, emoji: "🪟" }),
  wall({ id: "red-banner", name: "Red Banner", description: "Hang your colours.", art: "red_banner", levelRequired: 14, cost: [planks(1), flax(4)], buildTimeMs: 3 * MIN, xp: 100, emoji: "🚩" }),
  wall({ id: "landscape-painting", name: "Landscape Painting", description: "Mountains and a lake, somewhere north of here.", art: "painting", levelRequired: 15, cost: [planks(2), flax(3)], buildTimeMs: 5 * MIN, xp: 100, emoji: "🖼️" }),
  wall({ id: "shield-display", name: "Shield Display", description: "A round shield, polished and hung.", art: "shield_display", levelRequired: 25, cost: [oak(1), bronze(3)], buildTimeMs: 10 * MIN, xp: 200, emoji: "🛡️" }),

  // ── Surface pieces (sit on a table, stand or shelf) ──
  surface({ id: "potted-plant", name: "Potted Fern", description: "A bit of green on the table.", art: "potted_fern", levelRequired: 1, cost: [planks(1)], buildTimeMs: 30 * SEC, xp: 31, emoji: "🪴" }),
  surface({ id: "bronze-candlestick", name: "Bronze Candlestick", description: "A candle in a bronze holder.", levelRequired: 12, cost: [bronze(1)], buildTimeMs: 1 * MIN, xp: 40, emoji: "🕯️" }),

  // ── Facilities: crafting stations that work at home ──
  facility({ id: "workbench", name: "Workbench", description: "Saw logs into planks at home.", art: "workbench", station: "sawmill", levelRequired: 5, cost: [planks(3)], buildTimeMs: 5 * MIN, xp: 100, emoji: "🪚" }),
  facility({ id: "kitchen-range", name: "Cooking Range", description: "A stone range. Cook at home.", art: "cooking_range", station: "range", levelRequired: 10, cost: [planks(4), bronze(2)], buildTimeMs: 10 * MIN, xp: 150, emoji: "🍳" }),
  facility({ id: "small-anvil", name: "Anvil", description: "Smith bars into gear at home.", art: "anvil", station: "anvil", levelRequired: 15, cost: [planks(2), bronze(3)], buildTimeMs: 15 * MIN, xp: 200, emoji: "⚒️" }),
  facility({ id: "small-furnace", name: "Small Furnace", description: "Smelt ore into bars at home.", station: "furnace", levelRequired: 25, cost: [oak(4), bronze(4)], buildTimeMs: 30 * MIN, xp: 320, emoji: "🏭" }),
  facility({ id: "stone-altar", name: "Stone Altar", description: "Offer bones here for twice the Prayer XP of burying them.", art: "stone_altar", station: "altar", levelRequired: 30, cost: [oak(4), bronze(4)], buildTimeMs: 30 * MIN, xp: 400, emoji: "⛪" }),
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

/** Where the house portal is (proposed: Riverside Town). More portals are
 *  just more ids here. */
export const HOUSE_PORTAL_LOCATIONS = ["town"];

export const HOUSE_CONTENT: HouseContent = {
  furniture: FURNITURE_CATALOG,
  skins: SKIN_CATALOG,
  wallpapers: WALLPAPER_CATALOG,
  floors: FLOOR_CATALOG,
  rugs: RUG_CATALOG,
  portalLocationIds: HOUSE_PORTAL_LOCATIONS,
};

const FURNITURE_BY_ID = new Map(FURNITURE_CATALOG.map((f) => [f.id, f]));

export function getFurniture(id: string): FurnitureDefinition | undefined {
  return FURNITURE_BY_ID.get(id);
}
