import type { QuestDefinition } from "../engine/types";

// Quests are ordered stages over the same UnlockCondition language
// everything else uses. Stages without `consumes` complete on their own;
// stages with it need the player to hand the items over.
export const QUEST_CATALOG: QuestDefinition[] = [
  {
    id: "overgrown-den",
    name: "The Overgrown Den",
    description: "Something is living in the den at the Dark Forest. The town wants to know what.",
    stages: [
      {
        description: "Travel to the Dark Forest.",
        objective: { kind: "flag", flag: "visited:dark-forest" },
      },
      {
        description: "Defeat 3 goblins near the den.",
        objective: { kind: "statisticAtLeast", statistic: "kills:goblin", atLeast: 3 },
      },
      {
        description: "Bring 5 bones back as proof.",
        objective: { kind: "resourceAtLeast", resource: "bones", amount: 5 },
        consumes: [{ resource: "bones", amount: 5 }],
      },
    ],
    // investigatedDen is what the "Something's Living in the Den" job
    // waits on.
    reward: { gp: 300, xp: { attack: 200 }, setFlags: ["investigatedDen"] },
  },
];

export function getQuest(id: string): QuestDefinition | undefined {
  return QUEST_CATALOG.find((q) => q.id === id);
}
