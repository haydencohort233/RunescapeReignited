import type { JobDefinition } from "../engine/types";

// Fixed content for now (no random rotation yet) — mostly one-time, since
// that was the priority. Deliberately varied to exercise every shape the
// type supports: a plain delivery, a milestone with no consumption, a
// repeatable grind job, and one that sets a flag on completion (the
// quest-starting hook — this one behaves exactly like a tiny quest).
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
  },
  {
    id: "flax-for-the-fletcher",
    title: "Flax for the Fletcher",
    description: "Bring 10 Flax to the job board. Repeatable.",
    objective: { kind: "resourceAtLeast", resource: "flax", amount: 10 },
    consumesOnTurnIn: [{ resource: "flax", amount: 10 }],
    reward: { gp: 40 },
    repeatable: true,
  },
  {
    id: "clear-the-den",
    title: "Something's Living in the Den",
    description: "Investigate the Overgrown Den at Dark Forest.",
    // Placeholder objective until dungeons/combat exist — a flag a future
    // "Enter" action would set. Included now to prove a job CAN be the
    // first step of something bigger, not just a delivery.
    objective: { kind: "flag", flag: "investigatedDen" },
    reward: { gp: 250, setFlags: ["denCleared"] },
  },
];

export function getJob(id: string): JobDefinition | undefined {
  return JOB_CATALOG.find((j) => j.id === id);
}