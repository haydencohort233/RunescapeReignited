import { describe, expect, it } from "vitest";
import { makeEngine, HOUR, SECOND } from "./helpers";
import { GAME_CONTENT } from "../../content";
import { GameEngine } from "../gameEngine";
import { getEnemy } from "../../content/enemies";
import { getRecipe } from "../../content/recipes";
import { getLocation } from "../../content/mapLocations";

const NO_GEAR = { attack: 0, strength: 0, defence: 0 };

describe("buffs during time away", () => {
  it("pay for the part of the window they were active", () => {
    const g = makeEngine();
    g.engine.gainResource("gp", 100);
    g.engine.gainResource("wood", 5);
    g.engine.purchaseBuilding("lumbermill", 1); // 0.5 wood/s
    g.engine.addModifier({
      id: "x2",
      source: "buff",
      target: "wood",
      type: "multiplicative",
      value: 2,
      expiresAt: g.now() + 30 * 60 * SECOND,
      label: "x2",
    });
    const before = g.engine.getResourceAmount("wood");
    g.advance(HOUR);
    // 30 min at 1/s + 30 min at 0.5/s.
    expect(g.engine.getResourceAmount("wood") - before).toBeCloseTo(2700, 5);
    expect(g.state().modifiers.x2).toBeUndefined();
  });

  it("an additive buff with no building pays only while active", () => {
    const g = makeEngine();
    g.engine.addModifier({
      id: "coal",
      source: "buff",
      target: "coal",
      type: "additive",
      value: 1,
      expiresAt: g.now() + 10 * 60 * SECOND,
      label: "+1 coal/s",
    });
    g.advance(HOUR);
    expect(g.engine.getResourceAmount("coal")).toBeCloseTo(600, 5);
  });
});

describe("stopping an action catches up first", () => {
  it("keeps items finished since the last tick", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 5);
    g.engine.startCraftJob(getRecipe("wooden-bow")!, 5);
    g.setNow(g.now() + 5999); // 2 done, no tick yet
    g.engine.stopActiveAction();
    expect(g.engine.getOwnedCount("wooden-bow-u")).toBe(2);
    expect(g.engine.getOwnedCount("wood")).toBe(3);
  });

  it("doesn't cancel a trip that already arrived", () => {
    const g = makeEngine();
    g.engine.startTravel(getLocation("town")!, getLocation("lumber-camp")!);
    const a = g.state().activeAction!;
    g.setNow(g.now() + (a.kind === "travel" ? a.durationMs : 0) + 500);
    g.engine.cancelTravel();
    expect(g.state().currentLocationId).toBe("lumber-camp");
  });
});

describe("messages", () => {
  it("loot names currencies properly", () => {
    const g = makeEngine();
    for (const skill of ["attack", "strength", "defence", "hitpoints"]) g.engine.setSkillLevel(skill, 99);
    g.engine.devSetCurrentHp(99);
    g.engine.startCombat({ ...getEnemy("goblin")!, lootTable: [{ id: "gp", quantityMin: 3, quantityMax: 3, weight: 1 }] }, NO_GEAR);
    for (let i = 0; i < 60 && g.state().activeAction; i++) g.advance(SECOND);
    const msg = g.engine.notifications.getHistory().find((n) => n.message.startsWith("Defeated"))?.message;
    expect(msg).toContain("3 GP");
  });

  it("the away summary says when the cap applied", () => {
    const g = makeEngine();
    g.engine.setOfflineCapMs(HOUR);
    g.advance(3 * HOUR);
    const summary = g.engine.notifications.getAll().find((n) => n.type === "offline-summary");
    expect(summary?.message).toContain("only 1h 0m counted");
  });
});

describe("loading a save with a broken fight", () => {
  it("defaults missing attack counters instead of resolving thousands of attacks", () => {
    const g = makeEngine();
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR);
    const st = JSON.parse(g.engine.serialize());
    delete st.activeAction.playerAttacksResolved;
    delete st.activeAction.enemyAttacksResolved;
    const e = GameEngine.deserialize(JSON.stringify(st), GAME_CONTENT, { clock: () => g.now() + 5000 });
    e.resolveElapsed();
    expect(e.getState().activeAction?.kind).toBe("combat");
    expect(e.getCurrentHp()).toBeGreaterThan(0);
  });
});
