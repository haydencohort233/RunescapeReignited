import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers";

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

  it("completes stages that are already met on start", () => {
    const g = makeEngine();
    g.engine.setFlag("visited:dark-forest");
    g.engine.startQuest("overgrown-den");
    expect(g.state().quests["overgrown-den"].stage).toBe(1);
  });
});
