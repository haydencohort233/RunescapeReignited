import type { Facing, GameState, LoadoutEntry, PlacedFurniture, ServantOrder, StoredFurniture } from "./types";
import { getDailyPeriodNumber } from "./time";
import { DEFAULT_OFFLINE_CAP_MS } from "./tuning";
import { SCHEMA_VERSION, STARTING_HITPOINTS_XP, STARTING_LOCATION_ID } from "./state";
import { DEFAULT_COMBAT_STYLES } from "./combatStyles";

/**
 * Migration chain: each entry transforms the state shape from version N to
 * N+1. Applied in sequence starting from whatever version a loaded save
 * reports. Add a new entry here every time SCHEMA_VERSION bumps due to a
 * structural change (renamed/restructured/repurposed field) — for purely
 * ADDITIVE changes (a new field with a sensible default), the backfill in
 * deserialize() already covers it and a migration entry is optional but
 * still fine to add for clarity.
 */
/** The offline cap the v21 -> v22 migration raised saves to. Kept as its
 *  own number: the default for new saves is 1 hour now, and that old step
 *  should still do what it did. */
const LEGACY_OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

const MIGRATIONS: Record<number, (old: any, now: number) => any> = {
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
  9: (old, now) => {
    const todayPeriod = getDailyPeriodNumber(now);
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
  // v14 -> v15: the four separate action fields (craft job, gather session,
  // travel, combat) collapsed into one `activeAction` union so "one thing
  // at a time" can't be bypassed. Older builds allowed some combinations
  // (e.g. gathering mid-fight); keep the first in priority order and end
  // the rest. A dropped craft job refunds its unfinished materials, same
  // as cancelling it would.
  14: (old) => {
    const candidates: [string, string][] = [
      ["combat", "activeCombatSession"],
      ["travel", "activeTravel"],
      ["craft", "activeCraftJob"],
      ["gather", "activeGatherSession"],
    ];
    let activeAction: any = null;
    const resources = { ...(old.resources ?? {}) };
    for (const [kind, field] of candidates) {
      const value = old[field];
      if (!value) continue;
      if (!activeAction) {
        activeAction = { kind, ...value };
      } else if (kind === "craft") {
        const remaining = value.quantityTotal - value.quantityCompleted;
        for (const input of value.inputsPerItem ?? []) {
          const r = resources[input.resource] ?? { amount: 0, lifetimeEarned: 0 };
          resources[input.resource] = { ...r, amount: r.amount + input.amount * remaining };
        }
      }
    }
    const next = { ...old, resources, activeAction };
    for (const [, field] of candidates) delete next[field];
    return next;
  },
  // v15 -> v16: building stats (rate, cost, unlocks) stopped being saved —
  // they're read from content so rebalancing reaches existing saves. Only
  // the owned count per building is kept.
  15: (old) => {
    const buildings: Record<string, number> = {};
    for (const [id, producer] of Object.entries(old.producers ?? {})) {
      buildings[id] = (producer as { quantity?: number }).quantity ?? 0;
    }
    const { producers: _producers, ...rest } = old;
    return { ...rest, buildings };
  },
  // v16 -> v17: resources and items merged into one ledger. Stackable items
  // were single inventory instances carrying a `quantity`; they become plain
  // counts in `resources`, the same place wood and gp live, so recipes,
  // shops and jobs can use any of them. Recipe outputs and loot entries
  // snapshotted into an in-progress action move to the shared shape too.
  16: (old) => {
    const resources = { ...(old.resources ?? {}) };
    const inventory: Record<string, any> = {};
    const converted = new Set<string>();
    for (const [instanceId, instance] of Object.entries<any>(old.inventory ?? {})) {
      if (instance.quantity === undefined) {
        inventory[instanceId] = instance;
        continue;
      }
      const r = resources[instance.itemDefId] ?? { amount: 0, lifetimeEarned: 0 };
      resources[instance.itemDefId] = {
        amount: r.amount + instance.quantity,
        lifetimeEarned: r.lifetimeEarned + instance.quantity,
      };
      converted.add(instanceId);
    }
    const equipment: Record<string, string> = {};
    for (const [slot, instanceId] of Object.entries<string>(old.equipment ?? {})) {
      if (!converted.has(instanceId)) equipment[slot] = instanceId;
    }

    const convertOutput = (o: any) =>
      o?.kind === "item" ? { resource: o.itemDefId, amount: o.quantity } : { resource: o.resource, amount: o.amount };
    let activeAction = old.activeAction ?? null;
    if (activeAction && (activeAction.kind === "craft" || activeAction.kind === "gather")) {
      activeAction = { ...activeAction, output: convertOutput(activeAction.output) };
    } else if (activeAction?.kind === "combat") {
      const lootTable = (activeAction.lootTable ?? []).map((e: any) => ({
        id: e.itemDefId ?? e.resourceId,
        quantityMin: e.quantityMin,
        quantityMax: e.quantityMax,
        weight: e.weight,
      }));
      activeAction = { ...activeAction, lootTable };
    }
    return { ...old, resources, inventory, equipment, activeAction };
  },
  // v17 -> v18: job board state moved out of `statistics` (where
  // completion days were stored as jobCompletedPeriod:<id>) into its own
  // `jobs` field, and accepted jobs gained objective baselines. Jobs
  // accepted before this keep empty baselines, i.e. the old absolute check.
  17: (old) => {
    const accepted: Record<string, any> = {};
    for (const [jobId, record] of Object.entries<any>(old.acceptedJobs ?? {})) {
      accepted[jobId] = { ...record, baselines: {} };
    }
    const statistics: Record<string, number> = {};
    const lastCompletedPeriod: Record<string, number> = {};
    for (const [key, value] of Object.entries<number>(old.statistics ?? {})) {
      if (key.startsWith("jobCompletedPeriod:")) lastCompletedPeriod[key.slice("jobCompletedPeriod:".length)] = value;
      else statistics[key] = value;
    }
    const { acceptedJobs: _acceptedJobs, ...rest } = old;
    return { ...rest, statistics, jobs: { accepted, lastCompletedPeriod, completedOnce: {} } };
  },
  // v18 -> v19: combat sessions gained autoRepeat / autoEatItemId / kills.
  // A fight in progress from before continues as a single fight.
  18: (old) => {
    const action = old.activeAction;
    if (action?.kind !== "combat") return old;
    return { ...old, activeAction: { autoRepeat: false, kills: 0, ...action } };
  },
  // v19 -> v20: quests added.
  19: (old) => ({ ...old, quests: old.quests ?? {} }),
  // v20 -> v21: the food picked for a fight is remembered for the next one.
  // Nothing to carry over; older saves just start with none remembered.
  20: (old) => old,
  // v21 -> v22: combat styles, special attack energy and spells. The
  // offline cap went from 1 hour to 8; it's stored per save, so raise
  // existing saves too (never lower one a future upgrade already raised).
  21: (old) => ({
    ...old,
    offlineCapMs: Math.max(typeof old.offlineCapMs === "number" ? old.offlineCapMs : 0, LEGACY_OFFLINE_CAP_MS),
    specialEnergy: 100,
    combatStyles: { ...DEFAULT_COMBAT_STYLES },
  }),
  // v22 -> v23: dungeon runs. Nobody is in one yet.
  22: (old) => ({ ...old, dungeonRun: null }),
  // v23 -> v24: dungeon loadouts can be saved from the Equipment tab.
  23: (old) => ({ ...old, savedLoadouts: old.savedLoadouts ?? {} }),
  // v24 -> v25: the player house. Everyone starts with an empty room. The
  // offline cap is left as it was (decided): only new saves start at 1 hour.
  24: (old) => ({ ...old, house: old.house ?? emptyHouse() }),
  // v25 -> v26: the house floor became a cosmetic (floorId). The engine
  // fills in the default floor, wallpaper and rug from content on load.
  25: (old) => (isRecord(old.house) && isRecord(old.house.layout) ? { ...old, house: { ...old.house, layout: { ...old.house.layout, floorId: "" } } } : old),
  // v26 -> v27: servants. Nobody has one yet.
  26: (old) => ({ ...old, servant: null }),
};

/** An empty house. Wallpaper and rug ids are filled from content by the
 *  engine (the engine has no content here). */
export function emptyHouse(): GameState["house"] {
  return { layout: { inside: [], yard: [], wallpaperId: "", floorId: "", rugId: "" }, storage: [], build: null, unlockedSkins: [] };
}

/** Brings a parsed save of any version up to the current GameState shape:
 *  runs each migration from the save's version onward, then backfills
 *  anything still missing. */
export function migrateSave(parsed: any, now: number): GameState {
  // Anything without the basic shape of a save is refused outright — an
  // imported "[]" or "{}" would otherwise quietly become a brand-new game
  // and overwrite real progress on the next autosave.
  if (!isRecord(parsed) || !isRecord(parsed.resources) || !isRecord(parsed.skills)) {
    throw new Error("That doesn't look like a save from this game.");
  }
  const fromVersion = typeof parsed.version === "number" ? parsed.version : 0;
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (migrate) parsed = migrate(parsed, now);
  }

  // Safety net beneath the migration chain: backfill any field still
  // missing after migrations run (covers additive changes that never got
  // an explicit migration entry). Without this, a missing offlineCapMs
  // becomes `undefined`, and Math.min(elapsedMs, undefined) silently
  // evaluates to NaN — which then poisons every downstream calculation
  // without ever throwing an error.
  const withDefaults: GameState = {
    resources: sanitizeResources(parsed.resources),
    buildings: sanitizeCounts(parsed.buildings),
    modifiers: isRecord(parsed.modifiers) ? parsed.modifiers : {},
    skills: (() => {
      const skills: GameState["skills"] = {};
      for (const [id, skill] of Object.entries(isRecord(parsed.skills) ? parsed.skills : {})) {
        skills[id] = { xp: finiteOr((skill as { xp?: unknown })?.xp, 0, 0) };
      }
      skills.hitpoints = { xp: Math.max(skills.hitpoints?.xp ?? 0, STARTING_HITPOINTS_XP) };
      return skills;
    })(),
    flags: isRecord(parsed.flags) ? parsed.flags : {},
    inventory: isRecord(parsed.inventory) ? parsed.inventory : {},
    equipment: {},
    activeAction: sanitizeAction(parsed.activeAction),
    currentLocationId: typeof parsed.currentLocationId === "string" ? parsed.currentLocationId : STARTING_LOCATION_ID,
    currentHp: finiteOr(parsed.currentHp, 10, 0),
    lastCombatFoodId: typeof parsed.lastCombatFoodId === "string" ? parsed.lastCombatFoodId : undefined,
    specialEnergy: Math.min(100, finiteOr(parsed.specialEnergy, 100, 0)),
    combatStyles: {
      melee: typeof parsed.combatStyles?.melee === "string" ? parsed.combatStyles.melee : DEFAULT_COMBAT_STYLES.melee,
      ranged: typeof parsed.combatStyles?.ranged === "string" ? parsed.combatStyles.ranged : DEFAULT_COMBAT_STYLES.ranged,
      magic: typeof parsed.combatStyles?.magic === "string" ? parsed.combatStyles.magic : DEFAULT_COMBAT_STYLES.magic,
    },
    selectedSpellId: typeof parsed.selectedSpellId === "string" ? parsed.selectedSpellId : undefined,
    dungeonRun: sanitizeDungeonRun(parsed.dungeonRun),
    savedLoadouts: sanitizeSavedLoadouts(parsed.savedLoadouts),
    jobs: {
      accepted: isRecord(parsed.jobs?.accepted) ? parsed.jobs.accepted : {},
      lastCompletedPeriod: isRecord(parsed.jobs?.lastCompletedPeriod) ? parsed.jobs.lastCompletedPeriod : {},
      completedOnce: isRecord(parsed.jobs?.completedOnce) ? parsed.jobs.completedOnce : {},
    },
    quests: isRecord(parsed.quests) ? parsed.quests : {},
    statistics: sanitizeCounts(parsed.statistics, { integers: false }),
    lastTickTimestamp: finiteOr(parsed.lastTickTimestamp, now),
    offlineCapMs: finiteOr(parsed.offlineCapMs, DEFAULT_OFFLINE_CAP_MS, 0),
    house: sanitizeHouse(parsed.house),
    servant: sanitizeServant(parsed.servant),
    version: SCHEMA_VERSION,
  };
  // Equipment may only point at instances that still exist, or at a worn
  // stack (`stack:<id>`, see ledger.ts) that still has something in it.
  for (const [slot, instanceId] of Object.entries(isRecord(parsed.equipment) ? parsed.equipment : {})) {
    if (typeof instanceId !== "string") continue;
    const stackId = instanceId.startsWith("stack:") ? instanceId.slice("stack:".length) : null;
    if (stackId ? (withDefaults.resources[stackId]?.amount ?? 0) >= 1 : withDefaults.inventory[instanceId]) {
      (withDefaults.equipment as Record<string, string>)[slot] = instanceId;
    }
  }
  return withDefaults;
}

