import { describe, expect, it } from "vitest";
import { makeEngine, SECOND } from "./helpers";
import { GameEngine } from "../gameEngine";
import { GAME_CONTENT } from "../../content";
import { getFurniture, HOUSE_CONTENT } from "../../content/house";
import { SAW_PLANK_RECIPE } from "../../content/recipes";
import { decodeHouse, encodeHouse } from "../houseShare";
import { fromShareCode, toShareCode } from "../../lib/shareCode";
import { YARD_DECOR_SLOTS } from "../tuning";
import type { HouseLayout } from "../types";

const MIN = 60 * SECOND;

/** A level 60 builder at the house with plenty of materials. */
function builder() {
  const g = makeEngine();
  g.engine.setSkillLevel("construction", 60);
  for (const id of ["plank", "oak-plank", "mahogany-plank", "bronze-bar", "flax", "wood"]) g.engine.addItem(id, 500);
  return g;
}

/** Builds a piece and returns its storage uid. */
function build(g: ReturnType<typeof makeEngine>, furnitureId: string): string {
  expect(g.engine.startFurnitureBuild(furnitureId)).toBe(true);
  for (let t = 0; t < getFurniture(furnitureId)!.buildTimeMs; t += MIN) g.advance(MIN);
  const stored = g.state().house.storage;
  return stored[stored.length - 1].uid;
}

describe("yard", () => {
  it("garden pieces go in the yard, furniture inside, facilities and benches either", () => {
    const g = builder();
    const fern = build(g, "fern");
    const chair = build(g, "oak-chair");
    expect(g.engine.placeFurniture(fern, { x: 0, y: 0 }, "inside")).toBe(false);
    expect(g.engine.placeFurniture(fern, { x: 0, y: 0 }, "yard")).toBe(true);
    expect(g.engine.placeFurniture(chair, { x: 1, y: 0 }, "yard")).toBe(false);
    expect(g.engine.placeFurniture(chair, { x: 1, y: 0 }, "inside")).toBe(true);
    const bench = build(g, "oak-bench");
    expect(g.engine.placeFurniture(bench, { x: 9, y: 3 }, "yard")).toBe(true); // the yard is 10 wide
    expect(g.state().house.layout.yard.map((p) => p.furnitureId)).toEqual(["fern", "oak-bench"]);
  });

  it("the yard holds 20 pieces, apart from the furniture limit", () => {
    const g = builder();
    for (let i = 0; i < YARD_DECOR_SLOTS; i++) {
      g.state().house.storage.push({ uid: `f${i}`, furnitureId: "fern" });
      expect(g.engine.placeFurniture(`f${i}`, { x: i % 10, y: Math.floor(i / 10) }, "yard")).toBe(true);
    }
    g.state().house.storage.push({ uid: "one-more", furnitureId: "fern" });
    expect(g.engine.placeFurniture("one-more", { x: 0, y: 3 }, "yard")).toBe(false);
    expect(g.engine.getHouseAreaLimit("yard")).toBe(20);
  });

  it("a facility in the yard works, counts as the house's one of its kind, and servants use it", () => {
    const g = builder();
    const bench = build(g, "workbench");
    expect(g.engine.placeFurniture(bench, { x: 0, y: 3 }, "yard")).toBe(true);
    expect(g.engine.getRecipeStartBlocker(SAW_PLANK_RECIPE)).toBeNull();
    expect(g.engine.getFurnitureBuildBlocker("workbench")).toMatch(/already have a Workbench/);
    g.engine.gainResource("gp", 1000);
    g.engine.devHireServant("butler");
    g.engine.depositServantWages(1000);
    expect(g.engine.startServantOrder(SAW_PLANK_RECIPE, 5)).toBe(true);
    // Storing it moves, rotates and stores from the yard like inside.
    expect(g.engine.moveFurniture(bench, { x: 5, y: 2 })).toBe(true);
    expect(g.engine.storeFurniture(bench)).toBe(true);
    expect(g.state().servant!.order).toBeNull();
  });

  it("on load, a piece in an area it can't stand in goes to storage", () => {
    const g = builder();
    g.state().house.layout.yard.push({ uid: "chair", furnitureId: "oak-chair", x: 0, y: 0, facing: "front" });
    g.state().house.layout.inside.push({ uid: "fern", furnitureId: "fern", x: 0, y: 0, facing: "front" });
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().house.layout.yard).toEqual([]);
    expect(loaded.getState().house.layout.inside).toEqual([]);
    expect(loaded.getState().house.storage.map((s) => s.uid).sort()).toEqual(["chair", "fern"]);
  });
});

