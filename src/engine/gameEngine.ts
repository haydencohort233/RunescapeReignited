import type {
  GameState,
  GameContent,
  BuildingDefinition,
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
  UnlockCondition,
  QuestDefinition,
  ActiveCraftJob,
  ActiveGatherSession,
  ActiveTravel,
  ActiveCombatSession,
} from "./types";
import { NotificationQueue } from "./notificationQueue";
import { levelForXp, xpForLevel, MAX_LEVEL, calculateCombatLevel } from "./xpCurve";
import { isUnlocked, captureBaselines, offsetByBaselines } from "./unlockConditions";
import { getDailyPeriodNumber } from "./time";
import { formatDuration } from "./format";
import {
  AUTO_EAT_BELOW_HP_FRACTION,
  BASE_HP_REGEN_PER_SECOND,
  BUILDING_SELL_REFUND_FRACTION,
  DEFAULT_COST_SCALING_FACTOR,
  DEFAULT_DEATH_GP_LOSS_PERCENT,
  DEFAULT_DEATH_RESOURCE_LOSS_PERCENT,
  DEFAULT_ENEMY_ATTACK_SPEED_MS,
  DEFAULT_GATHER_MAX_DURATION_MS,
  DEFAULT_MS_PER_DISTANCE_UNIT,
  EAT_ATTACK_DELAY_MS,
  ENEMY_RESPAWN_MS,
  SHOP_SELL_PRICE_FRACTION,
  UNARMED_ATTACK_SPEED_MS,
  WEAKNESS_DAMAGE_MULTIPLIER,
} from "./tuning";
import { STARTING_LOCATION_ID, createInitialState } from "./state";
import { migrateSave } from "./migrations";

/** Below this, a gap is just a tab-switch/screen-lock, not a real "away"
 *  session — don't narrate it, even though the simulation still resolves
 *  it correctly either way. */
const MIN_AWAY_MS_FOR_SUMMARY = 60 * 1000; // 1 minute