// ── Sanitizing ─────────────────────────────────────────────────────────
// A save is untrusted input: it may be hand-edited, imported from an older
// build, or carry a null where a NaN was serialized. Anything malformed is
// replaced with a safe default rather than allowed to poison the game.

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOr(value: unknown, fallback: number, min = Number.NEGATIVE_INFINITY): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, value) : fallback;
}

function sanitizeLoadout(raw: unknown[]): LoadoutEntry[] {
  return raw
    .filter((e: unknown) => isRecord(e) && typeof e.itemDefId === "string" && typeof e.quantity === "number" && Number.isFinite(e.quantity))
    .map((e: any) => ({
      itemDefId: e.itemDefId,
      quantity: Math.max(0, Math.floor(e.quantity)),
      ...(typeof e.instanceId === "string" ? { instanceId: e.instanceId } : {}),
    }));
}

/** Saved loadouts per dungeon id; anything malformed is dropped. Stale
 *  entries (an item since sold) are trimmed when the loadout is read. */
function sanitizeSavedLoadouts(raw: unknown): GameState["savedLoadouts"] {
  const loadouts: GameState["savedLoadouts"] = {};
  for (const [id, entries] of Object.entries(isRecord(raw) ? raw : {})) {
    if (Array.isArray(entries)) loadouts[id] = sanitizeLoadout(entries);
  }
  return loadouts;
}

