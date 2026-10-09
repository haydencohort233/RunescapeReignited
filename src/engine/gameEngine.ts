import type {
  GameState,
  Producer,
  Modifier,
  ResourceId,
  CraftingRecipe,
  RecipeInput,
  ItemDefinition,
  ItemInstance,
  MapLocation,
  AchievementDefinition,
  JobDefinition,
  EnemyDefinition,
  WeaponType,
} from "./types";
import { NotificationQueue } from "./notificationQueue";
import { levelForXp, xpForLevel, MAX_LEVEL, calculateCombatLevel } from "./xpCurve";
import { isUnlocked } from "./unlockConditions";
import { getDailyPeriodNumber } from "./time";
import { formatDuration } from "./format";
import { resolveAttack } from "./combatMath";
import { weightedRandomPick } from "./rng";

const SCHEMA_VERSION = 14;

/** OSRS-authentic: Hitpoints starts pre-leveled at 10 (unlike every other
 *  skill, which starts at 1) — this is the XP threshold for level 10. */
const STARTING_HITPOINTS_XP = xpForLevel(10);

/** ms between auto-resolved combat rounds when no per-encounter override
 *  is set. */
/** Default attack speed for an enemy that doesn't specify its own. */
const DEFAULT_ENEMY_ATTACK_SPEED_MS = 3000;

/** How often the player attacks with no weapon equipped (or an equipped
 *  weapon that doesn't specify attackSpeedMs) — deliberately slower than
 *  most weapons, so going unarmed is a real downside, not a neutral
 *  default. */
const UNARMED_ATTACK_SPEED_MS = 4000;

/** Damage multiplier when the player's weaponType matches the enemy's
 *  weakness. Applied to damage, not accuracy — using the right weapon
 *  hits harder, it doesn't make you hit more often. */
const WEAKNESS_DAMAGE_MULTIPLIER = 1.25;

const DEFAULT_DEATH_GP_LOSS_PERCENT = 0.1;
const DEFAULT_DEATH_RESOURCE_LOSS_PERCENT = 0.05;

/** Baseline passive HP regen (out of combat only) before modifiers —
 *  1 HP per 60s, scaled via getModifiedValue("hpRegen", ...) so an item
 *  like "Restoration Necklace: 2x Health Regen" is just a multiplicative
 *  modifier targeting "hpRegen", no special-cased regen system needed. */
const BASE_HP_REGEN_PER_SECOND = 1 / 60;

/** The starting location id — must match an entry in content/mapLocations.ts. */
export const STARTING_LOCATION_ID = "town";

/** Default travel pace: ms of travel time per unit of map distance. Content
 *  can override per-trip via startTravel's opts. */
export const DEFAULT_MS_PER_DISTANCE_UNIT = 50;

/** Default cap on how much real-world absence counts toward production and
 *  crafting rewards. Stored per-save (state.offlineCapMs), not hardcoded, so
 *  a future upgrade/item can extend it — this is just the starting value. */
export const DEFAULT_OFFLINE_CAP_MS = 60 * 60 * 1000; // 1 hour

/** Default hard cap on a single open-ended gathering session (Woodcutting
 *  etc.) — separate constant from DEFAULT_OFFLINE_CAP_MS on purpose, since
 *  they answer different questions ("how much away-time counts at all" vs
 *  "how long can one continuous gathering session run"). */
export const DEFAULT_GATHER_MAX_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Below this, a gap is just a tab-switch/screen-lock, not a real "away"
 *  session — don't narrate it, even though the simulation still resolves
 *  it correctly either way. */
const MIN_AWAY_MS_FOR_SUMMARY = 60 * 1000; // 1 minute

/** Default cost-scaling multiplier for producers that don't specify their own. */
const DEFAULT_COST_SCALING_FACTOR = 1.15;

export function createInitialState(): GameState {
  return {
    resources: {
      gp: { amount: 0, lifetimeEarned: 0 },
    },
    producers: {},
    modifiers: {},
    skills: { hitpoints: { xp: STARTING_HITPOINTS_XP } },
    // The starting location doesn't count as a "discovery" when you travel
    // back to it later — mark it visited from the start.
    flags: { [`visited:${STARTING_LOCATION_ID}`]: true },
    inventory: {},
    equipment: {},
    activeCraftJob: null,
    activeGatherSession: null,
    currentHp: 10, // matches STARTING_HITPOINTS_XP's level-10 max
    activeCombatSession: null,
    acceptedJobs: {},
    currentLocationId: STARTING_LOCATION_ID,
    activeTravel: null,
    statistics: {},
    lastTickTimestamp: Date.now(),
    offlineCapMs: DEFAULT_OFFLINE_CAP_MS,
    version: SCHEMA_VERSION,
  };
}

/**
 * Migration chain: each entry transforms the state shape from version N to
 * N+1. Applied in sequence starting from whatever version a loaded save
 * reports. Add a new entry here every time SCHEMA_VERSION bumps due to a
 * structural change (renamed/restructured/repurposed field) — for purely
 * ADDITIVE changes (a new field with a sensible default), the backfill in
 * deserialize() already covers it and a migration entry is optional but
 * still fine to add for clarity.
 */
const MIGRATIONS: Record<number, (old: any) => any> = {
  // v3 -> v4: items (like the wooden bow) moved from the resources ledger
  // into a proper instanced inventory. Any pre-existing "bow" resource count
  // is orphaned data at this point (harmless — it just stops being read by
  // anything) rather than being converted, since converting a bare count
  // into N distinct ItemInstances isn't a lossless operation worth the
  // complexity for a single early-stage item. New inventory/equipment
  // fields are added by the backfill safety net below either way.
  3: (old) => ({ ...old, inventory: old.inventory ?? {}, equipment: old.equipment ?? {} }),
  // v4 -> v5: world map added — old saves get dropped at the starting location
  // with no travel in progress.
  4: (old) => ({
    ...old,
    currentLocationId: old.currentLocationId ?? STARTING_LOCATION_ID,
    activeTravel: old.activeTravel ?? null,
  }),
  // v5 -> v6: statistics/achievements added — old saves start with a clean
  // counter set (their history before this point isn't retroactively
  // trackable, which is fine — stats start counting from here).
  5: (old) => ({ ...old, statistics: old.statistics ?? {} }),
  // v6 -> v7: starting location wasn't marked visited, causing a false
  // "discovery" the first time a player traveled back to town after this
  // feature existed. Backfill it so existing saves don't get one free
  // (spurious) locationsDiscovered bump.
  6: (old) => ({
    ...old,
    flags: { ...(old.flags ?? {}), [`visited:${STARTING_LOCATION_ID}`]: true },
  }),
  // v7 -> v8: gather sessions added.
  7: (old) => ({ ...old, activeGatherSession: old.activeGatherSession ?? null }),
  // v8 -> v9: job board added.
  8: (old) => ({ ...old, acceptedJobs: old.acceptedJobs ?? {} }),
  // v9 -> v10: job acceptances now track WHICH day they were accepted, so
  // they can auto-expire on reset. Backfill existing acceptances as
  // "accepted today" (giving them a fresh full day) rather than leaving
  // acceptedPeriod undefined, which would make them expire instantly on
  // the next tick after upgrading.
  9: (old) => {
    const todayPeriod = getDailyPeriodNumber(Date.now());
    const acceptedJobs: Record<string, { acceptedAt: number; acceptedPeriod: number }> = {};
    for (const [jobId, record] of Object.entries(old.acceptedJobs ?? {})) {
      const r = record as { acceptedAt: number; acceptedPeriod?: number };
      acceptedJobs[jobId] = { acceptedAt: r.acceptedAt, acceptedPeriod: r.acceptedPeriod ?? todayPeriod };
    }
    return { ...old, acceptedJobs };
  },
  // v10 -> v11: HP/combat added. Existing characters get Hitpoints backfilled
  // to at least level 10 (same starting point a fresh character gets) rather
  // than being stuck at level 1 / 1 max HP — nobody should be punished by a
  // schema upgrade.
  10: (old) => {
    const existingHpXp = old.skills?.hitpoints?.xp ?? 0;
    const skills = {
      ...(old.skills ?? {}),
      hitpoints: { xp: Math.max(existingHpXp, STARTING_HITPOINTS_XP) },
    };
    return {
      ...old,
      skills,
      currentHp: old.currentHp ?? 10,
      activeCombatSession: old.activeCombatSession ?? null,
    };
  },
  // v11 -> v12: combat log added to ActiveCombatSession. Only matters if a
  // save was serialized mid-fight before this field existed.
  11: (old) => {
    if (!old.activeCombatSession) return old;
    return { ...old, activeCombatSession: { ...old.activeCombatSession, log: old.activeCombatSession.log ?? [] } };
  },
  // v12 -> v13: combat rebuilt around independent player/enemy attack
  // timers (weapon speed) instead of one shared round interval — an
  // in-progress session from before this exists in an incompatible shape.
  // Rather than trying to map old round-based fields onto the new
  // dual-timer ones (lossy and easy to get subtly wrong), just end the
  // fight cleanly. Honest outcome: "your fight was interrupted by an
  // update," not silently-wrong combat state.
  12: (old) => ({ ...old, activeCombatSession: null }),
  // v13 -> v14: log entries switched from a bare `hit: boolean` to an
  // `outcome: "miss"|"block"|"hit"` category — unlike the v12->v13 change,
  // this one converts losslessly (outcome is fully derivable from the old
  // hit+damage pair), so an in-progress fight can continue instead of
  // being cleared.
  13: (old) => {
    if (!old.activeCombatSession) return old;
    const log = (old.activeCombatSession.log ?? []).map((entry: any) => ({
      timestamp: entry.timestamp,
      attacker: entry.attacker,
      outcome: entry.hit === false ? "miss" : entry.damage <= 0 ? "block" : "hit",
      damage: entry.damage,
    }));
    return { ...old, activeCombatSession: { ...old.activeCombatSession, log } };
  },
};

