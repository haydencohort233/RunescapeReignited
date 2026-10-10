import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
// Serialized by the unmodified v14 engine: bought producers, stacked
// items, an equipped dagger, an active craft job and an accepted job.
import V14 from "../__fixtures__/save-v14.json?raw";

function load(json: string = V14) {
  const parsed = JSON.parse(json);
  return GameEngine.deserialize(json, undefined, { clock: () => parsed.lastTickTimestamp });
}

describe("loading a v14 save", () => {
  it("moves the in-progress craft job into activeAction", () => {
    const state = load().getState();
    expect(state.activeAction?.kind).toBe("craft");
    expect(state).not.toHaveProperty("activeCraftJob");
    expect(state).not.toHaveProperty("activeCombatSession");
  });

  it("keeps one action and refunds a craft job that was running alongside a fight", () => {
    const parsed = JSON.parse(V14);
    parsed.activeCombatSession = { enemyId: "goblin", enemyName: "Goblin", log: [] };
    const engine = load(JSON.stringify(parsed));
    expect(engine.getState().activeAction?.kind).toBe("combat");
    // 10 bows queued at 1 wood each, none finished: all 10 wood come back.
    expect(engine.getResourceAmount("wood")).toBe(parsed.resources.wood.amount + 10);
  });
});