/** A run missing its id, counters or loadout list is dropped (the loadout
 *  items were never removed from the ledger, so nothing is lost). */
function sanitizeDungeonRun(raw: unknown): GameState["dungeonRun"] {
  if (!isRecord(raw) || typeof raw.dungeonId !== "string" || !Array.isArray(raw.loadout)) return null;
  const wavesCleared = typeof raw.wavesCleared === "number" && Number.isFinite(raw.wavesCleared) ? Math.max(0, Math.floor(raw.wavesCleared)) : 0;
  const loadout = sanitizeLoadout(raw.loadout);
  return { dungeonId: raw.dungeonId, wavesCleared, awaitingBoss: raw.awaitingBoss === true, loadout };
}

function sanitizeResources(raw: unknown): GameState["resources"] {
  const resources: GameState["resources"] = { gp: { amount: 0, lifetimeEarned: 0 } };
  for (const [id, entry] of Object.entries(isRecord(raw) ? raw : {})) {
    if (!isRecord(entry)) continue;
    resources[id] = {
      amount: finiteOr(entry.amount, 0, 0),
      lifetimeEarned: finiteOr(entry.lifetimeEarned, 0, 0),
    };
  }
  return resources;
}

function sanitizeCounts(raw: unknown, opts = { integers: true }): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [id, value] of Object.entries(isRecord(raw) ? raw : {})) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    counts[id] = opts.integers ? Math.max(0, Math.floor(value)) : value;
  }
  return counts;
}

