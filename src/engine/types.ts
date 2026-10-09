// ─────────────────────────────────────────────────────────────────────────
// Core engine types. Keep this file framework-agnostic — no React imports.
// ─────────────────────────────────────────────────────────────────────────

/** A resource is anything the player accumulates: GP, Wood, Coal, Raw Fish, etc. */
export type ResourceId = string;

export interface ResourceState {
  amount: number;
  /** Lifetime total ever earned — useful for stats/achievements, never decreases. */
  lifetimeEarned: number;
}

/**
 * A producer generates a resource over time. Buildings are producers.
 * baseRatePerSecond is BEFORE modifiers are applied.
 */
export interface Producer {
  id: string;
  name: string;
  resource: ResourceId;
  baseRatePerSecond: number;
  /** How many of this producer the player owns (buildings can be bought multiple times). */
  quantity: number;
  /** Cost of the NEXT purchase, before scaling is applied for quantity already owned.
   *  Omit for producers that aren't player-purchasable (e.g. a quest-granted building). */
  baseCost?: RecipeInput[];
  /** Multiplier applied per unit already owned — e.g. 1.15 means the Nth purchase
   *  costs baseCost * 1.15^N. Defaults to 1.15 (a common idle-game curve) if omitted. */
  costScalingFactor?: number;
  /** Gates whether this producer can be purchased/discovered yet. Omit for
   *  producers available from the start. Enforced by the engine itself
   *  (purchaseProducer checks it), not just the UI. */
  unlockCondition?: UnlockCondition;
}

export type ModifierType = "multiplicative" | "additive";

/**
 * A modifier alters the effective rate of a resource or producer.
 * target: a ResourceId, a Producer id, or the special value "all".
 * Multiplicative modifiers are combined by multiplying; additive by summing,
 * then applied as (base + additiveSum) * multiplicativeProduct.
 */
export interface Modifier {
  id: string;
  source: "item" | "event" | "quest" | "buff" | "debuff";
  target: ResourceId | "all";
  type: ModifierType;
  value: number;
  /** Absolute epoch ms when this modifier stops applying. Omit for permanent modifiers. */
  expiresAt?: number;
  label: string;
}

/** Only meaningful for melee weapons — Ranged/Magic don't use this. */
export type WeaponType = "stab" | "slash" | "crush";

export type EquipSlot =
  | "head"
  | "cape"
  | "neck"
  | "weapon"
  | "body"
  | "shield"
  | "legs"
  | "hands"
  | "feet"
  | "ring"
  | "ammo";

export type ItemRarity = "common" | "uncommon" | "rare" | "legendary";

export type ItemActionId = "equip" | "unequip" | "drop" | "examine" | "eat" | "craft" | "teleport";

/**
 * Static content definition for an inventory item — lives in content/items.ts,
 * not GameState. Distinct from a resource: resources are fungible counts
 * (wood, gp), items are individually tracked instances (see ItemInstance)
 * because equipment needs per-copy state (durability, equipped-or-not) that
 * a single number can't represent.
 */
export interface ItemDefinition {
  id: string;
  name: string;
  description: string; // examine text
  /** Placeholder for real art later — an emoji or short code is fine for now. */
  image?: string;
  category: "weapon" | "armor" | "consumable" | "material" | "misc";
  rarity?: ItemRarity;
  /** Most non-equipment items stack into a single inventory slot (a running
   *  count) — equipment stays one-instance-per-copy since only equipment
   *  needs per-copy state (durability, which specific one is worn). */
  stackable: boolean;
  /** If true, only one copy can ever exist at once — addItem refuses to
   *  create/stack a second one. For one-of-a-kind items you don't want
   *  duplicated (a unique quest reward, etc.). Off by default. */
  unique?: boolean;
  equipSlot?: EquipSlot;
  maxDurability?: number;
  /** Combat/skill bonuses, loosely modeled on OSRS wiki values — approximate
   *  for now, easy to tune later since it's just a flat map. */
  stats?: Record<string, number>;
  /** Gates EQUIPPING (not owning/carrying) the item — e.g. Attack level 60
   *  for a Dragon Scimitar. You can hold an item you don't meet this for,
   *  same as OSRS; the engine just refuses the equip action itself. */
  equipRequirement?: UnlockCondition;
  /** Weapon-only — how the player's attack timer paces (weapon-slot items
   *  ONLY; falls back to UNARMED_ATTACK_SPEED_MS if unset/unequipped). A
   *  slow weapon with a big strength bonus and a fast weapon with a small
   *  one is the intended tradeoff — nothing enforces that balance, it's on
   *  the content author. */
  attackSpeedMs?: number;
  /** Weapon-only — stab/slash/crush. Matching an enemy's `weakness` (see
   *  EnemyDefinition) applies a damage bonus. */
  weaponType?: WeaponType;
  /** Look for a .gif instead of a .png — for rares/enchanted items with
   *  animated art (firecape-style). Purely an asset-path concern; has no
   *  mechanical effect. */
  animated?: boolean;
  /** Sub-folder path under /assets/items/ — e.g. "Armor/Bronze" puts this
   *  at /assets/items/Armor/Bronze/<slug>.png. Keeps the items directory
   *  browsable at scale instead of one flat folder with 1,000 entries.
   *  Omit for a top-level item. */
  assetFolder?: string;
  /** Teleports the player directly to this location id when the "teleport"
   *  action is used — bypasses normal travel time entirely. Not charge-
   *  limited yet (see maxDurability note above). */
  teleportTo?: string;
  /** Which actions show up in the click-panel / right-click quick-menu for
   *  this item. Adding a new action to an item is just adding its id here —
   *  no new component code needed unless the action itself is brand new.
   *  "examine" covers both flavor text AND stats now — no separate showStats. */
  actions: ItemActionId[];
}

