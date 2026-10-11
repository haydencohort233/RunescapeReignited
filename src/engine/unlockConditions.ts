import type { GameState, UnlockCondition } from "./types";
import { levelForXp } from "./xpCurve";
import { countOwned } from "./ledger";

/**
 * Evaluates an UnlockCondition against a GameState snapshot. Pure function —
 * no engine dependency — so it's trivially testable and usable from UI code
 * (e.g. "is this map location greyed out?") without needing a live engine.
 */
export function isUnlocked(condition: UnlockCondition, state: GameState): boolean {
  switch (condition.kind) {
    case "skillLevel": {
      const xp = state.skills[condition.skill]?.xp ?? 0;
      return levelForXp(xp) >= condition.atLeast;
    }
    case "flag": {
      const expected = condition.equals ?? true;
      return (state.flags[condition.flag] ?? false) === expected;
    }
    case "resourceAtLeast": {
      return countOwned(state, condition.resource) >= condition.amount;
    }
    case "resourceLifetimeAtLeast": {
      const lifetime = state.resources[condition.resource]?.lifetimeEarned ?? 0;
      return lifetime >= condition.amount;
    }
    case "buildingOwned": {
      const quantity = state.buildings[condition.buildingId] ?? 0;
      return quantity >= condition.atLeast;
    }
    case "statisticAtLeast": {
      const value = state.statistics[condition.statistic] ?? 0;
      return value >= condition.atLeast;
    }
    case "all":
      return condition.conditions.every((c) => isUnlocked(c, state));
    case "any":
      return condition.conditions.some((c) => isUnlocked(c, state));
    default:
      // Exhaustiveness check: if UnlockCondition ever gains a new kind and a
      // case here is forgotten, this becomes a compile error (the unhandled
      // variant won't be assignable to `never`) instead of a silent runtime bug.
      return assertNever(condition);
  }
}

/** How condition text names things. The engine only knows ids; the UI
 *  passes labels from content so players see "Goblin kills" rather than
 *  "kills:goblin". Every field falls back to a readable default. */
export interface ConditionLabels {
  resource?: (id: string) => string;
  building?: (id: string) => string;
  skill?: (id: string) => string;
  statistic?: (key: string) => string;
  /** Formats a statistic's value (e.g. a duration stored in ms). */
  statisticValue?: (key: string, value: number) => string;
}

function resolveLabels(labels: ConditionLabels = {}): Required<ConditionLabels> {
  return {
    resource: labels.resource ?? capitalize,
    building: labels.building ?? capitalize,
    skill: labels.skill ?? capitalize,
    statistic: labels.statistic ?? ((key) => key),
    statisticValue: labels.statisticValue ?? ((_key, value) => Math.floor(value).toLocaleString()),
  };
}

/** Short, human-readable reason a condition ISN'T met yet — for greying out
 *  a building/location with a tooltip like "Requires Fletching level 10". */
export function describeUnmetCondition(
  condition: UnlockCondition,
  state: GameState,
  labels?: ConditionLabels
): string | null {
  if (isUnlocked(condition, state)) return null;
  const l = resolveLabels(labels);
  switch (condition.kind) {
    case "skillLevel":
      return `Requires ${l.skill(condition.skill)} level ${condition.atLeast}`;
    case "flag":
      return condition.label ?? `Not unlocked yet`;
    case "resourceAtLeast":
      return `Requires ${condition.amount.toLocaleString()} ${l.resource(condition.resource)}`;
    case "resourceLifetimeAtLeast":
      return `Requires ${condition.amount.toLocaleString()} ${l.resource(condition.resource)} earned in total`;
    case "buildingOwned":
      return `Requires ${condition.atLeast}x ${l.building(condition.buildingId)}`;
    case "statisticAtLeast":
      // A running total reads best as progress toward the target.
      return describeConditionProgress(condition, state, {}, labels);
    case "all": {
      const firstUnmet = condition.conditions.find((c) => !isUnlocked(c, state));
      return firstUnmet ? describeUnmetCondition(firstUnmet, state, labels) : null;
    }
    case "any":
      return `Requires one of several conditions`;
    default:
      return assertNever(condition);
  }
}

/** Counter values snapshotted when a job is accepted, keyed by
 *  baselineKey(). Lets "defeat 10 goblins" mean 10 MORE from now, rather
 *  than being instantly met by lifetime kills. */
