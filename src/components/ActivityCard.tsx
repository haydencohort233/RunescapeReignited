import { useGame } from "../engine/GameEngineContext";
import { formatCountdown } from "../engine/time";

/** What the player is doing right now — crafting, gathering, traveling or
 *  fighting — in one place, with the one way to stop it. Hidden when idle. */
export default function ActivityCard() {
  const { engine, state } = useGame();
  const action = state.activeAction;
  if (!action) return null;

  const now = Date.now();
  let label: string;
  let detail: string;
  let stopLabel = "Stop";
  let canStop = true;
  switch (action.kind) {
    case "craft":
      label = `Making ${action.recipeName}`;
      detail = `${action.quantityCompleted}/${action.quantityTotal} done`;
      stopLabel = "Cancel";
      break;
    case "gather":
      label = `Gathering ${action.recipeName}`;
      detail = `${action.quantityGathered.toLocaleString()} so far`;
      break;
    case "travel":
      label = `Traveling to ${action.destinationName}`;
      detail = `Arriving in ${formatCountdown(Math.max(0, action.startedAt + action.durationMs - now))}`;
      stopLabel = "Cancel";
      break;
    case "combat":
      label = `Fighting ${action.enemyName}`;
      detail = action.autoRepeat ? `${action.kills} defeated this trip` : "";
      stopLabel = "Flee";
      canStop = action.canFlee;
      break;
  }

  const percent =
    action.kind === "craft"
      ? (action.quantityCompleted / action.quantityTotal) * 100
      : action.kind === "travel"
        ? Math.min(100, ((now - action.startedAt) / action.durationMs) * 100)
        : null;

  return (
    <div className="card is-active">
      <div className="card-header">
        <span className="card-title">{label}</span>
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
      {percent !== null && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.max(0, percent)}%` }} />
        </div>
      )}
    </div>
  );
}