/**
 * One actual copy (or, for a stackable item, the ONE stack entry) of an item
 * the player owns. itemDefId points into ItemDefinition content.
 */
export interface ItemInstance {
  instanceId: string;
  itemDefId: string;
  /** Present only for stackable items — the running count in that single slot. */
  quantity?: number;
  durability?: number; // present only if the definition has maxDurability
}

/** What a crafting recipe produces — either a fungible resource (existing
 *  behavior) or item instances (new). Kept as a discriminated union so
 *  resolveCraftJob can branch on it without recipes needing two shapes.
 *  stackable/unique are denormalized from the ItemDefinition at
 *  content-authoring time (same pattern ActiveCraftJob already uses) so the
 *  engine never needs a content-catalog lookup to resolve a job. */
export type RecipeOutput =
  | { kind: "resource"; resource: ResourceId; amount: number }
  | { kind: "item"; itemDefId: string; quantity: number; stackable: boolean; unique?: boolean };

/**
 * Static content definition for a world-map location — lives in
 * content/mapLocations.ts, not GameState. x/y are coordinates on the map
 * image's coordinate space (whatever size that ends up being — the engine
 * only cares about relative distance, not the image's actual pixel size).
 */
export interface MapLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Gates whether this location can be traveled TO. */
  unlockCondition?: UnlockCondition;
  /** Flag set automatically the first time the player arrives here — e.g.
   *  Lake Shore sets "discoveredLakeShore", which the Fishing Hut building
   *  is waiting on. Works via both normal travel and teleport. */
  onArriveSetFlag?: string;
}

/** The in-progress walk to a location — denormalized destination name for
 *  notification text, same pattern as ActiveCraftJob. Duration is fixed at
 *  travel-start time (distance × pace, after speed modifiers), not
 *  recomputed mid-travel — consistent with how crafting locks in its
 *  duration up front too. */
export interface ActiveTravel {
  destinationLocationId: string;
  destinationName: string;
  startedAt: number;
  durationMs: number;
  onArriveSetFlag?: string;
}
export type NotificationSeverity = "info" | "warning" | "error";

export type NotificationType =
  | "reward"
  | "quest"
  | "production"
  | "offline-summary"
  | "status"
  | "achievement"
  | "debug"
  | "error";

export interface GameNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  message: string;
  timestamp: number;
  /** Debug/dev-only notifications are hidden from normal players by default. */
  devOnly?: boolean;
  /**
   * Milliseconds until this notification auto-dismisses. null/undefined means
   * it persists until the player manually dismisses it (used for errors,
   * dev logs, and anything worth actually reading — offline summaries, quests).
   */
  durationMs?: number | null;
}

/** Auto-dismiss defaults by type. Ambient/flavor notifications clear themselves;
 *  anything worth reading (or debugging) sticks around until dismissed. */
export const DEFAULT_NOTIFICATION_DURATIONS: Record<NotificationType, number | null> = {
  reward: 6000,
  production: 6000,
  status: 5000,
  quest: null,
  "offline-summary": null,
  achievement: null, // stays until dismissed — it's a big deal, don't auto-clear it
  debug: null,
  error: null,
};

