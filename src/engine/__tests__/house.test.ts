import { describe, expect, it } from "vitest";
import { makeEngine, HOUR, SECOND } from "./helpers";
import { GameEngine } from "../gameEngine";
import { GAME_CONTENT } from "../../content";
import { getLocation } from "../../content/mapLocations";
import { getFurniture } from "../../content/house";
import { SAW_PLANK_RECIPE, WOODEN_BOW_RECIPE } from "../../content/recipes";
import { DEFAULT_OFFLINE_CAP_MS } from "../tuning";
import { SCHEMA_VERSION } from "../state";

const MIN = 60 * SECOND;

/** A player at the house with plenty of materials. */
function builder(level = 60) {
  const g = makeEngine();
  g.engine.setSkillLevel("construction", level);
  for (const id of ["plank", "oak-plank", "mahogany-plank", "bronze-bar", "flax"]) g.engine.addItem(id, 500);
  return g;
}

/** Builds a piece and returns its storage uid. Ticks a minute at a time,
 *  so a build longer than the offline cap still finishes. */
function build(g: ReturnType<typeof makeEngine>, furnitureId: string): string {
  expect(g.engine.startFurnitureBuild(furnitureId)).toBe(true);
  for (let t = 0; t < getFurniture(furnitureId)!.buildTimeMs; t += MIN) g.advance(MIN);
  const stored = g.state().house.storage;
  return stored[stored.length - 1].uid;
}

describe("player house: building", () => {
  it("builds over time, offline too, into storage with Construction XP", () => {
    const g = builder(1);
    const bed = getFurniture("plank-bed")!;
    expect(g.engine.startFurnitureBuild("plank-bed")).toBe(true);
    expect(g.engine.getResourceAmount("plank")).toBe(500 - 3);
    g.advance(bed.buildTimeMs - SECOND);
    expect(g.state().house.storage).toHaveLength(0);
    g.advance(SECOND);
    expect(g.state().house.storage.map((s) => s.furnitureId)).toEqual(["plank-bed"]);
    expect(g.state().house.build).toBeNull();
    expect(g.engine.getSkillXp("construction")).toBe(bed.xp);
  });

  it("doesn't block other activities", () => {
    const g = builder();
    g.engine.startFurnitureBuild("oak-bed");
    g.engine.addItem("wood", 10);
    expect(g.engine.startCraftJob(WOODEN_BOW_RECIPE, 5)).toBe(true);
    g.advance(HOUR);
    expect(g.state().house.storage).toHaveLength(1);
    expect(g.state().statistics["crafted:wooden-bow"]).toBe(5);
  });

  it("time beyond the offline cap doesn't count toward a build", () => {
    const g = builder();
    g.engine.startFurnitureBuild("mahogany-bed"); // 2 hours
    g.advance(10 * HOUR); // only the 1 hour cap counts
    expect(g.state().house.build).not.toBeNull();
    g.advance(HOUR - SECOND);
    expect(g.state().house.build).not.toBeNull();
    g.advance(SECOND);
    expect(g.state().house.storage.map((s) => s.furnitureId)).toEqual(["mahogany-bed"]);
  });

  it("refuses without the level, materials, a free storage slot, or while one is building", () => {
    const g = builder(1);
    expect(g.engine.getFurnitureBuildBlocker("oak-chair")).toMatch(/level 19/);
    g.engine.startFurnitureBuild("crude-wooden-chair");
    expect(g.engine.startFurnitureBuild("crude-wooden-chair")).toBe(false);
    g.advance(MIN);
    g.state().resources.plank.amount = 0;
    expect(g.engine.getFurnitureBuildBlocker("crude-wooden-chair")).toMatch(/Plank/);
    g.state().resources.plank.amount = 500;
    for (let i = g.state().house.storage.length; i < 10; i++) g.state().house.storage.push({ uid: `s${i}`, furnitureId: "wall-torch" });
    expect(g.engine.getHouseStorageCapacity()).toBe(10);
    expect(g.engine.getFurnitureBuildBlocker("crude-wooden-chair")).toMatch(/storage is full/);
  });

  it("cancelling gives the materials back", () => {
    const g = builder();
    g.engine.startFurnitureBuild("oak-table");
    expect(g.engine.cancelFurnitureBuild()).toBe(true);
    expect(g.engine.getResourceAmount("oak-plank")).toBe(500);
    expect(g.state().house.build).toBeNull();
  });

  it("needs you at the house portal", () => {
    const g = builder();
    g.engine.devTeleport(getLocation("lake-shore")!);
    expect(g.engine.isAtHouse()).toBe(false);
    expect(g.engine.startFurnitureBuild("crude-wooden-chair")).toBe(false);
  });
});

