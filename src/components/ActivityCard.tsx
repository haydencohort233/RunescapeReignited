import { useState, type ReactNode } from "react";
import { useGame } from "../engine/GameEngineContext";
import { formatCountdown } from "../engine/time";
import { formatNumber } from "../engine/format";
import { activityLabel, resourceName } from "../content/display";
import type { ActiveAction } from "../engine/types";
import type { GameEngine } from "../engine/gameEngine";
import { CycleBar } from "./ui/CycleBar";
import { ItemChip, SkillIcon } from "./ui/GameIcons";

/** Everything both views of the current action need. */
interface ActivityParts {
  label: string;
  skillId?: string;
  detail: ReactNode;
  /** Short text for the collapsed bar ("12/25", "1m 20s"). */
  short: string;
  overall: number | null;
  cycle: ReactNode;
  stopLabel: string;
  canStop: boolean;
}

function activityParts(engine: GameEngine, action: ActiveAction): ActivityParts {
  const now = Date.now();
  const parts: ActivityParts = {
    label: activityLabel(action),
    detail: null,
    short: "",
    overall: null,
    cycle: null,
    stopLabel: "Stop",
    canStop: true,
  };

  switch (action.kind) {
    case "craft": {
      parts.stopLabel = "Cancel";
      parts.skillId = action.skill;
      // XP-only recipes (burying bones) show what's being used up.
      const shown = action.output?.resource ?? action.inputsPerItem[0]?.resource;
      parts.short = `${action.quantityCompleted}/${action.quantityTotal}`;
      parts.detail = shown ? (
        <ItemChip id={shown} label={`${resourceName(shown)} ${parts.short}`} />
      ) : (
        parts.short
      );
      parts.overall = (action.quantityCompleted / action.quantityTotal) * 100;
      parts.cycle = <CycleBar startedAt={action.startedAt} timePerItemMs={action.timePerItemMs} maxIndex={action.quantityTotal - 1} />;
      break;
    }
    case "gather": {
      parts.skillId = action.skill;
      const count = action.quantityGathered * action.output.amount;
      parts.short = `x${formatNumber(count)}`;
      parts.detail = <ItemChip id={action.output.resource} label={`${resourceName(action.output.resource)} x${formatNumber(count)}`} />;
      parts.cycle = <CycleBar startedAt={action.startedAt} timePerItemMs={action.timePerItemMs} />;
      break;
    }
    case "travel": {
      parts.stopLabel = "Cancel";
      parts.short = formatCountdown(Math.max(0, action.startedAt + action.durationMs - now));
      parts.detail = `Arriving in ${parts.short}`;
      parts.overall = Math.min(100, ((now - action.startedAt) / action.durationMs) * 100);
      break;
    }
    case "combat":
      parts.stopLabel = "Flee";
      parts.canStop = action.canFlee && engine.getCurrentHp() > 0;
      parts.short = `${Math.ceil(action.enemyCurrentHp)}/${action.enemyMaxHp} HP`;
      parts.detail = action.autoRepeat ? `${action.kills} defeated this trip` : null;
      // The enemy's health, as the bar.
      parts.overall = action.enemyMaxHp > 0 ? (action.enemyCurrentHp / action.enemyMaxHp) * 100 : 0;
      break;
  }
  return parts;
}

function StopButton({ parts }: { parts: ActivityParts }) {
  const { engine } = useGame();
  return (
    <button
      type="button"
      className="btn"
      disabled={!parts.canStop}
      title={parts.canStop ? undefined : "You can't flee this fight"}
      onClick={() => engine.stopActiveAction()}
    >
      {parts.stopLabel}
    </button>
  );
}

function OverallBar({ percent, danger = false }: { percent: number | null; danger?: boolean }) {
  if (percent === null) return null;
  return (
    <div className={`progress-track${danger ? " is-enemy-hp" : ""}`}>
      <div className="progress-fill" style={{ width: `${Math.max(0, percent)}%` }} />
    </div>
  );
}

/** What the player is doing right now — crafting, gathering, traveling or
 *  fighting — in one place, with the one way to stop it. Hidden when idle,
 *  and on phones, where the compact bar at the top takes its place.
 *  Skilling shows the skill, what's coming out and how many, and a bar that
 *  fills once per item so there's always visible progress. */
export default function ActivityCard() {
  const { engine, state } = useGame();
  const action = state.activeAction;
  if (!action) return null;
  const parts = activityParts(engine, action);

  return (
    <div className="card is-active activity-card">
      <div className="card-header">
        <span className="card-title">
          {parts.skillId && <SkillIcon skillId={parts.skillId} />}
          {parts.label}
        </span>
        <StopButton parts={parts} />
      </div>
      {parts.detail && <span className="text-muted">{parts.detail}</span>}
      {parts.cycle}
      <OverallBar percent={parts.overall} danger={action.kind === "combat"} />
    </div>
  );
}

/** Phones: a thin bar for the current action, pinned at the top of every
 *  tab. Tap it for details and the Stop button. */
export function CompactActionBar({ onOpenFight }: { onOpenFight: () => void }) {
  const { engine, state } = useGame();
  const [open, setOpen] = useState(false);
  const action = state.activeAction;
  if (!action) return null;
  const parts = activityParts(engine, action);

  return (
    <div className={`compact-action${open ? " is-open" : ""}`}>
      <button type="button" className="compact-action-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="row" style={{ gap: 6, minWidth: 0 }}>
          {parts.skillId && <SkillIcon skillId={parts.skillId} size={16} />}
          <span className="compact-action-label">{parts.label}</span>
        </span>
        <span className="text-muted text-small">
          {parts.short} {open ? "▴" : "▾"}
        </span>
      </button>
      {parts.cycle ?? <OverallBar percent={parts.overall} danger={action.kind === "combat"} />}
      {open && (
        <div className="compact-action-details">
          {parts.detail && <span className="text-muted text-small">{parts.detail}</span>}
          {parts.cycle && <OverallBar percent={parts.overall} />}
          <div className="btn-row">
            {action.kind === "combat" && (
              <button type="button" className="btn btn-primary" onClick={onOpenFight}>
                Open fight
              </button>
            )}
            <StopButton parts={parts} />
          </div>
        </div>
      )}
    </div>
  );
}
