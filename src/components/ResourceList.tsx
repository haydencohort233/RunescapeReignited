import { useGame } from "../engine/GameEngineContext";
import { getResourceMeta } from "../content/resources";
import { formatNumber } from "../engine/format";
import { EmptyState } from "./ui/Page";

/** Currencies and materials the player holds, with production rates.
 *  Built from whatever the engine tracks, so new resources appear on their
 *  own. Finished goods and gear live in the Inventory tab. */
export default function ResourceList() {
  const { engine, state } = useGame();

  const entries = Object.entries(state.resources)
    .map(([id, resource]) => ({ id, resource, meta: getResourceMeta(id), rate: engine.getEffectiveRatePerSecond(id) }))
    .filter(({ meta, resource, rate }) => meta.category !== "item" && (resource.amount >= 1 || rate > 0))
    .sort((a, b) => (a.meta.category === b.meta.category ? 0 : a.meta.category === "currency" ? -1 : 1));

  if (entries.length === 0) return <EmptyState>No resources yet. Buy a building or gather something to start.</EmptyState>;

  return (
    <div className="card">
      <div>
        {entries.map(({ id, resource, meta, rate }) => (
          <div key={id} className="data-row">
            <span>{meta.name}</span>
            <span>
              {formatNumber(resource.amount)}
              {rate !== 0 && <span className="text-muted text-small"> (+{rate.toFixed(2)}/s)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