/** A small layout with a table holding a plant, a bed and a garden. */
function sampleLayout(): HouseLayout {
  return {
    inside: [
      { uid: "t", furnitureId: "oak-table", x: 2, y: 1, facing: "front" },
      { uid: "p", furnitureId: "potted-plant", x: 0, y: 0, facing: "front", hostId: "t" },
      { uid: "b", furnitureId: "plank-bed", x: 0, y: 0, facing: "front", skinId: "gilded-plank-bed" },
    ],
    yard: [
      { uid: "f", furnitureId: "small-fountain", x: 4, y: 1, facing: "front" },
      { uid: "w", furnitureId: "wooden-fence", x: 0, y: 3, facing: "front" },
    ],
    wallpaperId: "wood-wall",
    floorId: "wood-floor",
    rugId: "none",
    frontId: "brick-front",
    roofId: "slate-roof",
    groundId: "snow-ground",
    skyId: "night-sky",
    paths: [
      { x: 4, y: 0, pathId: "stone-path" },
      { x: 4, y: 1, pathId: "cobble-path" },
    ],
    weather: "off",
  };
}

describe("share codes", () => {
  it("round-trip a whole house, inside and yard, in one code", async () => {
    const code = await toShareCode({ name: "Adventurer", layout: sampleLayout() });
    expect(code.startsWith("RRH1.")).toBe(true);
    const back = await fromShareCode(`  ${code.slice(0, 20)}\n${code.slice(20)} `, HOUSE_CONTENT);
    expect(back?.name).toBe("Adventurer");
    const byId = (a: { furnitureId: string }, b: { furnitureId: string }) => a.furnitureId.localeCompare(b.furnitureId);
    const strip = (l: HouseLayout) => ({
      ...l,
      inside: l.inside.map(({ uid: _u, hostId, ...p }) => ({ ...p, host: !!hostId })).sort(byId),
      yard: l.yard.map(({ uid: _u, ...p }) => p).sort(byId),
    });
    expect(strip(back!.layout)).toEqual(strip(sampleLayout()));
    expect(back!.layout.inside.find((p) => p.furnitureId === "potted-plant")!.hostId).toBe(back!.layout.inside.find((p) => p.furnitureId === "oak-table")!.uid);
  });

  it("drop anything content wouldn't allow, and refuse what isn't a code", () => {
    const json = JSON.parse(encodeHouse({ name: "  <b>Bob</b>\u0007 the   Builder with a very long name ", layout: sampleLayout() }));
    json.i.push(["no-such-thing", 0, 0, 0, -1]); // unknown
    json.i.push(["oak-chair", 2, 1, 0, -1]); // on top of the table
    json.i.push(["oak-chair", 99, 0, 0, -1]); // off the grid
    json.i.push(["fern", 5, 0, 0, -1]); // a yard piece inside
    json.y.push(["small-fountain", 7, 1, 0, -1]);
    json.i.push(["workbench", 6, 3, 0, -1]);
    json.y.push(["workbench", 6, 3, 0, -1]); // a second Workbench
    json.i.push(["potted-plant", 5, 0, 0, 0]); // past the table's slots
    json.i[2][5] = "not-a-skin";
    for (let i = 0; i < 100; i++) json.y.push(["fern", i % 10, 3, 0, -1]);
    const house = decodeHouse(JSON.stringify(json), HOUSE_CONTENT)!;
    expect(house.name).toBe("bBob/b the Builder with");
    expect(house.layout.inside.map((p) => p.furnitureId).sort()).toEqual(["oak-table", "plank-bed", "potted-plant", "workbench"]);
    expect(house.layout.inside.find((p) => p.furnitureId === "plank-bed")!.skinId).toBeUndefined();
    expect(house.layout.yard.filter((p) => p.furnitureId === "workbench")).toHaveLength(0);
    expect(house.layout.yard.length).toBeLessThanOrEqual(YARD_DECOR_SLOTS);
    expect(decodeHouse("not json", HOUSE_CONTENT)).toBeNull();
    expect(decodeHouse(JSON.stringify({ v: 99 }), HOUSE_CONTENT)).toBeNull();
  });

  it("refuse junk and over-long pasted codes", async () => {
    expect(await fromShareCode("hello", HOUSE_CONTENT)).toBeNull();
    expect(await fromShareCode("RRH1.!!!!", HOUSE_CONTENT)).toBeNull();
    expect(await fromShareCode("RRH1." + "A".repeat(30_000), HOUSE_CONTENT)).toBeNull();
  });
});

describe("online identity in the save", () => {
  it("a v27 save gets none; a good one round-trips; a malformed one is dropped", () => {
    const g = makeEngine();
    const old = JSON.parse(g.engine.serialize());
    old.version = 27;
    delete old.online;
    expect(GameEngine.deserialize(JSON.stringify(old), GAME_CONTENT, { clock: () => g.now() }).getState().online).toBeNull();

    g.engine.setOnlineIdentity({ playerId: "abcdef0123456789", secret: "0123456789abcdef0123", houseId: null });
    g.engine.setListedHouseId("Xy12_ab-");
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getOnlineIdentity()).toEqual({ playerId: "abcdef0123456789", secret: "0123456789abcdef0123", houseId: "Xy12_ab-" });

    const bad = JSON.parse(g.engine.serialize());
    bad.online = { playerId: "x", secret: 5 };
    expect(GameEngine.deserialize(JSON.stringify(bad), GAME_CONTENT, { clock: () => g.now() }).getState().online).toBeNull();
  });
});

