import type { WeaponType, GameState, ActiveCombatSession, EnemyDefinition } from "../types";
import type { GameEngine } from "../gameEngine";
import {
  ATTACK_NOW_MIN_INTERVAL_FRACTION,
  MIN_ATTACK_SPEED_MS,
  ENEMY_RESPAWN_MS,
  AUTO_EAT_BELOW_HP_FRACTION,
  DEFAULT_ENEMY_ATTACK_SPEED_MS,
  UNARMED_ATTACK_SPEED_MS,
  WEAKNESS_DAMAGE_MULTIPLIER,
  DEFAULT_DEATH_GP_LOSS_PERCENT,
  DEFAULT_DEATH_RESOURCE_LOSS_PERCENT,
} from "../tuning";
import { STARTING_LOCATION_ID } from "../state";
import { resolveAttack } from "../combatMath";
import { weightedRandomPick } from "../rng";
import { getActiveCombat } from "../activeAction";

const MAX_COMBAT_EVENTS_PER_RESOLVE = 50_000;

/** Fights: independent attack timers, auto-repeat and auto-eat, loot, death. */
export class CombatSystem {
  private readonly engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  private get state(): GameState {
    return this.engine.getState();
  }

  private get notifications() {
    return this.engine.notifications;
  }

  private get combatSession() {
    return getActiveCombat(this.state);
  }

  /** Starts a fight. `equipmentBonus` is computed by the caller (see
   *  content/combatStats.ts) by summing stats across currently-equipped
   *  items, PLUS the equipped weapon's speed/type specifically. Refuses if
   *  another action is active, or current HP is 0 (heal first). */
  startCombat(
    enemy: EnemyDefinition,
    equipmentBonus: {
      attack: number;
      strength: number;
      defence: number;
      attackSpeedMs?: number;
      weaponType?: WeaponType;
    },
    opts?: { autoRepeat?: boolean; autoEatItemId?: string }
  ): boolean {
    if (!this.engine.ensureIdle()) return false;
    if (this.engine.getCurrentHp() <= 0) {
      this.notifications.push("status", "You need to heal before fighting.", { severity: "warning" });
      return false;
    }

    const now = this.engine.now();
    this.state.activeAction = {
      kind: "combat",
      enemyId: enemy.id,
      enemyName: enemy.name,
      enemyMaxHp: enemy.maxHp,
      enemyCurrentHp: enemy.maxHp,
      enemyAttack: enemy.attack,
      enemyStrength: enemy.strength,
      enemyDefence: enemy.defence,
      enemyAttackBonus: enemy.attackBonus,
      enemyStrengthBonus: enemy.strengthBonus,
      enemyDefenceBonus: enemy.defenceBonus,
      enemyWeakness: enemy.weakness,
      canFlee: enemy.canFlee ?? true,
      xpReward: enemy.xpReward,
      lootTable: enemy.lootTable ?? [],
      deathPenaltyGpLossPercent: enemy.deathPenalty?.gpLossPercent ?? DEFAULT_DEATH_GP_LOSS_PERCENT,
      deathPenaltyResourceLossPercent:
        enemy.deathPenalty?.resourceLossPercent ?? DEFAULT_DEATH_RESOURCE_LOSS_PERCENT,
      playerAttackBonus: equipmentBonus.attack,
      playerStrengthBonus: equipmentBonus.strength,
      playerDefenceBonus: equipmentBonus.defence,
      playerWeaponType: equipmentBonus.weaponType,
      playerAttackSpeedMs: Math.max(MIN_ATTACK_SPEED_MS, equipmentBonus.attackSpeedMs ?? UNARMED_ATTACK_SPEED_MS),
      enemyAttackSpeedMs: Math.max(MIN_ATTACK_SPEED_MS, enemy.attackSpeedMs ?? DEFAULT_ENEMY_ATTACK_SPEED_MS),
      playerStartedAt: now,
      enemyStartedAt: now,
      playerAttacksResolved: 0,
      enemyAttacksResolved: 0,
      autoRepeat: opts?.autoRepeat ?? false,
      autoEatItemId: opts?.autoEatItemId,
      kills: 0,
      log: [],
      logCount: 0,
    };
    this.notifications.push("status", `Engaged ${enemy.name}!`);
    return true;
  }

