import { describe, expect, it } from "vitest";
import { makeEngine, SECOND } from "./helpers";
import { WOODEN_BOW_RECIPE } from "../../content/recipes";

describe("crafting notifications", () => {
  it("a 30-item job leaves one toast, not 30", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 30);
    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 30);
    for (let i = 0; i < 60; i++) g.advance(SECOND);
    const production = g.engine.notifications.getAll().filter((n) => n.type === "production");
    expect(production).toHaveLength(1);
    expect(production[0].message).toContain("Made x30");
  });
});