/**
 * GameEngine owns the authoritative simulation. It has NO React dependency —
 * it's a plain class you can unit test, run in a web worker, or port to a
 * backend for server-authoritative validation later.
 *
 * The central design rule: there is exactly ONE code path for advancing time
 * — resolveElapsed(). It's used by the live tick loop AND by offline catch-up
 * on load, and it now resolves production, crafting-job completions, and
 * modifier expiry against the SAME capped time window, so they all agree
 * about "how much time actually counted" during a long absence.
 */
export class GameEngine {
  private state: GameState;
  readonly notifications: NotificationQueue;

  constructor(initialState?: GameState, notifications?: NotificationQueue) {
    this.state = initialState ?? createInitialState();
    this.notifications = notifications ?? new NotificationQueue();
  }

  getState(): GameState {
    return this.state;
  }

  getResourceAmount(resource: ResourceId): number {
    return this.state.resources[resource]?.amount ?? 0;
  }

  // ── Producers ────────────────────────────────────────────────────────

  registerProducer(producer: Producer): void {
    this.state.producers[producer.id] = producer;
    this.ensureResourceExists(producer.resource);
  }

  setProducerQuantity(producerId: string, quantity: number): void {
    const producer = this.state.producers[producerId];
    if (!producer) return;
    producer.quantity = Math.max(0, quantity);
  }

  /** Cost to buy `quantity` more of a producer, given how many are already owned.
   *  Returns null if the producer has no baseCost (not player-purchasable). */
  getProducerPurchaseCost(producerId: string, quantity: number): RecipeInput[] | null {
    const producer = this.state.producers[producerId];
    if (!producer || !producer.baseCost) return null;
    const scaling = producer.costScalingFactor ?? DEFAULT_COST_SCALING_FACTOR;

    // Sum of a geometric series: baseCost * scaling^owned for each unit bought,
    // owned going from current quantity to current quantity + quantity - 1.
    return producer.baseCost.map((input) => {
      let total = 0;
      for (let i = 0; i < quantity; i++) {
        total += input.amount * Math.pow(scaling, producer.quantity + i);
      }
      return { resource: input.resource, amount: Math.ceil(total) };
    });
  }

  /** Whether a producer's unlockCondition (if any) is currently satisfied. */
  isProducerUnlocked(producerId: string): boolean {
    const producer = this.state.producers[producerId];
    if (!producer) return false;
    if (!producer.unlockCondition) return true;
    return isUnlocked(producer.unlockCondition, this.state);
  }

  /** Buys `quantity` more of a producer at the scaled cost, if affordable and unlocked.
   *  `bypassUnlock` is for dev/cheat tooling only — normal player-facing purchase
   *  flows should never pass it. */
  purchaseProducer(producerId: string, quantity = 1, opts?: { bypassUnlock?: boolean }): boolean {
    const producer = this.state.producers[producerId];
    if (!producer) return false;

    if (!opts?.bypassUnlock && !this.isProducerUnlocked(producerId)) {
      this.notifications.push("status", `${producer.name} isn't available yet.`, {
        severity: "warning",
      });
      return false;
    }

    const cost = this.getProducerPurchaseCost(producerId, quantity);
    if (!cost) {
      // No baseCost defined — treat as free/not purchasable via this path.
      return false;
    }

    for (const input of cost) {
      if (this.getResourceAmount(input.resource) < input.amount) {
        this.notifications.push(
          "status",
          `Not enough ${input.resource} to buy ${quantity}x ${producer.name}.`,
          { severity: "warning" }
        );
        return false;
      }
    }

    for (const input of cost) {
      this.spendResource(input.resource, input.amount);
    }
    producer.quantity += quantity;
    this.incrementStatistic("buildingsBought:total", quantity);
    this.incrementStatistic(`buildingsBought:${producerId}`, quantity);
    this.notifications.push("status", `Purchased ${quantity}x ${producer.name}.`);
    return true;
  }

  // ── Modifiers (buffs/debuffs from items or events) ─────────────────────

  addModifier(modifier: Modifier): void {
    this.state.modifiers[modifier.id] = modifier;
    this.notifications.push(
      "status",
      `${modifier.source === "debuff" ? "Debuff" : "Buff"} active: ${modifier.label}`
    );
  }

  removeModifier(modifierId: string): void {
    delete this.state.modifiers[modifierId];
  }

  /** Purge modifiers whose expiresAt is at or before `asOf`. Returns the ones removed. */
  private pruneExpiredModifiers(asOf: number): Modifier[] {
    const expired: Modifier[] = [];
    for (const modifier of Object.values(this.state.modifiers)) {
      if (modifier.expiresAt !== undefined && modifier.expiresAt <= asOf) {
        expired.push(modifier);
        delete this.state.modifiers[modifier.id];
      }
    }
    return expired;
  }

  /**
   * General-purpose modifier application: (base + additiveSum) * multiplicativeProduct,
   * for ANY numeric value a modifier might affect — not just production
   * rates. `target` matching is three-tiered so one debuff can be as broad
   * or as narrow as it needs to be:
   *   1. Exact match — a modifier targeting "xp:woodcutting" only affects that.
   *   2. Namespace wildcard — "xp:all" affects every skill's XP, without
   *      also touching resource production or travel speed.
   *   3. Global wildcard — bare "all" affects literally everything routed
   *      through this method, anywhere in the game. This is the hook for a
   *      "your actions are 50% slower" debuff to touch production, XP,
   *      travel, and job rewards all at once, with a single modifier.
   *
   * Used by production rates, travel speed, skill XP gains, and job board
   * GP/point rewards today — and is exactly what a future combat system
   * (enemy damage, drop rates) or any other numeric grant should route
   * through too, rather than inventing its own scaling logic.
   */
  getModifiedValue(target: string, base: number): number {
    const namespace = target.includes(":") ? target.split(":")[0] : target;
    const namespaceWildcard = `${namespace}:all`;

    let additiveSum = 0;
    let multiplicativeProduct = 1;
    for (const modifier of Object.values(this.state.modifiers)) {
      const matches =
        modifier.target === target || modifier.target === namespaceWildcard || modifier.target === "all";
      if (!matches) continue;
      if (modifier.type === "additive") {
        additiveSum += modifier.value;
      } else {
        multiplicativeProduct *= modifier.value;
      }
    }
    return (base + additiveSum) * multiplicativeProduct;
  }

  /**
   * Effective production rate per second for a single resource, given
   * currently-active modifiers. (base + additiveSum) * multiplicativeProduct
   */
  getEffectiveRatePerSecond(resource: ResourceId): number {
    let base = 0;
    for (const producer of Object.values(this.state.producers)) {
      if (producer.resource === resource) {
        base += producer.baseRatePerSecond * producer.quantity;
      }
    }
    return this.getModifiedValue(resource, base);
  }

  // ── Flags (quest completion, one-time events, discovery states) ────────

  getFlag(flag: string): boolean {
    return this.state.flags[flag] ?? false;
  }

  setFlag(flag: string, value = true): void {
    this.state.flags[flag] = value;
  }

  // ── Skills ──────────────────────────────────────────────────────────────

  getSkillXp(skillId: string): number {
    return this.state.skills[skillId]?.xp ?? 0;
  }

  getSkillLevel(skillId: string): number {
    return levelForXp(this.getSkillXp(skillId));
  }

  addSkillXp(skillId: string, amount: number): void {
    if (amount <= 0) return;
    if (!this.state.skills[skillId]) this.state.skills[skillId] = { xp: 0 };
    // XP is modifier-scalable — an "xp:woodcutting" buff affects just this
    // skill, an "xp:all" buff affects every skill's gains.
    const scaledAmount = this.getModifiedValue(`xp:${skillId}`, amount);
    this.state.skills[skillId].xp += scaledAmount;
    // No notification here on purpose — resolveElapsed snapshots levels
    // before/after and decides how to report level-ups (see comment there).
    // Pushing one here meant a burst of many small ticks in a row (a
    // backgrounded-but-still-live tab is the common case, not just a true
    // offline catch-up) could stack up a dozen undismissed "level up"
    // toasts, since each one persists until dismissed.
  }

