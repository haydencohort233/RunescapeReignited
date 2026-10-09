import { useGame } from "../engine/GameEngineContext";
import { BUILDING_CATALOG } from "../content/buildings";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { formatNumber } from "../engine/format";
import { buildingIconPath } from "../content/assetPaths";
import GameImage from "./GameImage";

export default function BuildingsPanel() {
  const { engine, state } = useGame();

  return (
    <section style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Buildings</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {BUILDING_CATALOG.map((def) => {
          const producer = state.producers[def.id];
          const owned = producer?.quantity ?? 0;
          const unlocked = engine.isProducerUnlocked(def.id);
          const lockedReason = def.unlockCondition
            ? describeUnmetCondition(def.unlockCondition, state)
            : null;

          if (!unlocked) {
            return (
              <div
                key={def.id}
                style={{
                  border: "1px dashed #ccc",
                  borderRadius: 6,
                  padding: 10,
                  color: "#888",
                }}
              >
                <strong>{def.name} (Locked)</strong>
                <div style={{ fontSize: 13 }}>{lockedReason}</div>
              </div>
            );
          }

          const cost1 = engine.getProducerPurchaseCost(def.id, 1);
          const cost5 = engine.getProducerPurchaseCost(def.id, 5);

          return (
            <div key={def.id} style={{ border: "1px solid #ccc", borderRadius: 6, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <GameImage
                    src={buildingIconPath(def.id)}
                    alt={def.name}
                    style={{ width: 24, height: 24 }}
                    fallback={<span style={{ fontSize: 18 }}>🏠</span>}
                  />
                  {def.name}
                </strong>
                <span style={{ fontSize: 13, color: "#555" }}>
                  Owned: {owned} ({(def.baseRatePerSecond * owned).toFixed(2)} {def.resource}/s)
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => engine.purchaseProducer(def.id, 1)}>
                  Buy 1 ({cost1?.map((c) => `${formatNumber(c.amount)} ${c.resource}`).join(", ")})
                </button>
                <button onClick={() => engine.purchaseProducer(def.id, 5)}>
                  Buy 5 ({cost5?.map((c) => `${formatNumber(c.amount)} ${c.resource}`).join(", ")})
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}