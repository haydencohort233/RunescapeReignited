import { useGame } from "../engine/GameEngineContext";
import { QUEST_CATALOG } from "../content/quests";
import { describeConditionProgress, describeUnmetCondition } from "../engine/unlockConditions";
import type { QuestDefinition } from "../engine/types";

function QuestEntry({ quest }: { quest: QuestDefinition }) {
  const { engine, state } = useGame();
  const status = engine.getQuestStatus(quest.id);
  const progress = state.quests[quest.id];
  const stage = progress ? quest.stages[progress.stage] : undefined;
  const objective = engine.getQuestObjective(quest.id);
  const stageMet = engine.isQuestStageMet(quest.id);
  const startBlocked = quest.startCondition ? describeUnmetCondition(quest.startCondition, state) : null;

  const statusColor = status === "completed" ? "#1a7a3a" : status === "in-progress" ? "#b8860b" : "#888";
  const statusText =
    status === "completed"
      ? "Completed"
      : status === "in-progress"
        ? `Step ${progress!.stage + 1}/${quest.stages.length}`
        : "Not started";

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>{quest.name}</strong>
        <span style={{ fontSize: 12, color: statusColor }}>{statusText}</span>
      </div>
      <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>{quest.description}</p>

      {status === "not-started" &&
        (startBlocked ? (
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{startBlocked}</p>
        ) : (
          <button onClick={() => engine.startQuest(quest.id)}>Start quest</button>
        ))}

      {status === "in-progress" && stage && objective && (
        <div style={{ fontSize: 13 }}>
          <div>{stage.description}</div>
          {!stageMet && (
            <div style={{ fontSize: 12, color: "#b91c1c" }}>
              {describeConditionProgress(stage.objective, state, progress!.baselines) ??
                describeUnmetCondition(objective, state)}
            </div>
          )}
          {stageMet && stage.consumes && (
            <button style={{ marginTop: 4 }} onClick={() => engine.advanceQuest(quest.id)}>
              Hand over
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuestsPanel() {
  return (
    <section style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Quests</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {QUEST_CATALOG.map((quest) => (
          <QuestEntry key={quest.id} quest={quest} />
        ))}
      </div>
    </section>
  );
}