  /** Leaves the fight with no reward and no penalty — only if the enemy
   *  allows it (bosses typically don't). */
  fleeCombat(): boolean {
    const session = this.combatSession;
    if (!session) return false;
    if (!session.canFlee) {
      this.notifications.push("status", `You can't flee from ${session.enemyName}.`, {
        severity: "warning",
      });
      return false;
    }
    this.state.activeAction = null;
    this.notifications.push("status", `Fled from ${session.enemyName}.`);
    return true;
  }

  /** Interactive override — immediately resolves the player's next attack
   *  instead of waiting for their own weapon timer, for anyone who'd
   *  rather click than watch. Only affects the PLAYER's independent
   *  timer — the enemy's attack schedule is untouched, since forcing your
   *  own swing early doesn't make sense as also forcing theirs.
   *
   *  Re-anchoring uses the same "recompute the anchor from scratch" fix as
   *  before (see the historical note in git blame / prior version): naively
   *  incrementing playerStartedAt would compound on repeated clicks. Solving
   *  `playerStartedAt + playerAttacksResolved * speed == now` for
   *  playerStartedAt keeps the next attack exactly one weapon-speed away
   *  from THIS click, regardless of how many times you've clicked. */
  attackNow(): boolean {
    const session = this.combatSession;
    if (!session) return false;
    const now = this.engine.now();
    // Mid-respawn there's nothing to hit yet.
    if (now < session.playerStartedAt) return false;
    const minGap = session.playerAttackSpeedMs * ATTACK_NOW_MIN_INTERVAL_FRACTION;
    if (session.lastPlayerAttackAt !== undefined && now - session.lastPlayerAttackAt < minGap) return false;
    const killsBefore = session.kills;
    this.resolvePlayerAttack(session, now);
    // A kill with autoRepeat has already re-anchored both timers for the
    // respawn; don't override that.
    if (this.combatSession && session.kills === killsBefore) {
      session.playerAttacksResolved += 1;
      session.playerStartedAt = now - session.playerAttacksResolved * session.playerAttackSpeedMs;
    }
    return true;
  }

  private static readonly COMBAT_LOG_LIMIT = 20;

  private pushCombatLog(
    session: ActiveCombatSession,
    attacker: "player" | "enemy",
    hit: boolean,
    damage: number,
    at: number
  ): void {
    const outcome: "miss" | "block" | "hit" = !hit ? "miss" : damage <= 0 ? "block" : "hit";
    session.log.push({ timestamp: at, attacker, outcome, damage });
    session.logCount = (session.logCount ?? session.log.length - 1) + 1;
    if (session.log.length > CombatSystem.COMBAT_LOG_LIMIT) session.log.shift();
  }

  /** One player attack. May end the session (victory) — callers must
   *  re-check this.combatSession afterward. */
  private resolvePlayerAttack(session: ActiveCombatSession, at: number): void {
    const accuracy = { level: this.engine.getSkillLevel("attack"), bonus: session.playerAttackBonus };
    const power = { level: this.engine.getSkillLevel("strength"), bonus: session.playerStrengthBonus };
    const defence = { level: session.enemyDefence, bonus: session.enemyDefenceBonus };

    const outcome = resolveAttack(accuracy, power, defence);
    let damage = outcome.damage;
    // Weapon-type-vs-weakness bonus: matching a stab/slash/crush weapon to
    // the enemy's weakness scales damage up, not accuracy — an accurate
    // hit with the "wrong" weapon still lands, it just does less.
    if (outcome.hit && session.playerWeaponType && session.playerWeaponType === session.enemyWeakness) {
      damage = Math.ceil(damage * WEAKNESS_DAMAGE_MULTIPLIER);
    }

    session.lastPlayerAttackAt = at;
    this.pushCombatLog(session, "player", outcome.hit, damage, at);
    if (outcome.hit) {
      session.enemyCurrentHp = Math.max(0, session.enemyCurrentHp - damage);
    }
    if (session.enemyCurrentHp <= 0) {
      this.grantCombatVictory(session, at);
    }
  }

