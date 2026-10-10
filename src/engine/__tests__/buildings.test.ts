import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import { GAME_CONTENT } from "../../content";
import type { GameContent } from "../types";
import { T0 } from "./helpers";

const clock = () => T0;

function withLumbermillRate(rate: number): GameContent {
  return {
    ...GAME_CONTENT,
    buildings: GAME_CONTENT.buildings.map((b) => (b.id === "lumbermill" ? { ...b, baseRatePerSecond: rate } : b)),
  };
}

describe("buildings", () => {
  it("a rebalanced building rate reaches an existing save", () => {
    const before = new GameEngine(GAME_CONTENT, { clock });
    before.getState().resources.gp = { amount: 1000, lifetimeEarned: 1000 };
    before.purchaseBuilding("lumbermill", 2);
    const after = GameEngine.deserialize(before.serialize(), withLumbermillRate(99), { clock });
    expect(after.getBuildingQuantity("lumbermill")).toBe(2);
    expect(after.getEffectiveRatePerSecond("wood")).toBe(198);
  });

  it("new games start with base income and keep it across save/load", () => {
    const engine = new GameEngine(GAME_CONTENT, { clock });
    expect(engine.getBuildingQuantity("base-gp")).toBe(1);
    const reloaded = GameEngine.deserialize(engine.serialize(), GAME_CONTENT, { clock });
    expect(reloaded.getEffectiveRatePerSecond("gp")).toBe(1);
  });

  it("selling refunds half of what the last units cost and lowers the next price", () => {
    const engine = new GameEngine(GAME_CONTENT, { clock });
    engine.getState().resources.gp = { amount: 1000, lifetimeEarned: 1000 };
    const firstPrice = engine.getBuildingPurchaseCost("lumbermill", 1)![0].amount;
    engine.purchaseBuilding("lumbermill", 1);
    const gpAfterBuy = engine.getResourceAmount("gp");
    expect(engine.sellBuilding("lumbermill", 1)).toBe(true);
    expect(engine.getResourceAmount("gp")).toBe(gpAfterBuy + Math.floor(firstPrice * 0.5));
    expect(engine.getBuildingPurchaseCost("lumbermill", 1)![0].amount).toBe(firstPrice);
    expect(engine.sellBuilding("lumbermill", 1)).toBe(false);
  });

  it("refuses purchases beyond maxOwned", () => {
    const content: GameContent = {
      ...GAME_CONTENT,
      buildings: GAME_CONTENT.buildings.map((b) => (b.id === "lumbermill" ? { ...b, maxOwned: 2 } : b)),
    };
    const engine = new GameEngine(content, { clock });
    engine.getState().resources.gp = { amount: 10_000, lifetimeEarned: 10_000 };
    expect(engine.purchaseBuilding("lumbermill", 3)).toBe(false);
    expect(engine.purchaseBuilding("lumbermill", 2)).toBe(true);
    expect(engine.purchaseBuilding("lumbermill", 1)).toBe(false);
  });
});
