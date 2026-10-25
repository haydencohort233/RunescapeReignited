import { describe, expect, it } from "vitest";
import { makeEngine, HOUR, SECOND } from "./helpers";
import { GameEngine } from "../gameEngine";
import { GAME_CONTENT } from "../../content";
import { getLocation } from "../../content/mapLocations";
import { getFurniture } from "../../content/house";
import { getNpc } from "../../content/npcs";
import { SAW_PLANK_RECIPE, SAW_OAK_PLANK_RECIPE } from "../../content/recipes";

const MIN = 60 * SECOND;
const GUILD = getNpc("guildmistress-wren")!;
/** A Butler saws a plank in 3 s / 20% = 15 s, for 15 GP of wages. */
const BUTLER_PLANK_MS = 15 * SECOND;

/** A level 60 builder at the house, with a Workbench placed and plenty of
 *  logs and GP. */
function home(level = 60) {
  const g = makeEngine();
  g.engine.setSkillLevel("construction", level);
  g.engine.addItem("plank", 50);
  g.engine.addItem("wood", 2000);
  g.engine.gainResource("gp", 1_000_000);
  expect(g.engine.startFurnitureBuild("workbench")).toBe(true);
  for (let t = 0; t < getFurniture("workbench")!.buildTimeMs; t += MIN) g.advance(MIN);
  const uid = g.state().house.storage[0].uid;
  expect(g.engine.placeFurniture(uid, { x: 0, y: 3 })).toBe(true);
  return { ...g, workbench: uid };
}

/** `home()`, plus a hired servant with a full pouch. */
function withServant(id = "butler", purse = 100_000) {
  const g = home();
  g.engine.devHireServant(id);
  g.engine.depositServantWages(purse);
  return g;
}

describe("servants: hiring", () => {
  it("hires at the Servants' Guild in Draynor, with the level and 100 GP, one at a time", () => {
    const g = makeEngine();
    g.engine.gainResource("gp", 1000);
    g.engine.setSkillLevel("construction", 19);
    expect(g.engine.getServantHireBlocker(GUILD, "butler")).toMatch(/be with Mistress Wren/);
    g.engine.devTeleport(getLocation("draynor-village")!);
    expect(g.engine.getServantHireBlocker(GUILD, "butler")).toMatch(/level 20/);
    g.engine.setSkillLevel("construction", 20);
    expect(g.engine.getServantHireBlocker(GUILD, "servant")).toMatch(/level 40/);
    expect(g.engine.hireServant(GUILD, "butler")).toBe(true);
    expect(g.engine.getOwnedCount("gp")).toBe(900);
    expect(g.engine.getHiredServant()?.id).toBe("butler");
    g.engine.setSkillLevel("construction", 60);
    expect(g.engine.getServantHireBlocker(GUILD, "demon-butler")).toMatch(/already have a servant/);
  });

  it("dismissing gives back the pouch and unused materials", () => {
    const g = withServant("butler", 1000);
    const gp = g.engine.getOwnedCount("gp");
    expect(g.engine.startServantOrder(SAW_PLANK_RECIPE, 10)).toBe(true);
    expect(g.engine.getOwnedCount("wood")).toBe(1990);
    expect(g.engine.dismissServant()).toBe(true);
    expect(g.state().servant).toBeNull();
    expect(g.engine.getOwnedCount("wood")).toBe(2000);
    expect(g.engine.getOwnedCount("gp")).toBe(gp + 1000);
  });
});