describe("player house: limits", () => {
  it("furniture limit is 5 plus 1 per 2 levels; storage 10 plus 5 per 5 levels, max 100", () => {
    const g = makeEngine();
    expect(g.engine.getFurnitureLimit()).toBe(5);
    expect(g.engine.getHouseStorageCapacity()).toBe(10);
    g.engine.setSkillLevel("construction", 3);
    expect(g.engine.getFurnitureLimit()).toBe(6);
    g.engine.setSkillLevel("construction", 25);
    expect(g.engine.getHouseStorageCapacity()).toBe(35);
    g.engine.setSkillLevel("construction", 99);
    expect(g.engine.getFurnitureLimit()).toBe(54);
    expect(g.engine.getHouseStorageCapacity()).toBe(100);
  });

  it("won't place more than the limit", () => {
    const g = builder(1);
    const uids = Array.from({ length: 6 }, () => build(g, "crude-wooden-chair"));
    g.engine.setSkillLevel("construction", 1); // building gave some levels
    uids.slice(0, 5).forEach((uid, i) => expect(g.engine.placeFurniture(uid, { x: i, y: 3 })).toBe(true));
    expect(g.engine.placeFurniture(uids[5], { x: 6, y: 3 })).toBe(false);
  });
});

describe("player house: placing", () => {
  it("floor pieces can't overlap or leave the room", () => {
    const g = builder();
    const bed = build(g, "plank-bed"); // 2 wide, 4 deep
    const chair = build(g, "crude-wooden-chair");
    expect(g.engine.placeFurniture(bed, { x: 0, y: 6 })).toBe(false); // off the front edge
    expect(g.engine.placeFurniture(bed, { x: 16, y: 0 })).toBe(false); // off the right edge
    expect(g.engine.placeFurniture(bed, { x: 0, y: 0 })).toBe(true);
    expect(g.engine.placeFurniture(chair, { x: 0, y: 2 })).toBe(false);
    expect(g.engine.placeFurniture(chair, { x: 2, y: 2 })).toBe(true);
  });

  it("turning swaps the footprint and re-checks the grid", () => {
    const g = builder();
    const bed = build(g, "plank-bed"); // 2 wide, 4 deep
    const chair = build(g, "crude-wooden-chair");
    g.engine.placeFurniture(bed, { x: 0, y: 0 });
    g.engine.placeFurniture(chair, { x: 2, y: 0 });
    expect(g.engine.rotateFurniture(bed)).toBe(false); // turned, it needs columns 0-1 of row 0
    g.engine.storeFurniture(chair);
    expect(g.engine.rotateFurniture(bed)).toBe(true);
    expect(g.state().house.layout.inside[0].facing).toBe("right");
    expect(g.engine.placeFurniture(build(g, "crude-wooden-chair"), { x: 2, y: 0 })).toBe(false);
  });

  it("wall pieces use the wall grid and don't turn", () => {
    const g = builder();
    const shelves = build(g, "wooden-shelves");
    const torch = build(g, "wall-torch");
    const chair = build(g, "crude-wooden-chair");
    g.engine.placeFurniture(chair, { x: 0, y: 0 });
    expect(g.engine.placeFurniture(shelves, { x: 0, y: 0 })).toBe(true); // a different grid from the chair
    expect(g.engine.placeFurniture(torch, { x: 0, y: 0 })).toBe(false);
    expect(g.engine.placeFurniture(torch, { x: 0, y: 2 })).toBe(true);
    expect(g.engine.rotateFurniture(shelves)).toBe(false);
  });

  it("surface pieces sit on a host and travel with it", () => {
    const g = builder();
    const table = build(g, "oak-table"); // 2 surface slots
    const plant = build(g, "potted-plant");
    const candle = build(g, "bronze-candlestick");
    const extra = build(g, "potted-plant");
    expect(g.engine.placeFurniture(plant, { x: 0, y: 0 })).toBe(false); // nothing to sit on
    g.engine.placeFurniture(table, { x: 2, y: 2 });
    expect(g.engine.placeFurniture(plant, { x: 0, y: 0, hostId: table })).toBe(true);
    expect(g.engine.placeFurniture(candle, { x: 0, y: 0, hostId: table })).toBe(false);
    expect(g.engine.placeFurniture(candle, { x: 1, y: 0, hostId: table })).toBe(true);
    expect(g.engine.placeFurniture(extra, { x: 2, y: 0, hostId: table })).toBe(false);

    expect(g.engine.moveFurniture(table, { x: 5, y: 3 })).toBe(true);
    expect(g.state().house.layout.inside.filter((p) => p.hostId === table)).toHaveLength(2);

    expect(g.engine.storeFurniture(table)).toBe(true);
    expect(g.state().house.layout.inside).toHaveLength(0);
    expect(g.state().house.storage.map((s) => s.uid)).toEqual(expect.arrayContaining([table, plant, candle]));
  });
});

