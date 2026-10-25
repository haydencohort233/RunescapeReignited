import type {
  ResourceId,
  BuildingDefinition,
  GameContent,
  Modifier,
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
  AttackStyle,
  SpellDefinition,
  NpcDefinition,
  EquipSlot,
  DungeonDefinition,
  LoadoutEntry,
  ToolType,
  FurnitureDefinition,
  FurniturePlacement,
  FurnitureSkin,
  RoomCosmetic,
  StationType,
  ServantDefinition,
} from "./types";
import { NotificationQueue } from "./notificationQueue";
import { levelForXp, xpForLevel, MAX_LEVEL, calculateCombatLevel } from "./xpCurve";
import { isUnlocked } from "./unlockConditions";
import { formatDuration, capitalize } from "./format";
import { SHOP_SELL_PRICE_FRACTION, BASE_HP_REGEN_PER_SECOND, SPECIAL_ENERGY_REGEN_PER_MS } from "./tuning";
import { computeEquipmentBonuses, type EquipmentBonuses } from "./equipmentBonuses";
import { createInitialState } from "./state";
import { migrateSave } from "./migrations";
import { countOwned, isWholeQuantity, stackEquipId, wornItemDefId } from "./ledger";
import { describeAction, getActiveCombat } from "./activeAction";
import { BuildingSystem } from "./systems/buildings";
import { CraftingSystem } from "./systems/crafting";
import { TravelSystem } from "./systems/travel";
import type { TravelRoute } from "./roads";
import { CombatSystem } from "./systems/combat";
import { JobBoardSystem } from "./systems/jobs";
import { QuestSystem } from "./systems/quests";
import { DungeonSystem } from "./systems/dungeons";
import { HouseSystem } from "./systems/house";
import { ServantSystem } from "./systems/servants";

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
  private readonly spellsById: Map<string, SpellDefinition>;
  private readonly buildingSystem: BuildingSystem;
  private readonly craftingSystem: CraftingSystem;
  private readonly travelSystem: TravelSystem;
  private readonly combatSystem: CombatSystem;
  private readonly jobBoardSystem: JobBoardSystem;
  private readonly questSystem: QuestSystem;
  private readonly dungeonSystem: DungeonSystem;
  private readonly houseSystem: HouseSystem;
  private readonly servantSystem: ServantSystem;
  private readonly enemiesById: Map<string, EnemyDefinition>;
  /** Non-null only while resolveElapsed() is replaying an away period.
   *  Combat outcomes collect here and go into the one "while you were
   *  away" summary instead of a toast per kill. */
  catchUp: { kills: Record<string, number>; eaten: number } | null = null;
  /** Set while devSkipTime runs, so the summary says "skipped". */
  private skippingTime = false;

  constructor(
    content: GameContent,
    opts?: { state?: GameState; notifications?: NotificationQueue; clock?: () => number }
  ) {
    this.content = content;
    this.itemsById = new Map(content.items.map((i) => [i.id, i]));
    this.spellsById = new Map((content.spells ?? []).map((s) => [s.id, s]));
    this.buildingSystem = new BuildingSystem(this);
    this.craftingSystem = new CraftingSystem(this);
    this.travelSystem = new TravelSystem(this);
    this.combatSystem = new CombatSystem(this);
    this.jobBoardSystem = new JobBoardSystem(this);
    this.questSystem = new QuestSystem(this);
    this.enemiesById = new Map((content.enemies ?? []).map((e) => [e.id, e]));
    this.dungeonSystem = new DungeonSystem(this);
    this.houseSystem = new HouseSystem(this);
    this.servantSystem = new ServantSystem(this);
    this.clock = opts?.clock ?? Date.now;
    this.state = opts?.state ?? createInitialState(this.clock());
    this.notifications = opts?.notifications ?? new NotificationQueue();
    this.grantStartingBuildings();
    this.stackInstancesOfStackableItems();
    this.backfillItemCharges();
    this.grantStarterKit(content.starterKit ?? []);
    this.houseSystem.normalize();
    this.servantSystem.normalize();
  }

  /** A copy of a charged item (Amulet of Glory) from before charges existed
   *  starts full. Content-driven, so it lives here, not in migrations. */
  private backfillItemCharges(): void {
    for (const instance of Object.values(this.state.inventory)) {
      const def = this.itemsById.get(instance.itemDefId);
      if (def?.maxCharges !== undefined && instance.charges === undefined) instance.charges = def.maxCharges;
      if (def?.maxDurability !== undefined && instance.durability === undefined) instance.durability = def.maxDurability;
    }
  }

  /** Gives the starting tools once per save (new games, and older saves
   *  the first time they load with tools in content), so gathering that now
   *  needs a tool doesn't lock anyone out. A flag, not a check for "has an
   *  axe", so dropping or selling one never conjures a new one. */
  private grantStarterKit(itemIds: string[]): void {
    if (this.getFlag("starterKitGranted")) return;
    for (const id of itemIds) if (this.itemsById.has(id)) this.addItem(id, 1);
    this.setFlag("starterKitGranted", true);
  }

  /** An item that became stackable in content (arrows) may still exist as
   *  separate instances in an older save: fold them into the stack, and a
   *  worn one becomes the worn stack. Content-driven, so it lives here
   *  rather than in the content-agnostic migrations. */
  private stackInstancesOfStackableItems(): void {
    for (const instance of Object.values(this.state.inventory)) {
      if (!this.itemsById.get(instance.itemDefId)?.stackable) continue;
      for (const [slot, id] of Object.entries(this.state.equipment)) {
        if (id === instance.instanceId) {
          this.state.equipment[slot as keyof GameState["equipment"]] = stackEquipId(instance.itemDefId);
        }
      }
      delete this.state.inventory[instance.instanceId];
      this.ensureResourceExists(instance.itemDefId);
      this.state.resources[instance.itemDefId].amount += 1;
    }
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
    const run = this.state.dungeonRun;
    if (run) {
      const name = this.dungeonSystem.getDungeon(run.dungeonId)?.name ?? "a dungeon";
      this.notifications.push("status", `You're in the ${name}. Leave it first.`, { severity: "warning" });
      return false;
    }
    const action = this.state.activeAction;
    if (!action) return true;
    this.notifications.push("status", `You're busy ${describeAction(action)}. Stop that first.`, {
      severity: "warning",
    });
    return false;
  }

  /** Stops whatever is running, using that action's own stop rules
   *  (crafting refunds, travel returns you to your origin, combat counts
   *  as fleeing and can be refused). Returns false if it couldn't stop. */
  stopActiveAction(): boolean {
    // Catch up first: the action may have finished since the last tick (a
    // trip that already arrived, a fight already won or lost), and stopping
    // it from stale progress would undo that.
    this.catchUpToNow();
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
    const { additiveSum, multiplicativeProduct } = this.sumModifiers(target);
    return (base + additiveSum) * multiplicativeProduct;
  }

  /** Just the multiplicative part for `target` — what scales one
   *  building's own output. Additive bonuses belong to the resource as a
   *  whole, not to any one building. */
  getModifierMultiplier(target: string): number {
    return this.sumModifiers(target).multiplicativeProduct;
  }

  private sumModifiers(target: string): { additiveSum: number; multiplicativeProduct: number } {
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
    return { additiveSum, multiplicativeProduct };
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
    const capMs = this.getOfflineCapMs();
    const cappedMs = Math.min(elapsedMs, capMs);
    const effectiveNow = from + cappedMs;

    if (elapsedMs > capMs) {
      this.notifications.push(
        "debug",
        `Offline gap of ${Math.round(elapsedMs / 60000)}min capped to ${Math.round(capMs / 60000)}min for reward calculation`,
        { devOnly: true }
      );
    }

    // Anything that had already run out before this window started.
    const expired = this.pruneExpiredModifiers(from);

    // Snapshot holdings so the away summary can report everything gained
    // (production, gathering, crafting, loot), not just building output.
    const holdingsBefore = wasOffline ? this.snapshotHoldings() : null;

    const levelsBefore: Record<string, number> = {};
    for (const skillId of Object.keys(this.state.skills)) {
      levelsBefore[skillId] = this.getSkillLevel(skillId);
    }

    // Production runs in segments split wherever a modifier expires, so a
    // buff that lasted the first 30 minutes of an hour away pays for those
    // 30 minutes instead of nothing. Expiry uses the SAME capped horizon as
    // everything else, not the real `now` (see class doc comment). Crafting
    // XP and travel speed below still see only the modifiers left at the
    // end of the window.
    const gains: Record<ResourceId, number> = {};
    let segmentStart = from;
    for (const boundary of this.modifierExpiriesWithin(from, effectiveNow)) {
      this.addProduction(gains, boundary - segmentStart);
      segmentStart = boundary;
      expired.push(...this.pruneExpiredModifiers(boundary));
    }

    for (const [resourceId, gained] of Object.entries(gains)) {
      this.gainResource(resourceId, gained);
    }

    // Furniture builds run beside the active action, never instead of it.
    this.houseSystem.resolveBuild(effectiveNow);
    this.servantSystem.resolve(effectiveNow);
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
    this.state.specialEnergy = Math.min(100, this.state.specialEnergy + cappedMs * SPECIAL_ENERGY_REGEN_PER_MS);
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

  /** Sorted expiry times inside (from, to), then `to` itself: the
   *  boundaries of resolveElapsed's production segments. */
  private modifierExpiriesWithin(from: number, to: number): number[] {
    const times = new Set<number>([to]);
    for (const m of Object.values(this.state.modifiers)) {
      if (m.expiresAt !== undefined && m.expiresAt > from && m.expiresAt < to) times.add(m.expiresAt);
    }
    return [...times].sort((a, b) => a - b);
  }

  /** Adds `ms` worth of production at the current rates into `gains`.
   *  Only things something produces: building outputs, plus anything an
   *  additive modifier targets directly (a "+1 GP/s" buff with no
   *  building). Iterating every stack would also let a future modifier
   *  targeting "all" mint bones and food each second. */
  private addProduction(gains: Record<ResourceId, number>, ms: number): void {
    if (ms <= 0) return;
    const producedResources = new Set(this.content.buildings.map((b) => b.resource));
    for (const m of Object.values(this.state.modifiers)) {
      if (m.type === "additive" && m.target !== "all" && !m.target.includes(":")) producedResources.add(m.target);
    }
    for (const resourceId of producedResources) {
      const gained = this.getEffectiveRatePerSecond(resourceId) * (ms / 1000);
      if (gained > 0) gains[resourceId] = (gains[resourceId] ?? 0) + gained;
    }
  }

  private shiftActionAnchors(ms: number): void {
    this.houseSystem.shiftAnchors(ms);
    this.servantSystem.shiftAnchors(ms);
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
        if (action.bleed) action.bleed.startedAt += ms;
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
    // Say when the cap kicked in, or "away for 9h" paying 1h looks like a bug.
    const capMs = this.getOfflineCapMs();
    const counted = elapsedMs > capMs ? ` (only ${formatDuration(capMs)} counted)` : "";
    this.notifications.push(
      "offline-summary",
      this.skippingTime
        ? `Skipped ${duration}${counted}: you earned ${parts.join(", ")}.`
        : `While you were away for ${duration}${counted}, you earned ${parts.join(", ")}.`,
      { replaceKey: "offline-summary" }
    );
  }

  // ── Offline cap (flexible so future upgrades/items can extend it) ──────

  /** How much time away counts: the save's base cap plus the best bed. */
  getOfflineCapMs(): number {
    return this.state.offlineCapMs + this.houseSystem.getOfflineCapBonusMs();
  }

  /**
   * Moves the game forward by `ms` at once, as if that much time had
   * passed: crafting, gathering, fights, travel, furniture builds,
   * production and buffs all advance. Capped by the offline cap like any
   * away time. A dev tool for now; later the paid "speed up" (decided:
   * it will skip everything, not just builds).
   */
  devSkipTime(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.catchUpToNow();
    this.state.lastTickTimestamp -= ms;
    this.shiftActionAnchors(-ms);
    for (const m of Object.values(this.state.modifiers)) if (m.expiresAt !== undefined) m.expiresAt -= ms;
    this.skippingTime = true;
    try {
      this.resolveElapsed();
    } finally {
      this.skippingTime = false;
    }
  }

  /** The save's base cap, without the bed. */
  getBaseOfflineCapMs(): number {
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
      this.state.inventory[instanceId] = {
        instanceId,
        itemDefId,
        ...(def?.maxDurability !== undefined ? { durability: def.maxDurability } : {}),
        ...(def?.maxCharges !== undefined ? { charges: def.maxCharges } : {}),
      };
      ids.push(instanceId);
    }
    return ids;
  }

  /** Whether `quantity` more of an item can be taken: false for a second
   *  copy of a `unique` item, which addItem would refuse. Warns if not. */
  canReceive(itemDefId: string, quantity: number): boolean {
    const def = this.itemsById.get(itemDefId);
    if (!def?.unique) return true;
    if (quantity > 1 || this.getResourceAmount(itemDefId) > 0 || Object.values(this.state.inventory).some((i) => i.itemDefId === itemDefId)) {
      this.notifications.push("status", `You can only own one ${def.name}.`, { severity: "warning" });
      return false;
    }
    return true;
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
   *  same "engine enforces it, not just the UI" pattern as purchaseBuilding.
   *  A stackable item (arrows) is worn as a whole stack and needs no
   *  instanceId. */
  equipItem(def: ItemDefinition, instanceId?: string): boolean {
    if (!def.equipSlot) return false;
    if (!this.canChangeSlot(def.equipSlot)) return false;
    if (this.state.dungeonRun) {
      const brought = def.stackable
        ? this.state.dungeonRun.loadout.some((e) => e.itemDefId === def.id)
        : !!instanceId && this.dungeonSystem.canUseInstance(instanceId);
      if (!brought) {
        this.notifications.push("status", "Only what you brought into the dungeon can be used here.", { severity: "warning" });
        return false;
      }
    }
    if (def.stackable) {
      if (this.getResourceAmount(def.id) < 1) return false;
    } else {
      const instance = instanceId ? this.state.inventory[instanceId] : undefined;
      if (!instance || instance.itemDefId !== def.id) return false;
    }

    if (def.equipRequirement && !isUnlocked(def.equipRequirement, this.state)) {
      this.notifications.push("status", `You don't meet the requirements to equip ${def.name}.`, {
        severity: "warning",
      });
      return false;
    }

    // In a dungeon, whatever this replaces stays usable for the run.
    const replaced = this.state.equipment[def.equipSlot];
    if (this.state.dungeonRun && replaced && !replaced.startsWith("stack:")) {
      this.dungeonSystem.rememberUnequipped(this.state.inventory[replaced]?.itemDefId ?? "", replaced);
    }
    this.state.equipment[def.equipSlot] = def.stackable ? stackEquipId(def.id) : instanceId;
    this.incrementStatistic(`equipped:${def.id}`, 1);
    this.notifications.push("status", `Equipped ${def.name}.`);
    return true;
  }

  unequipSlot(slot: string): void {
    const def = this.state.equipment[slot as keyof GameState["equipment"]];
    if (!def) return;
    if (!this.canChangeSlot(slot as EquipSlot)) return;
    if (this.state.dungeonRun && !def.startsWith("stack:")) {
      this.dungeonSystem.rememberUnequipped(this.state.inventory[def]?.itemDefId ?? "", def);
    }
    delete this.state.equipment[slot as keyof GameState["equipment"]];
    this.notifications.push("status", `Unequipped item.`);
  }

  /** Removes one item instance entirely — from inventory and, if worn,
   *  its equipment slot. Stacks use dropStack. */
  dropItem(def: ItemDefinition, instanceId: string): void {
    if (!this.state.inventory[instanceId]) return;
    if (this.combatSession && this.isEquipped(instanceId)) {
      this.notifications.push("status", "You can't change gear mid-fight.", { severity: "warning" });
      return;
    }
    for (const [slot, id] of Object.entries(this.state.equipment)) {
      if (id === instanceId) delete this.state.equipment[slot as keyof GameState["equipment"]];
    }
    delete this.state.inventory[instanceId];
    this.notifications.push("status", `Dropped ${def.name}.`);
  }

  /** Drops `quantity` from a stack, or the whole stack when omitted.
   *  Clamped to what's held. Not counted as spending. */
  dropStack(itemDefId: string, quantity?: number): void {
    // A worn stack has to come off first, as worn gear does in OSRS.
    if (this.isEquipped(stackEquipId(itemDefId))) return;
    const held = Math.floor(this.getResourceAmount(itemDefId));
    if (quantity !== undefined && !isWholeQuantity(quantity)) return;
    const amount = Math.min(held, quantity ?? held);
    if (amount <= 0) return;
    this.state.resources[itemDefId].amount -= amount;
    this.notifications.push("status", `Dropped ${amount.toLocaleString()}x ${this.nameOf(itemDefId)}.`);
  }

  /** Eats one unit of a food item, healing its healAmount (scaled by
   *  "healing" modifiers). Works mid-fight, at the cost of restarting your
   *  attack timer. The player-facing entry point. */
  eatItem(itemDefId: string): boolean {
    this.catchUpToNow();
    return this.consumeFood(itemDefId, this.now());
  }

  /** eatItem at a given time. Internal: auto-eat calls this mid-resolve
   *  with the event's own timestamp, where catching up would recurse. */
  consumeFood(itemDefId: string, at: number): boolean {
    const def = this.itemsById.get(itemDefId);
    if (!def?.healAmount || this.getFoodCount(itemDefId) < 1) return false;
    if (def.stackable) this.spendWornStack(itemDefId, 1);
    else this.removeOwned(itemDefId, 1);
    if (this.state.dungeonRun) this.dungeonSystem.useFood(itemDefId);
    const before = this.getCurrentHp();
    this.healHp(this.getModifiedValue("healing", def.healAmount));
    const healed = Math.floor(this.getCurrentHp() - before);

    this.combatSystem.restartPlayerAttackTimer(at);

    this.incrementStatistic(`eaten:${itemDefId}`, 1);
    if (this.catchUp) this.catchUp.eaten++;
    else this.notifications.push("status", `You eat the ${def.name}. It heals ${healed} HP.`);
    return true;
  }

  /** Gear is locked for the length of a fight (decided: no mid-fight
   *  swaps), except food, which can be switched any time. */
  private canChangeSlot(slot: EquipSlot): boolean {
    if (!this.combatSession || slot === "food") return true;
    this.notifications.push("status", "You can't change gear mid-fight.", { severity: "warning" });
    return false;
  }

  /** How much of a food the player can eat: a stack counts whether it's in
   *  the inventory or worn in the food slot. */
  getFoodCount(itemDefId: string): number {
    const def = this.itemsById.get(itemDefId);
    if (!def) return 0;
    // In a dungeon only the food brought along counts.
    if (this.state.dungeonRun) return this.dungeonSystem.foodLeft(itemDefId);
    return def.stackable ? Math.floor(this.getResourceAmount(itemDefId)) : this.getOwnedCount(itemDefId);
  }

  /** Uses up part of a stack that may be worn (arrows, food), counted as
   *  spending, and takes an emptied stack out of its slot. */
  spendWornStack(itemDefId: string, amount: number): void {
    this.spendResource(itemDefId, amount);
    this.clearEmptyWornStacks();
  }

  /** A worn stack that has run out comes out of its slot. */
  clearEmptyWornStacks(): void {
    for (const [slot, value] of Object.entries(this.state.equipment)) {
      if (!value?.startsWith("stack:")) continue;
      const itemDefId = value.slice("stack:".length);
      if (this.getResourceAmount(itemDefId) < 1) delete this.state.equipment[slot as EquipSlot];
    }
  }

  /** Bonuses from what's worn right now (see equipmentBonuses.ts). */
  getEquipmentBonuses(): EquipmentBonuses {
    return computeEquipmentBonuses(this.state, (id) => this.itemsById.get(id));
  }

  getSpell(spellId: string | undefined): SpellDefinition | undefined {
    return spellId ? this.spellsById.get(spellId) : undefined;
  }

  /** Picks the spell a magic weapon casts. Locked in when a fight starts. */
  selectSpell(spellId: string): boolean {
    const spell = this.getSpell(spellId);
    if (!spell) return false;
    if (this.getSkillLevel("magic") < spell.levelRequired) {
      this.notifications.push("status", `${spell.name} needs Magic level ${spell.levelRequired}.`, { severity: "warning" });
      return false;
    }
    this.state.selectedSpellId = spellId;
    return true;
  }

  /** Every worn degrading item (Barrows-style, has maxDurability) loses one
   *  point. At 0 it turns into its broken item, unworn, or dissolves.
   *  Returns true if anything broke, so a fight can re-read its gear. */
  wearDegradableGear(): boolean {
    let broke = false;
    for (const [slot, value] of Object.entries(this.state.equipment)) {
      if (!value || value.startsWith("stack:")) continue;
      const instance = this.state.inventory[value];
      const def = instance ? this.itemsById.get(instance.itemDefId) : undefined;
      if (!instance || def?.maxDurability === undefined) continue;
      instance.durability = (instance.durability ?? def.maxDurability) - 1;
      if (instance.durability > 0) continue;
      broke = true;
      delete this.state.equipment[slot as EquipSlot];
      if (def.brokenItemId && this.itemsById.has(def.brokenItemId)) {
        instance.itemDefId = def.brokenItemId;
        delete instance.durability;
        this.notifications.push("status", `Your ${def.name} has broken. Bob can repair it.`, { severity: "warning" });
      } else {
        delete this.state.inventory[value];
        this.notifications.push("status", `Your ${def.name} crumbles to dust.`, { severity: "warning" });
      }
    }
    return broke;
  }

  /** GP to fully repair one copy: a broken item costs its full item's
   *  repairCostGp, a worn one its share. 0 when there's nothing to fix. */
  getRepairCost(instanceId: string): number {
    const instance = this.state.inventory[instanceId];
    const def = instance ? this.itemsById.get(instance.itemDefId) : undefined;
    if (!instance || !def) return 0;
    if (def.repairsTo) return this.itemsById.get(def.repairsTo)?.repairCostGp ?? 0;
    if (def.maxDurability === undefined || !def.repairCostGp) return 0;
    const missing = def.maxDurability - (instance.durability ?? def.maxDurability);
    return missing <= 0 ? 0 : Math.max(1, Math.ceil((def.repairCostGp * missing) / def.maxDurability));
  }

  /** Repairs one copy at a shop that repairs (Bob), for gold. */
  repairItem(shopId: string, instanceId: string): boolean {
    const shop = this.content.shops.find((s) => s.id === shopId);
    if (!shop?.repairs) return false;
    if (this.state.currentLocationId !== shop.locationId) {
      this.notifications.push("status", `You need to be at ${shop.title} to have something repaired.`, { severity: "warning" });
      return false;
    }
    const instance = this.state.inventory[instanceId];
    const def = instance ? this.itemsById.get(instance.itemDefId) : undefined;
    const cost = this.getRepairCost(instanceId);
    if (!instance || !def || cost <= 0) return false;
    if (this.combatSession && this.isEquipped(instanceId)) return false;
    if (this.getOwnedCount("gp") < cost) {
      this.notifications.push("status", `Repairing ${def.name} costs ${cost.toLocaleString()} GP.`, { severity: "warning" });
      return false;
    }
    this.spendResource("gp", cost);
    const fixedDef = def.repairsTo ? this.itemsById.get(def.repairsTo)! : def;
    instance.itemDefId = fixedDef.id;
    instance.durability = fixedDef.maxDurability;
    this.incrementStatistic("itemsRepaired", 1);
    this.notifications.push("status", `${shop.npcName} repairs your ${fixedDef.name} for ${cost.toLocaleString()} GP.`);
    return true;
  }

  /** GP to refill one charged item (Amulet of Glory). */
  getRechargeCost(instanceId: string): number {
    const instance = this.state.inventory[instanceId];
    const def = instance ? this.itemsById.get(instance.itemDefId) : undefined;
    if (!instance || def?.maxCharges === undefined) return 0;
    return Math.max(0, def.maxCharges - (instance.charges ?? 0)) * (def.rechargeCostGp ?? 0);
  }

  /** Refills a charged item at an NPC who recharges (Aggie), for gold. */
  rechargeItem(npc: NpcDefinition, instanceId: string): boolean {
    if (!npc.services?.includes("recharge")) return false;
    if (this.state.currentLocationId !== npc.locationId) {
      this.notifications.push("status", `You need to be with ${npc.name} to recharge that.`, { severity: "warning" });
      return false;
    }
    const instance = this.state.inventory[instanceId];
    const def = instance ? this.itemsById.get(instance.itemDefId) : undefined;
    if (!instance || def?.maxCharges === undefined) return false;
    if ((instance.charges ?? 0) >= def.maxCharges) {
      this.notifications.push("status", `Your ${def.name} is already fully charged.`);
      return false;
    }
    const cost = this.getRechargeCost(instanceId);
    if (this.getOwnedCount("gp") < cost) {
      this.notifications.push("status", `Recharging ${def.name} costs ${cost.toLocaleString()} GP.`, { severity: "warning" });
      return false;
    }
    this.spendResource("gp", cost);
    instance.charges = def.maxCharges;
    this.notifications.push("status", `${npc.name} recharges your ${def.name} for ${cost.toLocaleString()} GP.`);
    return true;
  }

  /** Dev tool: every worn-down item back to full, broken ones repaired,
   *  and every charged item refilled. */
  devRestoreAllGear(): void {
    for (const instance of Object.values(this.state.inventory)) {
      let def = this.itemsById.get(instance.itemDefId);
      if (def?.repairsTo && this.itemsById.has(def.repairsTo)) {
        instance.itemDefId = def.repairsTo;
        def = this.itemsById.get(def.repairsTo);
      }
      if (def?.maxDurability !== undefined) instance.durability = def.maxDurability;
      if (def?.maxCharges !== undefined) instance.charges = def.maxCharges;
    }
    this.state.specialEnergy = 100;
    this.notifications.push("status", "Restored all gear, charges and special attack energy.");
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

  /** Buys `quantity` of an item from a shop, at the shop's own price from
   *  content. Enforces that the shop stocks it and that the player is
   *  actually AT the shop's location (not just a UI-hidden check) — same
   *  "engine enforces it, not just the UI" pattern as purchaseBuilding and
   *  equipItem. */
  buyFromShop(shopId: string, itemDefId: string, quantity: number): boolean {
    if (!isWholeQuantity(quantity)) return false;
    const shop = this.content.shops.find((s) => s.id === shopId);
    const price = shop?.items.find((i) => i.itemDefId === itemDefId)?.price;
    if (!shop || !price) return false;
    const itemName = this.nameOf(itemDefId);

    if (this.state.currentLocationId !== shop.locationId) {
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

    // Checked before paying: addItem refuses extra copies of a unique item,
    // and the money would already be gone.
    if (!this.canReceive(itemDefId, quantity)) return false;

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

  /** Sells `quantity` of an item to a shop that buys items, if the player
   *  is standing at it. Worn equipment is never sold (getOwnedCount
   *  excludes it). */
  sellToShop(shopId: string, itemDefId: string, quantity: number): boolean {
    if (!isWholeQuantity(quantity)) return false;
    const shop = this.content.shops.find((s) => s.id === shopId);
    if (!shop?.buysItems) return false;
    if (this.state.currentLocationId !== shop.locationId) {
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

  /** Dev tool: moves the player anywhere instantly, ignoring unlock
   *  requirements. Stops the current action first (forcibly, if it's a
   *  fight that can't be fled). First visits still count as discoveries. */
  devTeleport(destination: MapLocation): void {
    this.catchUpToNow();
    // A fight just ends: stopping it would flee, which a boss refuses with
    // a "can't flee" warning right before the teleport happens anyway.
    if (this.combatSession) this.state.activeAction = null;
    else this.stopActiveAction();
    this.dungeonSystem.end();
    this.travelSystem.arriveDirectly(destination);
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
    this.grantStarterKit(this.content.starterKit ?? []);
    this.houseSystem.normalize();
    this.servantSystem.normalize();
    this.notifications.clear();
    this.notifications.push("status", "Save data cleared. Starting fresh.");
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

  /** Deducts a resource that was lost rather than spent (death), recorded
   *  under `${resourceId}:lostOnDeath` so it never counts toward spending
   *  milestones. */
  loseResource(resourceId: ResourceId, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.ensureResourceExists(resourceId);
    this.state.resources[resourceId].amount -= amount;
    this.incrementStatistic(`${resourceId}:lostOnDeath`, amount);
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
    // Gear worn before "equipped:<id>" was counted still counts once.
    for (const value of Object.values(this.state.equipment)) {
      const itemDefId = value ? wornItemDefId(this.state, value) : undefined;
      if (itemDefId && !this.state.statistics[`equipped:${itemDefId}`]) this.state.statistics[`equipped:${itemDefId}`] = 1;
    }
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
        `Achievement unlocked: ${achievement.name}. ${achievement.description}`
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

  /** Time per item this player would get now (level and tool bonuses). */
  getEffectiveTimePerItem(recipe: CraftingRecipe): number {
    return this.craftingSystem.getEffectiveTimePerItem(recipe);
  }

  /** Why a recipe can't start right now (tool, station, unlock), or null. */
  getRecipeStartBlocker(recipe: CraftingRecipe): string | null {
    return this.craftingSystem.getStartBlocker(recipe);
  }

  getBestTool(type: ToolType): ItemDefinition | null {
    return this.craftingSystem.getBestTool(type).def;
  }

  // TravelSystem (systems/travel.ts)

  getTravelSpeedMultiplier(): number {
    return this.travelSystem.getTravelSpeedMultiplier();
  }

  getTravelToll(to: MapLocation): RecipeInput[] {
    return this.travelSystem.getTravelToll(to);
  }

  getTravelRoute(from: MapLocation, to: MapLocation): TravelRoute | null {
    return this.travelSystem.getTravelRoute(from, to);
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
    equipmentBonus?: Partial<EquipmentBonuses>,
    opts?: { autoRepeat?: boolean; autoEatItemId?: string }
  ): boolean {
    return this.combatSystem.startCombat(enemy, equipmentBonus, opts);
  }

  toggleSpecialAttack(): boolean {
    return this.combatSystem.toggleSpecialAttack();
  }

  setCombatStyle(attackStyle: AttackStyle, styleId: string): void {
    this.combatSystem.setCombatStyle(attackStyle, styleId);
  }

  fleeCombat(): boolean {
    return this.combatSystem.fleeCombat();
  }

  attackNow(): boolean {
    return this.combatSystem.attackNow();
  }

  setCombatFood(itemDefId: string): void {
    this.combatSystem.setCombatFood(itemDefId);
  }

  setAutoEat(enabled: boolean): void {
    this.combatSystem.setAutoEat(enabled);
  }

  // DungeonSystem (systems/dungeons.ts)

  getEnemy(enemyId: string): EnemyDefinition | undefined {
    return this.enemiesById.get(enemyId);
  }

  getDungeon(dungeonId: string): DungeonDefinition | undefined {
    return this.dungeonSystem.getDungeon(dungeonId);
  }

  getDungeonEnterBlocker(dungeonId: string, loadout: LoadoutEntry[]): string | null {
    return this.dungeonSystem.getEnterBlocker(dungeonId, loadout);
  }

  getLoadoutSlotsUsed(loadout: LoadoutEntry[]): number {
    return this.dungeonSystem.slotsUsed(loadout);
  }

  getSavedLoadout(dungeonId: string): LoadoutEntry[] {
    return this.dungeonSystem.getSavedLoadout(dungeonId);
  }

  setSavedLoadout(dungeonId: string, loadout: LoadoutEntry[]): boolean {
    return this.dungeonSystem.setSavedLoadout(dungeonId, loadout);
  }

  enterDungeon(dungeonId: string, loadout: LoadoutEntry[]): boolean {
    return this.dungeonSystem.enterDungeon(dungeonId, loadout);
  }

  continueToBoss(): boolean {
    return this.dungeonSystem.continueToBoss();
  }

  leaveDungeon(): boolean {
    return this.dungeonSystem.leave();
  }

  /** Internal: combat ends a run on a flee, death or running out of supplies. */
  endDungeonRun(message?: string): void {
    this.dungeonSystem.end(message);
  }

  /** Internal: combat reports a dungeon kill. */
  onDungeonFightWon(session: ActiveCombatSession, at: number, lootMessages: string[]): void {
    this.dungeonSystem.onFightWon(session, at, lootMessages);
  }

  /** Internal: the dungeon starts its own waves. */
  startDungeonFight(enemy: EnemyDefinition, dungeonId: string, startAt: number, autoEatItemId?: string): void {
    this.combatSystem.startDungeonFight(enemy, dungeonId, startAt, autoEatItemId);
  }

  // HouseSystem (systems/house.ts)

  getFurnitureDef(furnitureId: string): FurnitureDefinition | undefined {
    return this.houseSystem.getFurnitureDef(furnitureId);
  }

  getFurnitureSkin(skinId: string): FurnitureSkin | undefined {
    return this.houseSystem.getSkin(skinId);
  }

  isAtHouse(): boolean {
    return this.houseSystem.isAtHouse();
  }

  getFurnitureLimit(): number {
    return this.houseSystem.getFurnitureLimit();
  }

  getHouseStorageCapacity(): number {
    return this.houseSystem.getStorageCapacity();
  }

  getHouseStorageUsed(): number {
    return this.houseSystem.getStorageUsed();
  }

  /** A house facility for this station is standing in the house and the
   *  player is there. */
  hasHouseStation(station: StationType): boolean {
    return this.houseSystem.hasStationHere(station);
  }

  getHouseWallpaper(): RoomCosmetic | undefined {
    return this.houseSystem.getWallpaper();
  }

  getHouseFloor(): RoomCosmetic | undefined {
    return this.houseSystem.getFloor();
  }

  getHouseRug(): RoomCosmetic | undefined {
    return this.houseSystem.getRug();
  }

  getFurnitureBuildBlocker(furnitureId: string): string | null {
    return this.houseSystem.getBuildBlocker(furnitureId);
  }

  startFurnitureBuild(furnitureId: string): boolean {
    return this.houseSystem.startBuild(furnitureId);
  }

  cancelFurnitureBuild(): boolean {
    return this.houseSystem.cancelBuild();
  }

  getFurniturePlacementBlocker(def: FurnitureDefinition, placement: FurniturePlacement, ignoreUid?: string): string | null {
    return this.houseSystem.getPlacementBlocker(def, placement, ignoreUid);
  }

  placeFurniture(storageUid: string, placement: FurniturePlacement): boolean {
    return this.houseSystem.placeFromStorage(storageUid, placement);
  }

  moveFurniture(uid: string, placement: FurniturePlacement): boolean {
    return this.houseSystem.moveFurniture(uid, placement);
  }

  rotateFurniture(uid: string): boolean {
    return this.houseSystem.rotateFurniture(uid);
  }

  storeFurniture(uid: string): boolean {
    return this.houseSystem.storeFurniture(uid);
  }

  getAvailableFurnitureSkins(furnitureId: string): FurnitureSkin[] {
    return this.houseSystem.getAvailableSkins(furnitureId);
  }

  setFurnitureSkin(uid: string, skinId: string | null): boolean {
    return this.houseSystem.setFurnitureSkin(uid, skinId);
  }

  devUnlockAllFurnitureSkins(): void {
    this.houseSystem.devUnlockAllSkins();
  }

  devFinishFurnitureBuild(): void {
    this.houseSystem.devFinishBuild();
  }

  /** A facility for this station stands in the house, wherever the player is. */
  hasPlacedHouseStation(station: StationType): boolean {
    return this.houseSystem.hasPlacedStation(station);
  }

  /** The facility standing in the house for this station, if any. */
  getHouseFacility(station: StationType): FurnitureDefinition | undefined {
    return this.houseSystem.getPlacedFacility(station);
  }

  /** A servant's order is using the house's facility for this station. */
  isHouseStationBusy(station: StationType): boolean {
    return this.servantSystem.getBusyStation() === station;
  }

  /** The player's own craft is using the house's facility for this
   *  station (not a town one where they stand). */
  isPlayerUsingHouseStation(station: StationType): boolean {
    const action = this.state.activeAction;
    if (action?.kind !== "craft" || action.station !== station) return false;
    const inTown = (this.content.stationLocations?.[station] ?? []).includes(this.state.currentLocationId);
    return !inTown && this.houseSystem.hasStationHere(station);
  }

  // ServantSystem (systems/servants.ts)

  getServantDefinitions(): ServantDefinition[] {
    return this.servantSystem.getDefinitions();
  }

  getServantDefinition(servantId: string): ServantDefinition | undefined {
    return this.servantSystem.getDefinition(servantId);
  }

  /** The hired servant's definition, if any. */
  getHiredServant(): ServantDefinition | undefined {
    return this.servantSystem.getHired();
  }

  getServantHireBlocker(npc: NpcDefinition, servantId: string): string | null {
    return this.servantSystem.getHireBlocker(npc, servantId);
  }

  hireServant(npc: NpcDefinition, servantId: string): boolean {
    return this.servantSystem.hire(npc, servantId);
  }

  dismissServant(): boolean {
    return this.servantSystem.dismiss();
  }

  depositServantWages(amount: number): boolean {
    return this.servantSystem.deposit(amount);
  }

  /** How much work the coin pouch pays for, in ms. */
  getServantPurseTimeMs(): number {
    return this.servantSystem.getPurseTimeMs();
  }

  /** Wages for a whole order; the pouch must hold this much to start it. */
  getServantOrderWages(recipe: CraftingRecipe, quantity: number): number {
    return this.servantSystem.getOrderWages(recipe, quantity);
  }

  getServantOrderBlocker(recipe: CraftingRecipe, quantity: number): string | null {
    return this.servantSystem.getOrderBlocker(recipe, quantity);
  }

  getServantMaxOrder(recipe: CraftingRecipe): number {
    return this.servantSystem.getMaxOrder(recipe);
  }

  getServantTimePerItem(recipe: CraftingRecipe): number {
    return this.servantSystem.getTimePerItem(recipe);
  }

  startServantOrder(recipe: CraftingRecipe, quantity: number): boolean {
    return this.servantSystem.startOrder(recipe, quantity);
  }

  cancelServantOrder(): boolean {
    return this.servantSystem.cancelOrder();
  }

  getServantOrderTimeLeftMs(): number {
    return this.servantSystem.getOrderTimeLeftMs();
  }

  /** Internal: the house calls this when a facility is put away. */
  stopServantIfFacilityGone(storedName: string): void {
    this.servantSystem.stopIfFacilityGone(storedName);
  }

  devHireServant(servantId: string): void {
    this.servantSystem.devHire(servantId);
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

  devResetQuests(achievementIds: string[] = []): void {
    this.questSystem.devResetQuests(achievementIds);
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