describe("servants: orders", () => {
  it("only work facilities standing in the house, with GP in the pouch, up to their limit", () => {
    const g = home();
    g.engine.devHireServant("butler");
    expect(g.engine.getServantOrderBlocker(SAW_PLANK_RECIPE, 10)).toMatch(/coin pouch/);
    g.engine.depositServantWages(100);
    expect(g.engine.getServantOrderBlocker(SAW_PLANK_RECIPE, 501)).toMatch(/up to 500/);
    expect(g.engine.getServantMaxOrder(SAW_PLANK_RECIPE)).toBe(500);
    g.engine.storeFurniture(g.workbench);
    expect(g.engine.getServantOrderBlocker(SAW_PLANK_RECIPE, 10)).toMatch(/facility/);
  });

  it("works at their share of the player's speed, beside the player, paying wages as they go", () => {
    const g = withServant("butler", 1000);
    const xp = g.engine.getSkillXp("construction");
    expect(g.engine.startServantOrder(SAW_PLANK_RECIPE, 4)).toBe(true);
    g.engine.devTeleport(getLocation("lake-shore")!); // they keep working while you're away
    g.advance(BUTLER_PLANK_MS * 2);
    expect(g.state().servant!.order!.quantityCompleted).toBe(2);
    expect(g.engine.getOwnedCount("plank")).toBe(50 - 3 + 2);
    expect(g.engine.getSkillXp("construction") - xp).toBe(2 * SAW_PLANK_RECIPE.xpPerItem);
    expect(g.state().servant!.purse).toBeCloseTo(1000 - 30);
    g.advance(BUTLER_PLANK_MS * 2 + MIN);
    expect(g.state().servant!.order).toBeNull();
    expect(g.state().servant!.purse).toBeCloseTo(1000 - 60); // idle costs nothing
    expect(g.engine.getOwnedCount("plank")).toBe(50 - 3 + 4);
  });

  it("the Demon Butler is faster: half the player's speed", () => {
    const g = withServant("demon-butler");
    g.engine.startServantOrder(SAW_PLANK_RECIPE, 10);
    g.advance(60 * SECOND - SECOND); // 6 s per plank
    expect(g.state().servant!.order!.quantityCompleted).toBe(9);
    g.advance(SECOND);
    expect(g.state().servant!.order).toBeNull();
    expect(g.engine.getOwnedCount("plank")).toBe(50 - 3 + 10);
  });

  it("cancelling gives back what wasn't made", () => {
    const g = withServant();
    g.engine.startServantOrder(SAW_PLANK_RECIPE, 10);
    g.advance(BUTLER_PLANK_MS * 3);
    expect(g.engine.cancelServantOrder()).toBe(true);
    expect(g.engine.getOwnedCount("wood")).toBe(2000 - 3);
    expect(g.state().servant!.order).toBeNull();
  });

  it("putting the facility away stops the order, with a refund", () => {
    const g = withServant();
    g.engine.startServantOrder(SAW_PLANK_RECIPE, 10);
    g.advance(BUTLER_PLANK_MS);
    expect(g.engine.storeFurniture(g.workbench)).toBe(true);
    expect(g.state().servant!.order).toBeNull();
    expect(g.engine.getOwnedCount("wood")).toBe(2000 - 1);
  });

  it("away time is capped like everything else", () => {
    const g = withServant();
    g.engine.startServantOrder(SAW_PLANK_RECIPE, 500);
    g.advance(10 * HOUR); // only the 1 hour cap counts
    expect(g.state().servant!.order!.quantityCompleted).toBe(HOUR / BUTLER_PLANK_MS);
  });
});

