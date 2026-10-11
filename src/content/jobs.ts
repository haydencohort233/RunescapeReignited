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
    description: "Investigate the Overgrown Den at Dark Forest.",
    // Placeholder objective until dungeons/combat exist — a flag a future
    // "Enter" action would set. Included now to prove a job CAN be the
    // first step of something bigger, not just a delivery.
    objective: { kind: "flag", flag: "investigatedDen", label: "Complete the quest The Overgrown Den" },
    reward: { gp: 250, setFlags: ["denCleared"] },
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
];

const JOBS_BY_ID = new Map(JOB_CATALOG.map((j) => [j.id, j]));

export function getJob(id: string): JobDefinition | undefined {
  return JOBS_BY_ID.get(id);
}