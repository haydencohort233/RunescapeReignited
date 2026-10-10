import type { QuestDefinition, GameState, UnlockCondition } from "../types";
import type { GameEngine } from "../gameEngine";
import { isUnlocked, captureBaselines, offsetByBaselines } from "../unlockConditions";

/** Quests: ordered stages, automatic or hand-in advancement, completion rewards. */
export class QuestSystem {
  private readonly questsById: Map<string, QuestDefinition>;
  private readonly engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.questsById = new Map(engine.content.quests.map((q) => [q.id, q]));
  }

  private get state(): GameState {
    return this.engine.getState();
  }

  private get notifications() {
    return this.engine.notifications;
  }

  getQuestStatus(questId: string): "not-started" | "in-progress" | "completed" {
    const progress = this.state.quests[questId];
    const def = this.questsById.get(questId);
    if (!progress || !def) return "not-started";
    return progress.stage >= def.stages.length ? "completed" : "in-progress";
  }

  canStartQuest(questId: string): boolean {
    const def = this.questsById.get(questId);
    if (!def || this.state.quests[questId]) return false;
    return !def.startCondition || isUnlocked(def.startCondition, this.state);
  }

  startQuest(questId: string): boolean {
    this.engine.catchUpToNow(); // baselines must capture up-to-date counters
    const def = this.questsById.get(questId);
    if (!def || !this.canStartQuest(questId)) return false;
    this.state.quests[questId] = { stage: 0, baselines: captureBaselines(def.stages[0].objective, this.state) };
    this.notifications.push("quest", `Quest started: ${def.name}. ${def.stages[0].description}`);
    this.checkQuests(); // a first stage might already be met
    return true;
  }

  /** The current stage's objective, with counters measured from when the
   *  stage began. Null if the quest isn't in progress. */
  getQuestObjective(questId: string): UnlockCondition | null {
    const def = this.questsById.get(questId);
    const progress = this.state.quests[questId];
    if (!def || !progress || progress.stage >= def.stages.length) return null;
    return offsetByBaselines(def.stages[progress.stage].objective, progress.baselines);
  }

  isQuestStageMet(questId: string): boolean {
    const objective = this.getQuestObjective(questId);
    return !!objective && isUnlocked(objective, this.state);
  }

  /** Hands over the current stage's delivery and moves on. Only for
   *  stages with `consumes`; others advance by themselves (checkQuests). */
  advanceQuest(questId: string): boolean {
    const def = this.questsById.get(questId);
    const progress = this.state.quests[questId];
    if (!def || !progress || !this.isQuestStageMet(questId)) return false;
    const stage = def.stages[progress.stage];
    const consumes = stage.consumes ?? [];
    if (consumes.some((c) => this.engine.getOwnedCount(c.resource) < c.amount)) {
      this.notifications.push("status", "You don't have everything to hand over yet.", { severity: "warning" });
      return false;
    }
    this.engine.payFor(consumes);
    this.completeQuestStage(def);
    this.checkQuests();
    return true;
  }

  /** Advances every in-progress quest whose current stage is met and
   *  doesn't need a hand-over. Runs once per tick. */
  checkQuests(): void {
    for (const [questId, progress] of Object.entries(this.state.quests)) {
      const def = this.questsById.get(questId);
      if (!def) continue;
      while (progress.stage < def.stages.length) {
        const stage = def.stages[progress.stage];
        if (stage.consumes?.length || !this.isQuestStageMet(questId)) break;
        this.completeQuestStage(def);
      }
    }
  }

  private completeQuestStage(def: QuestDefinition): void {
    const progress = this.state.quests[def.id];
    progress.stage++;
    const next = def.stages[progress.stage];
    if (next) {
      progress.baselines = captureBaselines(next.objective, this.state);
      this.notifications.push("quest", `${def.name}: ${next.description}`);
      return;
    }

    progress.baselines = {};
    const reward = def.reward;
    if (reward?.gp) this.engine.gainResource("gp", reward.gp);
    for (const item of reward?.items ?? []) this.engine.addItem(item.itemDefId, item.quantity);
    for (const [skillId, xp] of Object.entries(reward?.xp ?? {})) this.engine.addSkillXp(skillId, xp);
    for (const flag of reward?.setFlags ?? []) this.engine.setFlag(flag, true);
    this.engine.incrementStatistic("questsCompleted", 1);
    this.notifications.push("quest", `Quest complete: ${def.name}!`);
  }
}
