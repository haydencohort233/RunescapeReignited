import type { GameState, ActiveCombatSession, EnemyDefinition, AttackStyle, SpellDefinition } from "../types";
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
  HITPOINTS_XP_SHARE,
} from "../tuning";
import { STARTING_LOCATION_ID } from "../state";
import { resolveAttack, type AccuracySide, type AttackModifiers, type PowerSide } from "../combatMath";
import { weightedRandomPick } from "../rng";
import { getActiveCombat } from "../activeAction";
import type { EquipmentBonuses } from "../equipmentBonuses";
import { resolveCombatStyle } from "../combatStyles";
import { getSpecialAttack, type SpecialAttackDefinition } from "../specialAttacks";

const MAX_COMBAT_EVENTS_PER_RESOLVE = 50_000;

/** Fights: independent attack timers, melee/Ranged/Magic, special attacks
 *  and bleeds, auto-repeat and auto-eat, loot, death. */
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
   *  content/combatStats.ts) from worn gear; omitted fields count as 0 and
   *  melee, and omitting it entirely reads the gear now worn. Refuses if
   *  another action is active, HP is 0, or a Ranged/Magic fight has no
   *  arrows or runes to start with. */
  startCombat(
    enemy: EnemyDefinition,
    equipmentBonus?: Partial<EquipmentBonuses>,
    opts?: { autoRepeat?: boolean; autoEatItemId?: string }
  ): boolean {
    this.engine.catchUpToNow();
    if (!this.engine.ensureIdle()) return false;
    if (this.engine.getCurrentHp() <= 0) {
      this.notifications.push("status", "You need to heal before fighting.", { severity: "warning" });
      return false;
    }

    const gear = equipmentBonus ?? this.engine.getEquipmentBonuses();
    const attackStyle: AttackStyle = gear.attackStyle ?? "melee";
    let spell: SpellDefinition | undefined;
    if (attackStyle === "ranged") {
      if (!gear.ammoItemId || this.engine.getResourceAmount(gear.ammoItemId) < 1) {
        this.notifications.push("status", "Equip some arrows before fighting with a bow.", { severity: "warning" });
        return false;
      }
    } else if (attackStyle === "magic") {
      spell = this.engine.getSpell(this.state.selectedSpellId);
      if (!spell) {
        this.notifications.push("status", "Pick a spell in the Equipment tab before fighting with magic.", { severity: "warning" });
        return false;
      }
      if (this.engine.getSkillLevel("magic") < spell.levelRequired) {
        this.notifications.push("status", `${spell.name} needs Magic level ${spell.levelRequired}.`, { severity: "warning" });
        return false;
      }
      if (!this.hasRunesFor(spell, gear.infiniteRunes ?? [])) {
        this.notifications.push("status", `You don't have the runes to cast ${spell.name}.`, { severity: "warning" });
        return false;
      }
    }

    const style = resolveCombatStyle(attackStyle, this.state.combatStyles[attackStyle]);
    const baseSpeed = gear.attackSpeedMs ?? UNARMED_ATTACK_SPEED_MS;
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
      enemyMagic: enemy.magic,
      enemyWeakness: enemy.weakness,
      canFlee: enemy.canFlee ?? true,
      xpReward: enemy.xpReward,
      lootTable: enemy.lootTable ?? [],
      deathPenaltyGpLossPercent: enemy.deathPenalty?.gpLossPercent ?? DEFAULT_DEATH_GP_LOSS_PERCENT,
      deathPenaltyResourceLossPercent:
        enemy.deathPenalty?.resourceLossPercent ?? DEFAULT_DEATH_RESOURCE_LOSS_PERCENT,
      playerAttackBonus: gear.attack ?? 0,
      playerStrengthBonus: gear.strength ?? 0,
      playerDefenceBonus: gear.defence ?? 0,
      playerWeaponType: gear.weaponType,
      attackStyle,
      playerRangedBonus: gear.ranged ?? 0,
      playerRangedStrength: gear.rangedStrength ?? 0,
      playerMagicBonus: gear.magic ?? 0,
      ammoItemId: attackStyle === "ranged" ? gear.ammoItemId : undefined,
      spellId: spell?.id,
      infiniteRunes: gear.infiniteRunes ?? [],
      specialAttackId: gear.specialAttack,
      playerAttackSpeedMs: Math.max(MIN_ATTACK_SPEED_MS, baseSpeed - (style.speedBonusMs ?? 0)),
      enemyAttackSpeedMs: Math.max(MIN_ATTACK_SPEED_MS, enemy.attackSpeedMs ?? DEFAULT_ENEMY_ATTACK_SPEED_MS),
      playerStartedAt: now,
      enemyStartedAt: now,
      playerAttacksResolved: 0,
      enemyAttacksResolved: 0,
      autoRepeat: opts?.autoRepeat ?? false,
      autoEatItemId: opts?.autoEatItemId ?? gear.foodItemId,
      kills: 0,
      log: [],
      logCount: 0,
    };
    const food = opts?.autoEatItemId ?? gear.foodItemId;
    if (food) this.state.lastCombatFoodId = food;
    this.notifications.push("status", `Engaged ${enemy.name}!`);
    return true;
  }

  /** Leaves the fight with no reward and no penalty — only if the enemy
   *  allows it (bosses typically don't). */
  fleeCombat(): boolean {
    // Resolve every attack that's already due, so a lethal hit or a kill
    // lands before the flee rather than being skipped by it.
    this.engine.catchUpToNow();
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
    this.engine.catchUpToNow();
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
    if (this.combatSession === session && session.kills === killsBefore) {
      session.playerAttacksResolved += 1;
      session.playerStartedAt = now - session.playerAttacksResolved * session.playerAttackSpeedMs;
    }
    return true;
  }

  /** Arms (or disarms) the weapon's special attack: the next swing uses it.
   *  Manual only for now. Refuses without a spec weapon or enough energy. */
  toggleSpecialAttack(): boolean {
    this.engine.catchUpToNow();
    const session = this.combatSession;
    if (!session) return false;
    const spec = getSpecialAttack(session.specialAttackId);
    if (!spec) {
      this.notifications.push("status", "Your weapon has no special attack.", { severity: "warning" });
      return false;
    }
    if (session.specArmed) {
      session.specArmed = false;
      return true;
    }
    if (this.state.specialEnergy < spec.cost) {
      this.notifications.push("status", `${spec.name} needs ${spec.cost}% special attack energy.`, { severity: "warning" });
      return false;
    }
    session.specArmed = true;
    return true;
  }

  /** Changes the combat style for an attack style. Works mid-fight, as in
   *  OSRS; a speed change (Rapid) keeps the next swing where it was. */
  setCombatStyle(attackStyle: AttackStyle, styleId: string): void {
    const style = resolveCombatStyle(attackStyle, styleId);
    if (style.id !== styleId) return;
    // Kills already due get the old style's XP.
    this.engine.catchUpToNow();
    this.state.combatStyles[attackStyle] = styleId;
    const session = this.combatSession;
    if (!session || (session.attackStyle ?? "melee") !== attackStyle) return;
    this.applyGearToSession(session, this.engine.getEquipmentBonuses());
  }

  /** Eating restarts your attack timer, as in OSRS: the next swing is a
   *  full weapon interval after the bite. Never pulls an attack earlier,
   *  e.g. while the next enemy is still respawning. `at` is when the food
   *  was eaten, which during offline catch-up is the enemy's attack time,
   *  not the wall clock. */
  restartPlayerAttackTimer(at: number): void {
    const session = this.combatSession;
    if (!session) return;
    const speed = session.playerAttackSpeedMs;
    const nextAt = session.playerStartedAt + (session.playerAttacksResolved + 1) * speed;
    const restartedAt = Math.max(nextAt, at + speed);
    session.playerStartedAt = restartedAt - (session.playerAttacksResolved + 1) * speed;
  }

  /** The food used by this fight's auto-eat, and remembered for the next
   *  fight. Switching food mid-fight keeps auto-eat on if it was on. */
  setCombatFood(itemDefId: string): void {
    this.state.lastCombatFoodId = itemDefId || undefined;
    const session = this.combatSession;
    if (session?.autoEatItemId && itemDefId) session.autoEatItemId = itemDefId;
  }

  /** Turns auto-eat on (with the remembered food) or off mid-fight. */
  setAutoEat(enabled: boolean): void {
    const session = this.combatSession;
    if (!session) return;
    session.autoEatItemId = enabled ? this.state.lastCombatFoodId : undefined;
  }

  /** Gear changed mid-fight (a degrading weapon broke): re-read bonuses,
   *  speed and attack style, keeping the next swing's time. */
  refreshGear(): void {
    const session = this.combatSession;
    if (session) this.applyGearToSession(session, this.engine.getEquipmentBonuses());
  }

  private applyGearToSession(session: ActiveCombatSession, gear: EquipmentBonuses): void {
    const attackStyle = gear.attackStyle;
    const style = resolveCombatStyle(attackStyle, this.state.combatStyles[attackStyle]);
    const nextAt = session.playerStartedAt + (session.playerAttacksResolved + 1) * session.playerAttackSpeedMs;
    session.playerAttackBonus = gear.attack;
    session.playerStrengthBonus = gear.strength;
    session.playerDefenceBonus = gear.defence;
    session.playerWeaponType = gear.weaponType;
    session.playerRangedBonus = gear.ranged;
    session.playerRangedStrength = gear.rangedStrength;
    session.playerMagicBonus = gear.magic;
    session.infiniteRunes = gear.infiniteRunes;
    session.specialAttackId = gear.specialAttack;
    if (!gear.specialAttack) session.specArmed = false;
    if (attackStyle !== (session.attackStyle ?? "melee")) {
      session.attackStyle = attackStyle;
      session.ammoItemId = attackStyle === "ranged" ? gear.ammoItemId : undefined;
      if (attackStyle !== "magic") session.spellId = undefined;
    }
    session.playerAttackSpeedMs = Math.max(
      MIN_ATTACK_SPEED_MS,
      (gear.attackSpeedMs ?? UNARMED_ATTACK_SPEED_MS) - (style.speedBonusMs ?? 0)
    );
    session.playerStartedAt = nextAt - (session.playerAttacksResolved + 1) * session.playerAttackSpeedMs;
  }

  private static readonly COMBAT_LOG_LIMIT = 20;

  private pushCombatLog(
    session: ActiveCombatSession,
    attacker: "player" | "enemy",
    outcome: "miss" | "block" | "hit" | "bleed",
    damage: number,
    at: number,
    special = false
  ): void {
    session.log.push({ timestamp: at, attacker, outcome, damage, ...(special ? { special } : {}) });
    session.logCount = (session.logCount ?? session.log.length - 1) + 1;
    if (session.log.length > CombatSystem.COMBAT_LOG_LIMIT) session.log.shift();
  }

  /** Invisible level bonus from the current combat style. */
  private styleBonus(session: ActiveCombatSession, skill: string): number {
    const attackStyle = session.attackStyle ?? "melee";
    return resolveCombatStyle(attackStyle, this.state.combatStyles[attackStyle]).levelBonus[skill] ?? 0;
  }

  private hasRunesFor(spell: SpellDefinition, infiniteRunes: string[]): boolean {
    return spell.runes.every((r) => infiniteRunes.includes(r.resource) || this.engine.getOwnedCount(r.resource) >= r.amount);
  }

  /** Ends the fight because arrows or runes ran out, mid-fight or offline. */
  private endOutOfSupplies(session: ActiveCombatSession, message: string): void {
    this.state.activeAction = null;
    this.notifications.push("status", `${message} You stop fighting ${session.enemyName}.`, { severity: "warning" });
  }

  /** One player attack: pays for it (an arrow, a spell's runes), then
   *  resolves one or more hits. May end the session (victory, or out of
   *  supplies) — callers must re-check this.combatSession afterward. */
  private resolvePlayerAttack(session: ActiveCombatSession, at: number): void {
    const attackStyle = session.attackStyle ?? "melee";
    let spell: SpellDefinition | undefined;

    if (attackStyle === "ranged") {
      const ammo = session.ammoItemId;
      if (!ammo || this.engine.getResourceAmount(ammo) < 1) {
        this.endOutOfSupplies(session, "You've run out of arrows.");
        return;
      }
      this.engine.spendWornStack(ammo, 1);
    } else if (attackStyle === "magic") {
      spell = this.engine.getSpell(session.spellId);
      if (!spell || !this.hasRunesFor(spell, session.infiniteRunes ?? [])) {
        this.endOutOfSupplies(session, `You've run out of runes for ${spell?.name ?? "your spell"}.`);
        return;
      }
      this.engine.payFor(spell.runes.filter((r) => !(session.infiniteRunes ?? []).includes(r.resource)));
      // OSRS gives a spell's base XP on every cast, hit or splash.
      this.engine.addSkillXp("magic", spell.baseXp);
    }

    let spec: SpecialAttackDefinition | undefined;
    if (session.specArmed) {
      session.specArmed = false;
      const armed = getSpecialAttack(session.specialAttackId);
      if (armed && this.state.specialEnergy >= armed.cost) {
        spec = armed;
        this.state.specialEnergy -= armed.cost;
      }
    }

    session.lastPlayerAttackAt = at;
    const hits = spec?.hits ?? 1;
    for (let i = 0; i < hits && session.enemyCurrentHp > 0; i++) {
      this.resolvePlayerHit(session, at, attackStyle, spell, spec);
    }

    // Degrading gear wears with use; a break changes what's worn.
    if (this.engine.wearDegradableGear() && this.combatSession === session) this.refreshGear();

    if (session.enemyCurrentHp <= 0) this.grantCombatVictory(session, at);
  }

  private resolvePlayerHit(
    session: ActiveCombatSession,
    at: number,
    attackStyle: AttackStyle,
    spell: SpellDefinition | undefined,
    spec: SpecialAttackDefinition | undefined
  ): void {
    let accuracy: AccuracySide;
    let power: PowerSide;
    let defence: AccuracySide = { level: session.enemyDefence, bonus: session.enemyDefenceBonus };
    const mods: AttackModifiers = {
      accuracyMultiplier: spec?.accuracyMultiplier,
      damageMultiplier: spec?.damageMultiplier,
    };

    if (attackStyle === "ranged") {
      const level = this.engine.getSkillLevel("ranged") + this.styleBonus(session, "ranged");
      accuracy = { level, bonus: session.playerRangedBonus ?? 0 };
      power = { level, bonus: session.playerRangedStrength ?? 0 };
    } else if (attackStyle === "magic") {
      accuracy = { level: this.engine.getSkillLevel("magic"), bonus: session.playerMagicBonus ?? 0 };
      power = { level: 0, bonus: 0 };
      mods.maxHit = spell?.maxHit ?? 0;
      // NPCs defend against magic with their Magic level.
      defence = { level: session.enemyMagic ?? session.enemyDefence, bonus: session.enemyDefenceBonus };
    } else {
      accuracy = {
        level: this.engine.getSkillLevel("attack") + this.styleBonus(session, "attack"),
        bonus: session.playerAttackBonus,
      };
      power = {
        level: this.engine.getSkillLevel("strength") + this.styleBonus(session, "strength"),
        bonus: session.playerStrengthBonus,
      };
    }

    const outcome = resolveAttack(accuracy, power, defence, Math.random, mods);
    let damage = outcome.damage;
    // Weapon-type-vs-weakness bonus: matching a stab/slash/crush weapon to
    // the enemy's weakness scales damage up, not accuracy — an accurate
    // hit with the "wrong" weapon still lands, it just does less.
    if (
      attackStyle === "melee" &&
      outcome.hit &&
      session.playerWeaponType &&
      session.playerWeaponType === session.enemyWeakness
    ) {
      damage = Math.ceil(damage * WEAKNESS_DAMAGE_MULTIPLIER);
    }

    const result = !outcome.hit ? "miss" : damage <= 0 ? "block" : "hit";
    this.pushCombatLog(session, "player", result, damage, at, !!spec);
    if (outcome.hit) {
      session.enemyCurrentHp = Math.max(0, session.enemyCurrentHp - damage);
      if (spec?.bleed && session.enemyCurrentHp > 0 && Math.random() < spec.bleed.chance) {
        // A new bleed restarts the timer rather than stacking.
        session.bleed = {
          damagePerHit: Math.max(1, Math.ceil(session.enemyMaxHp * spec.bleed.fractionOfMaxHp)),
          hitsLeft: spec.bleed.hits,
          intervalMs: spec.bleed.intervalMs,
          startedAt: at,
          resolved: 0,
        };
        if (!this.engine.catchUp) {
          this.notifications.push("status", `${session.enemyName} is bleeding!`, { replaceKey: "combat-bleed" });
        }
      }
    }
  }

  /** One bleed tick on the enemy. May end the session (victory). */
  private resolveBleedTick(session: ActiveCombatSession, at: number): void {
    const bleed = session.bleed;
    if (!bleed) return;
    bleed.resolved += 1;
    bleed.hitsLeft -= 1;
    const damage = Math.min(bleed.damagePerHit, session.enemyCurrentHp);
    session.enemyCurrentHp -= damage;
    this.pushCombatLog(session, "player", "bleed", damage, at);
    if (bleed.hitsLeft <= 0) session.bleed = undefined;
    if (session.enemyCurrentHp <= 0) this.grantCombatVictory(session, at);
  }

  /** One enemy attack. May end the session (defeat) — callers must
   *  re-check this.combatSession afterward. */
  private resolveEnemyAttack(session: ActiveCombatSession, at: number): void {
    const accuracy = { level: session.enemyAttack, bonus: session.enemyAttackBonus };
    const power = { level: session.enemyStrength, bonus: session.enemyStrengthBonus };
    const defence = {
      level: this.engine.getSkillLevel("defence") + this.styleBonus(session, "defence"),
      bonus: session.playerDefenceBonus,
    };

    const outcome = resolveAttack(accuracy, power, defence);
    this.pushCombatLog(session, "enemy", !outcome.hit ? "miss" : outcome.damage <= 0 ? "block" : "hit", outcome.damage, at);
    if (outcome.hit) {
      this.engine.damageHp(outcome.damage);
    }
    if (this.engine.getCurrentHp() <= 0) {
      this.endCombatDefeat(session);
      return;
    }
    this.maybeAutoEat(session, at);
  }

  /** A kill's combat XP: Hitpoints gets its share, the rest is split
   *  across the skills the current style trains. */
  private grantKillXp(session: ActiveCombatSession): void {
    const attackStyle = session.attackStyle ?? "melee";
    const style = resolveCombatStyle(attackStyle, this.state.combatStyles[attackStyle]);
    const hpXp = session.xpReward * HITPOINTS_XP_SHARE;
    const styleXp = (session.xpReward - hpXp) / style.xpSkills.length;
    this.engine.addSkillXp("hitpoints", hpXp);
    for (const skill of style.xpSkills) this.engine.addSkillXp(skill, styleXp);
  }

  private grantCombatVictory(session: ActiveCombatSession, at: number): void {
    this.grantKillXp(session);
    session.bleed = undefined;

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
        lootMessages.push(
          this.engine.itemsById.has(drop.id) ? `${quantity}x <${drop.id}>` : `${quantity} ${this.engine.nameOf(drop.id)}`
        );
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
    const hasFood = !!session.autoEatItemId && this.engine.getFoodCount(session.autoEatItemId) >= 1;
    return healthy || hasFood;
  }

  private maybeAutoEat(session: ActiveCombatSession, at: number): void {
    const foodId = session.autoEatItemId;
    if (!foodId) return;
    if (this.engine.getCurrentHp() >= this.engine.getMaxHp() * AUTO_EAT_BELOW_HP_FRACTION) return;
    if (!this.engine.consumeFood(foodId, at)) {
      session.autoEatItemId = undefined;
      this.notifications.push("status", `You've run out of ${this.engine.nameOf(foodId)}.`, { severity: "warning" });
    }
  }

  /** Death penalty: lose a percentage of GP (and, only if an enemy asks
   *  for it, of other stacks), then wake up back at the starting location.
   *  Decided: by default death takes only GP, if any is left. */
  private applyDeathPenalty(session: ActiveCombatSession): void {
    const gp = this.engine.getResourceAmount("gp");
    const gpLost = Math.floor(gp * session.deathPenaltyGpLossPercent);
    // loseResource, not spendResource: a death isn't spending, and counting
    // it as such once earned "Spend 1,000 gold" for dying.
    if (gpLost > 0) this.engine.loseResource("gp", gpLost);

    const resourceLosses: string[] = [];
    if (session.deathPenaltyResourceLossPercent > 0) {
      for (const resourceId of Object.keys(this.state.resources)) {
        if (resourceId === "gp" || resourceId === "achievement-points") continue;
        const amount = this.engine.getResourceAmount(resourceId);
        const lost = Math.floor(amount * session.deathPenaltyResourceLossPercent);
        if (lost > 0) {
          this.engine.loseResource(resourceId, lost);
          resourceLosses.push(`${lost.toLocaleString()} ${this.engine.nameOf(resourceId)}`);
        }
      }
      this.engine.clearEmptyWornStacks();
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
    this.engine.incrementStatistic("deaths", 1);
    this.state.currentHp = 1;
    this.applyDeathPenalty(session);
    this.state.activeAction = null;
  }

  /** Resolve combat up to `effectiveNow`. Player attacks, enemy attacks
   *  and bleed ticks each run on their own timer, so this can't just be
   *  "floor(elapsed/interval)" once like crafting/gathering — instead it's
   *  a small interleaved priority queue: at each step, whichever event is
   *  due soonest goes first, repeated until nothing is due yet (or the
   *  fight ends). This is what makes a fast weapon actually land more
   *  attacks than a slow enemy, and vice versa. */
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
      const bleed = session.bleed;
      const bleedNextAt = bleed ? bleed.startedAt + (bleed.resolved + 1) * bleed.intervalMs : Infinity;
      const nextEventAt = Math.min(playerNextAt, enemyNextAt, bleedNextAt);
      if (nextEventAt > effectiveNow) break;

      // Count the attack before resolving it: a kill with autoRepeat
      // resets both counters for the respawn, and must not be undone.
      if (bleedNextAt <= playerNextAt && bleedNextAt <= enemyNextAt) {
        this.resolveBleedTick(session, bleedNextAt);
      } else if (playerNextAt <= enemyNextAt) {
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
