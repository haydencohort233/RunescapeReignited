import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers";
import { getEnemy } from "../../content/enemies";
import { ACHIEVEMENT_CATALOG } from "../../content/achivements";
import { GAME_CONTENT } from "../../content";
import { GameEngine } from "../gameEngine";

const NO_GEAR = { attack: 0, strength: 0, defence: 0 };

describe("eating", () => {
  it("heals, consumes one, and caps at max HP", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 2);
    g.engine.devSetCurrentHp(1);
    expect(g.engine.eatItem("shark")).toBe(true);
    expect(g.engine.getCurrentHp()).toBe(g.engine.getMaxHp());
    expect(g.engine.getOwnedCount("shark")).toBe(1);
  });

  it("refuses non-food and missing food", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 1);
    expect(g.engine.eatItem("bones")).toBe(false);
    expect(g.engine.eatItem("shark")).toBe(false);
  });

  it("restarts the player's attack timer mid-fight", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 1);
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR);
    // Unarmed swings every 4s; eat 3s in, just before the first swing.
    g.advance(3000);
    g.engine.eatItem("shark");
    const s = g.state().activeAction!;
    if (s.kind !== "combat") throw new Error("fight ended");
    const nextAt = s.playerStartedAt + (s.playerAttacksResolved + 1) * s.playerAttackSpeedMs;
    expect(nextAt).toBe(g.now() + s.playerAttackSpeedMs);
  });

  it("never pulls the next attack earlier", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 1);
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR);
    const s = g.state().activeAction!;
    if (s.kind !== "combat") throw new Error("no fight");
    // As if mid-respawn: the next swing is far in the future.
    s.playerStartedAt = g.now() + 60_000;
    g.engine.eatItem("shark");
    expect(s.playerStartedAt).toBe(g.now() + 60_000);
  });
});

describe("keep fighting", () => {
  function strongPlayer() {
    const g = makeEngine();
    for (const skill of ["attack", "strength", "defence", "hitpoints"]) g.engine.setSkillLevel(skill, 99);
    g.engine.devSetCurrentHp(99);
    return g;
  }

  it("respawns the enemy and keeps fighting through an offline hour, in one summary", () => {
    const g = strongPlayer();
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR, { autoRepeat: true });
    g.advance(60 * 60 * 1000);
    const action = g.state().activeAction;
    expect(action?.kind).toBe("combat");
    const kills = g.state().statistics["kills:goblin"];
    expect(kills).toBeGreaterThan(100);
    const toasts = g.engine.notifications.getAll();
    expect(toasts.filter((n) => n.type === "reward")).toHaveLength(0);
    const summary = toasts.find((n) => n.type === "offline-summary");
    expect(summary?.message).toContain(`${kills} Goblin kills`);
  });

  it("without autoRepeat, a kill ends the fight", () => {
    const g = strongPlayer();
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR);
    g.advance(60 * 1000);
    expect(g.state().activeAction).toBeNull();
    expect(g.state().statistics["kills:goblin"]).toBe(1);
  });

  it("stops repeating when HP is low and there's no food", () => {
    const g = strongPlayer();
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR, { autoRepeat: true });
    g.engine.devSetCurrentHp(10); // well under half of 99
    g.advance(60 * 1000);
    expect(g.state().activeAction).toBeNull();
    expect(g.state().statistics["kills:goblin"]).toBe(1);
  });

  it("auto-eats below half HP and keeps going while food lasts", () => {
    const g = strongPlayer();
    g.engine.addItem("shark", 3);
    g.engine.startCombat(getEnemy("bandit")!, NO_GEAR, { autoRepeat: true, autoEatItemId: "shark" });
    g.engine.devSetCurrentHp(40);
    // The next bandit hit triggers a bite, which takes HP back over half.
    g.advance(30 * 1000);
    expect(g.engine.getOwnedCount("shark")).toBeLessThan(3);
    expect(g.engine.getCurrentHp()).toBeGreaterThan(0);
  });
});