export interface GameState {
  resources: Record<ResourceId, ResourceState>;
  producers: Record<string, Producer>;
  modifiers: Record<string, Modifier>;
  skills: Record<string, SkillState>;
  /** Arbitrary boolean flags — quest completion, one-time events, discovery
   *  states. The generic substrate that UnlockCondition checks read from. */
  flags: Record<string, boolean>;
  /** Individually-tracked items the player owns — see ItemInstance for why
   *  these aren't just another resource count. */
  inventory: Record<string, ItemInstance>;
  /** slot -> the instanceId currently worn there. Absent key = nothing worn. */
  equipment: Partial<Record<EquipSlot, string>>;
  /** Only one crafting job runs at a time in v1 — extend to an array/queue later if needed. */
  activeCraftJob: ActiveCraftJob | null;
  activeGatherSession: ActiveGatherSession | null;
  /** Current HP — max is derived from the Hitpoints skill level, not
   *  stored separately. Not clamped on read by the type system; the
   *  engine clamps to [0, maxHp] whenever it mutates this. */
  currentHp: number;
  activeCombatSession: ActiveCombatSession | null;
  /** jobId -> acceptance record. Completion status lives in flags
   *  (jobCompleted:<id>, one-time only) and statistics (jobCompletions:<id>,
   *  a running count for repeatable ones) — same reused substrates as
   *  everything else, not a new tracking mechanism. */
  /** jobId -> acceptance record. acceptedPeriod is the UTC daily period
   *  (see getDailyPeriodNumber) the job was accepted in — if the CURRENT
   *  period no longer matches, the job auto-expires (resolveJobExpiry)
   *  rather than lingering forever tied to a shift that's already reset.
   *  Completion status lives in `statistics` (jobCompletedPeriod:<id>),
   *  same reused-substrate approach as everything else. */
  acceptedJobs: Record<string, { acceptedAt: number; acceptedPeriod: number }>;
  /** Where the player currently is on the world map — a MapLocation id. */
  currentLocationId: string;
  /** In-progress travel, if any. Only one trip at a time, same "single
   *  action" rule as crafting. */
  activeTravel: ActiveTravel | null;
  /** Counters — building purchases, resource spend, travel time, craft
   *  completions, etc. Keyed by convention (see gameEngine.ts's
   *  incrementStatistic call sites for the actual key strings in use).
   *  Some entries (totalLevel, totalExp, gp:earned) are recomputed each
   *  tick from other state rather than incremented piecemeal. */
  statistics: Record<string, number>;
  /** Epoch ms of the last time the engine resolved elapsed time. Authoritative clock anchor. */
  lastTickTimestamp: number;
  /** Max real-world ms of absence that counts toward production/crafting rewards.
   *  Kept in state (not a constant) so future upgrades/items can extend it. */
  offlineCapMs: number;
  /** Schema version, bump when GameState shape changes — see migrations in gameEngine.ts. */
  version: number;
}

export interface SkillState {
  xp: number;
}

export interface RecipeInput {
  resource: ResourceId;
  amount: number;
}

/**
 * Generic gating check, shared by buildings, map locations, and quests.
 * Composable via "all"/"any" so content can express "level 10 fletching AND
 * quest X done" without each system inventing its own combinator.
 */
export type UnlockCondition =
  | { kind: "skillLevel"; skill: string; atLeast: number }
  | { kind: "flag"; flag: string; equals?: boolean } // equals defaults to true
  | { kind: "resourceAtLeast"; resource: ResourceId; amount: number }
  | { kind: "resourceLifetimeAtLeast"; resource: ResourceId; amount: number } // milestone — never re-locks
  | { kind: "producerOwned"; producerId: string; atLeast: number }
  | { kind: "statisticAtLeast"; statistic: string; atLeast: number } // see GameState.statistics
  | { kind: "all"; conditions: UnlockCondition[] }
  | { kind: "any"; conditions: UnlockCondition[] };

/**
 * Static content definition for an achievement — lives in
 * content/achievements.ts, not GameState. Whether it's been earned is
 * tracked via the ordinary flags store (key: "achievement:<id>") rather
 * than a dedicated field — same reuse-the-existing-substrate approach as
 * everything else gated by UnlockCondition.
 */
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  condition: UnlockCondition;
  reward?: {
    gp?: number;
    achievementPoints?: number;
    items?: { itemDefId: string; quantity: number; stackable: boolean }[];
  };
}

/**
 * A job board task — accept, do the thing, turn in for a reward. Reuses
 * UnlockCondition for the objective (a delivery is just resourceAtLeast,
 * "reach level 15" is just skillLevel — no job-board-specific condition
 * types needed) and the same reward shape achievements use.
 *
 * Two things make this the natural doorway into quests, not a separate
 * system: `setFlags` lets completing a job unlock a building/location/next
 * job exactly the same way arriving somewhere or hitting a milestone
 * already does, and nothing here assumes jobs are simple — a "job" that
 * sets a flag chaining to another job IS a quest, mechanically.
 */
