import { useGame } from "../engine/GameEngineContext";
import { QUEST_CATALOG } from "../content/quests";
import { JOB_BOARD_CATALOG } from "../content/jobBoards";
import { CONDITION_LABELS } from "../content/display";
import { conditionProgress, describeConditionProgress, describeUnmetCondition } from "../engine/unlockConditions";
import type { QuestDefinition } from "../engine/types";
import { Page } from "./ui/Page";
import { AcceptedJobsList } from "./JobBoardBrowsePanel";
import { getNpc } from "../content/npcs";
import { getLocation } from "../content/mapLocations";
import { GpAmount, ItemChip, SkillIcon } from "./ui/GameIcons";
import { ChatHead } from "./ui/Conversation";
import { isQuestReadyToHandIn } from "./map/locationStatus";
import { formatNumber } from "../engine/format";

type QuestState = "ready" | "in-progress" | "available" | "locked" | "completed";

/** What a quest gives, as chips: GP, XP with skill icons, items. */
function QuestRewards({ reward, notes = [] }: { reward: QuestDefinition["reward"]; notes?: string[] }) {
  if (!notes.length && (!reward || (!reward.gp && !reward.items?.length && !Object.keys(reward.xp ?? {}).length))) return null;
  return (
    <div className="quest-rewards">
      <span className="quest-rewards-label">Rewards</span>
      {reward?.gp ? (
        <span className="quest-reward">
          <GpAmount amount={reward.gp} />
        </span>
      ) : null}
      {Object.entries(reward?.xp ?? {}).map(([skill, xp]) => (
        <span key={skill} className="quest-reward">
          <SkillIcon skillId={skill} size={16} /> {formatNumber(xp)} XP
        </span>
      ))}
      {reward?.items?.map((i) => (
        <span key={i.itemDefId} className="quest-reward">
          <ItemChip id={i.itemDefId} amount={i.quantity} size={16} />
        </span>
      ))}
      {notes.map((note) => (
        <span key={note} className="quest-reward is-note">
          ★ {note}
        </span>
      ))}
    </div>
  );
}

/** One quest as a parchment scroll: who gives it, the steps done so far
 *  (crossed off, as in the OSRS quest journal) and the current one with
 *  its progress, and what it pays. Quests start and are handed in by
 *  talking to the giver, so there are no buttons here, only directions. */
function QuestScroll({ quest, questState }: { quest: QuestDefinition; questState: QuestState }) {
  const { state } = useGame();
  const progress = state.quests[quest.id];
  const giver = quest.giverNpcId ? getNpc(quest.giverNpcId) : undefined;
  const place = quest.locationId ? getLocation(quest.locationId) : undefined;
  const where = giver ? `${giver.name}${place ? ` in ${place.name}` : ""}` : place?.name;
  const startBlocked = quest.startCondition ? describeUnmetCondition(quest.startCondition, state, CONDITION_LABELS) : null;
  const stageIndex = progress?.stage ?? 0;

  const tag =
    questState === "completed"
      ? "Complete"
      : questState === "ready"
        ? "Ready to hand in"
        : questState === "in-progress"
          ? `Step ${stageIndex + 1} of ${quest.stages.length}`
          : questState === "locked"
            ? "Locked"
            : "Not started";

  return (
    <article className={`quest-scroll is-${questState}`}>
      <header className="quest-scroll-head">
        <span className={`map-badge ${questState === "ready" ? "is-quest-ready" : "is-quest"}`} aria-hidden="true">
          {questState === "ready" ? "!" : questState === "completed" ? "✓" : "Q"}
        </span>
        <h4 className="quest-scroll-title">{quest.name}</h4>
        <span className="quest-scroll-tag">{tag}</span>
      </header>

      {/* Done quests fold down to their name and giver, so the list stays
          short as it grows. */}
      {questState !== "completed" && <p className="quest-scroll-desc">{quest.description}</p>}

      {giver && (
        <div className="quest-giver">
          <ChatHead name={giver.name} portrait={giver.portrait} size={30} />
          <span>
            <strong>{giver.name}</strong>
            {place && <span className="quest-giver-place"> · {place.name}</span>}
          </span>
        </div>
      )}

      {progress && questState !== "completed" && (
        <ol className="quest-steps">
          {quest.stages.slice(0, stageIndex + 1).map((stage, i) => {
            const current = i === stageIndex;
            const p = current ? conditionProgress(stage.objective, state, progress.baselines) : null;
            const text = current
              ? (describeConditionProgress(stage.objective, state, progress.baselines, CONDITION_LABELS) ?? null)
              : null;
            const percent = p ? Math.min(100, (p.have / Math.max(1, p.need)) * 100) : 0;
            return (
              <li key={i} className={current ? "is-current" : "is-done"}>
                <span>{stage.description}</span>
                {current && p && stage.objective.kind !== "flag" && (
                  <div className="quest-step-progress">
                    <span className="text-small">{text}</span>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {questState === "ready" && where && <p className="quest-callout is-ready">! Return to {where}</p>}
      {(questState === "available" || questState === "locked") && where && (
        <p className="quest-callout">
          💬 Talk to {where}
          {startBlocked && <span className="quest-callout-lock"> · 🔒 {startBlocked}</span>}
        </p>
      )}

      {questState !== "completed" && <QuestRewards reward={quest.reward} notes={quest.rewardNotes} />}
    </article>
  );
}

const GROUPS: { title: string; states: QuestState[] }[] = [
  { title: "In progress", states: ["ready", "in-progress"] },
  { title: "Available", states: ["available", "locked"] },
  { title: "Completed", states: ["completed"] },
];

export default function QuestsPanel() {
  const { engine, state } = useGame();
  const stateOf = (quest: QuestDefinition): QuestState => {
    const status = engine.getQuestStatus(quest.id);
    if (status === "completed") return "completed";
    if (status === "in-progress") return isQuestReadyToHandIn(engine, quest) ? "ready" : "in-progress";
    return quest.startCondition && describeUnmetCondition(quest.startCondition, state, CONDITION_LABELS) ? "locked" : "available";
  };
  const quests = QUEST_CATALOG.map((quest) => ({ quest, questState: stateOf(quest) }));
  const done = quests.filter((q) => q.questState === "completed").length;
  // Jobs are short and checked often, so taken ones go first. With none
  // taken, the "where to find jobs" note waits at the bottom.
  const jobCount = JOB_BOARD_CATALOG.reduce((n, board) => n + board.jobIds.filter((id) => engine.isJobAccepted(id)).length, 0);
  const hasJobs = jobCount > 0;
  const jobs = (
    <section className="job-group">
      <h4 className="job-group-title">
        Your jobs {hasJobs && <span className="job-count">{jobCount}</span>}
      </h4>
      <AcceptedJobsList />
    </section>
  );

  return (
    <Page title="Quests" meta={`${done}/${QUEST_CATALOG.length} completed`}>
      {hasJobs && jobs}
      {GROUPS.map(({ title, states }) => {
        const list = quests
          .filter((q) => states.includes(q.questState))
          .sort((a, b) => states.indexOf(a.questState) - states.indexOf(b.questState));
        if (list.length === 0) return null;
        return (
          <section key={title} className="job-group">
            <h4 className="job-group-title">
              {title} <span className="job-count">{list.length}</span>
            </h4>
            <div className="quest-grid">
              {list.map(({ quest, questState }) => (
                <QuestScroll key={quest.id} quest={quest} questState={questState} />
              ))}
            </div>
          </section>
        );
      })}
      {!hasJobs && jobs}
    </Page>
  );
}