describe("player house: beds and the offline cap", () => {
  it("new saves start at 1 hour; the best placed bed adds to it, beds don't stack", () => {
    const g = builder();
    expect(g.engine.getOfflineCapMs()).toBe(DEFAULT_OFFLINE_CAP_MS);
    expect(DEFAULT_OFFLINE_CAP_MS).toBe(HOUR);
    const plank = build(g, "plank-bed");
    expect(g.engine.getOfflineCapMs()).toBe(HOUR); // in storage: no effect
    g.engine.placeFurniture(plank, { x: 0, y: 0 });
    expect(g.engine.getOfflineCapMs()).toBe(HOUR + 30 * MIN);
    g.engine.placeFurniture(build(g, "plank-bed"), { x: 1, y: 0 });
    expect(g.engine.getOfflineCapMs()).toBe(HOUR + 30 * MIN);
    const mahogany = build(g, "mahogany-bed");
    g.engine.placeFurniture(mahogany, { x: 2, y: 0 });
    expect(g.engine.getOfflineCapMs()).toBe(3 * HOUR);
    g.engine.storeFurniture(mahogany);
    expect(g.engine.getOfflineCapMs()).toBe(HOUR + 30 * MIN);
  });

  it("the bed's extra time counts while away", () => {
    const g = builder();
    g.engine.placeFurniture(build(g, "plank-bed"), { x: 0, y: 0 });
    g.engine.startGatherSession("trees", { ...WOODEN_BOW_RECIPE, inputs: [], output: { resource: "wood", amount: 1 }, tool: undefined });
    const before = g.engine.getResourceAmount("wood");
    g.advance(10 * HOUR);
    const gained = g.engine.getResourceAmount("wood") - before;
    expect(gained).toBe(Math.floor((90 * MIN) / WOODEN_BOW_RECIPE.timePerItemMs));
  });
});