describe("paths and outside looks", () => {
  it("paint tiles for their cost, replace and clear them for a refund, anywhere in the yard", () => {
    const g = builder();
    const planks = g.engine.getOwnedCount("plank");
    const bars = g.engine.getOwnedCount("bronze-bar");
    expect(g.engine.paintPath(0, 0, "stone-path")).toBe(true);
    expect(g.engine.getOwnedCount("plank")).toBe(planks - 1);
    expect(g.engine.getOwnedCount("bronze-bar")).toBe(bars - 1);
    expect(g.engine.paintPath(0, 0, "stone-path")).toBe(false); // already there
    expect(g.engine.paintPath(0, 0, "dirt-path")).toBe(true); // replaced, stone refunded
    expect(g.engine.getOwnedCount("plank")).toBe(planks);
    expect(g.engine.erasePath(0, 0)).toBe(true);
    expect(g.state().house.layout.paths).toEqual([]);
    expect(g.engine.getPathBlocker(20, 0, "dirt-path")).toMatch(/not a spot/);
    for (let i = 0; i < 160; i++) g.engine.paintPath(i % 20, Math.floor(i / 20), "dirt-path");
    expect(g.state().house.layout.paths).toHaveLength(160); // the whole yard
    g.engine.setSkillLevel("construction", 1);
    expect(g.engine.getPathBlocker(0, 0, "cobble-path")).toMatch(/level 15/);
  });

  it("looks change only to known ids; defaults fill in on load", () => {
    const g = builder();
    expect(g.state().house.layout.frontId).toBe("timber-front");
    expect(g.engine.setHouseLook("front", "brick-front")).toBe(true);
    expect(g.engine.setHouseLook("sky", "no-such-sky")).toBe(false);
    const old = JSON.parse(g.engine.serialize());
    old.version = 28;
    for (const k of ["frontId", "roofId", "groundId", "skyId", "paths"]) delete old.house.layout[k];
    const loaded = GameEngine.deserialize(JSON.stringify(old), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().house.layout).toMatchObject({ frontId: "timber-front", roofId: "red-roof", groundId: "grass-ground", skyId: "day-sky", paths: [] });
  });

  it("codes from before the outside looks still open, with the defaults", () => {
    const json = JSON.parse(encodeHouse({ name: "Old", layout: sampleLayout() }));
    for (const k of ["xf", "xr", "xg", "xs", "p"]) delete json[k];
    const house = decodeHouse(JSON.stringify(json), HOUSE_CONTENT)!;
    expect(house.layout).toMatchObject({ frontId: "timber-front", skyId: "day-sky", paths: [] });
  });

  it("fences connect instead of turning", () => {
    expect(getFurniture("wooden-fence")!.connects).toBe(true);
  });
});

describe("the finer grid (Oct 25)", () => {
  it("a v29 save's positions double; surface slots and hosts stay; paths become four tiles", () => {
    const g = makeEngine();
    const old = JSON.parse(g.engine.serialize());
    old.version = 29;
    old.house.layout.inside = [
      { uid: "t", furnitureId: "oak-table", x: 3, y: 1, facing: "front" },
      { uid: "p", furnitureId: "potted-plant", x: 1, y: 0, facing: "front", hostId: "t" },
    ];
    old.house.layout.yard = [{ uid: "f", furnitureId: "fern", x: 9, y: 3, facing: "front" }];
    old.house.layout.paths = [{ x: 2, y: 1, pathId: "dirt-path" }];
    const loaded = GameEngine.deserialize(JSON.stringify(old), GAME_CONTENT, { clock: () => g.now() }).getState().house.layout;
    expect(loaded.inside).toEqual([
      { uid: "t", furnitureId: "oak-table", x: 6, y: 2, facing: "front" },
      { uid: "p", furnitureId: "potted-plant", x: 1, y: 0, facing: "front", hostId: "t" },
    ]);
    expect(loaded.yard[0]).toMatchObject({ x: 18, y: 6 });
    expect(loaded.paths.map((t) => `${t.x},${t.y}`).sort()).toEqual(["4,2", "4,3", "5,2", "5,3"]);
  });

  it("codes from the old grid open in the new squares", () => {
    const json = JSON.parse(encodeHouse({ name: "Old", layout: sampleLayout() }));
    delete json.g;
    json.i = [["oak-table", 3, 1, 0, -1], ["potted-plant", 1, 0, 0, 0]];
    json.p = [[2, 1, "dirt-path"]];
    const house = decodeHouse(JSON.stringify(json), HOUSE_CONTENT)!;
    expect(house.layout.inside.map((p) => [p.furnitureId, p.x, p.y])).toEqual([
      ["oak-table", 6, 2],
      ["potted-plant", 1, 0],
    ]);
    expect(house.layout.paths).toHaveLength(4);
  });
});
