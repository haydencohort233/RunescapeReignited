import { describe, expect, it } from "vitest";
import { makeEngine, SECOND } from "./helpers";
import type { CraftingRecipe } from "../types";
import { getItemDef } from "../../content/items";
import { GAME_CONTENT } from "../../content";

// A recipe that consumes a non-stackable item and a stackable one — the
// shape that wasn't expressible before resources and items were merged.
const SMELT_DAGGER: CraftingRecipe = {
  id: "melt-dagger",
  name: "Melt Dagger",
  skill: "smithing",
  xpPerItem: 1,
  timePerItemMs: SECOND,
  inputs: [
    { resource: "bronze-dagger", amount: 1 },
    { resource: "coal", amount: 2 },
  ],
  output: { resource: "bones", amount: 1 },
};

describe("unified ledger", () => {
  it("stackable items are counts, equipment is instances", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 3);
    g.engine.addItem("bronze-dagger", 2);
    expect(g.state().resources.bones.amount).toBe(3);
    expect(Object.values(g.state().inventory).filter((i) => i.itemDefId === "bronze-dagger")).toHaveLength(2);
    expect(g.engine.getOwnedCount("bronze-dagger")).toBe(2);
  });

  it("a recipe can consume non-stackable and stackable items", () => {
    const g = makeEngine();
    g.engine.addItem("bronze-dagger", 1);
    g.engine.addItem("coal", 2);
    expect(g.engine.startCraftJob(SMELT_DAGGER, 1)).toBe(true);
    expect(g.engine.getOwnedCount("bronze-dagger")).toBe(0);
    g.advance(SECOND);
    expect(g.engine.getOwnedCount("bones")).toBe(1);
  });

  it("never consumes equipped items", () => {
    const g = makeEngine();
    const [dagger] = g.engine.addItem("bronze-dagger", 1);
    g.engine.equipItem(getItemDef("bronze-dagger")!, dagger);
    g.engine.addItem("coal", 2);
    expect(g.engine.getOwnedCount("bronze-dagger")).toBe(0);
    expect(g.engine.startCraftJob(SMELT_DAGGER, 1)).toBe(false);
    expect(g.state().inventory[dagger]).toBeDefined();
  });

  it("cancelling refunds non-stackable inputs as instances", () => {
    const g = makeEngine();
    g.engine.addItem("bronze-dagger", 3);
    g.engine.addItem("coal", 6);
    g.engine.startCraftJob(SMELT_DAGGER, 3);
    g.engine.cancelCraftJob();
    expect(g.engine.getOwnedCount("bronze-dagger")).toBe(3);
    expect(g.engine.getOwnedCount("coal")).toBe(6);
  });

  it("job deliveries can require items", () => {
    const g = makeEngine();
    const job = {
      id: "dagger-delivery",
      title: "Daggers",
      description: "",
      objective: { kind: "resourceAtLeast" as const, resource: "bronze-dagger", amount: 2 },
      consumesOnTurnIn: [{ resource: "bronze-dagger", amount: 2 }],
      reward: { gp: 10 },
    };
    g.engine.acceptJob(job, "town");
    g.engine.addItem("bronze-dagger", 2);
    expect(g.engine.turnInJob(job, "town")).toBe(true);
    expect(g.engine.getOwnedCount("bronze-dagger")).toBe(0);
  });

  it("refuses a second copy of a unique item", () => {
    const g = makeEngine({
      ...GAME_CONTENT,
      items: [...GAME_CONTENT.items, { ...getItemDef("gold-ring")!, id: "one-ring", unique: true }],
    });
    expect(g.engine.addItem("one-ring", 1)).toHaveLength(1);
    expect(g.engine.addItem("one-ring", 1)).toHaveLength(0);
    expect(g.engine.getOwnedCount("one-ring")).toBe(1);
  });
});
