import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers";
import { CHOP_NORMAL_TREE_RECIPE, WOODEN_BOW_RECIPE } from "../../content/recipes";
import { getEnemy } from "../../content/enemies";
import { getLocation } from "../../content/mapLocations";

const NO_GEAR = { attack: 0, strength: 0, defence: 0 };

describe("one action at a time", () => {
  it("refuses to gather, craft or travel mid-fight", () => {
    const g = makeEngine();
    g.state().resources.wood = { amount: 10, lifetimeEarned: 10 };
    expect(g.engine.startCombat(getEnemy("goblin")!, NO_GEAR)).toBe(true);
    expect(g.engine.startGatherSession("trees", CHOP_NORMAL_TREE_RECIPE)).toBe(false);
    expect(g.engine.startCraftJob(WOODEN_BOW_RECIPE, 1)).toBe(false);
    expect(g.engine.startTravel(getLocation("town")!, getLocation("lumber-camp")!)).toBe(false);
    expect(g.state().activeAction?.kind).toBe("combat");
  });

  it("refuses to fight while traveling", () => {
    const g = makeEngine();
    expect(g.engine.startTravel(getLocation("town")!, getLocation("lumber-camp")!)).toBe(true);
    expect(g.engine.startCombat(getEnemy("goblin")!, NO_GEAR)).toBe(false);
  });

  it("stopActiveAction refunds a craft job and refuses to flee an unfleeable boss", () => {
    const g = makeEngine();
    g.state().resources.wood = { amount: 10, lifetimeEarned: 10 };
    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 10);
    expect(g.engine.getResourceAmount("wood")).toBe(0);
    expect(g.engine.stopActiveAction()).toBe(true);
    expect(g.engine.getResourceAmount("wood")).toBe(10);

    g.engine.startCombat(getEnemy("den-guardian")!, NO_GEAR);
    expect(g.engine.stopActiveAction()).toBe(false);
    expect(g.state().activeAction?.kind).toBe("combat");
  });
});
