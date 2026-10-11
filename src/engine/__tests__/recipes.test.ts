import { describe, expect, it, vi } from "vitest";
import { makeEngine, SECOND } from "./helpers";
import { BURN_LOGS_RECIPE, SPIN_FLAX_RECIPE, STRING_WOODEN_BOW_RECIPE, WOODEN_BOW_RECIPE } from "../../content/recipes";
import { getItemDef } from "../../content/items";

describe("the bow chain", () => {
  it("wood and flax become an equippable wooden bow", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 2);
    g.engine.addItem("flax", 2);

    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 2);
    g.advance(4 * SECOND);
    g.engine.startCraftJob(SPIN_FLAX_RECIPE, 2);
    g.advance(4 * SECOND);
    expect(g.engine.getOwnedCount("wooden-bow-u")).toBe(2);
    expect(g.engine.getOwnedCount("bowstring")).toBe(2);

    expect(g.engine.startCraftJob(STRING_WOODEN_BOW_RECIPE, 2)).toBe(true);
    g.advance(4 * SECOND);
    const bows = Object.values(g.state().inventory).filter((i) => i.itemDefId === "wooden-bow");
    expect(bows).toHaveLength(2);
    expect(g.engine.equipItem(getItemDef("wooden-bow")!, bows[0].instanceId)).toBe(true);
    expect(g.state().statistics["crafted:wooden-bow"]).toBe(2);
  });
});

describe("firemaking", () => {
  it("burns logs into ashes and XP, with a chance of coal per log", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 10);
    const roll = vi.spyOn(Math, "random").mockReturnValue(0.05); // under 10%: every log drops coal
    g.engine.startCraftJob(BURN_LOGS_RECIPE, 10);
    g.advance(10 * BURN_LOGS_RECIPE.timePerItemMs);
    roll.mockRestore();
    expect(g.engine.getOwnedCount("ashes")).toBe(10);
    expect(g.engine.getOwnedCount("coal")).toBe(10);
    expect(g.engine.getSkillXp("firemaking")).toBe(400);
  });

  it("no coal when the rolls miss", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 5);
    const roll = vi.spyOn(Math, "random").mockReturnValue(0.5);
    g.engine.startCraftJob(BURN_LOGS_RECIPE, 5);
    g.advance(5 * BURN_LOGS_RECIPE.timePerItemMs);
    roll.mockRestore();
    expect(g.engine.getOwnedCount("coal")).toBe(0);
  });
});
