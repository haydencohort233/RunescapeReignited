import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEngine, HOUR, SECOND } from "./helpers";
import { GAME_CONTENT } from "../../content";
import { GameEngine } from "../gameEngine";
import { getEnemy } from "../../content/enemies";
import { getRecipe } from "../../content/recipes";
import { getNpc } from "../../content/npcs";
import { getLocation } from "../../content/mapLocations";
import { getActiveCombat } from "../activeAction";
import { DEFAULT_OFFLINE_CAP_MS } from "../tuning";
import type { ActiveCombatSession, EnemyDefinition } from "../types";

/** A punching bag: lots of HP, never hits back hard enough to matter. */
const DUMMY: EnemyDefinition = {
  id: "goblin",
  name: "Dummy",
  maxHp: 10_000,
  attack: 1,
  strength: 1,
  defence: 1,
  ranged: 1,
  magic: 1,
  attackBonus: -64,
  strengthBonus: -64,
  defenceBonus: 0,
  xpReward: 100,
  attackSpeedMs: 60_000,
};

function fighter() {
  const g = makeEngine();
  for (const skill of ["attack", "strength", "defence", "hitpoints", "ranged", "magic"]) g.engine.setSkillLevel(skill, 99);
  g.engine.devSetCurrentHp(99);
  return g;
}

function combat(g: ReturnType<typeof makeEngine>): ActiveCombatSession {
  const s = getActiveCombat(g.state());
  if (!s) throw new Error("no fight");
  return s;
}

function equip(g: ReturnType<typeof makeEngine>, id: string) {
  const def = g.engine.itemsById.get(id)!;
  if (def.stackable) return g.engine.equipItem(def);
  const [instanceId] = g.engine.addItem(id, 1);
  return g.engine.equipItem(def, instanceId);
}

describe("combat styles", () => {
  it("send a kill's XP to the style's skill, with a quarter to Hitpoints", () => {
    const g = fighter();
    g.engine.setCombatStyle("melee", "aggressive");
    const before = { str: g.engine.getSkillXp("strength"), atk: g.engine.getSkillXp("attack"), hp: g.engine.getSkillXp("hitpoints") };
    g.engine.startCombat(getEnemy("goblin")!, { attack: 200, strength: 200, defence: 200 });
    for (let i = 0; i < 120 && g.state().activeAction; i++) g.advance(SECOND);
    expect(g.state().statistics["kills:goblin"]).toBe(1);
    expect(g.engine.getSkillXp("strength") - before.str).toBeCloseTo(15);
    expect(g.engine.getSkillXp("hitpoints") - before.hp).toBeCloseTo(5);
    expect(g.engine.getSkillXp("attack")).toBe(before.atk);
  });

  it("Rapid shoots a tick faster and Controlled splits XP three ways", () => {
    const g = fighter();
    equip(g, "wooden-bow");
    g.engine.addItem("bronze-arrow", 50);
    equip(g, "bronze-arrow");
    g.engine.setCombatStyle("ranged", "rapid");
    g.engine.startCombat(DUMMY);
    expect(combat(g).playerAttackSpeedMs).toBe(2400 - 600);
    g.engine.setCombatStyle("ranged", "ranged-accurate");
    expect(combat(g).playerAttackSpeedMs).toBe(2400);
  });
});

describe("Ranged", () => {
  it("uses one arrow per shot; out of arrows, the fight goes on but you can't attack", () => {
    const g = fighter();
    equip(g, "wooden-bow");
    g.engine.addItem("bronze-arrow", 3);
    equip(g, "bronze-arrow");
    expect(g.engine.startCombat(DUMMY)).toBe(true);
    expect(combat(g).attackStyle).toBe("ranged");
    g.advance(2400 * 3);
    expect(g.engine.getResourceAmount("bronze-arrow")).toBe(0);
    expect(g.state().equipment.ammo).toBeUndefined();
    const hp = combat(g).enemyCurrentHp;
    g.advance(2400 * 5);
    expect(combat(g).outOfSupplies).toBe(true);
    expect(combat(g).enemyCurrentHp).toBe(hp);
    expect(g.engine.attackNow()).toBe(false);
    expect(g.engine.fleeCombat()).toBe(true);
  });

  it("keep fighting doesn't respawn the enemy once the arrows are gone", () => {
    const g = fighter();
    equip(g, "wooden-bow");
    g.engine.addItem("bronze-arrow", 1);
    equip(g, "bronze-arrow");
    g.engine.startCombat({ ...DUMMY, maxHp: 1, defence: 1, defenceBonus: -200 }, undefined, { autoRepeat: true });
    for (let i = 0; i < 20 && g.state().activeAction; i++) g.advance(2400);
    expect(g.state().statistics["kills:goblin"]).toBe(1);
    expect(g.state().activeAction).toBeNull();
  });

  it("refuses to start with no arrows", () => {
    const g = fighter();
    equip(g, "wooden-bow");
    expect(g.engine.startCombat(DUMMY)).toBe(false);
  });
});

