import type { AchievementDefinition, UnlockCondition } from "../engine/types";
import { SKILL_CATALOG } from "./skills";

/** Any skill at this level or higher. Hitpoints is left out: it starts at
 *  10, so "reach level 10" would be earned on a brand new save. */
function anySkillAtLeast(level: number): UnlockCondition {
  return {
    kind: "any",
    conditions: SKILL_CATALOG.filter((s) => s.id !== "hitpoints").map((s) => ({ kind: "skillLevel" as const, skill: s.id, atLeast: level })),
  };
}

// Reward variety (gp, items, achievement points) and condition variety
// (spent stat, derived total level, travel time, craft count, building
// count) are deliberately mixed across these five so all the plumbing gets
// exercised. Extend freely — checkAchievements() picks up new entries
// automatically, no engine change needed.
export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    id: "bling-bling",
    name: "Bling! Bling!",
    description: "Spend 1,000 gold.",
    condition: { kind: "statisticAtLeast", statistic: "gp:spent", atLeast: 1000 },
    reward: { achievementPoints: 10 },
  },
  {
    id: "jack-of-all-trades",
    name: "Jack of All Trades",
    description: "Reach a total skill level of 50.",
    condition: { kind: "statisticAtLeast", statistic: "totalLevel", atLeast: 50 },
    reward: { achievementPoints: 25, gp: 500 },
  },
  {
    id: "world-traveler",
    name: "World Traveler",
    description: "Spend a total of 1 minute traveling.",
    condition: { kind: "statisticAtLeast", statistic: "totalTravelTimeMs", atLeast: 60_000 },
    reward: { achievementPoints: 10 },
  },
  {
    id: "fletching-novice",
    name: "Fletching Novice",
    description: "Fletch 10 Unstrung Bows.",
    condition: { kind: "statisticAtLeast", statistic: "crafted:wooden-bow", atLeast: 10 },
    reward: { gp: 200 },
  },
  {
    id: "master-builder",
    name: "Master Builder",
    description: "Purchase 10 buildings in total.",
    condition: { kind: "statisticAtLeast", statistic: "buildingsBought:total", atLeast: 10 },
    reward: { achievementPoints: 25, items: [{ itemDefId: "shark", quantity: 5 }] },
  },
  {
    id: "explorer",
    name: "Explorer",
    description: "Discover all 5 locations on the map.",
    condition: { kind: "statisticAtLeast", statistic: "locationsDiscovered", atLeast: 5 },
    reward: { achievementPoints: 30 },
  },
  {
    id: "reliable-helper",
    name: "Reliable Helper",
    description: "Complete 5 job board tasks.",
    condition: { kind: "statisticAtLeast", statistic: "jobCompletions:total", atLeast: 5 },
    reward: { achievementPoints: 20 },
  },
  {
    id: "gone-fishing",
    name: "Gone Fishing",
    description: "Catch 100 shrimps.",
    condition: { kind: "statisticAtLeast", statistic: "gathered:fish-shrimps", atLeast: 100 },
    reward: { achievementPoints: 10 },
  },
  {
    id: "bronze-age",
    name: "The Bronze Age",
    description: "Smelt 50 bronze bars.",
    condition: { kind: "statisticAtLeast", statistic: "crafted:smelt-bronze-bar", atLeast: 50 },
    reward: { achievementPoints: 10, gp: 250 },
  },
  {
    id: "grave-digger",
    name: "Grave Digger",
    description: "Bury 100 bones.",
    condition: { kind: "statisticAtLeast", statistic: "buried:bones", atLeast: 100 },
    reward: { achievementPoints: 10 },
  },
  // Milestones (added Oct 11; rewards proposed).
  {
    id: "groundbreaker",
    name: "Groundbreaker",
    description: "Buy your first building.",
    condition: { kind: "statisticAtLeast", statistic: "buildingsBought:total", atLeast: 1 },
    reward: { achievementPoints: 5 },
  },
  {
    id: "getting-somewhere",
    name: "Getting Somewhere",
    description: "Reach level 10 in any skill (Hitpoints doesn't count).",
    condition: anySkillAtLeast(10),
    reward: { achievementPoints: 5 },
  },
  {
    id: "apprentice",
    name: "Apprentice",
    description: "Reach level 20 in any skill.",
    condition: anySkillAtLeast(20),
    reward: { achievementPoints: 10 },
  },
  {
    id: "journeyman",
    name: "Journeyman",
    description: "Reach level 50 in any skill.",
    condition: anySkillAtLeast(50),
    reward: { achievementPoints: 25 },
  },
  {
    id: "master-of-one",
    name: "Master of One",
    description: "Reach level 99 in any skill.",
    condition: anySkillAtLeast(99),
    reward: { achievementPoints: 100 },
  },
  {
    id: "well-rounded",
    name: "Well Rounded",
    description: "Reach a total skill level of 250.",
    condition: { kind: "statisticAtLeast", statistic: "totalLevel", atLeast: 250 },
    reward: { achievementPoints: 50 },
  },
  {
    id: "first-blood",
    name: "First Blood",
    description: "Defeat your first enemy.",
    condition: { kind: "statisticAtLeast", statistic: "kills:total", atLeast: 1 },
    reward: { achievementPoints: 5 },
  },
  {
    id: "monster-hunter",
    name: "Monster Hunter",
    description: "Defeat 100 enemies.",
    condition: { kind: "statisticAtLeast", statistic: "kills:total", atLeast: 100 },
    reward: { achievementPoints: 20 },
  },
  {
    id: "den-cleaner",
    name: "Den Cleaner",
    description: "Clear the Overgrown Den and defeat the Den Guardian.",
    condition: { kind: "statisticAtLeast", statistic: "dungeonClears:overgrown-den", atLeast: 1 },
    reward: { achievementPoints: 30 },
  },
  {
    id: "sharp-dressed",
    name: "Sharp Dressed",
    description: "Equip a Dragon Scimitar.",
    condition: { kind: "statisticAtLeast", statistic: "equipped:dragon-scimitar", atLeast: 1 },
    reward: { achievementPoints: 25 },
  },
  {
    id: "dressed-in-bronze",
    name: "Dressed in Bronze",
    description: "Wear a bronze full helm, platebody and platelegs.",
    condition: {
      kind: "all",
      conditions: ["bronze-full-helm", "bronze-platebody", "bronze-platelegs"].map((id) => ({
        kind: "statisticAtLeast" as const,
        statistic: `equipped:${id}`,
        atLeast: 1,
      })),
    },
    reward: { achievementPoints: 10 },
  },
  {
    id: "good-cook",
    name: "Kitchen Regular",
    description: "Cook 100 shrimps.",
    condition: { kind: "statisticAtLeast", statistic: "crafted:cook-shrimps", atLeast: 100 },
    reward: { achievementPoints: 10 },
  },
];
