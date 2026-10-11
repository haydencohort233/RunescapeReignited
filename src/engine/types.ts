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
 * Static content definition for a building — lives in content/buildings.ts,
 * never in GameState. The save only records how many of each the player
 * owns (GameState.buildings), so changing a rate or cost here reaches
 * existing saves on their next load.
 */
export interface BuildingDefinition {
  id: string;
  name: string;
  /** What this building produces. */
  resource: ResourceId;
  /** Per unit owned, BEFORE modifiers are applied. */
  baseRatePerSecond: number;
  /** Cost of the first unit. Omit for buildings that aren't
   *  player-purchasable (e.g. a quest-granted building, or base income).
   *  Buildings without a baseCost can't be sold either. */
  baseCost?: RecipeInput[];
  /** Multiplier applied per unit already owned — e.g. 1.15 means the Nth
   *  purchase costs baseCost * 1.15^N. Defaults to DEFAULT_COST_SCALING_FACTOR
   *  in engine/tuning.ts if omitted. */
  costScalingFactor?: number;
  /** Gates whether this building can be purchased/discovered yet. Omit for
   *  buildings available from the start. Enforced by the engine itself
   *  (purchaseBuilding checks it), not just the UI. */
  unlockCondition?: UnlockCondition;
  /** Hard cap on how many one player can own. Omit for no limit. */
  maxOwned?: number;
  /** Owned from the start of a new game (or granted to an older save the
   *  first time it loads with this building in content). */
  startingQuantity?: number;
  /** Construction XP per unit bought. */
  constructionXp?: number;
}

/** Everything static the engine needs to look up at runtime. Passed in at
 *  construction; the engine has no import-level dependency on content/. */
export interface GameContent {
  buildings: BuildingDefinition[];
  items: ItemDefinition[];
  quests: QuestDefinition[];
  shops: ShopDefinition[];
  /** NPCs that offer a service (recharging jewellery). Optional so test
   *  content can leave it out. */
  npcs?: NpcDefinition[];
  /** Combat spells a magic weapon can cast. */
  spells?: SpellDefinition[];
  /** Station type -> the location ids that have one, so the engine can
   *  check a station recipe is started where its station is. */
  stationLocations?: Partial<Record<StationType, string[]>>;
  /** Tools every save is given once. */
  starterKit?: string[];
  /** Enemies, needed by dungeons to start each wave themselves. */
  enemies?: EnemyDefinition[];
  dungeons?: DungeonDefinition[];
}

/** A run of fights: waves, then a boss, with a regear stop before the boss.
 *  Only a small loadout comes in, not the whole inventory. */
export interface DungeonDefinition {
  id: string;
  name: string;
  locationId: string;
  /** Enemy ids fought in order, one after another. */
  waves: string[];
  bossId: string;
  /** How many loadout slots: each gear piece or food takes one; a stack of
   *  anything else (runes) takes one. */
  loadoutSlots: number;
  unlockCondition?: UnlockCondition;
  /** Set when the boss is beaten. */
  clearFlag?: string;
}

/** One thing brought into a dungeon: a specific copy, or a quantity of a stack. */
export interface LoadoutEntry {
  itemDefId: string;
  instanceId?: string;
  quantity: number;
}

/** A dungeon in progress. Waves run as ordinary combat sessions tagged
 *  with the dungeon id; between the last wave and the boss the run waits
 *  (awaitingBoss) so the player can regear from the loadout. */
export interface DungeonRun {
  dungeonId: string;
  /** Waves cleared so far. waves.length means the boss is next. */
  wavesCleared: number;
  awaitingBoss: boolean;
  loadout: LoadoutEntry[];
}

/** A combat spell: fixed max hit, runes used up per cast. */
export interface SpellDefinition {
  id: string;
  name: string;
  levelRequired: number;
  maxHit: number;
  /** Magic XP per cast, on top of the per-kill combat XP. */
  baseXp: number;
  runes: RecipeInput[];
}

/** A character at a location who talks and may offer a paid service. */
export interface NpcDefinition {
  id: string;
  name: string;
  locationId: string;
  /** Lines said when talked to, one picked at random. */
  dialogue: string[];
  services?: ("recharge" | "repair")[];
}

export interface ShopItem {
  itemDefId: string;
  /** Cost per unit. Almost always just GP, but this is a RecipeInput[] (the
   *  same shape building/recipe costs use) rather than a single number, so
   *  a resource-priced or multi-resource-priced item — or trading — works
   *  without changing this shape later. */
  price: RecipeInput[];
}

