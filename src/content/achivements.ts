import type { AchievementDefinition } from "../engine/types";

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
    description: "Fletch 10 wooden bows.",
    condition: { kind: "statisticAtLeast", statistic: "crafted:wooden-bow", atLeast: 10 },
    reward: { gp: 200 },
  },
  {
    id: "master-builder",
    name: "Master Builder",
    description: "Purchase 10 buildings in total.",
    condition: { kind: "statisticAtLeast", statistic: "buildingsBought:total", atLeast: 10 },
    reward: { achievementPoints: 25, items: [{ itemDefId: "shark", quantity: 5, stackable: true }] },
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
];