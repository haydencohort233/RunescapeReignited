import { useGame } from "../engine/GameEngineContext";
import { type JobBoardDefinition, getActiveJobIds } from "../content/jobBoards";
import { getJob } from "../content/jobs";
import { CONDITION_LABELS, formatReward } from "../content/display";
import { describeUnmetCondition, describeConditionProgress } from "../engine/unlockConditions";
import { getMsUntilNextDailyReset, formatCountdown } from "../engine/time";
import type { JobDefinition } from "../engine/types";

const FREQUENCY_TAG: Record<NonNullable<JobDefinition["frequency"]>, string> = {
  daily: "Daily",
  once: "One-time",
  repeatable: "Repeatable",
};

/** The jobs on one board, shown inside the board's card on the Home tab. */
export default function JobBoardBrowsePanel({ board }: { board: JobBoardDefinition }) {
  const { engine, state } = useGame();

  // What's shown today = whatever rotation picked, UNION anything the
  // player already has accepted from this board's pool — rotating a job
  // out only affects what's newly offerable, it should never yank
  // something you're actively working on out from under you.
  const activeToday = getActiveJobIds(board, Date.now());
  const visibleIds = Array.from(new Set([...activeToday, ...board.jobIds.filter((id) => engine.isJobAccepted(id))]));
  const resetsIn = formatCountdown(getMsUntilNextDailyReset(Date.now()));

  return (
    <div className="stack-sm">
      {visibleIds.map((jobId) => {
        const job = getJob(jobId);
        if (!job) return null;

        const accepted = engine.isJobAccepted(job.id);
        if (engine.isJobCompleted(job)) {
          // A done job's details would read as still on offer.
          if (job.frequency === "once") return null;
          return (
            <div key={job.id} className="card is-locked">
              <span className="locked-note">✓ {job.title} done. New jobs in {resetsIn}.</span>
            </div>
          );
        }

        const objectiveMet = engine.isJobObjectiveMet(job);
        const progress = accepted
          ? (describeConditionProgress(job.objective, state, state.jobs.accepted[job.id]?.baselines, CONDITION_LABELS) ??
            describeUnmetCondition(engine.getJobObjective(job), state, CONDITION_LABELS))
          : null;

        return (
          <div key={job.id} className={`card${accepted ? " is-active" : ""}`}>
            <div className="card-header">
              <span className="card-title">{job.title}</span>
              <span className="tag">{FREQUENCY_TAG[job.frequency ?? "daily"]}</span>
            </div>
            <p className="text-muted">{job.description}</p>
            {job.reward && <p className="text-small">Reward: {formatReward(job.reward)}</p>}
            {accepted && !objectiveMet && progress && <p className="text-small text-info">{progress}</p>}
            <div className="btn-row">
              {accepted ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!objectiveMet}
                  title={objectiveMet ? undefined : "Finish the job first"}
                  onClick={() => engine.turnInJob(job, board.locationId)}
                >
                  Turn in
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => engine.acceptJob(job, board.locationId)}>
                  Accept
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