export interface JobDefinition {
  id: string;
  title: string;
  description: string;
  objective: UnlockCondition;
  /** Only meaningful for a "bring me X" style job — resources to deduct on
   *  turn-in. Omit for a pure milestone job (nothing to consume, the
   *  objective check alone is the whole task). Kept separate from
   *  `objective` rather than inferred from it, since a job could check
   *  resourceAtLeast WITHOUT consuming (a "show me you have X" checkpoint). */
  consumesOnTurnIn?: RecipeInput[];
  reward?: {
    /** Modifier-scalable via "jobReward:gp" / "jobReward:all" / "all". */
    gp?: number;
    /** Modifier-scalable via "jobReward:achievementPoints" / "jobReward:all" / "all". */
    achievementPoints?: number;
    /** NEVER modifier-scaled — a fixed count is a fixed count. */
    items?: { itemDefId: string; quantity: number; stackable: boolean }[];
    /** Sets these flags on completion — the quest-chaining hook described above. */
    setFlags?: string[];
  };
  /** Default false. One-time jobs are permanently done once turned in
   *  (tracked via flags, same substrate as achievements); repeatable ones
   *  can be accepted again immediately after turn-in. */
  repeatable?: boolean;
}

/**
 * Static content definition for a craftable item — lives in your content/data
 * layer (not GameState). Passed into engine.startCraftJob() by the caller.
 */
export interface CraftingRecipe {
  id: string;
  name: string;
  skill: string;
  xpPerItem: number;
  timePerItemMs: number;
  inputs: RecipeInput[];
  output: RecipeOutput;
  /** Gates STARTING this recipe (batch craft or gather session) — e.g.
   *  Woodcutting level 30 for Willow Trees. Enforced by the engine itself
   *  in startCraftJob/startGatherSession, same "engine enforces it, not
   *  just the UI" pattern as equipRequirement/purchaseProducer. */
  unlockCondition?: UnlockCondition;
}

/**
 * The live, in-progress job — denormalized from whatever CraftingRecipe
 * started it, so the engine can resolve completions without needing a
 * recipe registry. Materials for the full requested quantity are deducted
 * up front when the job starts.
 */
export interface ActiveCraftJob {
  recipeId: string;
  recipeName: string;
  skill: string;
  xpPerItem: number;
  timePerItemMs: number;
  output: RecipeOutput;
  /** What was actually deducted at start — used to compute a refund if cancelled early. */
  inputsPerItem: RecipeInput[];
  startedAt: number;
  quantityTotal: number;
  quantityCompleted: number;
}

/**
 * An open-ended gathering activity (Woodcutting, eventually Fishing/Mining/
 * etc.) — distinct from ActiveCraftJob because it has no fixed quantity to
 * complete. It just runs until maxDurationMs elapses, or (if set) until too
 * long passes without a keepGatherSessionAlive() call, or the player stops
 * it manually. Reuses CraftingRecipe content — the same recipe shape works
 * for both a fixed-batch job and an open-ended session; which one a given
 * resource node uses is a UI/amenity-content decision, not a recipe one.
 */
export interface ActiveGatherSession {
  amenityId: string;
  recipeId: string;
  recipeName: string;
  skill: string;
  xpPerItem: number;
  timePerItemMs: number;
  output: RecipeOutput;
  startedAt: number;
  /** Running total granted so far this session. */
  quantityGathered: number;
  /** Hard cap — the session ends on its own after this much elapsed time,
   *  regardless of anything else. */
  maxDurationMs: number;
  /** If set, the session also ends early if this much time passes without
   *  a keepGatherSessionAlive() call — e.g. "click the tree every 2 hours
   *  or it stops." Omit for a plain time-capped session. */
  requiresKeepAliveEveryMs?: number;
  lastKeepAliveAt?: number;
}

/**
 * An in-progress fight. Auto-resolves in rounds via resolveElapsed (same
 * tick-driven pattern as everything else), with an optional interactive
 * "attack now" override for players who want to watch/click instead of
 * letting it run passively. Enemy stats are denormalized from
 * EnemyDefinition at start time (same pattern ActiveCraftJob uses for
 * recipes) so the engine never needs a content-catalog lookup mid-fight.
 */