describe("combat robustness", () => {
  it("uses the equipped weapon's speed and type", async () => {
    const { getEquipmentBonuses } = await import("../../content/combatStats");
    const { getItemDef } = await import("../../content/items");
    const g = makeEngine();
    const [dagger] = g.engine.addItem("bronze-dagger", 1);
    g.engine.equipItem(getItemDef("bronze-dagger")!, dagger);
    const bonuses = getEquipmentBonuses(g.state());
    expect(bonuses).toMatchObject({ attackSpeedMs: 1800, weaponType: "stab" });
    g.engine.startCombat(getEnemy("goblin")!, bonuses);
    const s = g.state().activeAction;
    expect(s?.kind === "combat" && s.playerAttackSpeedMs).toBe(1800);
  });

  it("a zero attack speed in content can't hang the combat loop", () => {
    const g = makeEngine();
    g.engine.startCombat({ ...getEnemy("goblin")!, attackSpeedMs: 0 }, { ...NO_GEAR, attackSpeedMs: 0 });
    g.advance(60 * 60 * 1000); // returns instead of spinning forever
    expect(g.state().statistics["kills:goblin"] ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("Attack Now can't be spammed faster than half the weapon's speed", () => {
    const g = makeEngine();
    g.engine.startCombat(getEnemy("den-guardian")!, NO_GEAR); // 4s unarmed, boss survives
    expect(g.engine.attackNow()).toBe(true);
    expect(g.engine.attackNow()).toBe(false);
    g.setNow(g.now() + 2000);
    expect(g.engine.attackNow()).toBe(true);
  });

  it("logCount keeps counting after the log hits its cap", () => {
    const g = makeEngine();
    g.engine.setSkillLevel("hitpoints", 99);
    g.engine.setSkillLevel("defence", 99);
    g.engine.devSetCurrentHp(99);
    g.engine.startCombat(getEnemy("den-guardian")!, { ...NO_GEAR, defence: 500 });
    g.advance(60 * 1000); // ~35 attacks between both sides
    const s = g.state().activeAction;
    if (s?.kind !== "combat") throw new Error("fight ended");
    expect(s.log.length).toBe(20);
    expect(s.logCount).toBeGreaterThan(20);
  });
});

describe("dying", () => {
  it("loses GP without counting it as spent", () => {
    const g = makeEngine();
    g.engine.gainResource("gp", 20_000);
    g.engine.devSetCurrentHp(1);
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR);
    for (let i = 0; i < 600 && g.state().activeAction; i++) g.advance(1000);
    expect(g.state().activeAction).toBeNull();
    // ~10% of 20k; base income trickles in during the fight.
    expect(g.state().statistics["gp:lostOnDeath"]).toBeGreaterThanOrEqual(2000);
    expect(g.state().statistics["gp:spent"] ?? 0).toBe(0);
    expect(g.state().statistics.deaths).toBe(1);
    g.engine.checkAchievements(ACHIEVEMENT_CATALOG);
    expect(g.engine.isAchievementEarned("bling-bling")).toBe(false);
  });
});

describe("combat food", () => {
  it("remembers the food picked for a fight, and switches auto-eat mid-fight", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 2);
    g.engine.startCombat(getEnemy("goblin")!, NO_GEAR, { autoEatItemId: "shark" });
    expect(g.state().lastCombatFoodId).toBe("shark");
    g.engine.setAutoEat(false);
    const s = g.state().activeAction!;
    expect(s.kind === "combat" && s.autoEatItemId).toBeUndefined();
    g.engine.setAutoEat(true);
    expect(s.kind === "combat" && s.autoEatItemId).toBe("shark");
  });

  it("survives a save round-trip", () => {
    const g = makeEngine();
    g.engine.setCombatFood("shark");
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: g.now });
    expect(loaded.getState().lastCombatFoodId).toBe("shark");
  });
});
