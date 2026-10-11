// Balance numbers in one place. These are starting values, not settled
// design: change them freely, nothing else needs to know.

/** Default cost multiplier per building already owned — the Nth purchase
 *  costs baseCost * factor^N. Buildings can override it per definition. */
export const DEFAULT_COST_SCALING_FACTOR = 1.15;

/** Selling a building refunds this fraction of what those units cost. */
export const BUILDING_SELL_REFUND_FRACTION = 0.5;

/** Shops pay this fraction of an item's value when you sell to them. */
export const SHOP_SELL_PRICE_FRACTION = 0.4;

/** With "keep fighting" on, the next enemy appears this long after a kill. */
export const ENEMY_RESPAWN_MS = 2400;

/** Auto-eat bites when HP drops below this fraction of max. Repeat fights
 *  also stop here when there's no food left, rather than fighting on
 *  toward a death while the player is away. */
export const AUTO_EAT_BELOW_HP_FRACTION = 0.5;

// ── Combat ──

/** Fastest anything can attack (one OSRS game tick). Also a safety floor:
 *  a 0 or negative speed in content would otherwise hang the combat loop. */
export const MIN_ATTACK_SPEED_MS = 600;

/** "Attack Now" can swing early, but no sooner than this fraction of the
 *  weapon's speed after the previous swing — otherwise clicking fast
 *  bypasses weapon speed entirely. */
export const ATTACK_NOW_MIN_INTERVAL_FRACTION = 0.5;

/** Default attack speed for an enemy that doesn't specify its own. */
export const DEFAULT_ENEMY_ATTACK_SPEED_MS = 3000;

/** How often the player attacks with no weapon equipped (or an equipped
 *  weapon that doesn't specify attackSpeedMs) — deliberately slower than
 *  most weapons, so going unarmed is a real downside, not a neutral
 *  default. */
export const UNARMED_ATTACK_SPEED_MS = 4000;

/** Damage multiplier when the player's weaponType matches the enemy's
 *  weakness. Applied to damage, not accuracy — using the right weapon
 *  hits harder, it doesn't make you hit more often. */
export const WEAKNESS_DAMAGE_MULTIPLIER = 1.25;

/** Share of GP lost on death, unless the enemy overrides it
 *  (EnemyDefinition.deathPenalty). Decided: death takes only GP, so other
 *  stacks default to 0. */
export const DEFAULT_DEATH_GP_LOSS_PERCENT = 0.1;
export const DEFAULT_DEATH_RESOURCE_LOSS_PERCENT = 0;

/** Of a kill's combat XP, the share Hitpoints gets; the rest goes to the
 *  skills the combat style trains. */
export const HITPOINTS_XP_SHARE = 0.25;

/** Special attack energy regained per millisecond: 10% every 30 seconds,
 *  as in OSRS. */
export const SPECIAL_ENERGY_REGEN_PER_MS = 10 / 30_000;

// ── Hitpoints, travel, offline ──

/** Baseline passive HP regen (out of combat only) before modifiers —
 *  1 HP per 60s, scaled via getModifiedValue("hpRegen", ...) so an item
 *  like "Restoration Necklace: 2x Health Regen" is just a multiplicative
 *  modifier targeting "hpRegen", no special-cased regen system needed. */
export const BASE_HP_REGEN_PER_SECOND = 1 / 60;

/** Default travel pace: ms of travel time per unit of map distance. Content
 *  can override per-trip via startTravel's opts. */
export const DEFAULT_MS_PER_DISTANCE_UNIT = 50;

/** Default cap on how much real-world absence counts toward production and
 *  crafting rewards. Stored per-save (state.offlineCapMs), not hardcoded, so
 *  a future upgrade/item can extend it — this is just the starting value. */
export const DEFAULT_OFFLINE_CAP_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Default hard cap on a single open-ended gathering session (Woodcutting
 *  etc.) — separate constant from DEFAULT_OFFLINE_CAP_MS on purpose, since
 *  they answer different questions ("how much away-time counts at all" vs
 *  "how long can one continuous gathering session run"). */
export const DEFAULT_GATHER_MAX_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

// ── Gathering ──

/** Gathering gets up to this much faster with level: 0 at level 1, the
 *  full amount at 99. Kept small on purpose so tools and buffs can stack
 *  on top without actions dropping to fractions of a second. */
export const MAX_GATHER_LEVEL_SPEED_BONUS = 0.1;

/** No gathering action ever gets faster than this, whatever stacks. */
export const MIN_GATHER_TIME_MS = 600;
