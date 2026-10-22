import { describe, expect, it } from "vitest";
import { makeEngine, HOUR, SECOND } from "./helpers";
import { getActiveCraftJob, getActiveGatherSession } from "../activeAction";
import { CHOP_NORMAL_TREE_RECIPE, WOODEN_BOW_RECIPE } from "../../content/recipes";

// Regression: the offline cap used to apply only to the catch-up tick
// itself. Every action measured from an absolute startedAt, so the NEXT
// live tick paid out everything the cap had just withheld. These pin the
// cap at 1 hour so the numbers stay readable (also the default now).
function cappedEngine() {
  const g = makeEngine();
  g.engine.setOfflineCapMs(HOUR);
  return g;
}

describe("offline cap", () => {
  it("caps a gathering session across the catch-up tick and the tick after it", () => {
    const g = cappedEngine();
    g.engine.startGatherSession("trees", CHOP_NORMAL_TREE_RECIPE);
    g.advance(10 * HOUR);
    const afterCatchUp = g.engine.getResourceAmount("wood");
    expect(afterCatchUp).toBe(HOUR / CHOP_NORMAL_TREE_RECIPE.timePerItemMs);
    g.advance(SECOND);
    expect(g.engine.getResourceAmount("wood")).toBeLessThanOrEqual(afterCatchUp + 1);
  });

  it("caps a crafting job across the catch-up tick and the tick after it", () => {
    const g = cappedEngine();
    g.state().resources.wood = { amount: 100_000, lifetimeEarned: 0 };
    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 50_000);
    g.advance(10 * HOUR);
    const done = getActiveCraftJob(g.state())!.quantityCompleted;
    expect(done).toBe(HOUR / WOODEN_BOW_RECIPE.timePerItemMs);
    g.advance(SECOND);
    expect(getActiveCraftJob(g.state())!.quantityCompleted).toBeLessThanOrEqual(done + 1);
  });

  it("does not shorten a keep-alive window with time beyond the cap", () => {
    const g = cappedEngine();
    g.engine.startGatherSession("willows", CHOP_NORMAL_TREE_RECIPE, { requiresKeepAliveEveryMs: 2 * HOUR });
    g.advance(10 * HOUR); // only 1h counts, so the 2h keep-alive hasn't lapsed
    g.advance(SECOND);
    expect(getActiveGatherSession(g.state())).not.toBeNull();
  });

  it("live ticks under the cap are unaffected", () => {
    const g = cappedEngine();
    g.engine.startGatherSession("trees", CHOP_NORMAL_TREE_RECIPE);
    for (let i = 0; i < 30; i++) g.advance(SECOND);
    expect(g.engine.getResourceAmount("wood")).toBe(10);
  });
});
