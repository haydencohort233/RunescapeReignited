import { describe, expect, it } from "vitest";
import { getLocation } from "../../content/mapLocations";
import { makeEngine } from "./helpers";
import { conditionProgress, describeConditionProgress } from "../unlockConditions";

describe("quests", () => {
  it("runs the sample quest through every stage", () => {
    const g = makeEngine();
    g.state().statistics["kills:goblin"] = 50; // old kills don't count
    expect(g.engine.startQuest("overgrown-den")).toBe(true);
    expect(g.engine.getQuestStatus("overgrown-den")).toBe("in-progress");

    g.engine.setFlag("visited:dark-forest");
    g.advance(1000);
    expect(g.state().quests["overgrown-den"].stage).toBe(1);

    g.state().statistics["kills:goblin"] = 52;
    g.advance(1000);
    expect(g.state().quests["overgrown-den"].stage).toBe(1);
    g.state().statistics["kills:goblin"] = 53;
    g.advance(1000);
    expect(g.state().quests["overgrown-den"].stage).toBe(2);

    // A delivery stage never completes by itself, even when met.
    g.engine.addItem("bones", 6);
    g.advance(1000);
    expect(g.state().quests["overgrown-den"].stage).toBe(2);
    expect(g.engine.advanceQuest("overgrown-den")).toBe(true);

    expect(g.engine.getQuestStatus("overgrown-den")).toBe("completed");
    expect(g.engine.getOwnedCount("bones")).toBe(1);
    expect(g.engine.getFlag("investigatedDen")).toBe(true);
    expect(g.engine.startQuest("overgrown-den")).toBe(false);
  });

  it("caps progress at what's needed", () => {
    const g = makeEngine();
    g.engine.addItem("bronze-bar", 1_000_000_000);
    const need = { kind: "resourceAtLeast", resource: "bronze-bar", amount: 3 } as const;
    expect(conditionProgress(need, g.state())).toEqual({ have: 3, need: 3 });
    expect(describeConditionProgress(need, g.state())).toMatch(/3\/3$/);
  });

  it("completes stages that are already met on start", () => {
    const g = makeEngine();
    g.engine.setFlag("visited:dark-forest");
    g.engine.startQuest("overgrown-den");
    expect(g.state().quests["overgrown-den"].stage).toBe(1);
  });

  it("starts a quest only where its giver is", () => {
    const g = makeEngine();
    expect(g.engine.startQuest("quarry-masters-order")).toBe(false);
    g.engine.devTeleport(getLocation("quarry")!);
    expect(g.engine.startQuest("quarry-masters-order")).toBe(true);
  });

  it("hands in only back at the giver, and marks the quest done", () => {
    const g = makeEngine();
    g.engine.devTeleport(getLocation("quarry")!);
    g.engine.startQuest("quarry-masters-order");
    g.state().statistics["crafted:smelt-bronze-bar"] = (g.state().statistics["crafted:smelt-bronze-bar"] ?? 0) + 5;
    g.engine.addItem("bronze-bar", 5);
    g.advance(1000);
    g.engine.devTeleport(getLocation("town")!);
    expect(g.engine.advanceQuest("quarry-masters-order")).toBe(false);
    g.engine.devTeleport(getLocation("quarry")!);
    expect(g.engine.advanceQuest("quarry-masters-order")).toBe(true);
    expect(g.engine.getQuestStatus("quarry-masters-order")).toBe("completed");
    expect(g.engine.getFlag("questDone:quarry-masters-order")).toBe(true);
  });

  it("the dev reset puts every quest back to not started", () => {
    const g = makeEngine();
    g.engine.setFlag("visited:dark-forest");
    g.engine.startQuest("overgrown-den");
    g.engine.setFlag("investigatedDen");
    g.engine.setFlag("questDone:overgrown-den");
    g.engine.setFlag("achievement:quest-overgrown-den");
    g.engine.devResetQuests(["quest-overgrown-den"]);
    expect(g.engine.getQuestStatus("overgrown-den")).toBe("not-started");
    expect(g.engine.getFlag("investigatedDen")).toBe(false);
    expect(g.engine.getFlag("questDone:overgrown-den")).toBe(false);
    expect(g.engine.getFlag("achievement:quest-overgrown-den")).toBe(false);
  });
});
