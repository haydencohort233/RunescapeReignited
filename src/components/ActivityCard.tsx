import type { ReactNode } from "react";
import { useGame } from "../engine/GameEngineContext";
import { formatCountdown } from "../engine/time";
import { formatNumber } from "../engine/format";
import { activityLabel, resourceName } from "../content/display";
import { CycleBar } from "./ui/CycleBar";
import { ItemChip, SkillIcon } from "./ui/GameIcons";

/** What the player is doing right now — crafting, gathering, traveling or
 *  fighting — in one place, with the one way to stop it. Hidden when idle.
 *  Skilling shows the skill, what's coming out and how many, and a bar that
 *  fills once per item so there's always visible progress. */
export default function ActivityCard() {
  const { engine, state } = useGame();
  const action = state.activeAction;
  if (!action) return null;

  const now = Date.now();
  let stopLabel = "Stop";
  let canStop = true;
  let detail: ReactNode = null;
  let overall: number | null = null;
  let cycle: ReactNode = null;

  switch (action.kind) {
    case "craft": {
      stopLabel = "Cancel";
      detail = (
        <ItemChip
          id={action.output.resource}
          label={`${resourceName(action.output.resource)} ${action.quantityCompleted}/${action.quantityTotal}`}
        />
      );
      overall = (action.quantityCompleted / action.quantityTotal) * 100;
      const index = Math.min(action.quantityTotal - 1, Math.floor((now - action.startedAt) / action.timePerItemMs));
      cycle = <CycleBar startedAt={action.startedAt} timePerItemMs={action.timePerItemMs} itemIndex={Math.max(0, index)} />;
      break;
    }
    case "gather": {
      detail = (
        <ItemChip
          id={action.output.resource}
          label={`${resourceName(action.output.resource)} x${formatNumber(action.quantityGathered * action.output.amount)}`}
        />
      );
      const index = Math.max(0, Math.floor((now - action.startedAt) / action.timePerItemMs));
      cycle = <CycleBar startedAt={action.startedAt} timePerItemMs={action.timePerItemMs} itemIndex={index} />;
      break;
    }
    case "travel":
      stopLabel = "Cancel";
      detail = `Arriving in ${formatCountdown(Math.max(0, action.startedAt + action.durationMs - now))}`;
      overall = Math.min(100, ((now - action.startedAt) / action.durationMs) * 100);
      break;
    case "combat":
      stopLabel = "Flee";
      canStop = action.canFlee && engine.getCurrentHp() > 0;
      detail = action.autoRepeat ? `${action.kills} defeated this trip` : null;
      break;
  }

  const skillId = action.kind === "craft" || action.kind === "gather" ? action.skill : undefined;

  return (
    <div className="card is-active">
      <div className="card-header">
        <span className="card-title">
          {skillId && <SkillIcon skillId={skillId} />}
          {activityLabel(action)}
        </span>
        <button
          type="button"
          className="btn"
          disabled={!canStop}
          title={canStop ? undefined : "You can't flee this fight"}
          onClick={() => engine.stopActiveAction()}
        >
          {stopLabel}
        </button>
      </div>
      {detail && <span className="text-muted">{detail}</span>}
      {cycle}
      {overall !== null && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.max(0, overall)}%` }} />
        </div>
      )}
    </div>
  );
}
