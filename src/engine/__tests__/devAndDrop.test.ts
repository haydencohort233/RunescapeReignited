import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers";
import { getLocation } from "../../content/mapLocations";
import { getEnemy } from "../../content/enemies";
import { GAME_CONTENT } from "../../content";
import { GameEngine } from "../gameEngine";

describe("dropping part of a stack", () => {
  it("drops the amount asked for, clamped to what's held", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 10);
    g.engine.dropStack("shark", 3);
    expect(g.engine.getOwnedCount("shark")).toBe(7);
    g.engine.dropStack("shark", 50);
    expect(g.engine.getOwnedCount("shark")).toBe(0);
  });

  it("ignores invalid amounts and drops everything when none is given", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 4);
    g.engine.dropStack("shark", 1.5);
    g.engine.dropStack("shark", -2);
    expect(g.engine.getOwnedCount("shark")).toBe(4);
    g.engine.dropStack("shark");
    expect(g.engine.getOwnedCount("shark")).toBe(0);
  });
});

describe("dev teleport", () => {
  it("ignores unlock requirements and still counts a first visit", () => {
    const g = makeEngine();
    const forest = getLocation("dark-forest")!;
    g.engine.devTeleport(forest);
    expect(g.state().currentLocationId).toBe("dark-forest");
    expect(g.engine.getFlag("discoveredDarkForest")).toBe(true);
    expect(g.state().statistics.locationsDiscovered).toBe(1);
  });

  it("ends a fight, even one that can't be fled", () => {
    const g = makeEngine();
    g.engine.startCombat(getEnemy("goblin")!, { attack: 0, strength: 0, defence: 0 });
    const s = g.state().activeAction!;
    if (s.kind === "combat") s.canFlee = false;
    g.engine.devTeleport(getLocation("lake-shore")!);
    expect(g.state().activeAction).toBeNull();
    expect(g.state().currentLocationId).toBe("lake-shore");
  });
});

describe("arrows", () => {
  it("stack, are worn as a whole stack, and come off intact", () => {
    const g = makeEngine();
    const arrows = g.engine.itemsById.get("bronze-arrow")!;
    const instancesBefore = Object.keys(g.state().inventory).length;
    g.engine.addItem("bronze-arrow", 100);
    expect(Object.keys(g.state().inventory)).toHaveLength(instancesBefore);
    expect(g.engine.equipItem(arrows)).toBe(true);
    expect(g.state().equipment.ammo).toBe("stack:bronze-arrow");
    // Worn: can't be sold, consumed or dropped.
    expect(g.engine.getOwnedCount("bronze-arrow")).toBe(0);
    g.engine.dropStack("bronze-arrow");
    expect(g.engine.getResourceAmount("bronze-arrow")).toBe(100);
    g.engine.unequipSlot("ammo");
    expect(g.engine.getOwnedCount("bronze-arrow")).toBe(100);
  });

  it("stay worn across a save round-trip", () => {
    const g = makeEngine();
    g.engine.addItem("bronze-arrow", 50);
    g.engine.equipItem(g.engine.itemsById.get("bronze-arrow")!);
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: g.now });
    expect(loaded.getState().equipment.ammo).toBe("stack:bronze-arrow");
    expect(loaded.getResourceAmount("bronze-arrow")).toBe(50);
  });

  it("old saves' separate arrow copies fold into one stack, keeping a worn one worn", () => {
    const g = makeEngine();
    const st = JSON.parse(g.engine.serialize());
    st.inventory = {
      a1: { instanceId: "a1", itemDefId: "bronze-arrow" },
      a2: { instanceId: "a2", itemDefId: "bronze-arrow" },
      a3: { instanceId: "a3", itemDefId: "bronze-arrow" },
    };
    st.equipment = { ammo: "a2" };
    const loaded = GameEngine.deserialize(JSON.stringify(st), GAME_CONTENT, { clock: g.now });
    expect(loaded.getState().inventory).toEqual({});
    expect(loaded.getResourceAmount("bronze-arrow")).toBe(3);
    expect(loaded.getState().equipment.ammo).toBe("stack:bronze-arrow");
  });
});
