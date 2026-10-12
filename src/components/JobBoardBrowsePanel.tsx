import { useGame } from "../engine/GameEngineContext";
import { type JobBoardDefinition, JOB_BOARD_CATALOG, getActiveJobIds } from "../content/jobBoards";
import { getJob } from "../content/jobs";
import { getLocation } from "../content/mapLocations";
import { CONDITION_LABELS, skillName } from "../content/display";
import { conditionProgress, describeConditionProgress, describeUnmetCondition } from "../engine/unlockConditions";
import { getMsUntilNextDailyReset, formatCountdown } from "../engine/time";
import { formatNumber } from "../engine/format";
import type { JobDefinition, UnlockCondition } from "../engine/types";
import { ItemChip } from "./ui/GameIcons";

const FREQUENCY_TAG: Record<NonNullable<JobDefinition["frequency"]>, string> = {
  daily: "Daily",
  once: "One-time",
  repeatable: "Repeatable",
};

/** The reward as chips: GP, points and items with their icons. */
function RewardChips({ reward }: { reward: JobDefinition["reward"] }) {
  if (!reward) return null;
  return (
    <span className="row text-small" style={{ gap: 8 }}>
      <span className="text-faint">Reward:</span>
      {reward.gp ? <span className="text-gold">🪙 {formatNumber(reward.gp)} GP</span> : null}
      {reward.achievementPoints ? <span>⭐ {reward.achievementPoints} points</span> : null}
      {reward.items?.map((i) => (
        <ItemChip key={i.itemDefId} id={i.itemDefId} amount={i.quantity} size={16} />
      ))}
    </span>
  );
}

/** One progress bar per counting part of the objective ("Copper Ore
 *  12/20" and "Tin Ore 20/20" for a two-part delivery). */
