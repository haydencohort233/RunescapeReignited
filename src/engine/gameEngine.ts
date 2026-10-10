import type {
  ResourceId,
  BuildingDefinition,
  GameContent,
  Modifier,
  WeaponType,
  ItemDefinition,
  ItemInstance,
  MapLocation,
  GameState,
  RecipeInput,
  UnlockCondition,
  AchievementDefinition,
  JobDefinition,
  CraftingRecipe,
  ActiveCombatSession,
  EnemyDefinition,
} from "./types";
import { NotificationQueue } from "./notificationQueue";
import { levelForXp, xpForLevel, MAX_LEVEL, calculateCombatLevel } from "./xpCurve";
import { isUnlocked } from "./unlockConditions";
import { formatDuration, capitalize } from "./format";
import { SHOP_SELL_PRICE_FRACTION, EAT_ATTACK_DELAY_MS, BASE_HP_REGEN_PER_SECOND } from "./tuning";
import { createInitialState } from "./state";
import { migrateSave } from "./migrations";
import { countOwned, isWholeQuantity } from "./ledger";
import { describeAction, getActiveCombat } from "./activeAction";
import { BuildingSystem } from "./systems/buildings";
import { CraftingSystem } from "./systems/crafting";
import { TravelSystem } from "./systems/travel";
import { CombatSystem } from "./systems/combat";
import { JobBoardSystem } from "./systems/jobs";
import { QuestSystem } from "./systems/quests";

/** Below this, a gap is just a tab-switch/screen-lock, not a real "away"
 *  session — don't narrate it, even though the simulation still resolves
 *  it correctly either way. */
const MIN_AWAY_MS_FOR_SUMMARY = 60 * 1000; // 1 minute

