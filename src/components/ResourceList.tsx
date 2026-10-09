import { useGame } from "../engine/GameEngineContext";
import { getResourceMeta, type ResourceCategory } from "../content/resources";

/** Renders every resource of a given category currently tracked by the
 *  engine — dynamic, not a hardcoded per-resource list, so a new resource
 *  (like coal was) shows up automatically the moment the engine tracks it. */
export default function ResourceList({ category }: { category: ResourceCategory }) {
  const { engine, state } = useGame();

  const entries = Object.entries(state.resources).filter(
    ([id]) => getResourceMeta(id).category === category
  );

  if (entries.length === 0) {
    return <p style={{ fontSize: 13, color: "#888" }}>Nothing here yet.</p>;
  }

  return (
    <div>
      {entries.map(([id, resource]) => {
        const meta = getResourceMeta(id);
        const rate = engine.getEffectiveRatePerSecond(id);
        return (
          <div key={id}>
            {meta.name}: {Math.floor(resource.amount).toLocaleString()}
            {rate !== 0 && (
              <span style={{ color: "#666", fontSize: 13 }}> ({rate.toFixed(2)}/s)</span>
            )}
          </div>
        );
      })}
    </div>
  );
}