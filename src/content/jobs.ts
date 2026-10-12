import type { JobDefinition } from "../engine/types";

// Deliberately varied to exercise every shape the type supports: a plain
// daily delivery, a one-time milestone with no consumption, a repeatable
// grind job, a daily kill count (counted from when you accept it), and a
// one-time job that sets a flag on completion (the quest-starting hook).
// Jobs are "daily" unless they say otherwise.
export const JOB_CATALOG: JobDefinition[] = [
  {
    id: "deliver-wood",
    title: "Wood for the Mill",
    description: "Bring 20 Wood to the job board.",
    objective: { kind: "resourceAtLeast", resource: "wood", amount: 20 },
    consumesOnTurnIn: [{ resource: "wood", amount: 20 }],
    reward: { gp: 100 },
  },
  {
    id: "reach-woodcutting-15",
    title: "Prove Your Skill",
    description: "Reach Woodcutting level 15.",
    objective: { kind: "skillLevel", skill: "woodcutting", atLeast: 15 },
    // No consumesOnTurnIn — nothing to hand over, the level itself is the task.
    reward: { achievementPoints: 15 },
    frequency: "once", // a level, once reached, stays reached
  },
  {
    id: "flax-for-the-fletcher",
    title: "Flax for the Fletcher",
    description: "Bring 10 Flax to the job board. Repeatable.",
    objective: { kind: "resourceAtLeast", resource: "flax", amount: 10 },
    consumesOnTurnIn: [{ resource: "flax", amount: 10 }],
    reward: { gp: 40 },
    frequency: "repeatable",
  },
  {
    id: "clear-the-den",
    title: "Something's Living in the Den",
    description: "Clear the Overgrown Den at Dark Forest and defeat the Den Guardian.",
    // The dungeon sets denCleared when its boss falls.
    objective: { kind: "flag", flag: "denCleared", label: "Defeat the Den Guardian in the Overgrown Den" },
    reward: { gp: 250 },
    frequency: "once",
  },
  {
    id: "goblin-trouble",
    title: "Goblin Trouble",
    description: "Defeat 5 goblins in the Dark Forest.",
    // Counts kills made AFTER accepting, not lifetime kills.
    objective: { kind: "statisticAtLeast", statistic: "kills:goblin", atLeast: 5 },
    reward: { gp: 75 },
  },
  // ── Added Oct 11: more jobs per place, and better-paying ones that need
  // a level. Rewards are proposed. ──
  {
    id: "rest-in-peace",
    title: "Rest in Peace",
    description: "The graveyard keeper is behind. Bury 20 bones.",
    objective: { kind: "statisticAtLeast", statistic: "buried:bones", atLeast: 20 },
    reward: { gp: 120 },
  },
  {
    id: "supper-for-the-inn",
    title: "Supper for the Inn",
    description: "Bring 15 cooked Shrimps for the inn's supper.",
    objective: { kind: "resourceAtLeast", resource: "shrimps", amount: 15 },
    consumesOnTurnIn: [{ resource: "shrimps", amount: 15 }],
    reward: { gp: 150 },
  },
  {
    id: "bronze-for-the-guard",
    title: "Bronze for the Guard",
    description: "The town guard needs 10 Bronze Bars for repairs.",
    objective: { kind: "resourceAtLeast", resource: "bronze-bar", amount: 10 },
    consumesOnTurnIn: [{ resource: "bronze-bar", amount: 10 }],
    requirement: { kind: "skillLevel", skill: "smithing", atLeast: 5 },
    reward: { gp: 350 },
  },
  {
    id: "logs-for-the-camp",
    title: "Logs for the Camp",
    description: "Bring 50 Wood to the camp foreman.",
    objective: { kind: "resourceAtLeast", resource: "wood", amount: 50 },
    consumesOnTurnIn: [{ resource: "wood", amount: 50 }],
    reward: { gp: 250 },
  },
  {
    id: "oak-order",
    title: "Oak Order",
    description: "A shipwright wants 25 Oak Logs.",
    objective: { kind: "resourceAtLeast", resource: "oak-logs", amount: 25 },
    consumesOnTurnIn: [{ resource: "oak-logs", amount: 25 }],
    requirement: { kind: "skillLevel", skill: "woodcutting", atLeast: 15 },
    reward: { gp: 500 },
  },
  {
    id: "willow-order",
    title: "Willow Order",
    description: "The bowyer wants 25 Willow Logs.",
    objective: { kind: "resourceAtLeast", resource: "willow-logs", amount: 25 },
    consumesOnTurnIn: [{ resource: "willow-logs", amount: 25 }],
    requirement: { kind: "skillLevel", skill: "woodcutting", atLeast: 30 },
    reward: { gp: 900 },
  },
  {
    id: "bandit-bounty",
    title: "Bandit Bounty",
    description: "Bandits keep raiding the camp. Defeat 5 of them.",
    objective: { kind: "statisticAtLeast", statistic: "kills:bandit", atLeast: 5 },
    requirement: { kind: "skillLevel", skill: "attack", atLeast: 10 },
    reward: { gp: 400 },
  },
  {
    id: "head-lumberjack",
    title: "Head Lumberjack",
    description: "Reach Woodcutting level 40 and the foreman will make it official.",
    objective: { kind: "skillLevel", skill: "woodcutting", atLeast: 40 },
    reward: { gp: 2000, achievementPoints: 20 },
    frequency: "once",
  },
  {
    id: "shrimp-supply",
    title: "Shrimp Supply",
    description: "Bring 30 Raw Shrimps to the fishmonger.",
    objective: { kind: "resourceAtLeast", resource: "raw-shrimps", amount: 30 },
    consumesOnTurnIn: [{ resource: "raw-shrimps", amount: 30 }],
    reward: { gp: 150 },
  },
  {
    id: "trout-run",
    title: "Trout Run",
    description: "Bring 20 Raw Trout to the fishmonger.",
    objective: { kind: "resourceAtLeast", resource: "raw-trout", amount: 20 },
    consumesOnTurnIn: [{ resource: "raw-trout", amount: 20 }],
    requirement: { kind: "skillLevel", skill: "fishing", atLeast: 20 },
    reward: { gp: 500 },
  },
  {
    id: "tuna-haul",
    title: "Tuna Haul",
    description: "Bring 15 Raw Tuna to the fishmonger.",
    objective: { kind: "resourceAtLeast", resource: "raw-tuna", amount: 15 },
    consumesOnTurnIn: [{ resource: "raw-tuna", amount: 15 }],
    requirement: { kind: "skillLevel", skill: "fishing", atLeast: 35 },
    reward: { gp: 1200 },
  },
  {
    id: "shark-week",
    title: "Shark Week",
    description: "A collector pays well for 5 Raw Sharks. Repeatable.",
    objective: { kind: "resourceAtLeast", resource: "raw-shark", amount: 5 },
    consumesOnTurnIn: [{ resource: "raw-shark", amount: 5 }],
    requirement: { kind: "skillLevel", skill: "fishing", atLeast: 76 },
    reward: { gp: 2500 },
    frequency: "repeatable",
  },
  {
    id: "ore-for-the-furnace",
    title: "Ore for the Furnace",
    description: "Bring 20 Copper Ore and 20 Tin Ore.",
    objective: {
      kind: "all",
      conditions: [
        { kind: "resourceAtLeast", resource: "copper-ore", amount: 20 },
        { kind: "resourceAtLeast", resource: "tin-ore", amount: 20 },
      ],
    },
    consumesOnTurnIn: [
      { resource: "copper-ore", amount: 20 },
      { resource: "tin-ore", amount: 20 },
    ],
    reward: { gp: 200 },
  },
  {
    id: "rock-breaker",
    title: "Rock Breaker",
    description: "Mine 100 Copper Ore for the quarry master.",
    objective: { kind: "statisticAtLeast", statistic: "gathered:mine-copper", atLeast: 100 },
    requirement: { kind: "skillLevel", skill: "mining", atLeast: 10 },
    reward: { gp: 600 },
  },
  {
    id: "quarry-regular",
    title: "Quarry Regular",
    description: "Reach Mining level 30.",
    objective: { kind: "skillLevel", skill: "mining", atLeast: 30 },
    reward: { gp: 1500, achievementPoints: 15 },
    frequency: "once",
  },
];

const JOBS_BY_ID = new Map(JOB_CATALOG.map((j) => [j.id, j]));

export function getJob(id: string): JobDefinition | undefined {
  return JOBS_BY_ID.get(id);
}
