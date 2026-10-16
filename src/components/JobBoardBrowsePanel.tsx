import type { ReactNode } from "react";
import { useGame } from "../engine/GameEngineContext";
import { type JobBoardDefinition, JOB_BOARD_CATALOG, getActiveJobIds } from "../content/jobBoards";
import { getJob } from "../content/jobs";
import { getLocation } from "../content/mapLocations";
import { CONDITION_LABELS, skillName } from "../content/display";
import { conditionProgress, describeConditionProgress, describeUnmetCondition } from "../engine/unlockConditions";
import { getMsUntilNextDailyReset, formatCountdown } from "../engine/time";
import type { JobDefinition, UnlockCondition } from "../engine/types";
import { GpAmount, ItemChip } from "./ui/GameIcons";

const FREQUENCY: Record<NonNullable<JobDefinition["frequency"]>, { label: string; tone: string }> = {
  daily: { label: "Daily", tone: "is-daily" },
  once: { label: "One-time", tone: "is-once" },
  repeatable: { label: "Repeatable", tone: "is-repeat" },
};

/** The reward as chips: GP, points and items with their icons. */
function RewardChips({ reward }: { reward: JobDefinition["reward"] }) {
  if (!reward) return <span className="text-faint text-small">No reward</span>;
  return (
    <span className="job-reward">
      {reward.gp ? (
        <span className="job-reward-gp">
          <GpAmount amount={reward.gp} />
        </span>
      ) : null}
      {reward.achievementPoints ? <span className="job-reward-pts">⭐ {reward.achievementPoints}</span> : null}
      {reward.items?.map((i) => (
        <ItemChip key={i.itemDefId} id={i.itemDefId} amount={i.quantity} size={16} />
      ))}
    </span>
  );
}

/** One bar per counting part of the objective ("Copper Ore 12/20" and
 *  "Tin Ore 20/20" for a two-part delivery). */
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
        const done = progress ? progress.have >= progress.need : text === "Done";
        const percent = progress ? Math.min(100, (progress.have / Math.max(1, progress.need)) * 100) : done ? 100 : 0;
        return (
          <div key={i} className={`job-objective${done ? " is-done" : ""}`}>
            <span className="row row-between">
              <span>{text}</span>
              {done && <span aria-label="done">✓</span>}
            </span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One job, as a note pinned to the board: what it asks, what it pays,
 *  and accept or turn in. Accepting or turning in only works at the
 *  job's board. */
export function JobCard({ job, boardLocationId, showBoard = false }: { job: JobDefinition; boardLocationId: string; showBoard?: boolean }) {
  const { engine, state } = useGame();
  const accepted = engine.isJobAccepted(job.id);
  const objectiveMet = engine.isJobObjectiveMet(job);
  const needs = job.requirement ? describeUnmetCondition(job.requirement, state, CONDITION_LABELS) : null;
  const here = state.currentLocationId === boardLocationId;
  const boardName = getLocation(boardLocationId)?.name ?? boardLocationId;
  const freq = FREQUENCY[job.frequency ?? "daily"];
  const ready = accepted && objectiveMet;

  let action: ReactNode;
  if (ready && here) {
    action = (
      <button type="button" className="btn btn-primary" onClick={() => engine.turnInJob(job, boardLocationId)}>
        Turn in
      </button>
    );
  } else if (ready) {
    action = <span className="job-status">Turn in at {boardName}</span>;
  } else if (accepted) {
    action = <span className="job-status">In progress</span>;
  } else if (needs) {
    action = <span className="job-status is-locked">🔒 {needs}</span>;
  } else if (!here) {
    action = <span className="job-status">At {boardName}</span>;
  } else {
    action = (
      <button type="button" className="btn btn-primary" onClick={() => engine.acceptJob(job, boardLocationId)}>
        Accept
      </button>
    );
  }

  return (
    <article className={`job-note${accepted ? " is-accepted" : ""}${ready ? " is-ready" : ""}${needs && !accepted ? " is-locked" : ""}`}>
      <span className="job-pin" aria-hidden="true" />
      <div className="job-tags">
        <span className={`job-freq ${freq.tone}`}>{freq.label}</span>
        {job.requirement?.kind === "skillLevel" && (
          <span className={`job-req${needs ? "" : " is-met"}`}>
            {needs ? "" : "✓ "}Lv {job.requirement.atLeast} {skillName(job.requirement.skill)}
          </span>
        )}
        {ready && <span className="job-ready-tag">Ready!</span>}
      </div>
      <h4 className="job-title">{job.title}</h4>
      <p className="job-desc">{job.description}</p>
      {showBoard && <span className="text-faint text-small">From the board at {boardName}.</span>}
      {accepted && <ObjectiveProgress job={job} />}
      <div className="job-foot">
        <RewardChips reward={job.reward} />
        {action}
      </div>
    </article>
  );
}

/** The jobs on one board, opened from the town picture: a corkboard of
 *  notes, what you've taken on first, then what's on offer, then what
 *  needs a higher level. */
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
  const ready = inProgress.filter((j) => engine.isJobObjectiveMet(j)).length;

  const group = (title: string, list: JobDefinition[]) =>
    list.length > 0 && (
      <section className="job-group">
        <h4 className="job-group-title">
          {title} <span className="job-count">{list.length}</span>
        </h4>
        <div className="job-grid">
          {list.map((job) => (
            <JobCard key={job.id} job={job} boardLocationId={board.locationId} />
          ))}
        </div>
      </section>
    );

  return (
    <div className="job-board">
      <div className="job-board-head">
        <span className="job-board-stat">
          📌 {available.length} open{inProgress.length > 0 && ` · ${inProgress.length} taken`}
          {ready > 0 && <strong className="job-board-ready"> · {ready} ready to turn in</strong>}
        </span>
        <span className="job-board-timer" title="Daily jobs change then. One-time and repeatable jobs stay up.">
          ⏳ New dailies in {resetsIn}
        </span>
      </div>
      {group("Your jobs", inProgress)}
      {group("Posted", available)}
      {group("Needs a higher level", locked)}
      {doneToday.length > 0 && (
        <p className="job-done">
          ✓ Done today: {doneToday.map((j) => j.title).join(", ")}. Back in {resetsIn}.
        </p>
      )}
      {jobs.length === 0 && <p className="job-done">Nothing posted right now. Check back in {resetsIn}.</p>}
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
    <div className="job-grid">
      {entries.map(({ board, job }) => (
        <JobCard key={job.id} job={job} boardLocationId={board.locationId} showBoard />
      ))}
    </div>
  );
}
