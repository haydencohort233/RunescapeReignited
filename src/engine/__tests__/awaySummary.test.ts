import { describe, expect, it } from "vitest";
import { snapshotProgress, summarizeAway } from "../awaySummary";
import { xpForLevel } from "../xpCurve";
import { HOUR, T0, makeEngine } from "./helpers";

describe("away summary", () => {
  it("reports XP, levels, items gained and used, and kills", () => {
    const g = makeEngine();
    g.engine.addItem("logs", 10);
    const before = snapshotProgress(g.state(), T0);

    g.engine.addSkillXp("woodcutting", xpForLevel(5) + 10);
    g.engine.addItem("oak-logs", 7);
    g.state().resources.logs.amount = 4;
    g.state().statistics["kills:goblin"] = 3;
    const summary = summarizeAway(before, snapshotProgress(g.state(), T0 + HOUR), 8 * HOUR);

    expect(summary?.awayMs).toBe(HOUR);
    expect(summary?.skills).toEqual([{ skillId: "woodcutting", xp: xpForLevel(5) + 10, fromLevel: 1, toLevel: 5 }]);
    expect(summary?.gained).toContainEqual({ id: "oak-logs", amount: 7 });
    expect(summary?.spent).toEqual([{ id: "logs", amount: 6 }]);
    expect(summary?.kills).toEqual([{ enemyId: "goblin", count: 3 }]);
  });

  it("is null when nothing changed, and notes the offline cap", () => {
    const g = makeEngine();
    const before = snapshotProgress(g.state(), T0);
    expect(summarizeAway(before, snapshotProgress(g.state(), T0 + HOUR), 8 * HOUR)).toBeNull();

    g.engine.addItem("logs", 1);
    const summary = summarizeAway(before, snapshotProgress(g.state(), T0 + 10 * HOUR), 8 * HOUR);
    expect(summary?.countedMs).toBe(8 * HOUR);
  });

  it("says when the activity stopped, but not when a trip arrived", () => {
    const g = makeEngine();
    const at = (activity: string | null) => ({ ...snapshotProgress(g.state(), T0), activity });
    expect(summarizeAway(at("gather"), at(null), HOUR)?.stopped).toBe(true);
    expect(summarizeAway(at("travel"), at(null), HOUR)).toBeNull();
  });
});