const FACINGS = new Set<Facing>(["front", "right", "back", "left"]);

function sanitizePlaced(raw: unknown): PlacedFurniture[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const placed: PlacedFurniture[] = [];
  for (const p of raw) {
    if (!isRecord(p) || typeof p.uid !== "string" || typeof p.furnitureId !== "string" || seen.has(p.uid)) continue;
    if (typeof p.x !== "number" || !Number.isFinite(p.x) || typeof p.y !== "number" || !Number.isFinite(p.y)) continue;
    seen.add(p.uid);
    placed.push({
      uid: p.uid,
      furnitureId: p.furnitureId,
      ...(typeof p.skinId === "string" ? { skinId: p.skinId } : {}),
      x: Math.floor(p.x),
      y: Math.floor(p.y),
      facing: FACINGS.has(p.facing) ? p.facing : "front",
      ...(typeof p.hostId === "string" ? { hostId: p.hostId } : {}),
    });
  }
  return placed;
}

/** The house, with anything malformed dropped. Unknown furniture ids and
 *  overlaps are content questions, handled by the engine on load. */
function sanitizeHouse(raw: unknown): GameState["house"] {
  const house = emptyHouse();
  if (!isRecord(raw)) return house;
  const layout = isRecord(raw.layout) ? raw.layout : {};
  house.layout = {
    inside: sanitizePlaced(layout.inside),
    yard: sanitizePlaced(layout.yard),
    wallpaperId: typeof layout.wallpaperId === "string" ? layout.wallpaperId : "",
    floorId: typeof layout.floorId === "string" ? layout.floorId : "",
    rugId: typeof layout.rugId === "string" ? layout.rugId : "",
  };
  house.storage = (Array.isArray(raw.storage) ? raw.storage : [])
    .filter((s: unknown): s is StoredFurniture => isRecord(s) && typeof s.uid === "string" && typeof s.furnitureId === "string")
    .map((s: StoredFurniture) => ({ uid: s.uid, furnitureId: s.furnitureId, ...(typeof s.skinId === "string" ? { skinId: s.skinId } : {}) }));
  const b = raw.build;
  if (
    isRecord(b) &&
    typeof b.furnitureId === "string" &&
    typeof b.startedAt === "number" &&
    Number.isFinite(b.startedAt) &&
    typeof b.durationMs === "number" &&
    Number.isFinite(b.durationMs) &&
    b.durationMs >= 0
  ) {
    house.build = {
      furnitureId: b.furnitureId,
      startedAt: b.startedAt,
      durationMs: b.durationMs,
      paid: Array.isArray(b.paid)
        ? b.paid.filter((c: unknown) => isRecord(c) && typeof c.resource === "string" && typeof c.amount === "number" && Number.isFinite(c.amount) && c.amount > 0)
        : [],
    };
  }
  house.unlockedSkins = [...new Set((Array.isArray(raw.unlockedSkins) ? raw.unlockedSkins : []).filter((s: unknown) => typeof s === "string"))] as string[];
  return house;
}

