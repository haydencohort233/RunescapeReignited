import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers";
import { getItemDef } from "../../content/items";
import { getLocation } from "../../content/mapLocations";
import { GAME_CONTENT } from "../../content";
import { GameEngine } from "../gameEngine";

describe("selling to shops", () => {
  it("pays the configured fraction of value and removes the items", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 10);
    const gp = g.engine.getResourceAmount("gp");
    const unit = g.engine.getShopSellPrice("bones");
    expect(g.engine.sellToShop("bobs-famous-axes", "bones", 10)).toBe(true);
    expect(g.engine.getOwnedCount("bones")).toBe(0);
    expect(g.engine.getResourceAmount("gp")).toBe(gp + unit * 10);
  });

  it("won't sell what you're wearing, or anything without a value", () => {
    const g = makeEngine();
    const [dagger] = g.engine.addItem("bronze-dagger", 1);
    g.engine.equipItem(getItemDef("bronze-dagger")!, dagger);
    expect(g.engine.sellToShop("riverside-armoury", "bronze-dagger", 1)).toBe(false);
    g.engine.addItem("ardougne-cloak", 1);
    expect(g.engine.sellToShop("bobs-famous-axes", "ardougne-cloak", 1)).toBe(false);
  });

  it("requires being at the shop", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 1);
    g.engine.devTeleport(getLocation("lake-shore")!);
    expect(g.engine.sellToShop("bobs-famous-axes", "bones", 1)).toBe(false);
    expect(g.engine.buyFromShop("riverside-armoury", "bronze-dagger", 1)).toBe(false);
  });
});

describe("buying from shops", () => {
  it("charges the shop's own price and only sells what it stocks", () => {
    const g = makeEngine();
    g.engine.gainResource("gp", 1000);
    expect(g.engine.buyFromShop("riverside-armoury", "bronze-dagger", 2)).toBe(true);
    expect(g.engine.getResourceAmount("gp")).toBe(900);
    expect(g.engine.buyFromShop("bobs-famous-axes", "dragon-scimitar", 1)).toBe(false);
    expect(g.engine.buyFromShop("no-such-shop", "bronze-dagger", 1)).toBe(false);
  });

  it("won't take money for a second copy of a unique item", () => {
    const content = {
      ...GAME_CONTENT,
      items: GAME_CONTENT.items.map((i) => (i.id === "bronze-dagger" ? { ...i, unique: true } : i)),
    };
    const engine = new GameEngine(content, { clock: () => 1_800_000_000_000 });
    engine.gainResource("gp", 1000);
    expect(engine.buyFromShop("riverside-armoury", "bronze-dagger", 2)).toBe(false);
    expect(engine.buyFromShop("riverside-armoury", "bronze-dagger", 1)).toBe(true);
    const gp = engine.getResourceAmount("gp");
    expect(engine.buyFromShop("riverside-armoury", "bronze-dagger", 1)).toBe(false);
    expect(engine.getResourceAmount("gp")).toBe(gp);
  });
});