export type ConditionBaselines = Record<string, number>;

/** Only counters that only ever go up get a baseline — current holdings
 *  (resourceAtLeast) and levels are naturally "reach X", not "gain X". */
function baselineKey(condition: UnlockCondition): string | null {
  if (condition.kind === "statisticAtLeast") return `stat:${condition.statistic}`;
  if (condition.kind === "resourceLifetimeAtLeast") return `lifetime:${condition.resource}`;
  return null;
}

function baselineValue(condition: UnlockCondition, state: GameState): number {
  if (condition.kind === "statisticAtLeast") return state.statistics[condition.statistic] ?? 0;
  if (condition.kind === "resourceLifetimeAtLeast") return state.resources[condition.resource]?.lifetimeEarned ?? 0;
  return 0;
}

/** Snapshots every counter the condition (including nested all/any) reads. */
export function captureBaselines(condition: UnlockCondition, state: GameState): ConditionBaselines {
  const baselines: ConditionBaselines = {};
  const visit = (c: UnlockCondition) => {
    if (c.kind === "all" || c.kind === "any") return c.conditions.forEach(visit);
    const key = baselineKey(c);
    if (key) baselines[key] = baselineValue(c, state);
  };
  visit(condition);
  return baselines;
}

/** The same condition with each counter target raised by its baseline, so
 *  isUnlocked() measures progress made since the snapshot. */
export function offsetByBaselines(condition: UnlockCondition, baselines: ConditionBaselines): UnlockCondition {
  if (condition.kind === "all" || condition.kind === "any") {
    return { ...condition, conditions: condition.conditions.map((c) => offsetByBaselines(c, baselines)) };
  }
  const key = baselineKey(condition);
  const base = key ? (baselines[key] ?? 0) : 0;
  if (condition.kind === "statisticAtLeast") return { ...condition, atLeast: condition.atLeast + base };
  if (condition.kind === "resourceLifetimeAtLeast") return { ...condition, amount: condition.amount + base };
  return condition;
}

/** "You have 3/10 Flax" style progress — for content the player is actively
 *  working toward (an accepted job), where a live fraction reads better
 *  than a static "Requires 10 Flax". Returns null for condition kinds with
 *  no single meaningful fraction (a boolean flag, a compound all/any) —
 *  callers should fall back to describeUnmetCondition for those. Scoped to
 *  job board turn-ins for now, not retrofitted onto buildings/achievements/
 *  equip requirements, where "Requires X" (locked, not-yet-started content)
 *  reads better than a progress bar. */
export function describeConditionProgress(
  condition: UnlockCondition,
  state: GameState,
  baselines: ConditionBaselines = {},
  labels?: ConditionLabels
): string | null {
  const l = resolveLabels(labels);
  const key = baselineKey(condition);
  const base = key ? (baselines[key] ?? 0) : 0;
  switch (condition.kind) {
    case "resourceAtLeast": {
      const have = Math.floor(countOwned(state, condition.resource));
      return `${l.resource(condition.resource)}: ${have.toLocaleString()}/${condition.amount.toLocaleString()}`;
    }
    case "resourceLifetimeAtLeast": {
      const have = Math.floor((state.resources[condition.resource]?.lifetimeEarned ?? 0) - base);
      return `${l.resource(condition.resource)} earned: ${have.toLocaleString()}/${condition.amount.toLocaleString()}`;
    }
    case "skillLevel": {
      const have = levelForXp(state.skills[condition.skill]?.xp ?? 0);
      return `${l.skill(condition.skill)} level: ${have}/${condition.atLeast}`;
    }
    case "statisticAtLeast": {
      const have = (state.statistics[condition.statistic] ?? 0) - base;
      const k = condition.statistic;
      return `${l.statistic(k)}: ${l.statisticValue(k, Math.max(0, have))}/${l.statisticValue(k, condition.atLeast)}`;
    }
    case "buildingOwned": {
      const have = state.buildings[condition.buildingId] ?? 0;
      return `${l.building(condition.buildingId)} owned: ${have}/${condition.atLeast}`;
    }
    case "flag":
    case "all":
    case "any":
      return null;
    default:
      return assertNever(condition);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled UnlockCondition kind: ${JSON.stringify(value)}`);
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}