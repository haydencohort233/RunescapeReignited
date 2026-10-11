import { describe, expect, it } from "vitest";
import { makeEngine, SECOND, HOUR } from "./helpers";
import { WOODEN_BOW_RECIPE } from "../../content/recipes";
import { getLocation } from "../../content/mapLocations";

describe("bad input is rejected, not half-applied", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("quantity %s", (q) => {
    const g = makeEngine();
    g.engine.addItem("wood", 100);
    g.state().resources.gp = { amount: 10_000, lifetimeEarned: 10_000 };
    g.engine.addItem("bones", 10);
    const before = JSON.stringify(g.state());
    expect(g.engine.startCraftJob(WOODEN_BOW_RECIPE, q)).toBe(false);
    expect(g.engine.purchaseBuilding("lumbermill", q)).toBe(false);
    expect(g.engine.sellBuilding("lumbermill", q)).toBe(false);
    expect(g.engine.buyFromShop("bobs-famous-axes", "bronze-dagger", q)).toBe(false);
    expect(g.engine.sellToShop("bobs-famous-axes", "bones", q)).toBe(false);
    expect(JSON.stringify(g.state())).toBe(before);
  });

  it("NaN never reaches the save", () => {
    const g = makeEngine();
    g.engine.addSkillXp("attack", Number.NaN);
    g.engine.setSkillLevel("attack", Number.NaN);
    g.engine.devSetCurrentHp(Number.NaN);
    g.engine.addItem("wood", Number.NaN);
    expect(g.engine.getSkillXp("attack")).toBe(0);
    expect(g.engine.getCurrentHp()).toBe(10);
    expect(g.engine.getResourceAmount("wood")).toBe(0);
  });
});

describe("timing", () => {
  it("a job started on a stale tick isn't credited for time before it started", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 100);
    g.setNow(g.now() + 30 * SECOND); // 30s pass with no tick (throttled tab)
    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 100);
    g.advance(SECOND);
    expect(g.engine.getOwnedCount("wooden-bow-u")).toBe(0);
  });

  it("an action keeps going after the system clock jumps backwards", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 100);
    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 100);
    g.advance(10 * SECOND);
    expect(g.engine.getOwnedCount("wooden-bow-u")).toBe(5);
    g.setNow(g.now() - HOUR);
    g.engine.resolveElapsed();
    g.advance(10 * SECOND);
    expect(g.engine.getOwnedCount("wooden-bow-u")).toBe(10);
  });

  it("travel must start from where the player is", () => {
    const g = makeEngine();
    expect(g.engine.startTravel(getLocation("lake-shore")!, getLocation("lumber-camp")!)).toBe(false);
    expect(g.engine.startTravel(getLocation("town")!, getLocation("lumber-camp")!)).toBe(true);
  });
});

describe("actions started on a stale tick past the offline cap", () => {
  it("a craft started right after waking from sleep runs normally", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 100);
    g.setNow(g.now() + 2 * HOUR); // asleep, no ticks
    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 10);
    g.advance(2 * SECOND);
    expect(g.engine.getOwnedCount("wooden-bow-u")).toBe(1);
  });

  it("travel started right after waking arrives on time", () => {
    const g = makeEngine();
    g.setNow(g.now() + 2 * HOUR);
    g.engine.startTravel(getLocation("town")!, getLocation("lumber-camp")!);
    g.advance(60 * SECOND);
    expect(g.state().currentLocationId).toBe("lumber-camp");
  });
});

describe("production", () => {
  it("an 'all' modifier doesn't mint stacked items", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 5);
    g.engine.addModifier({ id: "m", source: "buff", target: "all", type: "additive", value: 1, label: "test" });
    g.advance(10 * SECOND);
    expect(g.engine.getOwnedCount("bones")).toBe(5);
  });
});