export interface ShopDefinition {
  id: string;
  npcName: string;
  title: string;
  /** The MapLocation id this shop is accessible from — you have to
   *  physically be there, checked inside GameEngine.buyFromShop and
   *  sellToShop (so it's enforced, not just hidden). */
  locationId: string;
  items: ShopItem[];
  /** Whether the shop buys items from the player (anything with a value,
   *  at SHOP_SELL_PRICE_FRACTION of it — see engine/tuning.ts). */
  buysItems?: boolean;
  /** Lines the shopkeeper says when talked to, one picked at random. */
  dialogue?: string[];
  /** Repairs worn and broken gear for gold (Bob, as in OSRS). */
  repairs?: boolean;
}

/**
 * One step of a quest. A stage without `consumes` completes on its own as
 * soon as its objective is met; a stage with `consumes` is a delivery the
 * player hands over explicitly (advanceQuest), so items are never taken
 * without them asking.
 */
export interface QuestStage {
  description: string;
  /** Counters (statisticAtLeast etc.) count from when the stage began. */
  objective: UnlockCondition;
  consumes?: RecipeInput[];
}

export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  /** Gates starting the quest. Omit for quests available from the start. */
  startCondition?: UnlockCondition;
  stages: QuestStage[];
  reward?: {
    gp?: number;
    items?: { itemDefId: string; quantity: number }[];
    /** skillId -> XP. */
    xp?: Record<string, number>;
    /** Flags set on completion — how a quest unlocks locations, buildings,
     *  jobs or other quests. */
    setFlags?: string[];
  };
}

/** Saved per started quest. `stage` === stages.length means complete. */
export interface QuestProgress {
  stage: number;
  /** Counter snapshots for the current stage's objective. */
  baselines: Record<string, number>;
}

export type ModifierType = "multiplicative" | "additive";

/**
 * A modifier alters a numeric value — a resource's production rate, XP
 * gains, travel speed, and so on. target: a ResourceId, a namespaced key
 * like "xp:woodcutting", or the special value "all".
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
  | "ammo"
  /** Food worn here is what fights eat from (Melvor-style). A whole stack,
   *  like ammo. */
  | "food";

/** Which family of combat a weapon fights with. Unarmed and any weapon
 *  without one fight in melee. */
export type AttackStyle = "melee" | "ranged" | "magic";

/** What a gathering recipe needs in hand. */
export type ToolType = "axe" | "pickaxe" | "net" | "rod" | "harpoon" | "tinderbox";

/** A tool's effect: the best usable one the player owns sets the speed. */
export interface ToolStats {
  type: ToolType;
  /** Multiplies time per item; 0.9 = 10% faster. Bronze is 1. */
  speedMultiplier: number;
  /** Gates USING the tool (not owning it), e.g. Woodcutting 41 for a rune axe. */
  requirement?: UnlockCondition;
}

export type ItemRarity = "common" | "uncommon" | "rare" | "legendary";

export type ItemActionId = "equip" | "unequip" | "drop" | "examine" | "eat" | "craft" | "teleport" | "bury";

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
  category: "weapon" | "armor" | "consumable" | "material" | "tool" | "misc";
  rarity?: ItemRarity;
  /** Stackable items are a plain count in the ledger (GameState.resources),
   *  same as currencies. Non-stackable items (equipment) get one instance
   *  per copy, since only they need per-copy state (durability, which
   *  specific one is worn). */
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
  /** Food: HP restored per bite (before "healing" modifiers). Gives the
   *  item an "eat" action its meaning. */
  healAmount?: number;
  /** Base value in GP — what shops pay a fraction of (see tuning.ts).
   *  Omit for items no shop will buy. */
  value?: number;
  /** Teleports the player directly to this location id when the "teleport"
   *  action is used — bypasses normal travel time entirely. Uses a charge
   *  when the item has maxCharges. */
  teleportTo?: string;
  /** Jewellery charges (Amulet of Glory: 4). Kept per copy on
   *  ItemInstance.charges; an NPC recharges them for gold. */
  maxCharges?: number;
  /** GP per charge to recharge (see content/npcs.ts). */
  rechargeCostGp?: number;
  /** Weapon-only: melee (default), ranged (needs ammo) or magic (casts the
   *  selected spell). */
  attackStyle?: AttackStyle;
  /** Weapon-only: id of its special attack (engine/specialAttacks.ts). */
  specialAttack?: string;
  /** Rune ids this item supplies without limit while worn (Air Staff: air). */
  infiniteRunes?: string[];
  /** Makes this item a gathering tool. */
  tool?: ToolStats;
  /** Prayer XP for burying or scattering one. Gives "bury" its meaning. */
  prayerXp?: number;
  /** Degrading gear (Barrows-style), with maxDurability: when durability
   *  reaches 0 the copy turns into this item. Omit to have it dissolve. */
  brokenItemId?: string;
  /** On a broken item: the item a repair turns it back into. */
  repairsTo?: string;
  /** GP for a full repair from 0; partial wear costs its share. */
  repairCostGp?: number;
  /** Which actions show up in the click-panel / right-click quick-menu for
   *  this item. Adding a new action to an item is just adding its id here —
   *  no new component code needed unless the action itself is brand new.
   *  "examine" covers both flavor text AND stats now — no separate showStats. */
  actions: ItemActionId[];
}

