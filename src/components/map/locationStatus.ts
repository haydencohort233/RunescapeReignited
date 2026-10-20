import type { GameEngine } from "../../engine/gameEngine";
import type { QuestDefinition } from "../../engine/types";
import { JOB_BOARD_CATALOG } from "../../content/jobBoards";
import { getJob } from "../../content/jobs";
import { QUEST_CATALOG } from "../../content/quests";

/** Accepted jobs from the boards at a location whose objective is met:
 *  the ✓ badge on the map. */
export function jobsReadyAt(engine: GameEngine, locationId: string): number {
  let ready = 0;
  for (const board of JOB_BOARD_CATALOG) {
    if (board.locationId !== locationId) continue;
    for (const id of board.jobIds) {
      const job = getJob(id);
      if (job && engine.isJobAccepted(id) && engine.isJobObjectiveMet(job)) ready++;
    }
  }
  return ready;
}

export interface LocationQuest {
  quest: QuestDefinition;
  status: "not-started" | "in-progress" | "completed";
  canStart: boolean;
  /** Its current step is a hand-in the player has everything for. */
  readyToHandIn: boolean;
}

/** In progress, on a hand-in step, and the player has what it asks for:
 *  time to go back to the giver. */
export function isQuestReadyToHandIn(engine: GameEngine, quest: QuestDefinition): boolean {
  const progress = engine.getState().quests[quest.id];
  if (!progress || engine.getQuestStatus(quest.id) !== "in-progress") return false;
  return !!quest.stages[progress.stage]?.consumes && engine.isQuestStageMet(quest.id);
}

/** Quests given out at a location, for the map's quest markers and panel. */
export function questsAt(engine: GameEngine, locationId: string): LocationQuest[] {
  return QUEST_CATALOG.filter((q) => q.locationId === locationId).map((quest) => ({
    quest,
    status: engine.getQuestStatus(quest.id),
    canStart: engine.canStartQuest(quest.id),
    readyToHandIn: isQuestReadyToHandIn(engine, quest),
  }));
}

/** What the badges on a map pin show. */
export interface PinStatus {
  jobsReady: number;
  /** Quests here the player can start now. */
  questsToStart: number;
  /** Quests here ready to hand in. */
  questsReady: number;
}

export function pinStatus(engine: GameEngine, locationId: string): PinStatus {
  const quests = questsAt(engine, locationId);
  return {
    jobsReady: jobsReadyAt(engine, locationId),
    questsToStart: quests.filter((q) => q.canStart).length,
    questsReady: quests.filter((q) => q.readyToHandIn).length,
  };
}
