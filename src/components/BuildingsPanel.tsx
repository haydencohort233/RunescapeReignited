import { useGame } from "../engine/GameEngineContext";
import { BUILDING_CATALOG } from "../content/buildings";
import { CONDITION_LABELS, formatAmounts, resourceName } from "../content/display";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { buildingIconPath } from "../content/assetPaths";
import type { BuildingDefinition } from "../engine/types";
import GameImage from "./GameImage";
import { ActionCard, LockedCard, type CardAction } from "./ui/ActionCard";
import { QUANTITY_STEPS } from "./ui/quantity";
import { Page } from "./ui/Page";

function BuildingCard({ def }: { def: BuildingDefinition }) {
  const { engine, state } = useGame();
  const icon = (
    <GameImage src={buildingIconPath(def.id)} alt={def.name} style={{ width: 24, height: 24 }} fallback={<span>🏠</span>} />
  );

  if (!engine.isBuildingUnlocked(def.id)) {
    const reason = def.unlockCondition ? describeUnmetCondition(def.unlockCondition, state, CONDITION_LABELS) : null;
    // Show the price too, so players know what to save up (shrimps, bones).
    const firstCost = engine.getBuildingPurchaseCost(def.id, 1);
    return (
      <LockedCard
        icon={icon}
        title={def.name}
        reason={
          <>
            {reason ?? "Not available yet"}
            {firstCost && <div>Costs {formatAmounts(firstCost)}</div>}
          </>
        }
      />
    );
  }

  const owned = engine.getBuildingQuantity(def.id);
  // Buffs that multiply this resource scale this building too.
  const multiplier = engine.getModifierMultiplier(def.resource);
  const rate = def.baseRatePerSecond * owned * multiplier;

  const buyActions: CardAction[] = QUANTITY_STEPS.map((q) => {
    const cost = engine.getBuildingPurchaseCost(def.id, q) ?? [];
    const overLimit = def.maxOwned !== undefined && owned + q > def.maxOwned;
    const affordable = cost.every((c) => engine.getOwnedCount(c.resource) >= c.amount);
    return {
      label: `Buy ${q} (${formatAmounts(cost)})`,
      variant: q === 1 ? ("primary" as const) : undefined,
      disabled: overLimit || !affordable,
      reason: overLimit ? `You can own at most ${def.maxOwned}` : `Costs ${formatAmounts(cost)}`,
      onClick: () => engine.purchaseBuilding(def.id, q),
    };
  });
  const refund = engine.getBuildingSellRefund(def.id, 1);
  const sellAction: CardAction = {
    label: refund ? `Sell 1 (+${formatAmounts(refund)})` : "Sell 1",
    disabled: owned === 0,
    reason: "You don't own any",
    onClick: () => engine.sellBuilding(def.id, 1),
  };

  return (
    <ActionCard
      icon={icon}
      title={def.name}
      meta={`${owned}${def.maxOwned !== undefined ? `/${def.maxOwned}` : ""} owned · +${rate.toFixed(2)} ${resourceName(def.resource)}/s`}
      description={`Each produces ${def.baseRatePerSecond} ${resourceName(def.resource)} per second${
        multiplier !== 1 ? ` (x${Number(multiplier.toFixed(2))} from buffs right now)` : ""
      }.${def.constructionXp ? ` Each one built gives ${def.constructionXp} Construction XP.` : ""}`}
      actions={[...buyActions, sellAction]}
    />
  );
}

export default function BuildingsPanel() {
  return (
    <Page title="Buildings">
      <div className="stack-sm">
        {BUILDING_CATALOG.filter((def) => def.baseCost).map((def) => (
          <BuildingCard key={def.id} def={def} />
        ))}
      </div>
    </Page>
  );
}