  // ── Crafting jobs (time-based, gated by skill/materials) ───────────────

  /**
   * Starts a crafting job for `quantity` items. Materials for the FULL
   * quantity are deducted immediately (RuneScape-style: you commit the
   * batch up front). Only one job runs at a time in v1 — starting a new
   * one while another is active is rejected.
   */
  startCraftJob(recipe: CraftingRecipe, quantity: number): boolean {
    if (quantity <= 0) return false;

    if (recipe.unlockCondition && !isUnlocked(recipe.unlockCondition, this.state)) {
      this.notifications.push("status", `You don't meet the requirements to do this yet.`, {
        severity: "warning",
      });
      return false;
    }

    if (this.state.activeCraftJob) {
      this.notifications.push(
        "status",
        `Already crafting ${this.state.activeCraftJob.recipeName} — finish or cancel that first.`,
        { severity: "warning" }
      );
      return false;
    }
    if (this.state.activeGatherSession) {
      this.notifications.push(
        "status",
        `Currently gathering ${this.state.activeGatherSession.recipeName} — stop that first.`,
        { severity: "warning" }
      );
      return false;
    }

    for (const input of recipe.inputs) {
      const needed = input.amount * quantity;
      if (this.getResourceAmount(input.resource) < needed) {
        this.notifications.push(
          "status",
          `Not enough ${input.resource} to craft ${quantity}x ${recipe.name}.`,
          { severity: "warning" }
        );
        return false;
      }
    }

    for (const input of recipe.inputs) {
      this.spendResource(input.resource, input.amount * quantity);
    }

    if (recipe.output.kind === "resource") {
      this.ensureResourceExists(recipe.output.resource);
    }

    this.state.activeCraftJob = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      skill: recipe.skill,
      xpPerItem: recipe.xpPerItem,
      timePerItemMs: recipe.timePerItemMs,
      output: recipe.output,
      inputsPerItem: recipe.inputs,
      startedAt: this.state.lastTickTimestamp,
      quantityTotal: quantity,
      quantityCompleted: 0,
    };