/** Display names for ledger ids that have no item definition. */
const CURRENCY_NAMES: Record<string, string> = { gp: "GP", "achievement-points": "Achievement Points" };

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
 *
 * Each game system (buildings, crafting, travel, combat, jobs, quests)
 * lives in engine/systems/ and is reached through the forwarding methods
 * near the bottom of this class. Shared helpers the systems call
 * (gainResource, payFor, incrementStatistic, ...) are non-private for that
 * reason; UI code should stick to the player-facing methods.
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
  readonly itemsById: Map<string, ItemDefinition>;
  private readonly buildingSystem: BuildingSystem;
  private readonly craftingSystem: CraftingSystem;
  private readonly travelSystem: TravelSystem;
  private readonly combatSystem: CombatSystem;
  private readonly jobBoardSystem: JobBoardSystem;
  private readonly questSystem: QuestSystem;
  /** Non-null only while resolveElapsed() is replaying an away period.
   *  Combat outcomes collect here and go into the one "while you were
   *  away" summary instead of a toast per kill. */
  catchUp: { kills: Record<string, number>; eaten: number } | null = null;

  constructor(
    content: GameContent,
    opts?: { state?: GameState; notifications?: NotificationQueue; clock?: () => number }
  ) {
    this.content = content;
    this.itemsById = new Map(content.items.map((i) => [i.id, i]));
    this.buildingSystem = new BuildingSystem(this);
    this.craftingSystem = new CraftingSystem(this);
    this.travelSystem = new TravelSystem(this);
    this.combatSystem = new CombatSystem(this);
    this.jobBoardSystem = new JobBoardSystem(this);
    this.questSystem = new QuestSystem(this);
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

  /** Resolves any time that has passed since the last tick. Every player
   *  action that sets a timing anchor or a baseline calls this first: if
   *  the last tick is stale (a laptop waking from sleep, a throttled tab),
   *  an action started at the real time and THEN caught up past the offline
   *  cap would have its anchor shifted into the future and sit frozen. */
  catchUpToNow(): void {
    if (this.clock() !== this.state.lastTickTimestamp) this.resolveElapsed();
  }

  // ── The single active action (crafting, gathering, travel, combat) ─────

  private get combatSession(): ActiveCombatSession | null {
    return getActiveCombat(this.state);
  }

  /** Every start* method gates on this, so "one thing at a time" is
   *  enforced in exactly one place — adding a new action kind can't
   *  forget to check the others. */
  ensureIdle(): boolean {
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
    return this.itemsById.get(id)?.name ?? CURRENCY_NAMES[id] ?? id;
  }

  /** Ids without an item definition (gp, achievement points) are plain
   *  counts, so they stack. */
  private isStackable(id: ResourceId): boolean {
    return this.itemsById.get(id)?.stackable ?? true;
  }

  /** Removes everything in `costs` (times `multiplier`). Callers check
   *  getOwnedCount first; this doesn't re-check. */
  payFor(costs: RecipeInput[], multiplier = 1): void {
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
  giveBack(id: ResourceId, amount: number): void {
    if (this.isStackable(id)) this.gainResource(id, amount, { countAsEarned: false });
    else this.addItem(id, amount);
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
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!this.state.skills[skillId]) this.state.skills[skillId] = { xp: 0 };
    // XP is modifier-scalable — an "xp:woodcutting" buff affects just this
    // skill, an "xp:all" buff affects every skill's gains.
    const scaledAmount = this.getModifiedValue(`xp:${skillId}`, amount);
    if (!Number.isFinite(scaledAmount) || scaledAmount <= 0) return;
    this.state.skills[skillId].xp += scaledAmount;
    // No notification here on purpose — resolveElapsed snapshots levels
    // before/after and decides how to report level-ups (see comment there).
    // Pushing one here meant a burst of many small ticks in a row (a
    // backgrounded-but-still-live tab is the common case, not just a true
    // offline catch-up) could stack up a dozen undismissed "level up"
    // toasts, since each one persists until dismissed.
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
      // apply negative production, just resync. Action anchors move back by
      // the same amount, so an in-progress craft or fight carries on from
      // where it was instead of stalling until the clock catches up.
      if (elapsedMs < 0) this.shiftActionAnchors(elapsedMs);
      this.state.lastTickTimestamp = now;
      return;
    }

    const wasOffline = elapsedMs > MIN_AWAY_MS_FOR_SUMMARY;
    this.catchUp = wasOffline ? { kills: {}, eaten: 0 } : null;
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

    // Snapshot holdings so the away summary can report everything gained
    // (production, gathering, crafting, loot), not just building output.
    const holdingsBefore = wasOffline ? this.snapshotHoldings() : null;

    const levelsBefore: Record<string, number> = {};
    for (const skillId of Object.keys(this.state.skills)) {
      levelsBefore[skillId] = this.getSkillLevel(skillId);
    }

    const gains: Record<ResourceId, number> = {};
    // Only things something produces: building outputs, plus anything an
    // additive modifier targets directly (a "+1 GP/s" buff with no
    // building). Iterating every stack would also let a future modifier
    // targeting "all" mint bones and food each second.
    const producedResources = new Set(this.content.buildings.map((b) => b.resource));
    for (const m of Object.values(this.state.modifiers)) {
      if (m.type === "additive" && m.target !== "all" && !m.target.includes(":")) producedResources.add(m.target);
    }
    for (const resourceId of producedResources) {
      const rate = this.getEffectiveRatePerSecond(resourceId);
      const gained = rate * (cappedMs / 1000);
      if (gained > 0) gains[resourceId] = gained;
    }

    for (const [resourceId, gained] of Object.entries(gains)) {
      this.gainResource(resourceId, gained);
    }

    this.craftingSystem.resolveCraftJob(effectiveNow);
    this.travelSystem.resolveTravel(effectiveNow);
    this.craftingSystem.resolveGatherSession(effectiveNow);
    // Captured BEFORE resolveCombatSession runs — if a fight was active at
    // the start of this tick's window, no regen credit for ANY of that
    // window, even if the fight ends partway through it (e.g. defeat).
    // Checking "is there an active session right now" (i.e. AFTER combat
    // resolves) would wrongly grant regen for the whole window once the
    // session clears, even though most of it was spent fighting.
    const wasInCombatThisTick = this.combatSession !== null;
    this.combatSystem.resolveCombatSession(effectiveNow);
    if (!wasInCombatThisTick) this.resolveHpRegen(cappedMs);
    this.jobBoardSystem.resolveJobExpiry(now);
    this.questSystem.checkQuests();
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
      this.emitOfflineSummary(elapsedMs, holdingsBefore ?? {}, levelUps);
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
        if (action.lastPlayerAttackAt !== undefined) action.lastPlayerAttackAt += ms;
        break;
    }
  }

  /** Owned count per id: stacked amounts plus one per item instance. */
  private snapshotHoldings(): Record<string, number> {
    const holdings: Record<string, number> = {};
    for (const [id, r] of Object.entries(this.state.resources)) holdings[id] = r.amount;
    for (const instance of Object.values(this.state.inventory)) {
      holdings[instance.itemDefId] = (holdings[instance.itemDefId] ?? 0) + 1;
    }
    return holdings;
  }

  private emitOfflineSummary(
    elapsedMs: number,
    holdingsBefore: Record<string, number>,
    levelUps: { skillId: string; from: number; to: number }[]
  ): void {
    const duration = formatDuration(elapsedMs);
    const parts: string[] = [];
    for (const [id, after] of Object.entries(this.snapshotHoldings())) {
      const gained = Math.floor(after) - Math.floor(holdingsBefore[id] ?? 0);
      if (gained >= 1) parts.push(`${gained.toLocaleString()} ${this.nameOf(id)}`);
    }

    for (const levelUp of levelUps) {
      const gained = levelUp.to - levelUp.from;
      const levelWord = gained === 1 ? "level" : "levels";
      parts.push(`${gained} ${capitalize(levelUp.skillId)} ${levelWord}`);
    }

    if (this.catchUp) {
      for (const [enemyName, kills] of Object.entries(this.catchUp.kills)) {
        parts.push(`${kills} ${enemyName} ${kills === 1 ? "kill" : "kills"}`);
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
    if (!Number.isFinite(quantity) || quantity <= 0) return [];
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
    for (let i = 0; i < Math.floor(quantity); i++) {
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
    if (!isWholeQuantity(quantity)) return false;
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
    if (!isWholeQuantity(quantity)) return false;
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
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.state.currentHp = Math.min(this.getMaxHp(), this.getCurrentHp() + amount);
  }

  damageHp(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
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
    if (!Number.isFinite(hp)) return;
    this.state.currentHp = Math.max(0, Math.min(this.getMaxHp(), hp));
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

  /** Adds to a resource. `countAsEarned: false` is for refunds, which give
   *  back what was already yours rather than counting toward lifetime
   *  milestones like "earned 100 GP". */
  gainResource(resourceId: ResourceId, amount: number, opts?: { countAsEarned?: boolean }): void {
    // NaN would poison the save permanently (it serializes as null).
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.ensureResourceExists(resourceId);
    this.state.resources[resourceId].amount += amount;
    if (opts?.countAsEarned !== false) this.state.resources[resourceId].lifetimeEarned += amount;
  }

  /** Deducts a resource AND records it under `${resourceId}:spent` in
   *  statistics. All resource spending should route through here rather
   *  than mutating state.resources directly, so "Total GP Spent" etc. stay
   *  accurate without scattering increment calls at every call site. */
  spendResource(resourceId: ResourceId, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.ensureResourceExists(resourceId);
    this.state.resources[resourceId].amount -= amount;
    this.incrementStatistic(`${resourceId}:spent`, amount);
  }

  incrementStatistic(key: string, amount = 1): void {
    if (!Number.isFinite(amount)) return;
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
    if (!Number.isFinite(level)) return;
    const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
    if (!this.state.skills[skillId]) this.state.skills[skillId] = { xp: 0 };
    this.state.skills[skillId].xp = xpForLevel(clamped);
  }

  // ── Achievements ─────────────────────────────────────────────────────

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

  // ── Systems ──────────────────────────────────────────────────────────
  // Each game system lives in engine/systems/. The methods below keep
  // the engine's public API in one place and forward to them.

  // BuildingSystem (systems/buildings.ts)

  getBuildingDef(buildingId: string): BuildingDefinition | undefined {
    return this.buildingSystem.getBuildingDef(buildingId);
  }

  getBuildingQuantity(buildingId: string): number {
    return this.buildingSystem.getBuildingQuantity(buildingId);
  }

  getBuildingPurchaseCost(buildingId: string, quantity: number): RecipeInput[] | null {
    return this.buildingSystem.getBuildingPurchaseCost(buildingId, quantity);
  }

  getBuildingSellRefund(buildingId: string, quantity: number): RecipeInput[] | null {
    return this.buildingSystem.getBuildingSellRefund(buildingId, quantity);
  }

  isBuildingUnlocked(buildingId: string): boolean {
    return this.buildingSystem.isBuildingUnlocked(buildingId);
  }

  purchaseBuilding(buildingId: string, quantity = 1, opts?: { bypassUnlock?: boolean }): boolean {
    return this.buildingSystem.purchaseBuilding(buildingId, quantity, opts);
  }

  sellBuilding(buildingId: string, quantity = 1): boolean {
    return this.buildingSystem.sellBuilding(buildingId, quantity);
  }

  // CraftingSystem (systems/crafting.ts)

  startCraftJob(recipe: CraftingRecipe, quantity: number): boolean {
    return this.craftingSystem.startCraftJob(recipe, quantity);
  }

  cancelCraftJob(): void {
    this.craftingSystem.cancelCraftJob();
  }

  startGatherSession(
    amenityId: string,
    recipe: CraftingRecipe,
    opts?: { maxDurationMs?: number; requiresKeepAliveEveryMs?: number }
  ): boolean {
    return this.craftingSystem.startGatherSession(amenityId, recipe, opts);
  }

  stopGatherSession(): void {
    this.craftingSystem.stopGatherSession();
  }

  keepGatherSessionAlive(): boolean {
    return this.craftingSystem.keepGatherSessionAlive();
  }

  // TravelSystem (systems/travel.ts)

  getTravelSpeedMultiplier(): number {
    return this.travelSystem.getTravelSpeedMultiplier();
  }

  getTravelDurationEstimate(from: MapLocation, to: MapLocation, opts?: { msPerDistanceUnit?: number }): number {
    return this.travelSystem.getTravelDurationEstimate(from, to, opts);
  }

  startTravel(from: MapLocation, to: MapLocation, opts?: { msPerDistanceUnit?: number }): boolean {
    return this.travelSystem.startTravel(from, to, opts);
  }

  cancelTravel(): void {
    this.travelSystem.cancelTravel();
  }

  teleportTo(def: ItemDefinition, instanceId: string, destination: MapLocation): boolean {
    return this.travelSystem.teleportTo(def, instanceId, destination);
  }

  // CombatSystem (systems/combat.ts)

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
    return this.combatSystem.startCombat(enemy, equipmentBonus, opts);
  }

  fleeCombat(): boolean {
    return this.combatSystem.fleeCombat();
  }

  attackNow(): boolean {
    return this.combatSystem.attackNow();
  }

  // JobBoardSystem (systems/jobs.ts)

  isJobAccepted(jobId: string): boolean {
    return this.jobBoardSystem.isJobAccepted(jobId);
  }

  isJobCompleted(job: JobDefinition): boolean {
    return this.jobBoardSystem.isJobCompleted(job);
  }

  acceptJob(job: JobDefinition, boardLocationId: string): boolean {
    return this.jobBoardSystem.acceptJob(job, boardLocationId);
  }

  getJobObjective(job: JobDefinition): UnlockCondition {
    return this.jobBoardSystem.getJobObjective(job);
  }

  isJobObjectiveMet(job: JobDefinition): boolean {
    return this.jobBoardSystem.isJobObjectiveMet(job);
  }

  turnInJob(job: JobDefinition, boardLocationId: string): boolean {
    return this.jobBoardSystem.turnInJob(job, boardLocationId);
  }

  devForceJobBoardReset(): void {
    this.jobBoardSystem.devForceJobBoardReset();
  }

  // QuestSystem (systems/quests.ts)

  getQuestStatus(questId: string): "not-started" | "in-progress" | "completed" {
    return this.questSystem.getQuestStatus(questId);
  }

  canStartQuest(questId: string): boolean {
    return this.questSystem.canStartQuest(questId);
  }

  startQuest(questId: string): boolean {
    return this.questSystem.startQuest(questId);
  }

  getQuestObjective(questId: string): UnlockCondition | null {
    return this.questSystem.getQuestObjective(questId);
  }

  isQuestStageMet(questId: string): boolean {
    return this.questSystem.isQuestStageMet(questId);
  }

  advanceQuest(questId: string): boolean {
    return this.questSystem.advanceQuest(questId);
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
