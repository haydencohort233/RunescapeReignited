import type { GameState } from "./types";
import { levelForXp } from "./xpCurve";

/** Shorter absences (a tab switch, a locked phone, a quick errand) get no
 *  "While you were away" popup. Five minutes is about when a break is a
 *  real break, and when browsers start throttling a hidden tab. */
export const AWAY_SUMMARY_MIN_MS = 5 * 60 * 1000;

/** What the player had at one moment, to compare against later. */
export interface ProgressSnapshot {
  at: number;
  /** Owned count per id: stacks plus one per item instance. */
  holdings: Record<string, number>;
  /** Total XP per skill. */
  xp: Record<string, number>;
  /** Kill count per enemy id. */
  kills: Record<string, number>;
  deaths: number;
  /** What was running (craft, gather, travel, combat), if anything. */
  activity: string | null;
}

export interface AwaySummary {
  awayMs: number;
  /** How much of awayMs counted, after the offline cap. */
  countedMs: number;
  skills: { skillId: string; xp: number; fromLevel: number; toLevel: number }[];
  gained: { id: string; amount: number }[];
  spent: { id: string; amount: number }[];
  kills: { enemyId: string; count: number }[];
  deaths: number;
  /** The activity that was running ended while away (travel arriving
   *  doesn't count). */
  stopped: boolean;
}

export function snapshotProgress(state: GameState, at: number): ProgressSnapshot {
  const holdings: Record<string, number> = {};
  for (const [id, r] of Object.entries(state.resources)) holdings[id] = Math.floor(r.amount);
  for (const instance of Object.values(state.inventory)) {
    holdings[instance.itemDefId] = (holdings[instance.itemDefId] ?? 0) + 1;
  }
  const xp: Record<string, number> = {};
  for (const [id, s] of Object.entries(state.skills)) xp[id] = s.xp;
  const kills: Record<string, number> = {};
  for (const [key, n] of Object.entries(state.statistics)) {
    if (key.startsWith("kills:") && key !== "kills:total") kills[key.slice(6)] = n;
  }
  return { at, holdings, xp, kills, deaths: state.statistics.deaths ?? 0, activity: state.activeAction?.kind ?? null };
}

/** What changed between two snapshots, biggest first. Null when nothing
 *  did, so an empty popup is never shown. */
export function summarizeAway(before: ProgressSnapshot, after: ProgressSnapshot, offlineCapMs: number): AwaySummary | null {
  const awayMs = Math.max(0, after.at - before.at);
  const skills = Object.entries(after.xp)
    .map(([skillId, xp]) => {
      const was = before.xp[skillId] ?? 0;
      return { skillId, xp: xp - was, fromLevel: levelForXp(was), toLevel: levelForXp(xp) };
    })
    .filter((s) => s.xp >= 1)
    .sort((a, b) => b.xp - a.xp);

  const gained: AwaySummary["gained"] = [];
  const spent: AwaySummary["spent"] = [];
  for (const id of new Set([...Object.keys(before.holdings), ...Object.keys(after.holdings)])) {
    const delta = (after.holdings[id] ?? 0) - (before.holdings[id] ?? 0);
    if (delta > 0) gained.push({ id, amount: delta });
    else if (delta < 0) spent.push({ id, amount: -delta });
  }
  gained.sort((a, b) => b.amount - a.amount);
  spent.sort((a, b) => b.amount - a.amount);

  const kills = Object.entries(after.kills)
    .map(([enemyId, n]) => ({ enemyId, count: n - (before.kills[enemyId] ?? 0) }))
    .filter((k) => k.count > 0)
    .sort((a, b) => b.count - a.count);

  const deaths = after.deaths - before.deaths;
  const stopped = before.activity !== null && before.activity !== "travel" && after.activity === null;
  if (!skills.length && !gained.length && !spent.length && !kills.length && !deaths && !stopped) return null;
  return { awayMs, countedMs: Math.min(awayMs, offlineCapMs), skills, gained, spent, kills, deaths, stopped };
}