/**
 * One copy of a non-stackable item (equipment) the player owns — each copy
 * is tracked separately because it can be worn or carry durability.
 * Stackable items are plain counts in GameState.resources instead; see
 * engine/ledger.ts.
 */
export interface ItemInstance {
  instanceId: string;
  itemDefId: string;
  durability?: number; // present only if the definition has maxDurability
  charges?: number; // present only if the definition has maxCharges
}

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
  quest: 10000,
  "offline-summary": 20000,
  achievement: null, // the only kind that stays until dismissed: it's a big deal
  debug: 10000,
  error: 12000,
};

export interface GameState {
  resources: Record<ResourceId, ResourceState>;
  /** buildingId -> how many the player owns. Stats live in content. */
  buildings: Record<string, number>;
  modifiers: Record<string, Modifier>;
  skills: Record<string, SkillState>;
  /** Arbitrary boolean flags — quest completion, one-time events, discovery
   *  states. The generic substrate that UnlockCondition checks read from. */
  flags: Record<string, boolean>;
  /** Non-stackable items the player owns, one entry per copy. Stackable
   *  items live in `resources` — see engine/ledger.ts. */
  inventory: Record<string, ItemInstance>;
  /** slot -> the instanceId currently worn there. Absent key = nothing worn. */
  equipment: Partial<Record<EquipSlot, string>>;
  /** Whatever the player is doing right now — crafting, gathering,
   *  traveling or fighting. One field, not four, so "one thing at a time"
   *  holds by construction. */
  activeAction: ActiveAction | null;
  /** Current HP — max is derived from the Hitpoints skill level, not
   *  stored separately. Not clamped on read by the type system; the
   *  engine clamps to [0, maxHp] whenever it mutates this. */
  currentHp: number;
  /** The food last picked for a fight, preselected for the next one. */
  lastCombatFoodId?: string;
  /** Special attack energy, 0 to 100. Regenerates over time. */
  specialEnergy: number;
  /** The chosen combat style id per attack style (see engine/combatStyles.ts). */
  combatStyles: Record<AttackStyle, string>;
  /** The combat spell a magic weapon casts (engine/spells.ts). */
  selectedSpellId?: string;
  /** The dungeon being run, if any. While set, only loadout items can be
   *  used and nothing else can be started. */
  dungeonRun: DungeonRun | null;
  jobs: JobBoardState;
  /** questId -> progress, for quests the player has started. */
  quests: Record<string, QuestProgress>;
  /** Where the player currently is on the world map — a MapLocation id. */
  currentLocationId: string;
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

export type ActiveAction =
  | ({ kind: "craft" } & ActiveCraftJob)
  | ({ kind: "gather" } & ActiveGatherSession)
  | ({ kind: "travel" } & ActiveTravel)
  | ({ kind: "combat" } & ActiveCombatSession);

export interface SkillState {
  xp: number;
}

/** An amount of anything in the ledger: a currency (gp), a stackable item
 *  (wood, bones), or a non-stackable item (bronze-dagger). Used for costs,
 *  recipe inputs and outputs, deliveries and prices alike. */
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
  // equals defaults to true. `label` is what to tell the player while it's
  // unmet ("Complete the quest The Overgrown Den"); flags are internal ids.
  | { kind: "flag"; flag: string; equals?: boolean; label?: string }
  | { kind: "resourceAtLeast"; resource: ResourceId; amount: number }
  | { kind: "resourceLifetimeAtLeast"; resource: ResourceId; amount: number } // milestone — never re-locks
  | { kind: "buildingOwned"; buildingId: string; atLeast: number }
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
    items?: { itemDefId: string; quantity: number }[];
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
    items?: { itemDefId: string; quantity: number }[];
    /** Sets these flags on completion — the quest-chaining hook described above. */
    setFlags?: string[];
  };
  /** How often the job can be done:
   *    "daily"      (default) — once per UTC day, then it's back tomorrow.
   *    "once"       — never again after it's turned in. Use this for jobs
   *                   that set flags or otherwise act like a quest step.
   *    "repeatable" — can be accepted again right after turn-in.
   *  Objectives that count something (statisticAtLeast,
   *  resourceLifetimeAtLeast) always count from the moment of accepting. */
  frequency?: "daily" | "once" | "repeatable";
}

export interface AcceptedJob {
  acceptedAt: number;
  /** The UTC daily period (see getDailyPeriodNumber) the job was accepted
   *  in. Once the current period moves on, the job auto-expires
   *  (resolveJobExpiry) rather than lingering past the board reset. */
  acceptedPeriod: number;
  /** Counter values at acceptance, so the objective measures progress made
   *  since then — see captureBaselines in unlockConditions.ts. */
  baselines: Record<string, number>;
}