export interface ActiveCombatSession {
  enemyId: string;
  enemyName: string;
  enemyMaxHp: number;
  enemyCurrentHp: number;
  enemyAttack: number;
  enemyStrength: number;
  enemyDefence: number;
  enemyAttackBonus: number;
  enemyStrengthBonus: number;
  enemyDefenceBonus: number;
  enemyWeakness?: WeaponType;
  canFlee: boolean;
  xpReward: number;
  lootTable: LootEntry[];
  /** Death-penalty percentages, resolved once at combat start (enemy
   *  override merged over the global default) — see applyDeathPenalty. */
  deathPenaltyGpLossPercent: number;
  deathPenaltyResourceLossPercent: number;
  /** Equipment bonuses snapshotted at combat START, not re-fetched from
   *  content every round — mid-fight equipping isn't a supported flow yet
   *  anyway. Skill LEVELS are still read live each attack (so leveling up
   *  mid-fight does matter), only the equipment portion is frozen. */
  playerAttackBonus: number;
  playerStrengthBonus: number;
  playerDefenceBonus: number;
  playerWeaponType?: WeaponType;
  /**
   * Player and enemy attack on INDEPENDENT timers — not one shared "round."
   * A fast dagger and a slow warhammer genuinely swing at different rates,
   * and the enemy paces on its own attackSpeedMs regardless of what the
   * player's wielding — same as real OSRS, where your weapon speed and the
   * monster's aren't synchronized. Each side tracks its own anchor time
   * and completed-attack count, resolved as an interleaved priority queue
   * (see resolveCombatSession) rather than one combined interval.
   */
  playerAttackSpeedMs: number;
  enemyAttackSpeedMs: number;
  playerStartedAt: number;
  enemyStartedAt: number;
  playerAttacksResolved: number;
  enemyAttacksResolved: number;
  /** Last N events (most recent last) — "so I can tell what's going on".
   *  Capped and cleared with the rest of the session when the fight ends;
   *  this is live-fight visibility, not a persistent combat history. */
  log: CombatLogEntry[];
}

export interface CombatLogEntry {
  timestamp: number;
  attacker: "player" | "enemy";
  /** The categorization IS the future-animation/effect hook — a UI (or
   *  eventually a real animation/gif/sound system) keys off this rather
   *  than needing a separate unused "effect id" field:
   *    "miss"  — accuracy roll failed, attack didn't land at all
   *    "block" — accuracy roll succeeded, but the damage roll came up 0
   *    "hit"   — landed for real damage (> 0)
   *  OSRS visually shows "miss" and "block" the same way (both a "0"
   *  splat) despite being mechanically different rolls — kept as distinct
   *  categories here anyway since it costs nothing and gives a future UI
   *  more to work with than OSRS itself exposes. */
  outcome: "miss" | "block" | "hit";
  damage: number;
}

export interface LootEntry {
  /** Exactly one of these should be set. Omit both for a "nothing" roll —
   *  a valid, intentional outcome in a table, not an error case. */
  itemDefId?: string;
  resourceId?: string;
  quantityMin?: number;
  quantityMax?: number;
  weight: number;
  stackable?: boolean; // only relevant when itemDefId is set
}

export interface EnemyDefinition {
  id: string;
  name: string;
  isBoss?: boolean;
  maxHp: number;
  attack: number;
  strength: number;
  defence: number;
  ranged: number;
  magic: number;
  attackBonus: number;
  strengthBonus: number;
  defenceBonus: number;
  /** Total combat XP per kill — split evenly across Attack/Strength/
   *  Defence/Hitpoints for now (no combat-style selection UI yet). */
  xpReward: number;
  lootTable?: LootEntry[];
  /** Default true. Bosses typically set this false. */
  canFlee?: boolean;
  /** How often THIS enemy attacks — independent of the player's weapon
   *  speed (see ActiveCombatSession — each side paces on its own timer,
   *  same as real OSRS). Defaults to DEFAULT_ENEMY_ATTACK_SPEED_MS. */
  attackSpeedMs?: number;
  /** Matching the player's equipped weaponType applies a damage bonus. */
  weakness?: WeaponType;
  /** Overrides the default death-penalty percentages for dying to THIS
   *  enemy specifically — e.g. a boss/dungeon might hurt more than a
   *  regular overworld fight. Omit either field to use the global default. */
  deathPenalty?: { gpLossPercent?: number; resourceLossPercent?: number };
  /** HP-percentage thresholds that have their own "hurt" artwork — e.g.
   *  [50, 25] means `<slug>_50_hurt.png` and `<slug>_25_hurt.png` exist,
   *  swapped in as the enemy drops to/below each threshold. Omit entirely
   *  (the default) for an enemy whose art never changes — this is opt-in
   *  per enemy, not expected of every one. */
  degradeStages?: number[];
}