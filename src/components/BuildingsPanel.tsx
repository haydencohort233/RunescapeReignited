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
          if (!def.baseCost) return null; // not a purchasable building (e.g. base income)
          const owned = engine.getBuildingQuantity(def.id);
          const unlocked = engine.isBuildingUnlocked(def.id);
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

          const cost1 = engine.getBuildingPurchaseCost(def.id, 1);
          const cost5 = engine.getBuildingPurchaseCost(def.id, 5);
          const refund1 = engine.getBuildingSellRefund(def.id, 1);
          const atLimit = def.maxOwned !== undefined && owned >= def.maxOwned;
          const fitsFive = def.maxOwned === undefined || owned + 5 <= def.maxOwned;
          const formatCost = (cost: { resource: string; amount: number }[] | null) =>
            cost?.map((c) => `${formatNumber(c.amount)} ${c.resource}`).join(", ");

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
                  Owned: {owned}
                  {def.maxOwned !== undefined && `/${def.maxOwned}`} ({(def.baseRatePerSecond * owned).toFixed(2)}{" "}
                  {def.resource}/s)
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <button onClick={() => engine.purchaseBuilding(def.id, 1)} disabled={atLimit}>
                  Buy 1 ({formatCost(cost1)})
                </button>
                <button onClick={() => engine.purchaseBuilding(def.id, 5)} disabled={!fitsFive}>
                  Buy 5 ({formatCost(cost5)})
                </button>
                <button onClick={() => engine.sellBuilding(def.id, 1)} disabled={owned === 0}>
                  Sell 1{refund1 && ` (+${formatCost(refund1)})`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}