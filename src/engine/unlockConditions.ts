import type { GameState, UnlockCondition } from "./types";
import { levelForXp } from "./xpCurve";

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
      const amount = state.resources[condition.resource]?.amount ?? 0;
      return amount >= condition.amount;
    }
    case "resourceLifetimeAtLeast": {
      const lifetime = state.resources[condition.resource]?.lifetimeEarned ?? 0;
      return lifetime >= condition.amount;
    }
    case "producerOwned": {
      const quantity = state.producers[condition.producerId]?.quantity ?? 0;
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

/** Short, human-readable reason a condition ISN'T met yet — for greying out
 *  a building/location with a tooltip like "Requires Fletching level 10". */
export function describeUnmetCondition(condition: UnlockCondition, state: GameState): string | null {
  if (isUnlocked(condition, state)) return null;
  switch (condition.kind) {
    case "skillLevel":
      return `Requires ${capitalize(condition.skill)} level ${condition.atLeast}`;
    case "flag":
      return `Locked`;
    case "resourceAtLeast":
      return `Requires ${condition.amount.toLocaleString()} ${condition.resource}`;
    case "resourceLifetimeAtLeast":
      return `Requires ${condition.amount.toLocaleString()} ${condition.resource} earned (lifetime)`;
    case "producerOwned":
      return `Requires ${condition.atLeast}x ${condition.producerId}`;
    case "statisticAtLeast":
      return `Requires ${condition.statistic}: ${condition.atLeast.toLocaleString()}`;
    case "all": {
      const firstUnmet = condition.conditions.find((c) => !isUnlocked(c, state));
      return firstUnmet ? describeUnmetCondition(firstUnmet, state) : null;
    }
    case "any":
      return `Requires one of several conditions`;
    default:
      return assertNever(condition);
  }
}

/** "You have 3/10 Flax" style progress — for content the player is actively
 *  working toward (an accepted job), where a live fraction reads better
 *  than a static "Requires 10 Flax". Returns null for condition kinds with
 *  no single meaningful fraction (a boolean flag, a compound all/any) —
 *  callers should fall back to describeUnmetCondition for those. Scoped to
 *  job board turn-ins for now, not retrofitted onto buildings/achievements/
 *  equip requirements, where "Requires X" (locked, not-yet-started content)
 *  reads better than a progress bar. */
export function describeConditionProgress(condition: UnlockCondition, state: GameState): string | null {
  switch (condition.kind) {
    case "resourceAtLeast": {
      const have = Math.floor(state.resources[condition.resource]?.amount ?? 0);
      return `${have.toLocaleString()}/${condition.amount.toLocaleString()} ${capitalize(condition.resource)}`;
    }
    case "resourceLifetimeAtLeast": {
      const have = Math.floor(state.resources[condition.resource]?.lifetimeEarned ?? 0);
      return `${have.toLocaleString()}/${condition.amount.toLocaleString()} ${capitalize(condition.resource)} (lifetime)`;
    }
    case "skillLevel": {
      const have = levelForXp(state.skills[condition.skill]?.xp ?? 0);
      return `${capitalize(condition.skill)} level ${have}/${condition.atLeast}`;
    }
    case "statisticAtLeast": {
      const have = state.statistics[condition.statistic] ?? 0;
      return `${have.toLocaleString()}/${condition.atLeast.toLocaleString()} ${condition.statistic}`;
    }
    case "producerOwned": {
      const have = state.producers[condition.producerId]?.quantity ?? 0;
      return `${have}/${condition.atLeast} ${condition.producerId}`;
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