  /** One enemy attack. May end the session (defeat) — callers must
   *  re-check this.combatSession afterward. */
  private resolveEnemyAttack(session: ActiveCombatSession, at: number): void {
    const accuracy = { level: session.enemyAttack, bonus: session.enemyAttackBonus };
    const power = { level: session.enemyStrength, bonus: session.enemyStrengthBonus };
    const defence = { level: this.engine.getSkillLevel("defence"), bonus: session.playerDefenceBonus };

    const outcome = resolveAttack(accuracy, power, defence);
    this.pushCombatLog(session, "enemy", outcome.hit, outcome.damage, at);
    if (outcome.hit) {
      this.engine.damageHp(outcome.damage);
    }
    if (this.engine.getCurrentHp() <= 0) {
      this.endCombatDefeat(session);
      return;
    }
    this.maybeAutoEat(session);
  }

  private grantCombatVictory(session: ActiveCombatSession, at: number): void {
    // No combat-style selection UI yet, so XP just splits evenly across the
    // four skills involved — revisit once style selection exists.
    const xpEach = session.xpReward / 4;
    this.engine.addSkillXp("attack", xpEach);
    this.engine.addSkillXp("strength", xpEach);
    this.engine.addSkillXp("defence", xpEach);
    this.engine.addSkillXp("hitpoints", xpEach);

    this.engine.incrementStatistic(`kills:${session.enemyId}`, 1);
    this.engine.incrementStatistic("kills:total", 1);

    const lootMessages: string[] = [];
    if (session.lootTable.length > 0) {
      const drop = weightedRandomPick(session.lootTable.map((entry) => ({ item: entry, weight: entry.weight })));
      if (drop.id) {
        const quantity =
          drop.quantityMin !== undefined && drop.quantityMax !== undefined
            ? drop.quantityMin + Math.floor(Math.random() * (drop.quantityMax - drop.quantityMin + 1))
            : 1;
        this.engine.addItem(drop.id, quantity);
        // <id> tags render as item icons in RichText; currencies have no
        // item definition, so they're written out plainly.
        lootMessages.push(this.engine.itemsById.has(drop.id) ? `${quantity}x <${drop.id}>` : `${quantity} ${drop.id}`);
      }
    }

    session.kills++;
    if (this.engine.catchUp) {
      this.engine.catchUp.kills[session.enemyName] = (this.engine.catchUp.kills[session.enemyName] ?? 0) + 1;
    } else {
      const lootText = lootMessages.length > 0 ? ` You got: ${lootMessages.join(", ")}.` : " No loot this time.";
      const killText = session.autoRepeat ? ` (${session.kills} this trip)` : "";
      this.notifications.push("reward", `Defeated ${session.enemyName}!${killText}${lootText}`, {
        replaceKey: "combat-victory",
      });
    }

    if (session.autoRepeat && this.canKeepFighting(session)) {
      // Same enemy respawns; both timers restart after the respawn delay.
      session.enemyCurrentHp = session.enemyMaxHp;
      session.playerStartedAt = at + ENEMY_RESPAWN_MS;
      session.enemyStartedAt = at + ENEMY_RESPAWN_MS;
      session.playerAttacksResolved = 0;
      session.enemyAttacksResolved = 0;
      return;
    }
    if (session.autoRepeat) {
      this.notifications.push("status", `Stopped fighting ${session.enemyName}: HP is low and there's no food left.`, {
        severity: "warning",
      });
    }
    this.state.activeAction = null;
  }

  /** Repeat fights continue only while HP is healthy or there's food to
   *  bring it back up — never fight on toward a death unattended. */
  private canKeepFighting(session: ActiveCombatSession): boolean {
    const healthy = this.engine.getCurrentHp() >= this.engine.getMaxHp() * AUTO_EAT_BELOW_HP_FRACTION;
    const hasFood = !!session.autoEatItemId && this.engine.getOwnedCount(session.autoEatItemId) >= 1;
    return healthy || hasFood;
  }