export interface JobBoardState {
  accepted: Record<string, AcceptedJob>;
  /** Daily jobs: the UTC period each was last turned in. Done for today
   *  while it matches the current period. */
  lastCompletedPeriod: Record<string, number>;
  /** "once" jobs that have been turned in, permanently. */
  completedOnce: Record<string, true>;
}

/**
 * Static content definition for a craftable item — lives in your content/data
 * layer (not GameState). Passed into engine.startCraftJob() by the caller.
 */
export interface BonusDrop {
  resource: ResourceId;
  amount: number;
  /** 0-1, rolled once per item made. */
  chance: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  skill: string;
  xpPerItem: number;
  timePerItemMs: number;
  inputs: RecipeInput[];
  output: RecipeInput;
  /** What the player is shown as doing while this runs ("Burning Logs",
   *  "Chopping Willows"). Omit to use the skill's own (see SkillDefinition). */
  activityLabel?: string;
  /** Extra chance-based rewards per item made, rolled separately for each
   *  item (e.g. burning a log: 10% chance of coal). */
  bonusDrops?: BonusDrop[];
  /** Gates STARTING this recipe (batch craft or gather session) — e.g.
   *  Woodcutting level 30 for Willow Trees. Enforced by the engine itself
   *  in startCraftJob/startGatherSession, same "engine enforces it, not
   *  just the UI" pattern as equipRequirement/purchaseBuilding. */
  unlockCondition?: UnlockCondition;
  /** A gathering recipe that needs a tool (axe, net...) owned to start.
   *  The best usable one speeds it up. */
  tool?: ToolType;
  /** Only startable at an amenity of this station type (a range, a furnace). */
  station?: StationType;
}

export type StationType = "range" | "furnace" | "anvil";

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
  output: RecipeInput;
  bonusDrops?: BonusDrop[];
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
  output: RecipeInput;
  startedAt: number;
  bonusDrops?: BonusDrop[];
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
  /** Magic level, which defends against spells. Optional for sessions
   *  saved before Magic combat; falls back to enemyDefence. */
  enemyMagic?: number;
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
  /** Fields below are optional for sessions saved before they existed:
   *  missing means a melee fight with no ranged/magic bonuses. */
  attackStyle?: AttackStyle;
  playerRangedBonus?: number;
  playerRangedStrength?: number;
  playerMagicBonus?: number;
  /** Ranged: the arrow stack used up one per shot. */
  ammoItemId?: string;
  /** Magic: the spell cast every attack, locked in at the start. */
  spellId?: string;
  /** Runes the worn staff supplies, locked in with the spell. */
  infiniteRunes?: string[];
  /** The weapon's special attack, if it has one. */
  specialAttackId?: string;
  /** The next swing is a special attack (armed by the player). */
  specArmed?: boolean;
  /** Damage over time on the enemy, resolved on its own timer. */
  bleed?: BleedState;
  /** Set when this fight is a wave or boss of a dungeon run. */
  dungeonId?: string;
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
  /** "Keep fighting": after a kill, the same enemy respawns and the fight
   *  continues — offline too — until death, flee, or running low on HP
   *  with no food. */
  autoRepeat: boolean;
  /** Food eaten automatically when HP drops below AUTO_EAT_BELOW_HP_FRACTION.
   *  Cleared when it runs out. */
  autoEatItemId?: string;
  /** Kills during this session (more than one with autoRepeat). */
  kills: number;
  /** Last N events (most recent last) — "so I can tell what's going on".
   *  Capped and cleared with the rest of the session when the fight ends;
   *  this is live-fight visibility, not a persistent combat history. */
  log: CombatLogEntry[];
  /** Total entries ever logged this session. `log` is capped, so its
   *  length stops changing; the UI uses this to tell what's new. Optional
   *  for sessions saved before it existed. */
  logCount?: number;
  /** When the player last swung — rate-limits "Attack Now". */
  lastPlayerAttackAt?: number;
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
  outcome: "miss" | "block" | "hit" | "bleed";
  damage: number;
  /** Part of a special attack. */
  special?: boolean;
}

export interface BleedState {
  damagePerHit: number;
  hitsLeft: number;
  intervalMs: number;
  startedAt: number;
  resolved: number;
}

export interface LootEntry {
  /** Any ledger id — an item or a currency. Omit for a "nothing" roll — a
   *  valid, intentional outcome in a table, not an error case. */
  id?: string;
  quantityMin?: number;
  quantityMax?: number;
  weight: number;
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
  /** Total combat XP per kill: HITPOINTS_XP_SHARE to Hitpoints, the rest
   *  split across the skills the player's combat style trains. */
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