describe("Magic", () => {
  it("uses runes per cast, but not the ones the staff supplies", () => {
    const g = fighter();
    equip(g, "air-staff");
    g.engine.addItem("mind-rune", 2);
    expect(g.engine.selectSpell("wind-strike")).toBe(true);
    const magicXp = g.engine.getSkillXp("magic");
    expect(g.engine.startCombat(DUMMY)).toBe(true);
    g.advance(3000);
    expect(g.engine.getResourceAmount("mind-rune")).toBe(1);
    expect(g.engine.getSkillXp("magic") - magicXp).toBeCloseTo(5.5);
    g.advance(3000 * 2);
    expect(g.engine.getResourceAmount("mind-rune")).toBe(0);
    expect(combat(g).outOfSupplies).toBe(true);
  });

  it("needs a spell and the level for it", () => {
    const g = makeEngine();
    equip(g, "air-staff");
    expect(g.engine.startCombat(DUMMY)).toBe(false);
    expect(g.engine.selectSpell("fire-wave")).toBe(false);
  });
});

describe("special attacks", () => {
  it("Puncture hits twice and uses 25% energy", () => {
    const g = fighter();
    equip(g, "dragon-dagger");
    g.engine.startCombat(DUMMY);
    expect(g.engine.toggleSpecialAttack()).toBe(true);
    g.advance(2400);
    const s = combat(g);
    expect(g.state().specialEnergy).toBeCloseTo(75 + 2400 / 3000, 5);
    expect(s.log.filter((e) => e.special)).toHaveLength(2);
    expect(s.specArmed).toBe(false);
  });

  it("Sever can make the target bleed for 5% of its max HP, 4 times, without stacking", () => {
    const g = fighter();
    equip(g, "dragon-scimitar");
    g.engine.startCombat(DUMMY);
    const s = combat(g);
    // Force a bleed as Sever would apply it.
    s.bleed = { damagePerHit: 500, hitsLeft: 4, intervalMs: 3000, startedAt: g.now(), resolved: 0 };
    const hpBefore = s.enemyCurrentHp;
    g.advance(12_000);
    const bleeds = s.log.filter((e) => e.outcome === "bleed");
    expect(bleeds).toHaveLength(4);
    expect(bleeds.every((e) => e.damage === 500)).toBe(true);
    expect(s.bleed).toBeUndefined();
    expect(hpBefore - s.enemyCurrentHp).toBeGreaterThanOrEqual(2000);
  });

  afterEach(() => vi.restoreAllMocks());

  it("Sever's 25% roll starts a bleed, a new one restarts it, and a bleed can finish the kill", () => {
    const g = fighter();
    equip(g, "dragon-scimitar");
    const weak = { ...DUMMY, maxHp: 400, xpReward: 40 };
    g.engine.startCombat(weak);
    const s = combat(g);
    // Every roll lands; damage rolls the minimum; bleed chance roll passes.
    vi.spyOn(Math, "random").mockReturnValue(0);
    g.engine.toggleSpecialAttack();
    g.advance(2400);
    expect(s.bleed).toMatchObject({ damagePerHit: 20, hitsLeft: 4 });
    g.advance(3000); // one bleed tick and one swing
    expect(s.bleed?.hitsLeft).toBe(3);
    g.state().specialEnergy = 100;
    g.engine.toggleSpecialAttack();
    g.advance(2400);
    expect(s.bleed?.hitsLeft).toBe(4); // restarted, not stacked
    expect(s.log.filter((e) => e.outcome === "bleed").every((e) => e.damage === 20)).toBe(true);

    // A bleed tick that finishes the enemy is a kill.
    s.enemyCurrentHp = 5;
    s.playerStartedAt = g.now() + 60_000;
    s.bleed!.startedAt = g.now() - s.bleed!.intervalMs * (s.bleed!.resolved + 1) + 1;
    g.advance(10);
    expect(g.state().statistics["kills:goblin"]).toBe(1);
    expect(g.state().activeAction).toBeNull();
  });

  it("a failed bleed roll leaves no bleed", () => {
    const g = fighter();
    equip(g, "dragon-scimitar");
    g.engine.startCombat(DUMMY);
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(0.9);
    g.engine.toggleSpecialAttack();
    g.advance(2400);
    expect(combat(g).bleed).toBeUndefined();
  });

  it("refuses without enough energy, and regains 10% every 30 seconds", () => {
    const g = fighter();
    equip(g, "dragon-scimitar");
    g.state().specialEnergy = 50;
    g.engine.startCombat(DUMMY);
    expect(g.engine.toggleSpecialAttack()).toBe(false);
    g.advance(30 * SECOND);
    expect(g.state().specialEnergy).toBeCloseTo(60, 5);
  });

  it("a bleed survives a save mid-fight and moves with the offline cap", () => {
    const g = fighter();
    equip(g, "dragon-scimitar");
    g.engine.startCombat(DUMMY);
    combat(g).bleed = { damagePerHit: 5, hitsLeft: 4, intervalMs: 3000, startedAt: g.now(), resolved: 0 };
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(getActiveCombat(loaded.getState())?.bleed?.hitsLeft).toBe(4);
    const broken = JSON.parse(g.engine.serialize());
    broken.activeAction.bleed.intervalMs = 0;
    const fixed = GameEngine.deserialize(JSON.stringify(broken), GAME_CONTENT, { clock: () => g.now() });
    expect(getActiveCombat(fixed.getState())?.bleed).toBeUndefined();
  });
});

