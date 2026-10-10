// How game data is written out in the UI — one place for names, amounts
// and condition text, so every screen says "1,000 GP" and "Goblin kills"
// the same way instead of each formatting raw ids its own way.
import type { ConditionLabels } from "../engine/unlockConditions";
import type { RecipeInput } from "../engine/types";
import { formatDuration, formatNumber } from "../engine/format";
import { getResourceMeta } from "./resources";
import { BUILDING_CATALOG } from "./buildings";
import { SKILL_CATALOG } from "./skills";
import { getRecipe } from "./recipes";
import { getEnemy } from "./enemies";
import { getLocation } from "./mapLocations";
import { getJob } from "./jobs";

const BUILDING_NAMES = new Map(BUILDING_CATALOG.map((b) => [b.id, b.name]));
const SKILL_NAMES = new Map(SKILL_CATALOG.map((s) => [s.id, s.name]));

export function resourceName(id: string): string {
  return getResourceMeta(id).name;
}

export function buildingName(id: string): string {
  return BUILDING_NAMES.get(id) ?? id;
}

export function skillName(id: string): string {
  return SKILL_NAMES.get(id) ?? id;
}

/** "1,000 GP", "5 Wood". */
export function formatAmount(id: string, amount: number): string {
  return `${formatNumber(amount)} ${resourceName(id)}`;
}

/** "10 Wood, 2 Coal". */
export function formatAmounts(amounts: RecipeInput[], separator = ", "): string {
  return amounts.map((a) => formatAmount(a.resource, a.amount)).join(separator);
}

/** The shared reward shape used by jobs, achievements and quests. */
export function formatReward(reward?: {
  gp?: number;
  achievementPoints?: number;
  items?: { itemDefId: string; quantity: number }[];
  xp?: Record<string, number>;
}): string {
  if (!reward) return "";
  const parts: string[] = [];
  if (reward.gp) parts.push(formatAmount("gp", reward.gp));
  if (reward.achievementPoints) parts.push(formatAmount("achievement-points", reward.achievementPoints));
  for (const item of reward.items ?? []) parts.push(formatAmount(item.itemDefId, item.quantity));
  for (const [skill, xp] of Object.entries(reward.xp ?? {})) parts.push(`${formatNumber(xp)} ${skillName(skill)} XP`);
  return parts.join(", ");
}

const STAT_LABELS: Record<string, string> = {
  "gp:spent": "GP spent",
  "gp:earned": "GP earned",
  totalLevel: "Total level",
  totalExp: "Total XP",
  totalTravelTimeMs: "Time spent traveling",
  locationsDiscovered: "Locations discovered",
  "buildingsBought:total": "Buildings bought",
  "buildingsSold:total": "Buildings sold",
  "jobCompletions:total": "Jobs completed",
  "kills:total": "Enemies defeated",
  questsCompleted: "Quests completed",
};

/** "Goblin kills", "Wooden Bow (u) made", "GP spent". */
export function statisticName(key: string): string {
  if (STAT_LABELS[key]) return STAT_LABELS[key];
  const [kind, id] = key.split(":");
  if (id) {
    if (kind === "kills") return `${getEnemy(id)?.name ?? id} kills`;
    if (kind === "crafted") return `${getRecipe(id)?.name ?? id} made`;
    if (kind === "gathered") return `${getRecipe(id)?.name ?? id} gathered`;
    if (kind === "buildingsBought") return `${buildingName(id)} bought`;
    if (kind === "traveledTo") return `Trips to ${getLocation(id)?.name ?? id}`;
    if (kind === "jobCompletions") return `"${getJob(id)?.title ?? id}" completed`;
    if (id === "spent") return `${resourceName(kind)} spent`;
  }
  return key;
}

/** Durations are stored in ms; everything else is a count. */
export function formatStatisticValue(key: string, value: number): string {
  return key.endsWith("Ms") ? formatDuration(value) : formatNumber(value);
}

/** Pass to describeUnmetCondition / describeConditionProgress. */
export const CONDITION_LABELS: ConditionLabels = {
  resource: resourceName,
  building: buildingName,
  skill: skillName,
  statistic: statisticName,
  statisticValue: formatStatisticValue,
};