function ObjectiveProgress({ job }: { job: JobDefinition }) {
  const { state } = useGame();
  const baselines = state.jobs.accepted[job.id]?.baselines;
  const parts: UnlockCondition[] = job.objective.kind === "all" ? job.objective.conditions : [job.objective];
  return (
    <div className="job-progress">
      {parts.map((part, i) => {
        const progress = conditionProgress(part, state, baselines);
        const text =
          describeConditionProgress(part, state, baselines, CONDITION_LABELS) ??
          describeUnmetCondition(part, state, CONDITION_LABELS) ??
          "Done";
        const percent = progress ? Math.min(100, (progress.have / Math.max(1, progress.need)) * 100) : 0;
        return (
          <div key={i} className="stack-sm">
            <span className="text-small text-info">{text}</span>
            {progress && (
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${percent}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** One job: what it asks, what it pays, and accept or turn in. Accepting
 *  or turning in only works at the job's board. */
export function JobCard({ job, boardLocationId, showBoard = false }: { job: JobDefinition; boardLocationId: string; showBoard?: boolean }) {
  const { engine, state } = useGame();
  const accepted = engine.isJobAccepted(job.id);
  const objectiveMet = engine.isJobObjectiveMet(job);
  const needs = job.requirement ? describeUnmetCondition(job.requirement, state, CONDITION_LABELS) : null;
  const here = state.currentLocationId === boardLocationId;
  const boardName = getLocation(boardLocationId)?.name ?? boardLocationId;

  return (
    <div className={`card job-card${accepted ? " is-active" : ""}${needs && !accepted ? " is-locked" : ""}`}>
      <div className="card-header">
        <span className="card-title">{job.title}</span>
        <span className="row" style={{ gap: 4 }}>
          {job.requirement && job.requirement.kind === "skillLevel" && (
            <span className={`tag${needs ? "" : " tag-success"}`}>
              Lv {job.requirement.atLeast} {skillName(job.requirement.skill)}
            </span>
          )}
          <span className="tag">{FREQUENCY_TAG[job.frequency ?? "daily"]}</span>
        </span>
      </div>
      <p className="text-muted">{job.description}</p>
      <RewardChips reward={job.reward} />
      {showBoard && <span className="text-faint text-small">From the board at {boardName}.</span>}
      {accepted && <ObjectiveProgress job={job} />}
      {needs && !accepted && <span className="locked-note">🔒 {needs}</span>}
      <div className="btn-row">
        {accepted ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!objectiveMet || !here}
            title={!here ? `Turn it in at ${boardName}` : objectiveMet ? undefined : "Finish the job first"}
            onClick={() => engine.turnInJob(job, boardLocationId)}
          >
            {objectiveMet ? "Turn in" : "In progress"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!needs || !here}
            title={needs ?? (!here ? `Accept it at ${boardName}` : undefined)}
            onClick={() => engine.acceptJob(job, boardLocationId)}
          >
            Accept
          </button>
        )}
        {accepted && objectiveMet && !here && <span className="text-faint text-small">Turn it in at {boardName}.</span>}
      </div>
    </div>
  );
}

/** The jobs on one board, shown inside the board's card on the Home tab:
 *  what you've taken on first, then what's on offer, then what needs a
 *  higher level. */
export default function JobBoardBrowsePanel({ board }: { board: JobBoardDefinition }) {
  const { engine, state } = useGame();

  // What's shown today = whatever rotation picked, UNION anything the
  // player already has accepted from this board's pool — rotating a job
  // out only affects what's newly offerable, it should never yank
  // something you're actively working on out from under you.
  const activeToday = getActiveJobIds(board, Date.now());
  const visibleIds = Array.from(new Set([...activeToday, ...board.jobIds.filter((id) => engine.isJobAccepted(id))]));
  const resetsIn = formatCountdown(getMsUntilNextDailyReset(Date.now()));
  const jobs = visibleIds.map(getJob).filter((j): j is JobDefinition => !!j);

  const inProgress = jobs.filter((j) => engine.isJobAccepted(j.id));
  const open = jobs.filter((j) => !engine.isJobAccepted(j.id) && !engine.isJobCompleted(j));
  const available = open.filter((j) => !j.requirement || !describeUnmetCondition(j.requirement, state, CONDITION_LABELS));
  const locked = open.filter((j) => !available.includes(j));
  const doneToday = jobs.filter((j) => !engine.isJobAccepted(j.id) && engine.isJobCompleted(j) && j.frequency !== "once");

  const group = (title: string, list: JobDefinition[]) =>
    list.length > 0 && (
      <div className="stack-sm">
        <h4 className="section-title">{title}</h4>
        {list.map((job) => (
          <JobCard key={job.id} job={job} boardLocationId={board.locationId} />
        ))}
      </div>
    );

  return (
    <div className="stack">
      <span className="text-faint text-small">New daily jobs in {resetsIn}. One-time and repeatable jobs stay up.</span>
      {group("In progress", inProgress)}
      {group("Available", available)}
      {group("Needs a higher level", locked)}
      {doneToday.length > 0 && (
        <div className="card is-locked">
          <span className="locked-note">
            ✓ Done today: {doneToday.map((j) => j.title).join(", ")}. Back in {resetsIn}.
          </span>
        </div>
      )}
      {jobs.length === 0 && <span className="text-faint text-small">No jobs posted right now.</span>}
    </div>
  );
}

/** Every job you've accepted, from any board, for the Quests tab. */
export function AcceptedJobsList() {
  const { engine } = useGame();
  const entries = JOB_BOARD_CATALOG.flatMap((board) =>
    board.jobIds.filter((id) => engine.isJobAccepted(id)).map((id) => ({ board, job: getJob(id) }))
  ).filter((e): e is { board: JobBoardDefinition; job: JobDefinition } => !!e.job);
  if (entries.length === 0) {
    const places = JOB_BOARD_CATALOG.map((b) => getLocation(b.locationId)?.name ?? b.locationId);
    return <p className="empty-state">No jobs taken. There are job boards at {places.join(", ")}.</p>;
  }
  return (
    <div className="stack-sm">
      {entries.map(({ board, job }) => (
        <JobCard key={job.id} job={job} boardLocationId={board.locationId} showBoard />
      ))}
    </div>
  );
}
