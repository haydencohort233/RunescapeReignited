import { useEffect, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { type JobBoardDefinition, getActiveJobIds } from "../content/jobBoards";
import { getJob } from "../content/jobs";
import { describeUnmetCondition, describeConditionProgress } from "../engine/unlockConditions";
import { formatNumber } from "../engine/format";
import { getMsUntilNextDailyReset, formatCountdown } from "../engine/time";
import type { JobDefinition } from "../engine/types";

function formatReward(reward: JobDefinition["reward"]): string {
  if (!reward) return "";
  const parts: string[] = [];
  if (reward.gp) parts.push(`${formatNumber(reward.gp)} GP`);
  if (reward.achievementPoints) parts.push(`${formatNumber(reward.achievementPoints)} Achievement Points`);
  if (reward.items) for (const item of reward.items) parts.push(`${item.quantity}x ${item.itemDefId}`);
  return parts.join(", ");
}

export default function JobBoardBrowsePanel({
  board,
  onClose,
}: {
  board: JobBoardDefinition;
  onClose: () => void;
}) {
  const { engine, state } = useGame();
  const [, forceTick] = useState(0);

  // The "New job posted in HH:MM:SS" countdown needs a per-second re-render
  // independent of the engine's own tick, same reasoning as the travel and
  // gather-session countdowns elsewhere.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // What's shown today = whatever rotation picked, UNION anything the
  // player already has accepted from this board's pool — rotating a job
  // out only affects what's newly offerable, it should never yank
  // something you're actively working on out from under you.
  const activeToday = getActiveJobIds(board, Date.now());
  const visibleIds = Array.from(
    new Set([...activeToday, ...board.jobIds.filter((id) => engine.isJobAccepted(id))])
  );

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{board.title}</strong>
        <button onClick={onClose}>Close</button>
      </div>
      <p style={{ fontSize: 12, color: "#666", margin: "2px 0 0" }}>
        Resets in {formatCountdown(getMsUntilNextDailyReset(Date.now()))}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {visibleIds.map((jobId) => {
          const job = getJob(jobId);
          if (!job) return null;

          const accepted = engine.isJobAccepted(job.id);
          const completed = !job.repeatable && engine.isJobCompleted(job.id);

          // Completed: hide everything else about the job — showing a done
          // job's title/description/reward reads as if it's still on offer,
          // which is confusing. Just the countdown.
          if (completed) {
            return (
              <div key={job.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 8 }}>
                <span style={{ fontSize: 12, color: "#888" }}>
                  New job posted in {formatCountdown(getMsUntilNextDailyReset(Date.now()))}
                </span>
              </div>
            );
          }

          const objectiveMet = engine.isJobObjectiveMet(job);
          const progressOrReason =
            accepted && !objectiveMet
              ? (describeConditionProgress(job.objective, state) ?? describeUnmetCondition(job.objective, state))
              : null;

          return (
            <div key={job.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{job.title}</strong>
                {job.repeatable && <span style={{ fontSize: 11, color: "#888" }}>Repeatable</span>}
              </div>
              <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>{job.description}</p>
              {job.reward && (
                <p style={{ fontSize: 12, color: "#888", margin: "0 0 6px" }}>
                  Reward: {formatReward(job.reward)}
                </p>
              )}

              {accepted ? (
                objectiveMet ? (
                  <button onClick={() => engine.turnInJob(job, board.locationId)}>Turn In</button>
                ) : (
                  <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>{progressOrReason}</p>
                )
              ) : (
                <button onClick={() => engine.acceptJob(job, board.locationId)}>Accept</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}