describe("gear lock and food slot", () => {
  it("refuses gear changes mid-fight, but food can still be swapped", () => {
    const g = fighter();
    const [dagger] = g.engine.addItem("bronze-dagger", 1);
    g.engine.addItem("shark", 5);
    g.engine.addItem("trout", 5);
    expect(equip(g, "shark")).toBe(true);
    g.engine.startCombat(DUMMY);
    expect(g.engine.equipItem(g.engine.itemsById.get("bronze-dagger")!, dagger)).toBe(false);
    expect(equip(g, "trout")).toBe(true);
    expect(g.state().equipment.food).toBe("stack:trout");
  });

  it("auto-eats from the food slot and clears it when empty", () => {
    const g = makeEngine();
    g.engine.addItem("shark", 1);
    equip(g, "shark");
    expect(g.engine.getOwnedCount("shark")).toBe(0);
    expect(g.engine.getFoodCount("shark")).toBe(1);
    g.engine.startCombat(DUMMY);
    expect(combat(g).autoEatItemId).toBe("shark");
    g.engine.devSetCurrentHp(1);
    expect(g.engine.eatItem("shark")).toBe(true);
    expect(g.state().equipment.food).toBeUndefined();
  });

  it("death takes only GP", () => {
    const g = makeEngine();
    g.engine.gainResource("gp", 1000);
    g.engine.addItem("bones", 50);
    g.engine.startCombat(getEnemy("den-guardian")!, { attack: 0, strength: 0, defence: 0 });
    for (let i = 0; i < 600 && g.state().activeAction; i++) g.advance(SECOND);
    expect(g.state().statistics.deaths).toBe(1);
    expect(g.engine.getResourceAmount("bones")).toBe(50);
    expect(g.engine.getResourceAmount("gp")).toBeLessThan(1000 + 600);
  });
});