    const totalSeconds = Math.round((recipe.timePerItemMs * quantity) / 1000);
    this.notifications.push(
      "status",
      `Started crafting ${quantity}x ${recipe.name} (~${totalSeconds}s)`
    );
    return true;
  }

  /**
   * Cancels the active job. Refunds materials for whatever wasn't completed
   * yet (proportional to quantityTotal - quantityCompleted), since those
   * items were never actually produced.
   */
  cancelCraftJob(): void {
    const job = this.state.activeCraftJob;
    if (!job) return;
    const remaining = job.quantityTotal - job.quantityCompleted;
    for (const input of job.inputsPerItem) {
      this.ensureResourceExists(input.resource);
      this.state.resources[input.resource].amount += input.amount * remaining;
    }
    this.state.activeCraftJob = null;
    this.notifications.push("status", `Cancelled crafting ${job.recipeName}. Unused materials refunded.`);
  }

  /** Resolve craft-job completions up to `effectiveNow`. Internal — called from resolveElapsed(). */
  private resolveCraftJob(effectiveNow: number): void {
    const job = this.state.activeCraftJob;
    if (!job) return;

    const elapsedSinceStart = effectiveNow - job.startedAt;
    const completedByNow = Math.min(
      job.quantityTotal,
      Math.floor(elapsedSinceStart / job.timePerItemMs)
    );
    const newCompletions = completedByNow - job.quantityCompleted;
    if (newCompletions <= 0) return;

    if (job.output.kind === "resource") {
      this.ensureResourceExists(job.output.resource);
      const gained = job.output.amount * newCompletions;
      this.state.resources[job.output.resource].amount += gained;
      this.state.resources[job.output.resource].lifetimeEarned += gained;
    } else {
      this.addItem(job.output.itemDefId, job.output.quantity * newCompletions, {
        stackable: job.output.stackable,
        unique: job.output.unique,
      });
    }

    this.addSkillXp(job.skill, job.xpPerItem * newCompletions);
    this.incrementStatistic(`crafted:${job.recipeId}`, newCompletions);

    job.quantityCompleted = completedByNow;

    if (job.quantityCompleted >= job.quantityTotal) {
      this.notifications.push(
        "production",
        `Made x${job.quantityTotal} ${job.recipeName} (+${job.xpPerItem * job.quantityTotal} ${capitalize(job.skill)} XP)`
      );
      this.state.activeCraftJob = null;
    } else {
      this.notifications.push(
        "production",
        `Made x${newCompletions} ${job.recipeName} so far (+${job.xpPerItem * newCompletions} ${capitalize(job.skill)} XP)`
      );
    }
  }

  // ── Gathering sessions (Woodcutting etc. — open-ended, time-capped) ────

  /** Starts an open-ended gathering session. Mutually exclusive with
   *  crafting (same "one action at a time" rule) and with another gather
   *  session. `recipe.inputs` should normally be empty for a gathering
   *  recipe, but nothing enforces that — a "gather" that consumes
   *  something isn't nonsensical, just unusual. */
  startGatherSession(
    amenityId: string,
    recipe: CraftingRecipe,
    opts?: { maxDurationMs?: number; requiresKeepAliveEveryMs?: number }
  ): boolean {
    if (recipe.unlockCondition && !isUnlocked(recipe.unlockCondition, this.state)) {
      this.notifications.push("status", `You don't meet the requirements to do this yet.`, {
        severity: "warning",
      });
      return false;
    }

    if (this.state.activeGatherSession) {
      this.notifications.push(
        "status",
        `Already gathering ${this.state.activeGatherSession.recipeName} — stop that first.`,
        { severity: "warning" }
      );
      return false;
    }
    if (this.state.activeCraftJob) {
      this.notifications.push(
        "status",
        `Currently crafting ${this.state.activeCraftJob.recipeName} — finish or cancel that first.`,
        { severity: "warning" }
      );
      return false;
    }

    const now = this.state.lastTickTimestamp;
    this.state.activeGatherSession = {
      amenityId,
      recipeId: recipe.id,
      recipeName: recipe.name,
      skill: recipe.skill,
      xpPerItem: recipe.xpPerItem,
      timePerItemMs: recipe.timePerItemMs,
      output: recipe.output,
      startedAt: now,
      quantityGathered: 0,
      maxDurationMs: opts?.maxDurationMs ?? DEFAULT_GATHER_MAX_DURATION_MS,
      requiresKeepAliveEveryMs: opts?.requiresKeepAliveEveryMs,
      lastKeepAliveAt: opts?.requiresKeepAliveEveryMs ? now : undefined,
    };
    this.notifications.push("status", `Started gathering ${recipe.name}.`);
    return true;
  }

  /** Stops the current session early (player choice, not a cap being hit). */
  stopGatherSession(): void {
    const session = this.state.activeGatherSession;
    if (!session) return;
    this.state.activeGatherSession = null;
    this.notifications.push(
      "status",
      `Stopped gathering ${session.recipeName}. Gathered ${session.quantityGathered.toLocaleString()} total.`
    );
  }

  /** Resets the keep-alive clock — call this from a "tend to it" UI action.
   *  Returns false if there's no session, or the session doesn't require
   *  keep-alives (nothing to reset). Uses real Date.now(), not the engine's
   *  lastTickTimestamp anchor, since this is a live player action, not
   *  something resolved retroactively during offline catch-up. */
  keepGatherSessionAlive(): boolean {
    const session = this.state.activeGatherSession;
    if (!session || session.requiresKeepAliveEveryMs === undefined) return false;
    session.lastKeepAliveAt = Date.now();
    return true;
  }

  /** Resolve gathering progress up to `effectiveNow`. Internal — called from
   *  resolveElapsed(). Mirrors resolveCraftJob's "completedByNow = floor(elapsed
   *  / timePerItem)" approach, except the cap is a TIME cutoff (whichever is
   *  sooner: maxDurationMs, or a missed keep-alive) instead of a fixed quantity. */
  private resolveGatherSession(effectiveNow: number): void {
    const session = this.state.activeGatherSession;
    if (!session) return;

    let cutoff = session.startedAt + session.maxDurationMs;
    let endedFromInactivity = false;
    if (session.requiresKeepAliveEveryMs !== undefined && session.lastKeepAliveAt !== undefined) {
      const keepAliveCutoff = session.lastKeepAliveAt + session.requiresKeepAliveEveryMs;
      if (keepAliveCutoff < cutoff) {
        cutoff = keepAliveCutoff;
        endedFromInactivity = true;
      }
    }

    const cappedNow = Math.min(effectiveNow, cutoff);
    const totalByNow = Math.max(
      0,
      Math.floor((cappedNow - session.startedAt) / session.timePerItemMs)
    );
    const newCompletions = totalByNow - session.quantityGathered;

    if (newCompletions > 0) {
      if (session.output.kind === "resource") {
        this.ensureResourceExists(session.output.resource);
        const gained = session.output.amount * newCompletions;
        this.state.resources[session.output.resource].amount += gained;
        this.state.resources[session.output.resource].lifetimeEarned += gained;
      } else {
        this.addItem(session.output.itemDefId, session.output.quantity * newCompletions, {
          stackable: session.output.stackable,
          unique: session.output.unique,
        });
      }
      this.addSkillXp(session.skill, session.xpPerItem * newCompletions);
      this.incrementStatistic(`gathered:${session.recipeId}`, newCompletions);
      session.quantityGathered = totalByNow;
    }

    if (cappedNow >= cutoff) {
      const reason = endedFromInactivity ? "needed attention" : "reached its time limit";
      this.notifications.push(
        "status",
        `Your ${session.recipeName} gathering session ended (${reason}). Gathered ${session.quantityGathered.toLocaleString()} total.`
      );
      this.state.activeGatherSession = null;
    }
  }

  // ── World map travel ─────────────────────────────────────────────────

  /** Product of all active multiplicative "travelSpeed"-targeted modifiers,
   *  combined with a simple Agility-derived bonus (capped at 50% faster at
   *  level 100 — tune this formula freely, it's isolated here on purpose). */
  getTravelSpeedMultiplier(): number {
    const modifierMultiplier = this.getModifiedValue("travelSpeed", 1);
    const agilityLevel = this.getSkillLevel("agility");
    const agilityBonus = 1 - Math.min(0.5, agilityLevel * 0.005);
    return modifierMultiplier * agilityBonus;
  }

  /** Pure calculation, no state mutation — used both by startTravel and by
   *  the UI to preview a trip's duration before committing to it. */
  getTravelDurationEstimate(from: MapLocation, to: MapLocation, opts?: { msPerDistanceUnit?: number }): number {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const baseDurationMs = distance * (opts?.msPerDistanceUnit ?? DEFAULT_MS_PER_DISTANCE_UNIT);
    return Math.max(1000, Math.round(baseDurationMs * this.getTravelSpeedMultiplier()));
  }

  startTravel(from: MapLocation, to: MapLocation, opts?: { msPerDistanceUnit?: number }): boolean {
    if (this.state.activeTravel) {
      this.notifications.push("status", `Already traveling to ${this.state.activeTravel.destinationName}.`, {
        severity: "warning",
      });
      return false;
    }
    if (this.state.activeCraftJob) {
      this.notifications.push(
        "status",
        `Currently crafting ${this.state.activeCraftJob.recipeName} — stop that first.`,
        { severity: "warning" }
      );
      return false;
    }
    if (this.state.activeGatherSession) {
      this.notifications.push(
        "status",
        `Currently gathering ${this.state.activeGatherSession.recipeName} — stop that first.`,
        { severity: "warning" }
      );
      return false;
    }
    if (this.state.currentLocationId === to.id) {
      this.notifications.push("status", `You're already at ${to.name}.`, { severity: "warning" });
      return false;
    }
    if (to.unlockCondition && !isUnlocked(to.unlockCondition, this.state)) {
      this.notifications.push("status", `You can't travel to ${to.name} yet.`, { severity: "warning" });
      return false;
    }

    const durationMs = this.getTravelDurationEstimate(from, to, opts);

    this.state.activeTravel = {
      destinationLocationId: to.id,
      destinationName: to.name,
      startedAt: this.state.lastTickTimestamp,
      durationMs,
      onArriveSetFlag: to.onArriveSetFlag,
    };
    this.notifications.push("status", `Traveling to ${to.name} (~${Math.round(durationMs / 1000)}s).`);
    return true;
  }

  /** Cancels an in-progress trip. Simplification: you stay at your ORIGIN,
   *  not somewhere partway there — no partial-position tracking (yet). */
  cancelTravel(): void {
    const travel = this.state.activeTravel;
    if (!travel) return;
    this.state.activeTravel = null;
    this.notifications.push("status", `Travel to ${travel.destinationName} cancelled.`);
  }

  /** Instantly moves the player to `destination`, bypassing normal travel
   *  time — e.g. an Amulet of Glory. Still respects the destination's
   *  unlockCondition (you can't teleport somewhere you haven't unlocked).
   *  Not charge-limited yet — see the teleportTo comment in items.ts. */
  teleportTo(def: ItemDefinition, instanceId: string, destination: MapLocation): boolean {
    if (!this.state.inventory[instanceId]) return false;
    if (destination.unlockCondition && !isUnlocked(destination.unlockCondition, this.state)) {
      this.notifications.push("status", `You can't teleport to ${destination.name} yet.`, {
        severity: "warning",
      });
      return false;
    }
    this.state.activeTravel = null;
    this.state.currentLocationId = destination.id;
    this.arriveAt(destination.id, destination.name, destination.onArriveSetFlag);
    this.notifications.push("status", `You teleport to ${destination.name} using ${def.name}.`);
    return true;
  }

  /** Resolve travel completion up to `effectiveNow`. Internal — called from resolveElapsed(). */
  private resolveTravel(effectiveNow: number): void {
    const travel = this.state.activeTravel;
    if (!travel) return;
    if (effectiveNow >= travel.startedAt + travel.durationMs) {
      this.state.currentLocationId = travel.destinationLocationId;
      this.state.activeTravel = null;
      this.incrementStatistic("totalTravelTimeMs", travel.durationMs);
      this.arriveAt(travel.destinationLocationId, travel.destinationName, travel.onArriveSetFlag);
      this.notifications.push("status", `Arrived at ${travel.destinationName}.`);
    }
  }

  /** Shared arrival logic for both normal travel and teleport. Tracks
   *  per-location visit counts always, but only fires the "you discover..."
   *  notification and any onArriveSetFlag the FIRST time — repeat visits
   *  are silent on that front (still increment traveledTo, still notify
   *  "Arrived at..." from the caller). This is what makes a flag-gated
   *  building's unlock moment actually visible instead of a silent
   *  background state change. */
  private arriveAt(locationId: string, locationName: string, onArriveSetFlag?: string): void {
    this.incrementStatistic(`traveledTo:${locationId}`);

    const visitedFlag = `visited:${locationId}`;
    const isFirstVisit = !this.getFlag(visitedFlag);
    if (!isFirstVisit) return;

    this.setFlag(visitedFlag, true);
    this.incrementStatistic("locationsDiscovered");
    if (onArriveSetFlag) this.setFlag(onArriveSetFlag, true);
    this.notifications.push("quest", `You discover ${locationName} for the first time!`);
  }

  // ── Time resolution — the one true path for advancing the simulation ──

  /**
   * Advance the simulation from state.lastTickTimestamp to `now`.
   * Safe to call every second (live tick) or once after a multi-day gap
   * (offline catch-up) — behavior is identical either way.
   *
   * Production, crafting-job completions, and modifier expiry are all
   * resolved against the SAME capped window (effectiveNow), so a long
   * absence caps all forms of progress consistently rather than having
   * production capped while crafting silently kept going uncapped.
   */
  resolveElapsed(now: number = Date.now()): void {
    const from = this.state.lastTickTimestamp;
    const elapsedMs = now - from;

    if (elapsedMs <= 0) {
      // Clock went backwards (system clock change) or no time passed — don't
      // apply negative production, just resync the anchor.
      this.state.lastTickTimestamp = now;
      return;
    }

    const wasOffline = elapsedMs > MIN_AWAY_MS_FOR_SUMMARY;
    const cappedMs = Math.min(elapsedMs, this.state.offlineCapMs);
    const effectiveNow = from + cappedMs;

    if (elapsedMs > this.state.offlineCapMs) {
      this.notifications.push(
        "debug",
        `Offline gap of ${Math.round(elapsedMs / 60000)}min capped to ${Math.round(
          this.state.offlineCapMs / 60000
        )}min for reward calculation`,
        { devOnly: true }
      );
    }

    // Resolve modifier expiry using the SAME capped horizon as everything
    // else, not the real `now` — see class doc comment.
    const expired = this.pruneExpiredModifiers(effectiveNow);

    const levelsBefore: Record<string, number> = {};
    for (const skillId of Object.keys(this.state.skills)) {
      levelsBefore[skillId] = this.getSkillLevel(skillId);
    }

    const gains: Record<ResourceId, number> = {};
    for (const resourceId of Object.keys(this.state.resources)) {
      const rate = this.getEffectiveRatePerSecond(resourceId);
      const gained = rate * (cappedMs / 1000);
      if (gained > 0) gains[resourceId] = gained;
    }

    for (const [resourceId, gained] of Object.entries(gains)) {
      this.ensureResourceExists(resourceId);
      this.state.resources[resourceId].amount += gained;
      this.state.resources[resourceId].lifetimeEarned += gained;
    }

    this.resolveCraftJob(effectiveNow);
    this.resolveTravel(effectiveNow);
    this.resolveGatherSession(effectiveNow);
    // Captured BEFORE resolveCombatSession runs — if a fight was active at
    // the start of this tick's window, no regen credit for ANY of that
    // window, even if the fight ends partway through it (e.g. defeat).
    // Checking "is there an active session right now" (i.e. AFTER combat
    // resolves) would wrongly grant regen for the whole window once the
    // session clears, even though most of it was spent fighting.
    const wasInCombatThisTick = this.state.activeCombatSession !== null;
    this.resolveCombatSession(effectiveNow);
    if (!wasInCombatThisTick) this.resolveHpRegen(cappedMs);
    this.resolveJobExpiry(now);
    this.syncDerivedStatistics();

    this.state.lastTickTimestamp = now;

    // Any skill that gained a level THIS resolveElapsed call — could be more
    // than one (a craft job finishing several batches at once, etc.).
    const levelUps: { skillId: string; from: number; to: number }[] = [];
    for (const skillId of Object.keys(this.state.skills)) {
      const before = levelsBefore[skillId] ?? 1;
      const after = this.getSkillLevel(skillId);
      if (after > before) levelUps.push({ skillId, from: before, to: after });
    }

    if (wasOffline) {
      // Folded into one summary line instead of one toast per level — this
      // is what actually fixes the spam, whether the burst came from a true
      // offline gap or many rapid ticks in a backgrounded tab.
      if (levelUps.length > 0 || Object.keys(gains).length > 0) {
        this.emitOfflineSummary(elapsedMs, gains, levelUps);
      }
    } else {
      // Live play: immediate per-level-up feedback is good here and won't
      // spam under normal pacing — it's naturally rate-limited by how fast
      // XP can actually accrue in a ~1s tick.
      for (const levelUp of levelUps) {
        this.notifications.push(
          "quest",
          `<${capitalize(levelUp.skillId)}> level up! You are now level ${levelUp.to}.`,
          { replaceKey: `levelup:${levelUp.skillId}` }
        );
      }
    }

    for (const modifier of expired) {
      this.notifications.push("status", `${modifier.label} has worn off.`);
    }
  }

  private emitOfflineSummary(
    elapsedMs: number,
    gains: Record<ResourceId, number>,
    levelUps: { skillId: string; from: number; to: number }[]
  ): void {
    const duration = formatDuration(elapsedMs);
    const parts = Object.entries(gains)
      .filter(([, amount]) => amount >= 1)
      .map(([resource, amount]) => `${Math.floor(amount).toLocaleString()} ${resource.toUpperCase()}`);

    for (const levelUp of levelUps) {
      const gained = levelUp.to - levelUp.from;
      const levelWord = gained === 1 ? "level" : "levels";
      parts.push(`${gained} ${capitalize(levelUp.skillId)} ${levelWord}`);
    }

    if (parts.length === 0) return;
    this.notifications.push(
      "offline-summary",
      `While you were away for ${duration}, you earned ${parts.join(", ")}.`,
      { replaceKey: "offline-summary" }
    );
  }

  // ── Offline cap (flexible so future upgrades/items can extend it) ──────

  getOfflineCapMs(): number {
    return this.state.offlineCapMs;
  }

  setOfflineCapMs(ms: number): void {
    this.state.offlineCapMs = Math.max(0, ms);
  }

  // ── Inventory / Equipment ────────────────────────────────────────────

  /** Adds `quantity` of an item. Stackable items collapse into one instance
   *  (existing stack found and incremented, or a new one created); non-stackable
   *  items get one instance per unit, same as before. `unique` items refuse to
   *  add a second copy if one already exists anywhere (inventory or worn). */
  addItem(itemDefId: string, quantity: number, opts: { stackable: boolean; unique?: boolean }): string[] {
    if (quantity <= 0) return [];

    if (opts.unique) {
      const alreadyOwned = Object.values(this.state.inventory).some((i) => i.itemDefId === itemDefId);
      if (alreadyOwned) {
        this.notifications.push("status", `You can only own one of that item.`, { severity: "warning" });
        return [];
      }
    }

    if (opts.stackable) {
      const existing = Object.values(this.state.inventory).find((i) => i.itemDefId === itemDefId);
      if (existing) {
        existing.quantity = (existing.quantity ?? 1) + quantity;
        return [existing.instanceId];
      }
      const instanceId = this.newInstanceId();
      this.state.inventory[instanceId] = { instanceId, itemDefId, quantity };
      return [instanceId];
    }

    const ids: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const instanceId = this.newInstanceId();
      this.state.inventory[instanceId] = { instanceId, itemDefId };
      ids.push(instanceId);
    }
    return ids;
  }

  private newInstanceId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  getInventoryItems(): ItemInstance[] {
    return Object.values(this.state.inventory);
  }

  isEquipped(instanceId: string): boolean {
    return Object.values(this.state.equipment).includes(instanceId);
  }

  /** Equips an item, unequipping whatever was already in that slot (if anything).
   *  Refuses if the item has an unmet equipRequirement (e.g. an Attack level) —
   *  same "engine enforces it, not just the UI" pattern as purchaseProducer. */
  equipItem(def: ItemDefinition, instanceId: string): boolean {
    const instance = this.state.inventory[instanceId];
    if (!instance || instance.itemDefId !== def.id || !def.equipSlot) return false;

    if (def.equipRequirement && !isUnlocked(def.equipRequirement, this.state)) {
      this.notifications.push("status", `You don't meet the requirements to equip ${def.name}.`, {
        severity: "warning",
      });
      return false;
    }

    this.state.equipment[def.equipSlot] = instanceId;
    this.notifications.push("status", `Equipped ${def.name}.`);
    return true;
  }

  unequipSlot(slot: string): void {
    const def = this.state.equipment[slot as keyof GameState["equipment"]];
    if (!def) return;
    delete this.state.equipment[slot as keyof GameState["equipment"]];
    this.notifications.push("status", `Unequipped item.`);
  }

  /** Removes an item entirely — from inventory and, if worn, its equipment slot.
   *  For a stack, this drops the WHOLE stack (no partial-quantity drop yet —
   *  a "drop X" quantity prompt is a fine future addition, not built now). */
  dropItem(def: ItemDefinition, instanceId: string): void {
    if (!this.state.inventory[instanceId]) return;
    for (const [slot, id] of Object.entries(this.state.equipment)) {
      if (id === instanceId) delete this.state.equipment[slot as keyof GameState["equipment"]];
    }
    delete this.state.inventory[instanceId];
    this.notifications.push("status", `Dropped ${def.name}.`);
  }

  /** Stub — no hunger/HP system exists yet, so eating just consumes one unit.
   *  Wire in real effects here once those systems exist. */
  consumeItem(def: ItemDefinition, instanceId: string): void {
    const instance = this.state.inventory[instanceId];
    if (!instance) return;
    if (instance.quantity !== undefined && instance.quantity > 1) {
      instance.quantity -= 1;
    } else {
      delete this.state.inventory[instanceId];
    }
    this.notifications.push("status", `You eat the ${def.name}.`);
  }

  // ── Shops ────────────────────────────────────────────────────────────

  /** Max units of something affordable at `price`, given current resources —
   *  the bottleneck resource (whichever runs out first) determines it.
   *  Used for "Buy All"; also handy anywhere else a max-affordable quantity
   *  is useful later. */
  getMaxAffordableQuantity(price: RecipeInput[]): number {
    let max = Infinity;
    for (const cost of price) {
      if (cost.amount <= 0) continue;
      const available = this.getResourceAmount(cost.resource);
      max = Math.min(max, Math.floor(available / cost.amount));
    }
    return Number.isFinite(max) ? Math.max(0, max) : 0;
  }

  /** Buys `quantity` of an item from a shop. Enforces that the player is
   *  actually AT the shop's location (not just a UI-hidden check) — same
   *  "engine enforces it, not just the UI" pattern as purchaseProducer and
   *  equipItem. `price` is a RecipeInput[] (almost always just GP today,
   *  but works unchanged for a resource-priced item or, later, trading). */
  buyFromShop(
    shopLocationId: string,
    itemDefId: string,
    price: RecipeInput[],
    quantity: number,
    opts: { stackable: boolean; itemName: string }
  ): boolean {
    if (quantity <= 0) return false;

    if (this.state.currentLocationId !== shopLocationId) {
      this.notifications.push("status", "You need to be at the shop to buy from it.", {
        severity: "warning",
      });
      return false;
    }

    for (const cost of price) {
      if (this.getResourceAmount(cost.resource) < cost.amount * quantity) {
        this.notifications.push(
          "status",
          `Not enough ${cost.resource} to buy ${quantity}x ${opts.itemName}.`,
          { severity: "warning" }
        );
        return false;
      }
    }

    for (const cost of price) {
      this.spendResource(cost.resource, cost.amount * quantity);
    }
    this.addItem(itemDefId, quantity, { stackable: opts.stackable });
    this.incrementStatistic(`shopPurchases:${itemDefId}`, quantity);
    this.notifications.push("status", `Bought ${quantity}x ${opts.itemName}.`);
    return true;
  }

  // ── Hitpoints / HP ───────────────────────────────────────────────────

  getMaxHp(): number {
    return this.getSkillLevel("hitpoints");
  }

  getCurrentHp(): number {
    return Math.max(0, Math.min(this.getMaxHp(), this.state.currentHp));
  }

  /** Pure add-and-clamp — NOT modifier-scaled itself. Callers (resolveHpRegen,
   *  and later food/potions) apply getModifiedValue at their own call site,
   *  with whichever target namespace fits ("hpRegen" vs "healing") — scaling
   *  here too would double-apply it on top of an already-scaled amount. */
  private healHp(amount: number): void {
    if (amount <= 0) return;
    this.state.currentHp = Math.min(this.getMaxHp(), this.getCurrentHp() + amount);
  }

  private damageHp(amount: number): void {
    if (amount <= 0) return;
    this.state.currentHp = Math.max(0, this.getCurrentHp() - amount);
  }

  /** Passive regen — out of combat only, per an explicit design decision
   *  (reliably factoring in modifiers/equipment/attacking/defending DURING
   *  a fight is a lot more complexity for later; simple and correct now). */
  private resolveHpRegen(elapsedMs: number): void {
    if (this.state.activeCombatSession) return;
    if (this.getCurrentHp() >= this.getMaxHp()) return;
    const regenPerSecond = this.getModifiedValue("hpRegen", BASE_HP_REGEN_PER_SECOND);
    this.healHp(regenPerSecond * (elapsedMs / 1000));
  }

  getCombatLevel(): number {
    return calculateCombatLevel({
      attack: this.getSkillLevel("attack"),
      strength: this.getSkillLevel("strength"),
      defence: this.getSkillLevel("defence"),
      hitpoints: this.getSkillLevel("hitpoints"),
      ranged: this.getSkillLevel("ranged"),
      magic: this.getSkillLevel("magic"),
    });
  }

  /** Dev tool — directly sets current HP for testing, bypassing regen/combat. */
  devSetCurrentHp(hp: number): void {
    this.state.currentHp = Math.max(0, Math.min(this.getMaxHp(), hp));
  }

  // ── Combat ───────────────────────────────────────────────────────────

  /** Starts a fight. `equipmentBonus` is computed by the caller (the UI/
   *  content layer, which has access to ItemDefinition data the engine
   *  doesn't) by summing stats across currently-equipped items, PLUS the
   *  equipped weapon's speed/type specifically — same "caller resolves
   *  content, engine takes primitives" pattern as purchaseProducer/
   *  buyFromShop. Refuses if another action is active, or current HP is 0
   *  (heal first). */
  startCombat(
    enemy: EnemyDefinition,
    equipmentBonus: {
      attack: number;
      strength: number;
      defence: number;
      attackSpeedMs?: number;
      weaponType?: WeaponType;
    }
  ): boolean {
    if (this.state.activeCraftJob || this.state.activeGatherSession || this.state.activeTravel) {
      this.notifications.push("status", "You're busy with something else — stop that first.", {
        severity: "warning",
      });
      return false;
    }
    if (this.state.activeCombatSession) {
      this.notifications.push("status", `Already fighting ${this.state.activeCombatSession.enemyName}.`, {
        severity: "warning",
      });
      return false;
    }
    if (this.getCurrentHp() <= 0) {
      this.notifications.push("status", "You need to heal before fighting.", { severity: "warning" });
      return false;
    }

    const now = this.state.lastTickTimestamp;
    this.state.activeCombatSession = {
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
      playerAttackSpeedMs: equipmentBonus.attackSpeedMs ?? UNARMED_ATTACK_SPEED_MS,
      enemyAttackSpeedMs: enemy.attackSpeedMs ?? DEFAULT_ENEMY_ATTACK_SPEED_MS,
      playerStartedAt: now,
      enemyStartedAt: now,
      playerAttacksResolved: 0,
      enemyAttacksResolved: 0,
      log: [],
    };
    this.notifications.push("status", `Engaged ${enemy.name}!`);
    return true;
  }

  /** Leaves the fight with no reward and no penalty — only if the enemy
   *  allows it (bosses typically don't). */
  fleeCombat(): boolean {
    const session = this.state.activeCombatSession;
    if (!session) return false;
    if (!session.canFlee) {
      this.notifications.push("status", `You can't flee from ${session.enemyName}.`, {
        severity: "warning",
      });
      return false;
    }
    this.state.activeCombatSession = null;
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
    const session = this.state.activeCombatSession;
    if (!session) return false;
    this.resolvePlayerAttack(session);
    if (this.state.activeCombatSession) {
      const updated = this.state.activeCombatSession;
      updated.playerAttacksResolved += 1;
      updated.playerStartedAt = Date.now() - updated.playerAttacksResolved * updated.playerAttackSpeedMs;
    }
    return true;
  }

  private static readonly COMBAT_LOG_LIMIT = 20;

  private pushCombatLog(
    session: NonNullable<GameState["activeCombatSession"]>,
    attacker: "player" | "enemy",
    hit: boolean,
    damage: number
  ): void {
    const outcome: "miss" | "block" | "hit" = !hit ? "miss" : damage <= 0 ? "block" : "hit";
    session.log.push({ timestamp: Date.now(), attacker, outcome, damage });
    if (session.log.length > GameEngine.COMBAT_LOG_LIMIT) session.log.shift();
  }

  /** One player attack. May end the session (victory) — callers must
   *  re-check this.state.activeCombatSession afterward. */
  private resolvePlayerAttack(session: NonNullable<GameState["activeCombatSession"]>): void {
    const accuracy = { level: this.getSkillLevel("attack"), bonus: session.playerAttackBonus };
    const power = { level: this.getSkillLevel("strength"), bonus: session.playerStrengthBonus };
    const defence = { level: session.enemyDefence, bonus: session.enemyDefenceBonus };

    const outcome = resolveAttack(accuracy, power, defence);
    let damage = outcome.damage;
    // Weapon-type-vs-weakness bonus: matching a stab/slash/crush weapon to
    // the enemy's weakness scales damage up, not accuracy — an accurate
    // hit with the "wrong" weapon still lands, it just does less.
    if (outcome.hit && session.playerWeaponType && session.playerWeaponType === session.enemyWeakness) {
      damage = Math.ceil(damage * WEAKNESS_DAMAGE_MULTIPLIER);
    }

    this.pushCombatLog(session, "player", outcome.hit, damage);
    if (outcome.hit) {
      session.enemyCurrentHp = Math.max(0, session.enemyCurrentHp - damage);
    }
    if (session.enemyCurrentHp <= 0) {
      this.grantCombatVictory(session);
    }
  }

  /** One enemy attack. May end the session (defeat) — callers must
   *  re-check this.state.activeCombatSession afterward. */
  private resolveEnemyAttack(session: NonNullable<GameState["activeCombatSession"]>): void {
    const accuracy = { level: session.enemyAttack, bonus: session.enemyAttackBonus };
    const power = { level: session.enemyStrength, bonus: session.enemyStrengthBonus };
    const defence = { level: this.getSkillLevel("defence"), bonus: session.playerDefenceBonus };

    const outcome = resolveAttack(accuracy, power, defence);
    this.pushCombatLog(session, "enemy", outcome.hit, outcome.damage);
    if (outcome.hit) {
      this.damageHp(outcome.damage);
    }
    if (this.getCurrentHp() <= 0) {
      this.endCombatDefeat(session);
    }
  }

  private grantCombatVictory(session: NonNullable<GameState["activeCombatSession"]>): void {
    // No combat-style selection UI yet, so XP just splits evenly across the
    // four skills involved — revisit once style selection exists.
    const xpEach = session.xpReward / 4;
    this.addSkillXp("attack", xpEach);
    this.addSkillXp("strength", xpEach);
    this.addSkillXp("defence", xpEach);
    this.addSkillXp("hitpoints", xpEach);

    this.incrementStatistic(`kills:${session.enemyId}`, 1);
    this.incrementStatistic("kills:total", 1);

    const lootMessages: string[] = [];
    if (session.lootTable.length > 0) {
      const drop = weightedRandomPick(session.lootTable.map((entry) => ({ item: entry, weight: entry.weight })));
      if (drop.itemDefId || drop.resourceId) {
        const quantity =
          drop.quantityMin !== undefined && drop.quantityMax !== undefined
            ? drop.quantityMin + Math.floor(Math.random() * (drop.quantityMax - drop.quantityMin + 1))
            : 1;
        if (drop.itemDefId) {
          this.addItem(drop.itemDefId, quantity, { stackable: drop.stackable ?? true });
          lootMessages.push(`${quantity}x <${drop.itemDefId}>`);
        } else if (drop.resourceId) {
          this.ensureResourceExists(drop.resourceId);
          this.state.resources[drop.resourceId].amount += quantity;
          this.state.resources[drop.resourceId].lifetimeEarned += quantity;
          lootMessages.push(`${quantity} ${drop.resourceId}`);
        }
      }
    }

    const lootText = lootMessages.length > 0 ? ` You got: ${lootMessages.join(", ")}.` : " No loot this time.";
    this.notifications.push("reward", `Defeated ${session.enemyName}!${lootText}`);
    this.state.activeCombatSession = null;
  }

  /** Death penalty: lose a percentage of GP and of each other resource
   *  (capped implicitly since it's a percentage of what you actually
   *  have — never goes negative, never loses more than you're carrying),
   *  then wake up back at the starting location. No item loss (yet) —
   *  content can already ask for harsher percentages via
   *  EnemyDefinition.deathPenalty for a future dungeon/boss, but "lose a
   *  specific item on death" isn't built, only flagged as a natural
   *  extension of the same override pattern once something needs it. */
  private applyDeathPenalty(session: NonNullable<GameState["activeCombatSession"]>): void {
    const gp = this.getResourceAmount("gp");
    const gpLost = Math.floor(gp * session.deathPenaltyGpLossPercent);
    if (gpLost > 0) this.spendResource("gp", gpLost);

    const resourceLosses: string[] = [];
    for (const resourceId of Object.keys(this.state.resources)) {
      if (resourceId === "gp" || resourceId === "achievement-points") continue;
      const amount = this.getResourceAmount(resourceId);
      const lost = Math.floor(amount * session.deathPenaltyResourceLossPercent);
      if (lost > 0) {
        this.spendResource(resourceId, lost);
        resourceLosses.push(`${lost} ${resourceId}`);
      }
    }

    this.state.currentLocationId = STARTING_LOCATION_ID;

    const lossParts = [gpLost > 0 ? `${gpLost} GP` : null, ...resourceLosses].filter(
      (part): part is string => part !== null
    );
    const lossText = lossParts.length > 0 ? ` You lost ${lossParts.join(", ")}.` : "";
    this.notifications.push(
      "status",
      `Defeated by ${session.enemyName}. Woke up back in town.${lossText}`,
      { severity: "error" }
    );
  }

  private endCombatDefeat(session: NonNullable<GameState["activeCombatSession"]>): void {
    this.state.currentHp = 1;
    this.applyDeathPenalty(session);
    this.state.activeCombatSession = null;
  }

  /** Resolve combat up to `effectiveNow`. Player and enemy attack on
   *  independent timers, so this can't just be "floor(elapsed/interval)"
   *  once like crafting/gathering — instead it's a small interleaved
   *  priority queue: at each step, whichever side's next attack is due
   *  soonest goes first, repeated until neither side has an attack due
   *  yet (or the fight ends). This is what makes a fast weapon actually
   *  land more attacks than a slow enemy, and vice versa, instead of both
   *  sides trading blows in lockstep. */
  private resolveCombatSession(effectiveNow: number): void {
    let session = this.state.activeCombatSession;
    if (!session) return;

    while (session) {
      const playerNextAt =
        session.playerStartedAt + (session.playerAttacksResolved + 1) * session.playerAttackSpeedMs;
      const enemyNextAt =
        session.enemyStartedAt + (session.enemyAttacksResolved + 1) * session.enemyAttackSpeedMs;
      const nextEventAt = Math.min(playerNextAt, enemyNextAt);
      if (nextEventAt > effectiveNow) break;

      if (playerNextAt <= enemyNextAt) {
        this.resolvePlayerAttack(session);
        session = this.state.activeCombatSession;
        if (session) session.playerAttacksResolved += 1;
      } else {
        this.resolveEnemyAttack(session);
        session = this.state.activeCombatSession;
        if (session) session.enemyAttacksResolved += 1;
      }
    }
  }

  // ── Save-data management (settings tab) ─────────────────────────────────

  clearResource(resourceId: ResourceId): void {
    if (this.state.resources[resourceId]) {
      this.state.resources[resourceId].amount = 0;
    }
  }

  clearAllResources(): void {
    for (const resourceId of Object.keys(this.state.resources)) {
      this.state.resources[resourceId].amount = 0;
    }
  }

  /** Full wipe — new game. Keeps offlineCapMs at the default. */
  resetAll(): void {
    this.state = createInitialState();
    this.notifications.clear();
    this.notifications.push("status", "Save data cleared — starting fresh.");
  }

  private ensureResourceExists(resource: ResourceId): void {
    if (!this.state.resources[resource]) {
      this.state.resources[resource] = { amount: 0, lifetimeEarned: 0 };
    }
  }

  /** Deducts a resource AND records it under `${resourceId}:spent` in
   *  statistics. All resource spending should route through here rather
   *  than mutating state.resources directly, so "Total GP Spent" etc. stay
   *  accurate without scattering increment calls at every call site.
   *  Known simplification: a cancelled crafting job's refund does NOT
   *  reverse this stat — a minor overcount on cancel, not worth the extra
   *  bookkeeping for an edge case. */
  private spendResource(resourceId: ResourceId, amount: number): void {
    this.ensureResourceExists(resourceId);
    this.state.resources[resourceId].amount -= amount;
    this.incrementStatistic(`${resourceId}:spent`, amount);
  }

  private incrementStatistic(key: string, amount = 1): void {
    this.state.statistics[key] = (this.state.statistics[key] ?? 0) + amount;
  }

  /** Recomputes stats that are cheaper to derive fresh each tick than to
   *  keep incrementally in sync (total level, total XP, GP earned). Called
   *  once per resolveElapsed() — 1s cadence is plenty for stat displays. */
  private syncDerivedStatistics(): void {
    let totalLevel = 0;
    let totalExp = 0;
    for (const skill of Object.values(this.state.skills)) {
      totalExp += skill.xp;
      totalLevel += levelForXp(skill.xp);
    }
    this.state.statistics["totalLevel"] = totalLevel;
    this.state.statistics["totalExp"] = totalExp;
    this.state.statistics["gp:earned"] = this.state.resources.gp?.lifetimeEarned ?? 0;
  }

  /** Sets a skill directly to a level's minimum XP threshold — for dev
   *  tooling (testing travel speed at various Agility levels, etc.), not
   *  intended as a normal gameplay action. */
  setSkillLevel(skillId: string, level: number): void {
    const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
    if (!this.state.skills[skillId]) this.state.skills[skillId] = { xp: 0 };
    this.state.skills[skillId].xp = xpForLevel(clamped);
  }

  // ── Achievements ─────────────────────────────────────────────────────

  /** Checks every achievement not yet earned; grants reward + notification
   *  for any newly met. "Earned" is tracked via flags["achievement:<id>"] —
   *  same reused substrate as everything else UnlockCondition gates.
   *  Content-driven (takes the catalog as a parameter) — call this from the
   *  app layer's tick loop, same pattern as registerStartingContent. */
  /** Marks any newly-met achievement as earned and notifies — does NOT grant
   *  the reward. Reward collection is a separate, manual step (claimAchievementReward)
   *  so the player has to consciously see what they got, rather than it
   *  silently landing in their resources while they're on another tab. */
  checkAchievements(catalog: AchievementDefinition[]): void {
    for (const achievement of catalog) {
      const earnedFlag = `achievement:${achievement.id}`;
      if (this.getFlag(earnedFlag)) continue;
      if (!isUnlocked(achievement.condition, this.state)) continue;

      this.setFlag(earnedFlag, true);
      this.notifications.push(
        "achievement",
        `Achievement unlocked: ${achievement.name} — ${achievement.description}`
      );
    }
  }

  isAchievementEarned(achievementId: string): boolean {
    return this.getFlag(`achievement:${achievementId}`);
  }

  isAchievementClaimed(achievementId: string): boolean {
    return this.getFlag(`achievementClaimed:${achievementId}`);
  }

  /** Grants an earned-but-unclaimed achievement's reward. Refuses if not yet
   *  earned, or already claimed (no double-dipping). */
  claimAchievementReward(achievement: AchievementDefinition): boolean {
    if (!this.isAchievementEarned(achievement.id) || this.isAchievementClaimed(achievement.id)) {
      return false;
    }

    if (achievement.reward?.gp) {
      this.ensureResourceExists("gp");
      this.state.resources.gp.amount += achievement.reward.gp;
      this.state.resources.gp.lifetimeEarned += achievement.reward.gp;
    }
    if (achievement.reward?.achievementPoints) {
      this.ensureResourceExists("achievement-points");
      this.state.resources["achievement-points"].amount += achievement.reward.achievementPoints;
      this.state.resources["achievement-points"].lifetimeEarned += achievement.reward.achievementPoints;
    }
    if (achievement.reward?.items) {
      for (const item of achievement.reward.items) {
        this.addItem(item.itemDefId, item.quantity, { stackable: item.stackable });
      }
    }

    this.setFlag(`achievementClaimed:${achievement.id}`, true);
    this.notifications.push("reward", `Claimed reward for ${achievement.name}.`);
    return true;
  }

  // ── Job board ────────────────────────────────────────────────────────

  isJobAccepted(jobId: string): boolean {
    return !!this.state.acceptedJobs[jobId];
  }

  /** One-time jobs stay done forever once turned in. Repeatable ones are
   *  never "completed" in this permanent sense — they just cycle through
   *  accept -> turn in -> accept again. */
  /** One-time jobs stay done until the next UTC daily reset — checked by
   *  comparing the stored completion period against the current one, not a
   *  permanent flag. The moment the period number advances (crossing UTC
   *  midnight), this flips back to false on its own — no scheduled reset
   *  process needed, same "resolve lazily when checked" approach the rest
   *  of the engine already uses for offline catch-up. Repeatable jobs never
   *  set this at all, so they're always available regardless of period. */
  isJobCompleted(jobId: string): boolean {
    const completedPeriod = this.state.statistics[`jobCompletedPeriod:${jobId}`];
    if (completedPeriod === undefined) return false;
    return completedPeriod === getDailyPeriodNumber(Date.now());
  }

  /** Accepts a job, at its board's location. Refuses if already accepted,
   *  or (for a one-time job) already completed. */
  acceptJob(job: JobDefinition, boardLocationId: string): boolean {
    if (this.state.currentLocationId !== boardLocationId) {
      this.notifications.push("status", "You need to be at the job board to accept this.", {
        severity: "warning",
      });
      return false;
    }
    if (!job.repeatable && this.isJobCompleted(job.id)) {
      this.notifications.push("status", `You've already completed "${job.title}".`, {
        severity: "warning",
      });
      return false;
    }
    if (this.isJobAccepted(job.id)) {
      this.notifications.push("status", `You've already accepted "${job.title}".`, {
        severity: "warning",
      });
      return false;
    }
    this.state.acceptedJobs[job.id] = {
      acceptedAt: this.state.lastTickTimestamp,
      acceptedPeriod: getDailyPeriodNumber(Date.now()),
    };
    this.notifications.push("status", `Accepted job: ${job.title}.`);
    return true;
  }

  /** Whether a job's objective is currently met — same check used to gate
   *  the turn-in button in the UI and to enforce it here. */
  isJobObjectiveMet(job: JobDefinition): boolean {
    return isUnlocked(job.objective, this.state);
  }

  /** Turns in an accepted job: consumes delivery resources (if any), grants
   *  the reward (GP/achievement points modifier-scaled, items and flags
   *  never scaled), and either permanently marks it done (one-time) or
   *  clears it back to acceptable (repeatable). Must be at the board's
   *  location — same enforcement as accepting. */
  turnInJob(job: JobDefinition, boardLocationId: string): boolean {
    if (this.state.currentLocationId !== boardLocationId) {
      this.notifications.push("status", "You need to be at the job board to turn this in.", {
        severity: "warning",
      });
      return false;
    }
    if (!this.isJobAccepted(job.id)) return false;
    if (!this.isJobObjectiveMet(job)) {
      this.notifications.push("status", `You haven't finished "${job.title}" yet.`, {
        severity: "warning",
      });
      return false;
    }

    if (job.consumesOnTurnIn) {
      for (const cost of job.consumesOnTurnIn) {
        if (this.getResourceAmount(cost.resource) < cost.amount) {
          // Objective and consumption requirements should normally agree,
          // but content could theoretically diverge — fail safe rather
          // than deduct into the negative.
          this.notifications.push("status", `You don't have enough to turn this in.`, {
            severity: "warning",
          });
          return false;
        }
      }
      for (const cost of job.consumesOnTurnIn) {
        this.spendResource(cost.resource, cost.amount);
      }
    }

    if (job.reward?.gp) {
      const scaledGp = this.getModifiedValue("jobReward:gp", job.reward.gp);
      this.ensureResourceExists("gp");
      this.state.resources.gp.amount += scaledGp;
      this.state.resources.gp.lifetimeEarned += scaledGp;
    }
    if (job.reward?.achievementPoints) {
      const scaledPoints = this.getModifiedValue("jobReward:achievementPoints", job.reward.achievementPoints);
      this.ensureResourceExists("achievement-points");
      this.state.resources["achievement-points"].amount += scaledPoints;
      this.state.resources["achievement-points"].lifetimeEarned += scaledPoints;
    }
    if (job.reward?.items) {
      // Deliberately NOT modifier-scaled — a fixed item count is a fixed
      // item count, scaling item rewards would be a dupe/balance risk.
      for (const item of job.reward.items) {
        this.addItem(item.itemDefId, item.quantity, { stackable: item.stackable });
      }
    }
    if (job.reward?.setFlags) {
      // The quest-chaining hook: a job's completion can unlock a building,
      // a location, or another job the exact same way any other flag does.
      for (const flag of job.reward.setFlags) this.setFlag(flag, true);
    }

    delete this.state.acceptedJobs[job.id];
    this.incrementStatistic(`jobCompletions:${job.id}`, 1);
    this.incrementStatistic("jobCompletions:total", 1);
    if (!job.repeatable) {
      this.state.statistics[`jobCompletedPeriod:${job.id}`] = getDailyPeriodNumber(Date.now());
    }

    this.notifications.push("reward", `Turned in "${job.title}".`);
    return true;
  }

  /** Dev tool — immediately unlocks every daily-locked job, without waiting
   *  for the actual UTC reset. Clears the stored completion periods rather
   *  than un-accepting anything currently in progress. */
  devForceJobBoardReset(): void {
    for (const key of Object.keys(this.state.statistics)) {
      if (key.startsWith("jobCompletedPeriod:")) delete this.state.statistics[key];
    }
    this.notifications.push("status", "Dev: job board reset forced.", { severity: "warning" });
  }

  /** Cancels any accepted-but-unfinished job whose acceptance period no
   *  longer matches today — the shift reset, so the job posting is gone,
   *  same flavor as it being picked up by someone else. Uses the REAL
   *  current day (the raw `now` resolveElapsed received, not the
   *  offline-capped effectiveNow) since job resets are wall-clock-based,
   *  same as isJobCompleted/getActiveJobIds elsewhere. */
  private resolveJobExpiry(now: number): void {
    const currentPeriod = getDailyPeriodNumber(now);
    let expiredCount = 0;
    for (const [jobId, record] of Object.entries(this.state.acceptedJobs)) {
      if (record.acceptedPeriod !== currentPeriod) {
        delete this.state.acceptedJobs[jobId];
        expiredCount++;
      }
    }
    if (expiredCount > 0) {
      this.notifications.push(
        "status",
        expiredCount === 1
          ? "An accepted job expired when the board reset."
          : `${expiredCount} accepted jobs expired when the board reset.`,
        { severity: "warning" }
      );
    }
  }

  // ── Serialization ──────────────────────────────────────────────────────

  serialize(): string {
    return JSON.stringify(this.state);
  }

  static deserialize(json: string, notifications?: NotificationQueue): GameEngine {
    let parsed: any = JSON.parse(json);

    const fromVersion = typeof parsed.version === "number" ? parsed.version : 0;
    for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
      const migrate = MIGRATIONS[v];
      if (migrate) parsed = migrate(parsed);
    }

    // Safety net beneath the migration chain: backfill any field still
    // missing after migrations run (covers additive changes that never got
    // an explicit migration entry). Without this, a missing offlineCapMs
    // becomes `undefined`, and Math.min(elapsedMs, undefined) silently
    // evaluates to NaN — which then poisons every downstream calculation
    // without ever throwing an error.
    const withDefaults: GameState = {
      resources: { ...createInitialState().resources, ...(parsed.resources ?? {}) },
      producers: parsed.producers ?? {},
      modifiers: parsed.modifiers ?? {},
      skills: (() => {
        const skills = parsed.skills ?? {};
        const hpXp = skills.hitpoints?.xp ?? 0;
        return { ...skills, hitpoints: { xp: Math.max(hpXp, STARTING_HITPOINTS_XP) } };
      })(),
      flags: parsed.flags ?? {},
      inventory: parsed.inventory ?? {},
      equipment: parsed.equipment ?? {},
      activeCraftJob: parsed.activeCraftJob ?? null,
      currentLocationId: parsed.currentLocationId ?? STARTING_LOCATION_ID,
      activeTravel: parsed.activeTravel ?? null,
      activeGatherSession: parsed.activeGatherSession ?? null,
      currentHp: typeof parsed.currentHp === "number" ? parsed.currentHp : 10,
      activeCombatSession: parsed.activeCombatSession ?? null,
      acceptedJobs: parsed.acceptedJobs ?? {},
      statistics: parsed.statistics ?? {},
      lastTickTimestamp:
        typeof parsed.lastTickTimestamp === "number" ? parsed.lastTickTimestamp : Date.now(),
      offlineCapMs:
        typeof parsed.offlineCapMs === "number" ? parsed.offlineCapMs : DEFAULT_OFFLINE_CAP_MS,
      version: SCHEMA_VERSION,
    };
    return new GameEngine(withDefaults, notifications);
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}