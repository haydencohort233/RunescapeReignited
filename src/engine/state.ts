import type { GameState } from "./types";
import { xpForLevel } from "./xpCurve";
import { DEFAULT_OFFLINE_CAP_MS } from "./tuning";

/** Bump when GameState's shape changes, and add a matching entry to
 *  MIGRATIONS in migrations.ts. */
export const SCHEMA_VERSION = 20;

/** OSRS-authentic: Hitpoints starts pre-leveled at 10 (unlike every other
 *  skill, which starts at 1) — this is the XP threshold for level 10. */
export const STARTING_HITPOINTS_XP = xpForLevel(10);

/** The starting location id — must match an entry in content/mapLocations.ts. */
export const STARTING_LOCATION_ID = "town";

export function createInitialState(now: number = Date.now()): GameState {
  return {
    resources: {
      gp: { amount: 0, lifetimeEarned: 0 },
    },
    buildings: {},
    modifiers: {},
    skills: { hitpoints: { xp: STARTING_HITPOINTS_XP } },
    // The starting location doesn't count as a "discovery" when you travel
    // back to it later — mark it visited from the start.
    flags: { [`visited:${STARTING_LOCATION_ID}`]: true },
    inventory: {},
    equipment: {},
    activeAction: null,
    currentHp: 10, // matches STARTING_HITPOINTS_XP's level-10 max
    jobs: { accepted: {}, lastCompletedPeriod: {}, completedOnce: {} },
    quests: {},
    currentLocationId: STARTING_LOCATION_ID,
    statistics: {},
    lastTickTimestamp: now,
    offlineCapMs: DEFAULT_OFFLINE_CAP_MS,
    version: SCHEMA_VERSION,
  };
}