describe("player house: facilities", () => {
  it("a placed workbench works as a sawmill at the house, and only there", () => {
    const g = builder();
    g.engine.addItem("wood", 10);
    expect(g.engine.getRecipeStartBlocker(SAW_PLANK_RECIPE)).toMatch(/sawmill/);
    const saw = build(g, "workbench");
    expect(g.engine.getRecipeStartBlocker(SAW_PLANK_RECIPE)).toMatch(/sawmill/); // still in storage
    g.engine.placeFurniture(saw, { x: 0, y: 3 });
    expect(g.engine.getRecipeStartBlocker(SAW_PLANK_RECIPE)).toBeNull();
    expect(g.engine.startCraftJob(SAW_PLANK_RECIPE, 2)).toBe(true);
    g.advance(10 * SECOND);
    expect(g.engine.getResourceAmount("plank")).toBe(500 - 3 + 2); // the workbench cost 3
    g.engine.devTeleport(getLocation("lake-shore")!);
    expect(g.engine.getRecipeStartBlocker(SAW_PLANK_RECIPE)).toMatch(/sawmill/);
  });

  it("putting the facility away stops the craft using it, with a refund", () => {
    const g = builder();
    g.engine.addItem("wood", 10);
    const saw = build(g, "workbench");
    g.engine.placeFurniture(saw, { x: 0, y: 3 });
    g.engine.startCraftJob(SAW_PLANK_RECIPE, 10);
    g.advance(4 * SECOND); // one plank done
    expect(g.engine.storeFurniture(saw)).toBe(true);
    expect(g.state().activeAction).toBeNull();
    expect(g.engine.getResourceAmount("wood")).toBe(9);
    expect(g.engine.getResourceAmount("plank")).toBe(500 - 3 + 1);
  });

  it("other furniture can be stored mid-craft", () => {
    const g = builder();
    g.engine.addItem("wood", 10);
    g.engine.placeFurniture(build(g, "workbench"), { x: 0, y: 3 });
    const chair = build(g, "crude-wooden-chair");
    g.engine.placeFurniture(chair, { x: 2, y: 3 });
    g.engine.startCraftJob(SAW_PLANK_RECIPE, 10);
    g.engine.storeFurniture(chair);
    expect(g.state().activeAction?.kind).toBe("craft");
  });
});

describe("skipping time", () => {
  it("moves everything forward at once: builds and crafting", () => {
    const g = builder();
    g.engine.addItem("wood", 10);
    g.engine.startFurnitureBuild("oak-bed"); // 45 minutes
    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 10);
    g.engine.devSkipTime(HOUR);
    expect(g.state().house.storage.map((s) => s.furnitureId)).toContain("oak-bed");
    expect(g.state().statistics["crafted:wooden-bow"]).toBe(10);
  });

  it("is capped like time away", () => {
    const g = builder();
    g.engine.startFurnitureBuild("mahogany-bed"); // 2 hours, cap 1 hour
    g.engine.devSkipTime(5 * HOUR);
    expect(g.state().house.build).not.toBeNull();
    g.engine.devSkipTime(HOUR);
    expect(g.state().house.build).toBeNull();
  });
});

describe("player house: cosmetics", () => {
  it("skins need unlocking and must match the piece", () => {
    const g = builder();
    const bed = build(g, "plank-bed");
    const chair = build(g, "crude-wooden-chair");
    g.engine.placeFurniture(bed, { x: 0, y: 0 });
    g.engine.placeFurniture(chair, { x: 4, y: 0 });
    expect(g.engine.getAvailableFurnitureSkins("plank-bed")).toEqual([]);
    expect(g.engine.setFurnitureSkin(bed, "gilded-plank-bed")).toBe(false);
    g.engine.devUnlockAllFurnitureSkins();
    expect(g.engine.setFurnitureSkin(chair, "gilded-plank-bed")).toBe(false);
    expect(g.engine.setFurnitureSkin(bed, "gilded-plank-bed")).toBe(true);
    g.engine.storeFurniture(bed);
    expect(g.state().house.storage.find((s) => s.uid === bed)?.skinId).toBe("gilded-plank-bed");
  });

  it("walls, floor and rug default from content", () => {
    const g = makeEngine();
    expect(g.engine.getHouseWallpaper()?.id).toBe("wood-wall");
    expect(g.engine.getHouseFloor()?.id).toBe("wood-floor");
    expect(g.engine.getHouseRug()?.id).toBe("none");
  });

  it("rugs lie under furniture: they only block other rugs", () => {
    const g = builder();
    const rug = build(g, "blue-rug");
    const rug2 = build(g, "red-rug");
    const chair = build(g, "crude-wooden-chair");
    expect(g.engine.placeFurniture(rug, { x: 6, y: 4 })).toBe(true);
    expect(g.engine.placeFurniture(chair, { x: 6, y: 4 })).toBe(true);
    expect(g.engine.placeFurniture(rug2, { x: 6, y: 4 })).toBe(false);
    expect(g.engine.placeFurniture(rug2, { x: 8, y: 4 })).toBe(true);
    expect(g.engine.rotateFurniture(rug)).toBe(false);
  });
});

