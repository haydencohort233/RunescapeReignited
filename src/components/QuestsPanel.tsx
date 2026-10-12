import { useGame } from "../engine/GameEngineContext";
import { QUEST_CATALOG } from "../content/quests";
import { CONDITION_LABELS, formatReward } from "../content/display";
import { describeConditionProgress, describeUnmetCondition } from "../engine/unlockConditions";
import type { QuestDefinition } from "../engine/types";
import { Page, Section } from "./ui/Page";
import { AcceptedJobsList } from "./JobBoardBrowsePanel";

function QuestCard({ quest }: { quest: QuestDefinition }) {
  const { engine, state } = useGame();
  const status = engine.getQuestStatus(quest.id);
  const progress = state.quests[quest.id];
  const stage = progress ? quest.stages[progress.stage] : undefined;
  const objective = engine.getQuestObjective(quest.id);
  const stageMet = engine.isQuestStageMet(quest.id);
  const startBlocked = quest.startCondition
    ? describeUnmetCondition(quest.startCondition, state, CONDITION_LABELS)
    : null;

  const tag =
    status === "completed" ? (
      <span className="tag tag-success">Completed</span>
    ) : status === "in-progress" ? (
      <span className="tag tag-gold">
        Step {progress!.stage + 1}/{quest.stages.length}
      </span>
    ) : (
      <span className="tag">Not started</span>
    );

  return (
    <div className={`card${status === "in-progress" ? " is-active" : ""}`}>
      <div className="card-header">
        <span className="card-title">{quest.name}</span>
        {tag}
      </div>
      <p className="text-muted">{quest.description}</p>
      {quest.reward && <p className="text-small">Reward: {formatReward(quest.reward)}</p>}

      {status === "not-started" && (
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!startBlocked}
            title={startBlocked ?? undefined}
            onClick={() => engine.startQuest(quest.id)}
          >
            Start quest
          </button>
        </div>
      )}

      {status === "in-progress" && stage && objective && (
        <>
          <p className="text-small">{stage.description}</p>
          {/* A flag stage's description already says what to do. */}
          {!stageMet && stage.objective.kind !== "flag" && (
            <p className="text-small text-info">
              {describeConditionProgress(stage.objective, state, progress!.baselines, CONDITION_LABELS) ??
                describeUnmetCondition(objective, state, CONDITION_LABELS)}
            </p>
          )}
          {stage.consumes && (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!stageMet}
                title={stageMet ? undefined : "You don't have everything yet"}
                onClick={() => engine.advanceQuest(quest.id)}
              >
                Hand over
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function QuestsPanel() {
  const { engine } = useGame();
  const done = QUEST_CATALOG.filter((q) => engine.getQuestStatus(q.id) === "completed").length;
  return (
    <Page title="Quests" meta={`${done}/${QUEST_CATALOG.length} completed`}>
      <div className="stack-sm">
        {QUEST_CATALOG.map((quest) => (
          <QuestCard key={quest.id} quest={quest} />
        ))}
      </div>
      <Section title="Your jobs">
        <AcceptedJobsList />
      </Section>
    </Page>
  );
}
