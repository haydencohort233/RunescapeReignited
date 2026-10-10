import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers";
import { getEnemy } from "../../content/enemies";

const NO_GEAR = { attack: 0, strength: 0, defence: 0 };

describe("eating", () => {
  it("heals, consumes one, and caps at max HP", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 2);
    g.engine.devSetCurrentHp(1);
    expect(g.engine.eatItem("shark")).toBe(true);
    expect(g.engine.getCurrentHp()).toBe(g.engine.getMaxHp());
    expect(g.engine.getOwnedCount("shark")).toBe(1);
  });

  it("refuses non-food and missing food", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 1);
    expect(g.engine.eatItem("bones")).toBe(false);
    expect(g.engine.eatItem("shark")).toBe(false);
  });

  it("delays the player's next attack mid-fight", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 1);
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR);
    const before = g.state().activeAction!;
    const anchor = before.kind === "combat" ? before.playerStartedAt : 0;
    g.engine.eatItem("shark");
    const after = g.state().activeAction!;
    expect(after.kind === "combat" && after.playerStartedAt).toBe(anchor + 1800);
  });
});