  private maybeAutoEat(session: ActiveCombatSession): void {
    const foodId = session.autoEatItemId;
    if (!foodId) return;
    if (this.engine.getCurrentHp() >= this.engine.getMaxHp() * AUTO_EAT_BELOW_HP_FRACTION) return;
    if (!this.engine.eatItem(foodId)) {
      session.autoEatItemId = undefined;
      this.notifications.push("status", `You've run out of ${this.engine.nameOf(foodId)}.`, { severity: "warning" });
    }
  }

  /** Death penalty: lose a percentage of GP and of each other resource
   *  (capped implicitly since it's a percentage of what you actually
   *  have — never goes negative, never loses more than you're carrying),
   *  then wake up back at the starting location. No item loss (yet) —
   *  content can already ask for harsher percentages via
   *  EnemyDefinition.deathPenalty for a future dungeon/boss, but "lose a
   *  specific item on death" isn't built, only flagged as a natural
   *  extension of the same override pattern once something needs it. */
  private applyDeathPenalty(session: ActiveCombatSession): void {
    const gp = this.engine.getResourceAmount("gp");
    const gpLost = Math.floor(gp * session.deathPenaltyGpLossPercent);
    if (gpLost > 0) this.engine.spendResource("gp", gpLost);

    const resourceLosses: string[] = [];
    for (const resourceId of Object.keys(this.state.resources)) {
      if (resourceId === "gp" || resourceId === "achievement-points") continue;
      const amount = this.engine.getResourceAmount(resourceId);
      const lost = Math.floor(amount * session.deathPenaltyResourceLossPercent);
      if (lost > 0) {
        this.engine.spendResource(resourceId, lost);
        resourceLosses.push(`${lost.toLocaleString()} ${this.engine.nameOf(resourceId)}`);
      }
    }

    this.state.currentLocationId = STARTING_LOCATION_ID;

    const lossParts = [gpLost > 0 ? `${gpLost.toLocaleString()} GP` : null, ...resourceLosses].filter(
      (part): part is string => part !== null
    );
    const lossText = lossParts.length > 0 ? ` You lost ${lossParts.join(", ")}.` : "";
    this.notifications.push(
      "status",
      `Defeated by ${session.enemyName}. Woke up back in town.${lossText}`,
      { severity: "error" }
    );
  }

  private endCombatDefeat(session: ActiveCombatSession): void {
    this.state.currentHp = 1;
    this.applyDeathPenalty(session);
    this.state.activeAction = null;
  }

  /** Resolve combat up to `effectiveNow`. Player and enemy attack on
   *  independent timers, so this can't just be "floor(elapsed/interval)"
   *  once like crafting/gathering — instead it's a small interleaved
   *  priority queue: at each step, whichever side's next attack is due
   *  soonest goes first, repeated until neither side has an attack due
   *  yet (or the fight ends). This is what makes a fast weapon actually
   *  land more attacks than a slow enemy, and vice versa, instead of both
   *  sides trading blows in lockstep. */
  resolveCombatSession(effectiveNow: number): void {
    let session = this.combatSession;
    if (!session) return;

    // Belt and braces against a hang: attack speeds are floored at
    // MIN_ATTACK_SPEED_MS, so an hour of catch-up is ~12,000 events. If
    // something still runs away, the rest resolves on later ticks.
    let budget = MAX_COMBAT_EVENTS_PER_RESOLVE;
    while (session && budget-- > 0) {
      const playerNextAt =
        session.playerStartedAt + (session.playerAttacksResolved + 1) * session.playerAttackSpeedMs;
      const enemyNextAt =
        session.enemyStartedAt + (session.enemyAttacksResolved + 1) * session.enemyAttackSpeedMs;
      const nextEventAt = Math.min(playerNextAt, enemyNextAt);
      if (nextEventAt > effectiveNow) break;

      // Count the attack before resolving it: a kill with autoRepeat
      // resets both counters for the respawn, and must not be undone.
      if (playerNextAt <= enemyNextAt) {
        session.playerAttacksResolved += 1;
        this.resolvePlayerAttack(session, playerNextAt);
      } else {
        session.enemyAttacksResolved += 1;
        this.resolveEnemyAttack(session, enemyNextAt);
      }
      session = this.combatSession;
    }
  }
}
