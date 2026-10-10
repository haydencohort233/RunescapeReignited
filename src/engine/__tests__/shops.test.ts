import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers";
import { getItemDef } from "../../content/items";

describe("selling to shops", () => {
  it("pays the configured fraction of value and removes the items", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 10);
    const gp = g.engine.getResourceAmount("gp");
    const unit = g.engine.getShopSellPrice("bones");
    expect(g.engine.sellToShop("town", "bones", 10)).toBe(true);
    expect(g.engine.getOwnedCount("bones")).toBe(0);
    expect(g.engine.getResourceAmount("gp")).toBe(gp + unit * 10);
  });

  it("won't sell what you're wearing, or anything without a value", () => {
    const g = makeEngine();
    const [dagger] = g.engine.addItem("bronze-dagger", 1);
    g.engine.equipItem(getItemDef("bronze-dagger")!, dagger);
    expect(g.engine.sellToShop("town", "bronze-dagger", 1)).toBe(false);
    g.engine.addItem("ardougne-cloak", 1);
    expect(g.engine.sellToShop("town", "ardougne-cloak", 1)).toBe(false);
  });

  it("requires being at the shop", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 1);
    expect(g.engine.sellToShop("lake-shore", "bones", 1)).toBe(false);
  });
});