import { resolveAttack } from "./combatMath";
import { weightedRandomPick } from "./rng";
import { countOwned } from "./ledger";
import {
  describeAction,
  getActiveCombat,
  getActiveCraftJob,
  getActiveGatherSession,
  getActiveTravel,
} from "./activeAction";

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
  /** The engine's only source of wall-clock time. Injectable so tests can
   *  drive time deterministically; every timestamp the engine stores or
   *  compares comes from here, never from Date.now() directly. */
  private readonly clock: () => number;
  /** Static game data (building stats, item definitions). Never saved —
   *  the save holds only player progress, so rebalancing content reaches
   *  existing players on their next load. */
  readonly content: GameContent;
  private readonly buildingsById: Map<string, BuildingDefinition>;
  private readonly itemsById: Map<string, ItemDefinition>;
  private readonly questsById: Map<string, QuestDefinition>;
  /** Non-null only while resolveElapsed() is replaying an away period.
   *  Combat outcomes collect here and go into the one "while you were
   *  away" summary instead of a toast per kill. */
  private catchUp: { kills: Record<string, number>; loot: Record<string, number>; eaten: number } | null = null;

  constructor(
    content: GameContent,
    opts?: { state?: GameState; notifications?: NotificationQueue; clock?: () => number }
  ) {
    this.content = content;
    this.buildingsById = new Map(content.buildings.map((b) => [b.id, b]));
    this.itemsById = new Map(content.items.map((i) => [i.id, i]));
    this.questsById = new Map(content.quests.map((q) => [q.id, q]));
    this.clock = opts?.clock ?? Date.now;
    this.state = opts?.state ?? createInitialState(this.clock());
    this.notifications = opts?.notifications ?? new NotificationQueue();
    this.grantStartingBuildings();
  }

  /** Seeds startingQuantity for any building the save has never had an
   *  entry for (a new game, or a building added to content after this save
   *  was made). An explicit 0 — e.g. one the player sold — is left alone. */
  private grantStartingBuildings(): void {
    for (const def of this.content.buildings) {
      if (this.state.buildings[def.id] === undefined && def.startingQuantity) {
        this.state.buildings[def.id] = def.startingQuantity;
      }
    }
  }

  now(): number {
    return this.clock();
  }

  // ── The single active action (crafting, gathering, travel, combat) ─────

  private get craftJob(): ActiveCraftJob | null {
    return getActiveCraftJob(this.state);
  }

  private get gatherSession(): ActiveGatherSession | null {
    return getActiveGatherSession(this.state);
  }

  private get travel(): ActiveTravel | null {
    return getActiveTravel(this.state);
  }

  private get combatSession(): ActiveCombatSession | null {
    return getActiveCombat(this.state);
  }

  /** Every start* method gates on this, so "one thing at a time" is
   *  enforced in exactly one place — adding a new action kind can't
   *  forget to check the others. */
  private ensureIdle(): boolean {
    const action = this.state.activeAction;
    if (!action) return true;
    this.notifications.push("status", `You're busy ${describeAction(action)} — stop that first.`, {
      severity: "warning",
    });
    return false;
  }

  /** Stops whatever is running, using that action's own stop rules
   *  (crafting refunds, travel returns you to your origin, combat counts
   *  as fleeing and can be refused). Returns false if it couldn't stop. */
  stopActiveAction(): boolean {
    const action = this.state.activeAction;
    if (!action) return true;
    switch (action.kind) {
      case "craft":
        this.cancelCraftJob();
        return true;
      case "gather":
        this.stopGatherSession();
        return true;
      case "travel":
        this.cancelTravel();
        return true;
      case "combat":
        return this.fleeCombat();
    }
  }

  getState(): GameState {
    return this.state;
  }

  /** The raw stacked count (may be fractional for produced resources).
   *  For "does the player have enough", use getOwnedCount, which also
   *  counts non-stackable items. */
  getResourceAmount(resource: ResourceId): number {
    return this.state.resources[resource]?.amount ?? 0;
  }

  /** How many of any id the player owns and could spend — see ledger.ts. */
  getOwnedCount(id: ResourceId): number {
    return countOwned(this.state, id);
  }

  /** Display name for a ledger id — the item's name, or the raw id for
   *  currencies that have no item definition. */
  nameOf(id: ResourceId): string {
    return this.itemsById.get(id)?.name ?? id;
  }

  /** Ids without an item definition (gp, achievement points) are plain
   *  counts, so they stack. */
  private isStackable(id: ResourceId): boolean {
    return this.itemsById.get(id)?.stackable ?? true;
  }

  /** Removes everything in `costs` (times `multiplier`). Callers check
   *  canAfford first; this doesn't re-check. */
  private payFor(costs: RecipeInput[], multiplier = 1): void {
    for (const c of costs) this.removeOwned(c.resource, c.amount * multiplier);
  }

  /** Takes `amount` of an id out of the ledger: from the stack, or by
   *  deleting unequipped instances. Records `${id}:spent` either way. */
  private removeOwned(id: ResourceId, amount: number): void {
    if (amount <= 0) return;
    if (this.isStackable(id)) {
      this.spendResource(id, amount);
      return;
    }
    const worn = new Set(Object.values(this.state.equipment));
    let remaining = amount;
    for (const instance of Object.values(this.state.inventory)) {
      if (remaining <= 0) break;
      if (instance.itemDefId !== id || worn.has(instance.instanceId)) continue;
      delete this.state.inventory[instance.instanceId];
      remaining--;
    }
    this.incrementStatistic(`${id}:spent`, amount - remaining);
  }

  /** Returns something the player already had (a cancelled craft's
   *  materials) without counting it as newly earned. */
  private giveBack(id: ResourceId, amount: number): void {
    if (this.isStackable(id)) this.gainResource(id, amount, { countAsEarned: false });
    else this.addItem(id, amount);
  }

  // ── Buildings ────────────────────────────────────────────────────────

  getBuildingDef(buildingId: string): BuildingDefinition | undefined {
    return this.buildingsById.get(buildingId);
  }

  getBuildingQuantity(buildingId: string): number {
    return this.state.buildings[buildingId] ?? 0;
  }

  /** Total cost of `quantity` units starting from `ownedBefore` already
   *  owned. Shared by buying (from the current count up) and selling (the
   *  last N bought). */
  private getBuildingCostRange(def: BuildingDefinition, ownedBefore: number, quantity: number): RecipeInput[] {
    const scaling = def.costScalingFactor ?? DEFAULT_COST_SCALING_FACTOR;
    // Sum of a geometric series: baseCost * scaling^owned for each unit.
    return (def.baseCost ?? []).map((input) => {
      let total = 0;
      for (let i = 0; i < quantity; i++) {
        total += input.amount * Math.pow(scaling, ownedBefore + i);
      }
      return { resource: input.resource, amount: Math.ceil(total) };
    });
  }

  /** Cost to buy `quantity` more of a building, given how many are already owned.
   *  Returns null if the building has no baseCost (not player-purchasable). */
  getBuildingPurchaseCost(buildingId: string, quantity: number): RecipeInput[] | null {
    const def = this.getBuildingDef(buildingId);
    if (!def || !def.baseCost) return null;
    return this.getBuildingCostRange(def, this.getBuildingQuantity(buildingId), quantity);
  }

  /** What selling the last `quantity` units would refund — a fraction of
   *  what those exact units cost. Null if the building can't be sold. */
  getBuildingSellRefund(buildingId: string, quantity: number): RecipeInput[] | null {
    const def = this.getBuildingDef(buildingId);
    if (!def || !def.baseCost) return null;
    const owned = this.getBuildingQuantity(buildingId);
    if (quantity <= 0 || quantity > owned) return null;
    return this.getBuildingCostRange(def, owned - quantity, quantity).map((c) => ({
      resource: c.resource,
      amount: Math.floor(c.amount * BUILDING_SELL_REFUND_FRACTION),
    }));
  }

  /** Whether a building's unlockCondition (if any) is currently satisfied. */
  isBuildingUnlocked(buildingId: string): boolean {
    const def = this.getBuildingDef(buildingId);
    if (!def) return false;
    if (!def.unlockCondition) return true;
    return isUnlocked(def.unlockCondition, this.state);
  }

  /** Buys `quantity` more of a building at the scaled cost, if affordable,
   *  unlocked, and under its maxOwned limit. `bypassUnlock` is for
   *  dev/cheat tooling only — normal player-facing purchase flows should
   *  never pass it. */
  purchaseBuilding(buildingId: string, quantity = 1, opts?: { bypassUnlock?: boolean }): boolean {
    const def = this.getBuildingDef(buildingId);
    if (!def || quantity <= 0) return false;

    if (!opts?.bypassUnlock && !this.isBuildingUnlocked(buildingId)) {
      this.notifications.push("status", `${def.name} isn't available yet.`, {
        severity: "warning",
      });
      return false;
    }

    const owned = this.getBuildingQuantity(buildingId);
    if (def.maxOwned !== undefined && owned + quantity > def.maxOwned) {
      this.notifications.push("status", `You can only own ${def.maxOwned}x ${def.name}.`, {
        severity: "warning",
      });
      return false;
    }

    const cost = this.getBuildingPurchaseCost(buildingId, quantity);
    if (!cost) {
      // No baseCost defined — treat as free/not purchasable via this path.
      return false;
    }

    const short = cost.find((c) => this.getOwnedCount(c.resource) < c.amount);
    if (short) {
      this.notifications.push(
        "status",
        `Not enough ${this.nameOf(short.resource)} to buy ${quantity}x ${def.name}.`,
        { severity: "warning" }
      );
      return false;
    }

    this.payFor(cost);
    this.state.buildings[buildingId] = owned + quantity;
    this.incrementStatistic("buildingsBought:total", quantity);
    this.incrementStatistic(`buildingsBought:${buildingId}`, quantity);
    this.notifications.push("status", `Purchased ${quantity}x ${def.name}.`);
    return true;
  }

  /** Sells the last `quantity` units for BUILDING_SELL_REFUND_FRACTION of
   *  what they cost, which also brings the next purchase price back down. */
  sellBuilding(buildingId: string, quantity = 1): boolean {
    const def = this.getBuildingDef(buildingId);
    const refund = this.getBuildingSellRefund(buildingId, quantity);
    if (!def || !refund) return false;
    for (const r of refund) this.giveBack(r.resource, r.amount);
    this.state.buildings[buildingId] = this.getBuildingQuantity(buildingId) - quantity;
    this.incrementStatistic("buildingsSold:total", quantity);
    this.notifications.push(
      "status",
      `Sold ${quantity}x ${def.name} for ${refund.map((r) => `${r.amount} ${r.resource}`).join(", ")}.`
    );
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
    for (const def of this.content.buildings) {
      if (def.resource === resource) {
        base += def.baseRatePerSecond * this.getBuildingQuantity(def.id);
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

    if (!this.ensureIdle()) return false;

    const short = recipe.inputs.find((input) => this.getOwnedCount(input.resource) < input.amount * quantity);
    if (short) {
      this.notifications.push(
        "status",
        `Not enough ${this.nameOf(short.resource)} to make ${quantity}x ${recipe.name}.`,
        { severity: "warning" }
      );
      return false;
    }

    this.payFor(recipe.inputs, quantity);

    this.state.activeAction = {
      kind: "craft",
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
    const job = this.craftJob;
    if (!job) return;
    const remaining = job.quantityTotal - job.quantityCompleted;
    for (const input of job.inputsPerItem) {
      this.giveBack(input.resource, input.amount * remaining);
    }
    this.state.activeAction = null;
    this.notifications.push("status", `Cancelled crafting ${job.recipeName}. Unused materials refunded.`);
  }

  /** Resolve craft-job completions up to `effectiveNow`. Internal — called from resolveElapsed(). */
  private resolveCraftJob(effectiveNow: number): void {
    const job = this.craftJob;
    if (!job) return;

    const elapsedSinceStart = effectiveNow - job.startedAt;
    const completedByNow = Math.min(
      job.quantityTotal,
      Math.floor(elapsedSinceStart / job.timePerItemMs)
    );
    const newCompletions = completedByNow - job.quantityCompleted;
    if (newCompletions <= 0) return;

    this.addItem(job.output.resource, job.output.amount * newCompletions);

    this.addSkillXp(job.skill, job.xpPerItem * newCompletions);
    this.incrementStatistic(`crafted:${job.recipeId}`, newCompletions);

    job.quantityCompleted = completedByNow;

    // One toast per job, updated in place as it progresses — a 30-item
    // batch used to leave 30 separate toasts behind.
    const replaceKey = "craft-progress";
    if (job.quantityCompleted >= job.quantityTotal) {
      this.notifications.push(
        "production",
        `Made x${job.quantityTotal} ${job.recipeName} (+${job.xpPerItem * job.quantityTotal} ${capitalize(job.skill)} XP)`,
        { replaceKey }
      );
      this.state.activeAction = null;
    } else {
      this.notifications.push(
        "production",
        `Made ${job.quantityCompleted}/${job.quantityTotal} ${job.recipeName} so far (+${job.xpPerItem * job.quantityCompleted} ${capitalize(job.skill)} XP)`,
        { replaceKey }
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

    if (!this.ensureIdle()) return false;

    const now = this.state.lastTickTimestamp;
    this.state.activeAction = {
      kind: "gather",
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
    const session = this.gatherSession;
    if (!session) return;
    this.state.activeAction = null;
    this.notifications.push(
      "status",
      `Stopped gathering ${session.recipeName}. Gathered ${session.quantityGathered.toLocaleString()} total.`
    );
  }

  /** Resets the keep-alive clock — call this from a "tend to it" UI action.
   *  Returns false if there's no session, or the session doesn't require
   *  keep-alives (nothing to reset). Uses the engine clock rather than the
   *  lastTickTimestamp anchor, since this is a live player action, not
   *  something resolved retroactively during offline catch-up. */
  keepGatherSessionAlive(): boolean {
    const session = this.gatherSession;
    if (!session || session.requiresKeepAliveEveryMs === undefined) return false;
    session.lastKeepAliveAt = this.clock();
    return true;
  }

  /** Resolve gathering progress up to `effectiveNow`. Internal — called from
   *  resolveElapsed(). Mirrors resolveCraftJob's "completedByNow = floor(elapsed
   *  / timePerItem)" approach, except the cap is a TIME cutoff (whichever is
   *  sooner: maxDurationMs, or a missed keep-alive) instead of a fixed quantity. */
  private resolveGatherSession(effectiveNow: number): void {
    const session = this.gatherSession;
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
      this.addItem(session.output.resource, session.output.amount * newCompletions);
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
      this.state.activeAction = null;
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
    if (this.state.currentLocationId === to.id) {
      this.notifications.push("status", `You're already at ${to.name}.`, { severity: "warning" });
      return false;
    }
    if (to.unlockCondition && !isUnlocked(to.unlockCondition, this.state)) {
      this.notifications.push("status", `You can't travel to ${to.name} yet.`, { severity: "warning" });
      return false;
    }
    if (!this.ensureIdle()) return false;

    const durationMs = this.getTravelDurationEstimate(from, to, opts);

    this.state.activeAction = {
      kind: "travel",
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
    const travel = this.travel;
    if (!travel) return;
    this.state.activeAction = null;
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
    // Teleporting interrupts whatever you were doing, same as OSRS — but it
    // can't be used to escape a fight you aren't allowed to flee.
    if (this.state.activeAction && !this.stopActiveAction()) return false;
    this.state.currentLocationId = destination.id;
    this.arriveAt(destination.id, destination.name, destination.onArriveSetFlag);
    this.notifications.push("status", `You teleport to ${destination.name} using ${def.name}.`);
    return true;
  }

  /** Resolve travel completion up to `effectiveNow`. Internal — called from resolveElapsed(). */
  private resolveTravel(effectiveNow: number): void {
    const travel = this.travel;
    if (!travel) return;
    if (effectiveNow >= travel.startedAt + travel.durationMs) {
      this.state.currentLocationId = travel.destinationLocationId;
      this.state.activeAction = null;
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
  resolveElapsed(now: number = this.clock()): void {
    const from = this.state.lastTickTimestamp;
    const elapsedMs = now - from;

    if (elapsedMs <= 0) {
      // Clock went backwards (system clock change) or no time passed — don't
      // apply negative production, just resync the anchor.
      this.state.lastTickTimestamp = now;
      return;
    }

    const wasOffline = elapsedMs > MIN_AWAY_MS_FOR_SUMMARY;
    this.catchUp = wasOffline ? { kills: {}, loot: {}, eaten: 0 } : null;
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
    const producedResources = new Set([
      ...Object.keys(this.state.resources),
      ...this.content.buildings.map((b) => b.resource),
    ]);
    for (const resourceId of producedResources) {
      const rate = this.getEffectiveRatePerSecond(resourceId);
      const gained = rate * (cappedMs / 1000);
      if (gained > 0) gains[resourceId] = gained;
    }

    for (const [resourceId, gained] of Object.entries(gains)) {
      this.gainResource(resourceId, gained);
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
    const wasInCombatThisTick = this.combatSession !== null;
    this.resolveCombatSession(effectiveNow);
    if (!wasInCombatThisTick) this.resolveHpRegen(cappedMs);
    this.resolveJobExpiry(now);
    this.checkQuests();
    this.syncDerivedStatistics();

    // Time beyond the offline cap never happened as far as the simulation
    // is concerned. Production is delta-based so it already respects the
    // cap, but every in-progress action measures from an absolute anchor
    // (startedAt etc.) — without shifting those forward by the skipped
    // time, the very next tick would compute `now - startedAt` and pay out
    // everything the cap just withheld.
    const skippedMs = elapsedMs - cappedMs;
    if (skippedMs > 0) this.shiftActionAnchors(skippedMs);

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
      const fought = this.catchUp && Object.keys(this.catchUp.kills).length > 0;
      if (levelUps.length > 0 || Object.keys(gains).length > 0 || fought) {
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
    this.catchUp = null;
  }

  private shiftActionAnchors(ms: number): void {
    const action = this.state.activeAction;
    if (!action) return;
    switch (action.kind) {
      case "craft":
      case "travel":
        action.startedAt += ms;
        break;
      case "gather":
        action.startedAt += ms;
        if (action.lastKeepAliveAt !== undefined) action.lastKeepAliveAt += ms;
        break;
      case "combat":
        action.playerStartedAt += ms;
        action.enemyStartedAt += ms;
        break;
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

    if (this.catchUp) {
      for (const [enemyName, kills] of Object.entries(this.catchUp.kills)) {
        parts.push(`${kills} ${enemyName} ${kills === 1 ? "kill" : "kills"}`);
      }
      for (const [id, amount] of Object.entries(this.catchUp.loot)) {
        parts.push(`${amount.toLocaleString()} ${this.nameOf(id)}`);
      }
      if (this.catchUp.eaten > 0) parts.push(`(ate ${this.catchUp.eaten} food)`);
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

  /** Adds `quantity` of any ledger id. Stackable ids (and currencies) go
   *  into the stacked count; non-stackable items get one instance each,
   *  whose ids are returned. A `unique` item refuses a second copy if one
   *  is already owned anywhere, worn or not. */
  addItem(itemDefId: string, quantity: number): string[] {
    if (quantity <= 0) return [];
    const def = this.itemsById.get(itemDefId);

    if (def?.unique) {
      const alreadyOwned =
        this.getResourceAmount(itemDefId) > 0 ||
        Object.values(this.state.inventory).some((i) => i.itemDefId === itemDefId);
      if (alreadyOwned) {
        this.notifications.push("status", `You can only own one ${def.name}.`, { severity: "warning" });
        return [];
      }
      quantity = 1;
    }

    if (this.isStackable(itemDefId)) {
      this.gainResource(itemDefId, quantity);
      return [];
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
    return `item-${this.clock()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  getInventoryItems(): ItemInstance[] {
    return Object.values(this.state.inventory);
  }

  isEquipped(instanceId: string): boolean {
    return Object.values(this.state.equipment).includes(instanceId);
  }

  /** Equips an item, unequipping whatever was already in that slot (if anything).
   *  Refuses if the item has an unmet equipRequirement (e.g. an Attack level) —
   *  same "engine enforces it, not just the UI" pattern as purchaseBuilding. */
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

  /** Removes one item instance entirely — from inventory and, if worn,
   *  its equipment slot. Stacks use dropStack. */
  dropItem(def: ItemDefinition, instanceId: string): void {
    if (!this.state.inventory[instanceId]) return;
    for (const [slot, id] of Object.entries(this.state.equipment)) {
      if (id === instanceId) delete this.state.equipment[slot as keyof GameState["equipment"]];
    }
    delete this.state.inventory[instanceId];
    this.notifications.push("status", `Dropped ${def.name}.`);
  }

  /** Drops a whole stack (no partial-quantity drop yet — a "drop X"
   *  prompt is a fine future addition). Not counted as spending. */
  dropStack(itemDefId: string): void {
    const amount = Math.floor(this.getResourceAmount(itemDefId));
    if (amount <= 0) return;
    this.state.resources[itemDefId].amount -= amount;
    this.notifications.push("status", `Dropped ${amount.toLocaleString()}x ${this.nameOf(itemDefId)}.`);
  }

  /** Eats one unit of a food item, healing its healAmount (scaled by
   *  "healing" modifiers). Works mid-fight, at the cost of delaying your
   *  next attack by EAT_ATTACK_DELAY_MS. */
  eatItem(itemDefId: string): boolean {
    const def = this.itemsById.get(itemDefId);
    if (!def?.healAmount || this.getOwnedCount(itemDefId) < 1) return false;
    this.removeOwned(itemDefId, 1);
    const before = this.getCurrentHp();
    this.healHp(this.getModifiedValue("healing", def.healAmount));
    const healed = Math.floor(this.getCurrentHp() - before);

    const session = this.combatSession;
    if (session) session.playerStartedAt += EAT_ATTACK_DELAY_MS;

    this.incrementStatistic(`eaten:${itemDefId}`, 1);
    if (this.catchUp) this.catchUp.eaten++;
    else this.notifications.push("status", `You eat the ${def.name}. It heals ${healed} HP.`);
    return true;
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
      const available = this.getOwnedCount(cost.resource);
      max = Math.min(max, Math.floor(available / cost.amount));
    }
    return Number.isFinite(max) ? Math.max(0, max) : 0;
  }

  /** Buys `quantity` of an item from a shop. Enforces that the player is
   *  actually AT the shop's location (not just a UI-hidden check) — same
   *  "engine enforces it, not just the UI" pattern as purchaseBuilding and
   *  equipItem. `price` is a RecipeInput[] (almost always just GP today,
   *  but works unchanged for a resource-priced item or, later, trading). */
  buyFromShop(
    shopLocationId: string,
    itemDefId: string,
    price: RecipeInput[],
    quantity: number
  ): boolean {
    if (quantity <= 0) return false;
    const itemName = this.nameOf(itemDefId);

    if (this.state.currentLocationId !== shopLocationId) {
      this.notifications.push("status", "You need to be at the shop to buy from it.", {
        severity: "warning",
      });
      return false;
    }

    const short = price.find((c) => this.getOwnedCount(c.resource) < c.amount * quantity);
    if (short) {
      this.notifications.push(
        "status",
        `Not enough ${this.nameOf(short.resource)} to buy ${quantity}x ${itemName}.`,
        { severity: "warning" }
      );
      return false;
    }

    this.payFor(price, quantity);
    this.addItem(itemDefId, quantity);
    this.incrementStatistic(`shopPurchases:${itemDefId}`, quantity);
    this.notifications.push("status", `Bought ${quantity}x ${itemName}.`);
    return true;
  }

  /** What a shop pays per unit (at least 1 GP for anything with a value),
   *  or 0 if the item can't be sold. */
  getShopSellPrice(itemDefId: string): number {
    const value = this.itemsById.get(itemDefId)?.value ?? 0;
    if (value <= 0) return 0;
    return Math.max(1, Math.floor(value * SHOP_SELL_PRICE_FRACTION));
  }

  /** Sells `quantity` of an item to the shop the player is standing at.
   *  Worn equipment is never sold (getOwnedCount excludes it). */
  sellToShop(shopLocationId: string, itemDefId: string, quantity: number): boolean {
    if (quantity <= 0) return false;
    if (this.state.currentLocationId !== shopLocationId) {
      this.notifications.push("status", "You need to be at the shop to sell to it.", { severity: "warning" });
      return false;
    }
    const unitPrice = this.getShopSellPrice(itemDefId);
    if (unitPrice <= 0) {
      this.notifications.push("status", `The shop won't buy ${this.nameOf(itemDefId)}.`, { severity: "warning" });
      return false;
    }
    if (this.getOwnedCount(itemDefId) < quantity) return false;

    this.removeOwned(itemDefId, quantity);
    const total = unitPrice * quantity;
    this.gainResource("gp", total);
    this.incrementStatistic(`shopSales:${itemDefId}`, quantity);
    this.notifications.push("status", `Sold ${quantity}x ${this.nameOf(itemDefId)} for ${total.toLocaleString()} GP.`);
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
    if (this.combatSession) return;
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
    if (!this.ensureIdle()) return false;
    if (this.getCurrentHp() <= 0) {
      this.notifications.push("status", "You need to heal before fighting.", { severity: "warning" });
      return false;
    }

    const now = this.state.lastTickTimestamp;
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
      playerAttackSpeedMs: equipmentBonus.attackSpeedMs ?? UNARMED_ATTACK_SPEED_MS,
      enemyAttackSpeedMs: enemy.attackSpeedMs ?? DEFAULT_ENEMY_ATTACK_SPEED_MS,
      playerStartedAt: now,
      enemyStartedAt: now,
      playerAttacksResolved: 0,
      enemyAttacksResolved: 0,
      autoRepeat: opts?.autoRepeat ?? false,
      autoEatItemId: opts?.autoEatItemId,
      kills: 0,
      log: [],
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
    const now = this.clock();
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
    damage: number
  ): void {
    const outcome: "miss" | "block" | "hit" = !hit ? "miss" : damage <= 0 ? "block" : "hit";
    session.log.push({ timestamp: this.clock(), attacker, outcome, damage });
    if (session.log.length > GameEngine.COMBAT_LOG_LIMIT) session.log.shift();
  }

  /** One player attack. May end the session (victory) — callers must
   *  re-check this.combatSession afterward. */
  private resolvePlayerAttack(session: ActiveCombatSession, at: number): void {
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
      this.grantCombatVictory(session, at);
    }
  }

  /** One enemy attack. May end the session (defeat) — callers must
   *  re-check this.combatSession afterward. */
  private resolveEnemyAttack(session: ActiveCombatSession): void {
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
      return;
    }
    this.maybeAutoEat(session);
  }

  private grantCombatVictory(session: ActiveCombatSession, at: number): void {
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
      if (drop.id) {
        const quantity =
          drop.quantityMin !== undefined && drop.quantityMax !== undefined
            ? drop.quantityMin + Math.floor(Math.random() * (drop.quantityMax - drop.quantityMin + 1))
            : 1;
        this.addItem(drop.id, quantity);
        if (this.catchUp) this.catchUp.loot[drop.id] = (this.catchUp.loot[drop.id] ?? 0) + quantity;
        // <id> tags render as item icons in RichText; currencies have no
        // item definition, so they're written out plainly.
        lootMessages.push(this.itemsById.has(drop.id) ? `${quantity}x <${drop.id}>` : `${quantity} ${drop.id}`);
      }
    }

    session.kills++;
    if (this.catchUp) {
      this.catchUp.kills[session.enemyName] = (this.catchUp.kills[session.enemyName] ?? 0) + 1;
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
    const healthy = this.getCurrentHp() >= this.getMaxHp() * AUTO_EAT_BELOW_HP_FRACTION;
    const hasFood = !!session.autoEatItemId && this.getOwnedCount(session.autoEatItemId) >= 1;
    return healthy || hasFood;
  }

  private maybeAutoEat(session: ActiveCombatSession): void {
    const foodId = session.autoEatItemId;
    if (!foodId) return;
    if (this.getCurrentHp() >= this.getMaxHp() * AUTO_EAT_BELOW_HP_FRACTION) return;
    if (!this.eatItem(foodId)) {
      session.autoEatItemId = undefined;
      this.notifications.push("status", `You've run out of ${this.nameOf(foodId)}.`, { severity: "warning" });
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
  private resolveCombatSession(effectiveNow: number): void {
    let session = this.combatSession;
    if (!session) return;

    while (session) {
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
        this.resolveEnemyAttack(session);
      }
      session = this.combatSession;
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
    this.state = createInitialState(this.clock());
    this.grantStartingBuildings();
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
  /** Adds to a resource. `countAsEarned: false` is for refunds, which give
   *  back what was already yours rather than counting toward lifetime
   *  milestones like "earned 100 GP". */
  private gainResource(resourceId: ResourceId, amount: number, opts?: { countAsEarned?: boolean }): void {
    if (amount <= 0) return;
    this.ensureResourceExists(resourceId);
    this.state.resources[resourceId].amount += amount;
    if (opts?.countAsEarned !== false) this.state.resources[resourceId].lifetimeEarned += amount;
  }

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
        this.addItem(item.itemDefId, item.quantity);
      }
    }

    this.setFlag(`achievementClaimed:${achievement.id}`, true);
    this.notifications.push("reward", `Claimed reward for ${achievement.name}.`);
    return true;
  }

  // ── Job board ────────────────────────────────────────────────────────

  isJobAccepted(jobId: string): boolean {
    return !!this.state.jobs.accepted[jobId];
  }

  /** Whether the job is done and not currently offerable — see
   *  JobDefinition.frequency. Daily completion is checked by comparing the
   *  stored period to today's, so it flips back on its own at UTC midnight
   *  with no scheduled reset process. */
  isJobCompleted(job: JobDefinition): boolean {
    const frequency = job.frequency ?? "daily";
    if (frequency === "repeatable") return false;
    if (frequency === "once") return !!this.state.jobs.completedOnce[job.id];
    return this.state.jobs.lastCompletedPeriod[job.id] === getDailyPeriodNumber(this.clock());
  }

  /** Accepts a job, at its board's location. Refuses if already accepted,
   *  or already completed (see isJobCompleted). Snapshots any counters the
   *  objective reads, so progress counts from now. */
  acceptJob(job: JobDefinition, boardLocationId: string): boolean {
    if (this.state.currentLocationId !== boardLocationId) {
      this.notifications.push("status", "You need to be at the job board to accept this.", {
        severity: "warning",
      });
      return false;
    }
    if (this.isJobCompleted(job)) {
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
    this.state.jobs.accepted[job.id] = {
      acceptedAt: this.state.lastTickTimestamp,
      acceptedPeriod: getDailyPeriodNumber(this.clock()),
      baselines: captureBaselines(job.objective, this.state),
    };
    this.notifications.push("status", `Accepted job: ${job.title}.`);
    return true;
  }

  /** The job's objective as it applies right now: for an accepted job,
   *  counters are measured from when it was accepted. */
  getJobObjective(job: JobDefinition): UnlockCondition {
    const accepted = this.state.jobs.accepted[job.id];
    return accepted ? offsetByBaselines(job.objective, accepted.baselines) : job.objective;
  }

  /** Whether a job's objective is currently met — same check used to gate
   *  the turn-in button in the UI and to enforce it here. */
  isJobObjectiveMet(job: JobDefinition): boolean {
    return isUnlocked(this.getJobObjective(job), this.state);
  }

  /** Turns in an accepted job: consumes deliveries (if any), grants the
   *  reward (GP/achievement points modifier-scaled, items and flags never
   *  scaled), and records completion per the job's frequency. Must be at
   *  the board's location — same enforcement as accepting. */
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
        if (this.getOwnedCount(cost.resource) < cost.amount) {
          // Objective and consumption requirements should normally agree,
          // but content could theoretically diverge — fail safe rather
          // than deduct into the negative.
          this.notifications.push("status", `You don't have enough to turn this in.`, {
            severity: "warning",
          });
          return false;
        }
      }
      this.payFor(job.consumesOnTurnIn);
    }

    if (job.reward?.gp) {
      this.gainResource("gp", this.getModifiedValue("jobReward:gp", job.reward.gp));
    }
    if (job.reward?.achievementPoints) {
      this.gainResource(
        "achievement-points",
        this.getModifiedValue("jobReward:achievementPoints", job.reward.achievementPoints)
      );
    }
    if (job.reward?.items) {
      // Deliberately NOT modifier-scaled — a fixed item count is a fixed
      // item count, scaling item rewards would be a dupe/balance risk.
      for (const item of job.reward.items) {
        this.addItem(item.itemDefId, item.quantity);
      }
    }
    if (job.reward?.setFlags) {
      // The quest-chaining hook: a job's completion can unlock a building,
      // a location, or another job the exact same way any other flag does.
      for (const flag of job.reward.setFlags) this.setFlag(flag, true);
    }

    delete this.state.jobs.accepted[job.id];
    this.incrementStatistic(`jobCompletions:${job.id}`, 1);
    this.incrementStatistic("jobCompletions:total", 1);
    const frequency = job.frequency ?? "daily";
    if (frequency === "daily") {
      this.state.jobs.lastCompletedPeriod[job.id] = getDailyPeriodNumber(this.clock());
    } else if (frequency === "once") {
      this.state.jobs.completedOnce[job.id] = true;
    }

    this.notifications.push("reward", `Turned in "${job.title}".`);
    return true;
  }

  /** Dev tool — immediately unlocks every daily job, without waiting for
   *  the actual UTC reset. "once" jobs stay done; nothing in progress is
   *  un-accepted. */
  devForceJobBoardReset(): void {
    this.state.jobs.lastCompletedPeriod = {};
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
    for (const [jobId, record] of Object.entries(this.state.jobs.accepted)) {
      if (record.acceptedPeriod !== currentPeriod) {
        delete this.state.jobs.accepted[jobId];
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

  // ── Quests ───────────────────────────────────────────────────────────

  getQuestStatus(questId: string): "not-started" | "in-progress" | "completed" {
    const progress = this.state.quests[questId];
    const def = this.questsById.get(questId);
    if (!progress || !def) return "not-started";
    return progress.stage >= def.stages.length ? "completed" : "in-progress";
  }

  canStartQuest(questId: string): boolean {
    const def = this.questsById.get(questId);
    if (!def || this.state.quests[questId]) return false;
    return !def.startCondition || isUnlocked(def.startCondition, this.state);
  }

  startQuest(questId: string): boolean {
    const def = this.questsById.get(questId);
    if (!def || !this.canStartQuest(questId)) return false;
    this.state.quests[questId] = { stage: 0, baselines: captureBaselines(def.stages[0].objective, this.state) };
    this.notifications.push("quest", `Quest started: ${def.name}. ${def.stages[0].description}`);
    this.checkQuests(); // a first stage might already be met
    return true;
  }

  /** The current stage's objective, with counters measured from when the
   *  stage began. Null if the quest isn't in progress. */
  getQuestObjective(questId: string): UnlockCondition | null {
    const def = this.questsById.get(questId);
    const progress = this.state.quests[questId];
    if (!def || !progress || progress.stage >= def.stages.length) return null;
    return offsetByBaselines(def.stages[progress.stage].objective, progress.baselines);
  }

  isQuestStageMet(questId: string): boolean {
    const objective = this.getQuestObjective(questId);
    return !!objective && isUnlocked(objective, this.state);
  }

  /** Hands over the current stage's delivery and moves on. Only for
   *  stages with `consumes`; others advance by themselves (checkQuests). */
  advanceQuest(questId: string): boolean {
    const def = this.questsById.get(questId);
    const progress = this.state.quests[questId];
    if (!def || !progress || !this.isQuestStageMet(questId)) return false;
    const stage = def.stages[progress.stage];
    const consumes = stage.consumes ?? [];
    if (consumes.some((c) => this.getOwnedCount(c.resource) < c.amount)) {
      this.notifications.push("status", "You don't have everything to hand over yet.", { severity: "warning" });
      return false;
    }
    this.payFor(consumes);
    this.completeQuestStage(def);
    this.checkQuests();
    return true;
  }

  /** Advances every in-progress quest whose current stage is met and
   *  doesn't need a hand-over. Runs once per tick. */
  private checkQuests(): void {
    for (const [questId, progress] of Object.entries(this.state.quests)) {
      const def = this.questsById.get(questId);
      if (!def) continue;
      while (progress.stage < def.stages.length) {
        const stage = def.stages[progress.stage];
        if (stage.consumes?.length || !this.isQuestStageMet(questId)) break;
        this.completeQuestStage(def);
      }
    }
  }

  private completeQuestStage(def: QuestDefinition): void {
    const progress = this.state.quests[def.id];
    progress.stage++;
    const next = def.stages[progress.stage];
    if (next) {
      progress.baselines = captureBaselines(next.objective, this.state);
      this.notifications.push("quest", `${def.name}: ${next.description}`);
      return;
    }

    progress.baselines = {};
    const reward = def.reward;
    if (reward?.gp) this.gainResource("gp", reward.gp);
    for (const item of reward?.items ?? []) this.addItem(item.itemDefId, item.quantity);
    for (const [skillId, xp] of Object.entries(reward?.xp ?? {})) this.addSkillXp(skillId, xp);
    for (const flag of reward?.setFlags ?? []) this.setFlag(flag, true);
    this.incrementStatistic("questsCompleted", 1);
    this.notifications.push("quest", `Quest complete: ${def.name}!`);
  }

  // ── Serialization ──────────────────────────────────────────────────────

  serialize(): string {
    return JSON.stringify(this.state);
  }

  static deserialize(
    json: string,
    content: GameContent,
    opts?: { notifications?: NotificationQueue; clock?: () => number }
  ): GameEngine {
    const clock = opts?.clock ?? Date.now;

    const state = migrateSave(JSON.parse(json), clock());
    return new GameEngine(content, { state, notifications: opts?.notifications, clock });
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}