describe("player house: saves", () => {
  it("round-trips the layout, storage, build and skins", () => {
    const g = builder();
    const table = build(g, "wooden-table");
    const plant = build(g, "potted-plant");
    g.engine.placeFurniture(table, { x: 1, y: 2 });
    expect(g.engine.placeFurniture(plant, { x: 0, y: 0, hostId: table })).toBe(true);
    g.engine.rotateFurniture(table);
    g.engine.devUnlockAllFurnitureSkins();
    g.engine.startFurnitureBuild("oak-bed");
    const before = g.state().house;
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().house).toEqual(before);
    expect(loaded.getState().version).toBe(SCHEMA_VERSION);
  });

  it("the layout is plain data (share-code ready)", () => {
    const g = builder();
    g.engine.placeFurniture(build(g, "crude-wooden-chair"), { x: 0, y: 0 });
    const layout = g.state().house.layout;
    expect(JSON.parse(JSON.stringify(layout))).toEqual(layout);
    expect(Object.keys(layout).sort()).toEqual(["floorId", "frontId", "groundId", "inside", "paths", "roofId", "rugId", "skyId", "wallpaperId", "weather", "yard"]);
    expect(layout.yard).toEqual([]);
  });

  it("a v25 save gets the default floor", () => {
    const g = makeEngine();
    const old = JSON.parse(g.engine.serialize());
    old.version = 25;
    delete old.house.layout.floorId;
    const loaded = GameEngine.deserialize(JSON.stringify(old), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().house.layout.floorId).toBe("wood-floor");
  });

  it("a v24 save gets an empty house and keeps its offline cap", () => {
    const g = makeEngine();
    const old = JSON.parse(g.engine.serialize());
    old.version = 24;
    old.offlineCapMs = 8 * HOUR;
    delete old.house;
    const loaded = GameEngine.deserialize(JSON.stringify(old), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().house.layout.inside).toEqual([]);
    expect(loaded.getState().house.build).toBeNull();
    expect(loaded.getOfflineCapMs()).toBe(8 * HOUR);
  });

  it("drops malformed pieces and unknown furniture, and returns orphaned surface pieces to storage", () => {
    const g = makeEngine();
    const old = JSON.parse(g.engine.serialize());
    old.house = {
      layout: {
        inside: [
          { uid: "a", furnitureId: "crude-wooden-chair", x: 0, y: 0, facing: "sideways" },
          { uid: "b", furnitureId: "no-such-thing", x: 1, y: 0, facing: "front" },
          { uid: "c", furnitureId: "potted-plant", x: 0, y: 0, facing: "front", hostId: "gone" },
          { uid: "d", furnitureId: "crude-wooden-chair", x: "nope", y: 0 },
        ],
        yard: "bad",
      },
      storage: [{ uid: "e" }],
      build: { furnitureId: "plank-bed", startedAt: null, durationMs: 1 },
      unlockedSkins: ["gilded-plank-bed", 7],
    };
    const house = GameEngine.deserialize(JSON.stringify(old), GAME_CONTENT, { clock: () => g.now() }).getState().house;
    expect(house.layout.inside).toEqual([{ uid: "a", furnitureId: "crude-wooden-chair", x: 0, y: 0, facing: "front" }]);
    expect(house.storage.map((s) => s.uid)).toEqual(["c"]);
    expect(house.build).toBeNull();
    expect(house.unlockedSkins).toEqual(["gilded-plank-bed"]);
    expect(house.layout.wallpaperId).toBe("wood-wall");
    expect(house.layout.floorId).toBe("wood-floor");
  });
});