describe("degrading gear", () => {
  it("breaks into its broken item, which Bob repairs for gold", () => {
    const g = fighter();
    equip(g, "dharoks-greataxe");
    const id = g.state().equipment.weapon!;
    g.state().inventory[id].durability = 2;
    g.engine.startCombat(DUMMY);
    g.advance(4200 * 2);
    expect(g.state().inventory[id].itemDefId).toBe("dharoks-greataxe-0");
    expect(g.state().equipment.weapon).toBeUndefined();
    // The fight carries on unarmed.
    expect(combat(g).playerAttackSpeedMs).toBe(4000);
    g.engine.fleeCombat();
    expect(g.engine.getRepairCost(id)).toBe(100_000);
    g.engine.gainResource("gp", 100_000);
    expect(g.engine.repairItem("bobs-famous-axes", id)).toBe(true);
    expect(g.state().inventory[id]).toMatchObject({ itemDefId: "dharoks-greataxe", durability: 10_000 });
  });

  it("the dev tool restores wear, broken items and charges", () => {
    const g = makeEngine();
    const [axe] = g.engine.addItem("dharoks-greataxe-0", 1);
    const [glory] = g.engine.addItem("amulet-of-glory", 1);
    g.state().inventory[glory].charges = 0;
    g.engine.devRestoreAllGear();
    expect(g.state().inventory[axe].itemDefId).toBe("dharoks-greataxe");
    expect(g.state().inventory[glory].charges).toBe(4);
  });
});

describe("jewellery charges", () => {
  it("the Glory uses a charge per teleport and Aggie recharges it", () => {
    const g = makeEngine();
    const [glory] = g.engine.addItem("amulet-of-glory", 1);
    const def = g.engine.itemsById.get("amulet-of-glory")!;
    expect(g.state().inventory[glory].charges).toBe(4);
    for (let i = 0; i < 4; i++) {
      g.engine.devTeleport(getLocation("lake-shore")!);
      expect(g.engine.teleportTo(def, glory, getLocation("town")!)).toBe(true);
    }
    expect(g.engine.teleportTo(def, glory, getLocation("town")!)).toBe(false);
    const aggie = getNpc("aggie")!;
    g.engine.gainResource("gp", 5000);
    expect(g.engine.rechargeItem(aggie, glory)).toBe(false); // not in Draynor
    g.engine.devTeleport(getLocation("draynor-village")!);
    expect(g.engine.rechargeItem(aggie, glory)).toBe(true);
    expect(g.state().inventory[glory].charges).toBe(4);
  });
});

describe("gathering", () => {
  it("needs the right tool, and the starter kit is given once", () => {
    const g = makeEngine();
    const axe = Object.values(g.state().inventory).find((i) => i.itemDefId === "bronze-axe")!;
    delete g.state().inventory[axe.instanceId];
    expect(g.engine.startGatherSession("trees", getRecipe("chop-normal-tree")!)).toBe(false);
    const reloaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(Object.values(reloaded.getState().inventory).some((i) => i.itemDefId === "bronze-axe")).toBe(false);
  });

  it("gets up to 10% faster with level, and a better tool stacks on top", () => {
    const g = makeEngine();
    const recipe = getRecipe("chop-normal-tree")!;
    expect(g.engine.getEffectiveTimePerItem(recipe)).toBe(3000);
    g.engine.setSkillLevel("woodcutting", 99);
    expect(g.engine.getEffectiveTimePerItem(recipe)).toBe(2700);
    g.engine.addItem("rune-axe", 1);
    expect(g.engine.getEffectiveTimePerItem(recipe)).toBe(Math.round(3000 * 0.9 * 0.75));
  });

  it("a tool the player can't use yet doesn't count", () => {
    const g = makeEngine();
    g.engine.addItem("rune-axe", 1);
    expect(g.engine.getBestTool("axe")?.id).toBe("bronze-axe");
  });

  it("station recipes only start at their station", () => {
    const g = makeEngine();
    g.engine.addItem("raw-shrimps", 1);
    g.engine.devTeleport(getLocation("lake-shore")!);
    expect(g.engine.startCraftJob(getRecipe("cook-shrimps")!, 1)).toBe(false);
    g.engine.devTeleport(getLocation("town")!);
    expect(g.engine.startCraftJob(getRecipe("cook-shrimps")!, 1)).toBe(true);
  });

  it("burying bones takes a second each and gives Prayer XP", () => {
    const g = makeEngine();
    g.engine.addItem("bones", 10);
    expect(g.engine.startCraftJob(getRecipe("bury-bones")!, 10)).toBe(true);
    expect(g.engine.getOwnedCount("bones")).toBe(0);
    g.advance(5 * SECOND);
    expect(g.engine.getSkillXp("prayer")).toBeCloseTo(4.5 * 5);
    g.advance(5 * SECOND);
    expect(g.engine.getSkillXp("prayer")).toBeCloseTo(45);
    // Grave Digger still counts buried bones.
    expect(g.state().statistics["buried:bones"]).toBe(10);
    expect(g.state().activeAction).toBeNull();
  });
});

