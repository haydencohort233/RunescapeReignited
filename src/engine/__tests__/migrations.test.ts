import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import { GAME_CONTENT } from "../../content";
// Serialized by the unmodified v14 engine: bought producers, stacked
// items, an equipped dagger, an active craft job and an accepted job.
import V14 from "../__fixtures__/save-v14.json?raw";

function load(json: string = V14) {
  const parsed = JSON.parse(json);
  return GameEngine.deserialize(json, GAME_CONTENT, { clock: () => parsed.lastTickTimestamp });
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
    parsed.activeCombatSession = {
      enemyId: "goblin",
      enemyName: "Goblin",
      playerAttackSpeedMs: 4000,
      enemyAttackSpeedMs: 3000,
      playerStartedAt: parsed.lastTickTimestamp,
      enemyStartedAt: parsed.lastTickTimestamp,
      log: [],
    };
    const engine = load(JSON.stringify(parsed));
    expect(engine.getState().activeAction?.kind).toBe("combat");
    // 10 bows queued at 1 wood each, none finished: all 10 wood come back.
    expect(engine.getResourceAmount("wood")).toBe(parsed.resources.wood.amount + 10);
  });
});

describe("v14 producers", () => {
  it("become owned counts, with stats read from content", () => {
    const engine = load();
    const state = engine.getState();
    expect(state).not.toHaveProperty("producers");
    expect(state.buildings).toMatchObject({ "base-gp": 1, lumbermill: 3 });
    expect(engine.getEffectiveRatePerSecond("wood")).toBe(1.5);
  });
});

describe("v14 stacked inventory", () => {
  it("becomes ledger counts, keeping equipment instances and what's worn", () => {
    const state = load().getState();
    expect(state.resources.bones.amount).toBe(3);
    expect(state.resources["wooden-bow-u"].amount).toBe(5);
    expect(state.resources.shark.amount).toBe(2);
    const instances = Object.values(state.inventory);
    expect(instances.every((i) => !("quantity" in i))).toBe(true);
    expect(instances.filter((i) => i.itemDefId === "bronze-dagger")).toHaveLength(2);
    expect(state.inventory[state.equipment.weapon!]?.itemDefId).toBe("bronze-dagger");
  });

  it("converts the in-progress craft job's output", () => {
    const action = load().getState().activeAction;
    expect(action?.kind === "craft" && action.output).toEqual({ resource: "wooden-bow-u", amount: 1 });
  });
});

describe("v14 job board", () => {
  it("moves accepted jobs and completion days out of statistics", () => {
    const state = load().getState();
    expect(state).not.toHaveProperty("acceptedJobs");
    expect(state.jobs.accepted["flax-for-the-fletcher"]).toMatchObject({ baselines: {} });
    expect(state.jobs.lastCompletedPeriod["deliver-wood"]).toBeTypeOf("number");
    expect(Object.keys(state.statistics).some((k) => k.startsWith("jobCompletedPeriod:"))).toBe(false);
    expect(state.statistics["kills:goblin"]).toBe(12);
  });
});

describe("untrusted save data", () => {
  it("replaces malformed values with safe defaults instead of crashing or keeping NaN", () => {
    const parsed = JSON.parse(V14);
    parsed.resources.gp.amount = null; // what NaN becomes after JSON.stringify
    parsed.resources.wood = "lots";
    parsed.skills.attack = { xp: -50 };
    parsed.currentHp = "full";
    parsed.statistics["kills:goblin"] = null;
    parsed.equipment.head = "missing-instance";
    parsed.activeCraftJob = { ...parsed.activeCraftJob, timePerItemMs: 0 };
    const state = load(JSON.stringify(parsed)).getState();
    expect(state.resources.gp.amount).toBe(0);
    expect(state.resources.wood).toBeUndefined();
    expect(state.skills.attack.xp).toBe(0);
    expect(state.currentHp).toBe(10);
    expect(state.statistics["kills:goblin"]).toBeUndefined();
    expect(state.equipment.head).toBeUndefined();
    expect(state.equipment.weapon).toBeDefined();
    expect(state.activeAction).toBeNull();
  });

  it("rejects JSON that isn't a save at all", () => {
    expect(() => GameEngine.deserialize("null", GAME_CONTENT)).toThrow();
    expect(() => GameEngine.deserialize("[1,2]", GAME_CONTENT)).toThrow();
    expect(() => GameEngine.deserialize("{}", GAME_CONTENT)).toThrow();
  });
});