describe("servants: wages", () => {
  it("an order only starts when the pouch covers all its wages, so it never runs dry", () => {
    const g = home();
    g.engine.devHireServant("butler");
    expect(g.engine.getServantOrderWages(SAW_PLANK_RECIPE, 10)).toBe(150);
    g.engine.depositServantWages(149);
    expect(g.engine.getServantOrderBlocker(SAW_PLANK_RECIPE, 10)).toMatch(/needs 150 GP/);
    expect(g.engine.startServantOrder(SAW_PLANK_RECIPE, 10)).toBe(false);
    g.engine.depositServantWages(1);
    expect(g.engine.startServantOrder(SAW_PLANK_RECIPE, 10)).toBe(true);
    g.advance(10 * BUTLER_PLANK_MS);
    expect(g.state().servant!.order).toBeNull();
    expect(g.state().servant!.purse).toBeCloseTo(0);
    expect(g.engine.getOwnedCount("plank")).toBe(50 - 3 + 10);
  });

  it("cancelling keeps the unused wages in the pouch", () => {
    const g = withServant("butler", 150);
    g.engine.startServantOrder(SAW_PLANK_RECIPE, 10);
    g.advance(BUTLER_PLANK_MS * 4);
    g.engine.cancelServantOrder();
    expect(g.state().servant!.purse).toBeCloseTo(90);
  });

  it("a hired servant with no order costs nothing and never leaves", () => {
    const g = withServant("butler", 500);
    g.advance(HOUR);
    g.advance(HOUR);
    expect(g.state().servant!.purse).toBe(500);
  });
});

describe("servants: facilities", () => {
  it("a facility the servant is working is occupied for the player, and the other way round", () => {
    const g = withServant();
    g.engine.addItem("oak-logs", 10);
    g.engine.startServantOrder(SAW_PLANK_RECIPE, 10);
    expect(g.engine.getRecipeStartBlocker(SAW_OAK_PLANK_RECIPE)).toMatch(/Butler is using the Workbench/);
    expect(g.engine.startCraftJob(SAW_OAK_PLANK_RECIPE, 1)).toBe(false);
    g.engine.cancelServantOrder();
    expect(g.engine.startCraftJob(SAW_OAK_PLANK_RECIPE, 5)).toBe(true);
    expect(g.engine.getServantOrderBlocker(SAW_PLANK_RECIPE, 10)).toMatch(/using that facility yourself/);
  });

  it("a house holds one facility of each kind", () => {
    const g = home();
    expect(g.engine.getFurnitureBuildBlocker("workbench")).toMatch(/already have a Workbench/);
    // One from before the rule, in storage, can't stand beside it.
    g.state().house.storage.push({ uid: "extra", furnitureId: "workbench" });
    expect(g.engine.placeFurniture("extra", { x: 4, y: 3 })).toBe(false);
  });

  it("extra facilities of one kind standing from before the rule go to storage on load", () => {
    const g = home();
    g.state().house.layout.inside.push({ uid: "extra", furnitureId: "workbench", x: 4, y: 3, facing: "front" });
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().house.layout.inside.filter((p) => p.furnitureId === "workbench")).toHaveLength(1);
    expect(loaded.getState().house.storage.map((p) => p.uid)).toContain("extra");
  });
});

describe("servants: saves", () => {
  it("round-trips a servant mid-order", () => {
    const g = withServant();
    g.engine.startServantOrder(SAW_PLANK_RECIPE, 10);
    g.advance(BUTLER_PLANK_MS + 5 * SECOND);
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().servant).toEqual(g.state().servant);
    expect(loaded.getState().servant!.order!.progressMs).toBe(5 * SECOND);
  });

  it("a v26 save gets no servant; a malformed one is dropped, an unknown one leaves with a refund", () => {
    const g = makeEngine();
    const old = JSON.parse(g.engine.serialize());
    old.version = 26;
    delete old.servant;
    expect(GameEngine.deserialize(JSON.stringify(old), GAME_CONTENT, { clock: () => g.now() }).getState().servant).toBeNull();

    const bad = JSON.parse(g.engine.serialize());
    bad.servant = { purse: 5 };
    expect(GameEngine.deserialize(JSON.stringify(bad), GAME_CONTENT, { clock: () => g.now() }).getState().servant).toBeNull();

    const gone = JSON.parse(g.engine.serialize());
    gone.servant = { servantId: "imp", purse: 50, order: null };
    const loaded = GameEngine.deserialize(JSON.stringify(gone), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().servant).toBeNull();
    expect(loaded.getOwnedCount("gp")).toBe(50);
  });
});