describe("Construction", () => {
  it("buildings give Construction XP, and the Fishing Hut needs level 5", () => {
    const g = makeEngine();
    g.engine.setFlag("discoveredLakeShore");
    g.engine.gainResource("gp", 1_000_000);
    g.engine.gainResource("wood", 10_000);
    g.engine.gainResource("raw-shrimps", 1000);
    expect(g.engine.purchaseBuilding("fishing-hut")).toBe(false);
    expect(g.engine.purchaseBuilding("lumbermill", 13)).toBe(true);
    expect(g.engine.getSkillLevel("construction")).toBeGreaterThanOrEqual(5);
    expect(g.engine.purchaseBuilding("fishing-hut")).toBe(true);
  });

  it("level 15 is reachable from early buildings alone", () => {
    const g = makeEngine();
    g.engine.gainResource("gp", 1_000_000);
    g.engine.gainResource("wood", 100_000);
    g.engine.purchaseBuilding("lumbermill", 32);
    g.engine.purchaseBuilding("quarry", 32);
    expect(g.engine.getSkillLevel("construction")).toBeGreaterThanOrEqual(15);
    expect(1_000_000 - g.engine.getResourceAmount("gp")).toBeLessThan(40_000);
  });
});

describe("save format v22", () => {
  it("raises an old save's 1 hour offline cap to 8 hours and keeps new fields", () => {
    const g = makeEngine();
    const old = JSON.parse(g.engine.serialize());
    old.version = 21;
    old.offlineCapMs = HOUR;
    delete old.specialEnergy;
    delete old.combatStyles;
    const loaded = GameEngine.deserialize(JSON.stringify(old), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getOfflineCapMs()).toBe(DEFAULT_OFFLINE_CAP_MS);
    expect(loaded.getState().specialEnergy).toBe(100);

    loaded.setCombatStyle("melee", "defensive");
    loaded.getState().selectedSpellId = "water-strike";
    loaded.getState().specialEnergy = 42;
    const again = GameEngine.deserialize(loaded.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(again.getState().combatStyles.melee).toBe("defensive");
    expect(again.getState().selectedSpellId).toBe("water-strike");
    expect(again.getState().specialEnergy).toBe(42);
  });
});

describe("Overgrown Den dungeon", () => {
  function atDen() {
    const g = fighter();
    g.engine.setFlag("investigatedDen");
    g.engine.devTeleport(getLocation("dark-forest")!);
    const [scim] = g.engine.addItem("dragon-scimitar", 1);
    g.engine.equipItem(g.engine.itemsById.get("dragon-scimitar")!, scim);
    return g;
  }

  it("needs the quest done and limits the loadout to 6 pieces of gear", () => {
    const g = atDen();
    const daggers = g.engine.addItem("bronze-dagger", 7).map((instanceId) => ({ itemDefId: "bronze-dagger", instanceId, quantity: 1 }));
    expect(g.engine.getDungeonEnterBlocker("overgrown-den", daggers)).toMatch(/only bring 6/);
    expect(g.engine.getDungeonEnterBlocker("overgrown-den", daggers.slice(0, 6))).toBeNull();
    // Food never takes a slot.
    g.engine.addItem("shark", 20);
    expect(g.engine.getLoadoutSlotsUsed([...daggers.slice(0, 6), { itemDefId: "shark", quantity: 20 }])).toBe(6);
    g.engine.setFlag("investigatedDen", false);
    expect(g.engine.enterDungeon("overgrown-den", [])).toBe(false);
  });

  it("runs the waves, stops to regear before the boss, then clears it", () => {
    const g = atDen();
    g.engine.addItem("shark", 20);
    equip(g, "shark");
    expect(g.engine.enterDungeon("overgrown-den", [])).toBe(true);
    for (let i = 0; i < 300 && !g.state().dungeonRun?.awaitingBoss; i++) g.advance(SECOND);
    const run = g.state().dungeonRun!;
    expect(run.awaitingBoss).toBe(true);
    expect(run.wavesCleared).toBe(3);
    expect(g.state().activeAction).toBeNull();
    // Nothing else can start while inside.
    expect(g.engine.startGatherSession("trees", getRecipe("chop-normal-tree")!)).toBe(false);

    expect(g.engine.continueToBoss()).toBe(true);
    expect(combat(g).enemyId).toBe("den-guardian");
    for (let i = 0; i < 600 && g.state().dungeonRun; i++) g.advance(SECOND);
    expect(g.engine.getFlag("denCleared")).toBe(true);
    expect(g.state().statistics["dungeonClears:overgrown-den"]).toBe(1);
  });

  it("the worn food comes in free, other food stays out, and only loadout gear can be equipped", () => {
    const g = atDen();
    g.engine.addItem("shark", 2);
    g.engine.addItem("trout", 10);
    equip(g, "shark");
    const [dagger] = g.engine.addItem("bronze-dagger", 1);
    const [dds] = g.engine.addItem("dragon-dagger", 1);
    g.engine.enterDungeon("overgrown-den", [
      { itemDefId: "trout", quantity: 5 }, // food can't be packed; ignored
      { itemDefId: "dragon-dagger", instanceId: dds, quantity: 1 },
    ]);
    expect(g.engine.getFoodCount("shark")).toBe(2);
    expect(g.engine.getFoodCount("trout")).toBe(0);
    g.engine.devSetCurrentHp(1);
    g.engine.eatItem("shark");
    g.engine.eatItem("shark");
    expect(g.engine.eatItem("shark")).toBe(false);
    expect(g.engine.eatItem("trout")).toBe(false);

    for (let i = 0; i < 300 && !g.state().dungeonRun?.awaitingBoss && g.state().dungeonRun; i++) g.advance(SECOND);
    expect(g.state().dungeonRun?.awaitingBoss).toBe(true);
    const daggerDef = g.engine.itemsById.get("bronze-dagger")!;
    expect(g.engine.equipItem(daggerDef, dagger)).toBe(false);
    expect(g.engine.equipItem(g.engine.itemsById.get("dragon-dagger")!, dds)).toBe(true);
    // The scimitar taken off can go back on.
    expect(g.engine.equipItem(g.engine.itemsById.get("dragon-scimitar")!, Object.values(g.state().inventory).find((i) => i.itemDefId === "dragon-scimitar")!.instanceId)).toBe(true);
  });

  it("a saved loadout skips copies no longer owned and survives a save", () => {
    const g = atDen();
    const [dds, dagger] = [...g.engine.addItem("dragon-dagger", 1), ...g.engine.addItem("bronze-dagger", 1)];
    expect(
      g.engine.setSavedLoadout("overgrown-den", [
        { itemDefId: "dragon-dagger", instanceId: dds, quantity: 1 },
        { itemDefId: "bronze-dagger", instanceId: dagger, quantity: 1 },
        { itemDefId: "shark", quantity: 5 },
      ])
    ).toBe(true);
    g.engine.dropItem(g.engine.itemsById.get("bronze-dagger")!, dagger);
    expect(g.engine.getSavedLoadout("overgrown-den")).toEqual([{ itemDefId: "dragon-dagger", instanceId: dds, quantity: 1 }]);
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getSavedLoadout("overgrown-den")).toHaveLength(1);
    const seven = g.engine.addItem("bronze-dagger", 7).map((instanceId) => ({ itemDefId: "bronze-dagger", instanceId, quantity: 1 }));
    expect(g.engine.setSavedLoadout("overgrown-den", seven)).toBe(false);
  });

  it("leaving or dying ends the run, and a run survives a save", () => {
    const g = atDen();
    g.engine.enterDungeon("overgrown-den", []);
    const loaded = GameEngine.deserialize(g.engine.serialize(), GAME_CONTENT, { clock: () => g.now() });
    expect(loaded.getState().dungeonRun?.dungeonId).toBe("overgrown-den");
    expect(g.engine.leaveDungeon()).toBe(true); // flees the goblin wave
    expect(g.state().dungeonRun).toBeNull();
    expect(g.state().activeAction).toBeNull();
  });
});