/** The hired servant, or null if malformed. A bad order is dropped (its
 *  materials with it) rather than the servant. Unknown servant ids are a
 *  content question, handled by the engine on load. */
function sanitizeServant(raw: unknown): GameState["servant"] {
  if (!isRecord(raw) || typeof raw.servantId !== "string") return null;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const servant: NonNullable<GameState["servant"]> = { servantId: raw.servantId, purse: finiteOr(raw.purse, 0, 0), order: null };
  const o = raw.order;
  if (
    isRecord(o) &&
    typeof o.recipeId === "string" &&
    typeof o.station === "string" &&
    finite(o.timePerItemMs) &&
    o.timePerItemMs > 0 &&
    finite(o.quantityTotal) &&
    o.quantityTotal > 0 &&
    finite(o.quantityCompleted) &&
    finite(o.resolvedTo) &&
    Array.isArray(o.inputsPerItem)
  ) {
    servant.order = {
      ...(o as unknown as ServantOrder),
      quantityCompleted: Math.max(0, Math.min(o.quantityTotal, Math.floor(o.quantityCompleted))),
      progressMs: Math.max(0, finiteOr(o.progressMs, 0, 0)),
      xpPerItem: finiteOr(o.xpPerItem, 0, 0),
    };
  }
  return servant;
}

/** Drops an in-progress action whose timing fields are missing or invalid
 *  — resolving one would divide by zero or never finish. */
function sanitizeAction(raw: unknown): GameState["activeAction"] {
  if (!isRecord(raw)) return null;
  const positive = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  switch (raw.kind) {
    case "craft":
      return positive(raw.timePerItemMs) && finite(raw.startedAt) && positive(raw.quantityTotal)
        ? (raw as GameState["activeAction"])
        : null;
    case "gather":
      return positive(raw.timePerItemMs) && finite(raw.startedAt) && positive(raw.maxDurationMs)
        ? (raw as GameState["activeAction"])
        : null;
    case "travel":
      // A malformed toll record is dropped (nothing to give back), not the trip.
      if (raw.tollPaid !== undefined && !Array.isArray(raw.tollPaid)) delete raw.tollPaid;
      return finite(raw.startedAt) && finite(raw.durationMs) ? (raw as GameState["activeAction"]) : null;
    case "combat":
      if (
        !positive(raw.playerAttackSpeedMs) ||
        !positive(raw.enemyAttackSpeedMs) ||
        !finite(raw.playerStartedAt) ||
        !finite(raw.enemyStartedAt) ||
        !Array.isArray(raw.log)
      ) {
        return null;
      }
      // A missing counter would make every "next attack" time NaN, and the
      // fight would resolve thousands of enemy attacks on the first tick.
      for (const key of ["playerAttacksResolved", "enemyAttacksResolved", "kills"] as const) {
        if (!finite(raw[key])) raw[key] = 0;
      }
      // Same for a bleed: any bad timing field and it's dropped.
      if (raw.bleed !== undefined) {
        const b = raw.bleed;
        if (!isRecord(b) || !positive(b.intervalMs) || !finite(b.startedAt) || !finite(b.resolved) || !finite(b.hitsLeft) || !finite(b.damagePerHit)) {
          delete raw.bleed;
        }
      }
      return raw as GameState["activeAction"];
    default:
      return null;
  }
}
