import type { BuildingDefinition, GameState, RecipeInput } from "../types";
import type { GameEngine } from "../gameEngine";
import { isUnlocked } from "../unlockConditions";
import { DEFAULT_COST_SCALING_FACTOR, BUILDING_SELL_REFUND_FRACTION } from "../tuning";

/** Buildings: definitions from content, owned counts in state, buying, selling and limits. */
export class BuildingSystem {
  private readonly buildingsById: Map<string, BuildingDefinition>;
  private readonly engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.buildingsById = new Map(engine.content.buildings.map((b) => [b.id, b]));
  }

  private get state(): GameState {
    return this.engine.getState();
  }

  private get notifications() {
    return this.engine.notifications;
  }

  getBuildingDef(buildingId: string): BuildingDefinition | undefined {
    return this.buildingsById.get(buildingId);
  }

  getBuildingQuantity(buildingId: string): number {
    return this.state.buildings[buildingId] ?? 0;
  }

  /** Total cost of `quantity` units starting from `ownedBefore` already
   *  owned. Shared by buying (from the current count up) and selling (the
   *  last N bought). */
  private getBuildingCostRange(def: BuildingDefinition, ownedBefore: number, quantity: number): RecipeInput[] {
    const scaling = def.costScalingFactor ?? DEFAULT_COST_SCALING_FACTOR;
    // Sum of a geometric series: baseCost * scaling^owned for each unit.
    return (def.baseCost ?? []).map((input) => {
      let total = 0;
      for (let i = 0; i < quantity; i++) {
        total += input.amount * Math.pow(scaling, ownedBefore + i);
      }
      return { resource: input.resource, amount: Math.ceil(total) };
    });
  }

  /** Cost to buy `quantity` more of a building, given how many are already owned.
   *  Returns null if the building has no baseCost (not player-purchasable). */
  getBuildingPurchaseCost(buildingId: string, quantity: number): RecipeInput[] | null {
    const def = this.getBuildingDef(buildingId);
    if (!def || !def.baseCost) return null;
    return this.getBuildingCostRange(def, this.getBuildingQuantity(buildingId), quantity);
  }

  /** What selling the last `quantity` units would refund — a fraction of
   *  what those exact units cost. Null if the building can't be sold. */
  getBuildingSellRefund(buildingId: string, quantity: number): RecipeInput[] | null {
    const def = this.getBuildingDef(buildingId);
    if (!def || !def.baseCost) return null;
    const owned = this.getBuildingQuantity(buildingId);
    if (quantity <= 0 || quantity > owned) return null;
    return this.getBuildingCostRange(def, owned - quantity, quantity).map((c) => ({
      resource: c.resource,
      amount: Math.floor(c.amount * BUILDING_SELL_REFUND_FRACTION),
    }));
  }

  /** Whether a building's unlockCondition (if any) is currently satisfied. */
  isBuildingUnlocked(buildingId: string): boolean {
    const def = this.getBuildingDef(buildingId);
    if (!def) return false;
    if (!def.unlockCondition) return true;
    return isUnlocked(def.unlockCondition, this.state);
  }

  /** Buys `quantity` more of a building at the scaled cost, if affordable,
   *  unlocked, and under its maxOwned limit. `bypassUnlock` is for
   *  dev/cheat tooling only — normal player-facing purchase flows should
   *  never pass it. */
  purchaseBuilding(buildingId: string, quantity = 1, opts?: { bypassUnlock?: boolean }): boolean {
    const def = this.getBuildingDef(buildingId);
    if (!def || quantity <= 0) return false;

    if (!opts?.bypassUnlock && !this.isBuildingUnlocked(buildingId)) {
      this.notifications.push("status", `${def.name} isn't available yet.`, {
        severity: "warning",
      });
      return false;
    }

    const owned = this.getBuildingQuantity(buildingId);
    if (def.maxOwned !== undefined && owned + quantity > def.maxOwned) {
      this.notifications.push("status", `You can only own ${def.maxOwned}x ${def.name}.`, {
        severity: "warning",
      });
      return false;
    }

    const cost = this.getBuildingPurchaseCost(buildingId, quantity);
    if (!cost) {
      // No baseCost defined — treat as free/not purchasable via this path.
      return false;
    }

    const short = cost.find((c) => this.engine.getOwnedCount(c.resource) < c.amount);
    if (short) {
      this.notifications.push(
        "status",
        `Not enough ${this.engine.nameOf(short.resource)} to buy ${quantity}x ${def.name}.`,
        { severity: "warning" }
      );
      return false;
    }

    this.engine.payFor(cost);
    this.state.buildings[buildingId] = owned + quantity;
    this.engine.incrementStatistic("buildingsBought:total", quantity);
    this.engine.incrementStatistic(`buildingsBought:${buildingId}`, quantity);
    this.notifications.push("status", `Purchased ${quantity}x ${def.name}.`);
    return true;
  }

  /** Sells the last `quantity` units for BUILDING_SELL_REFUND_FRACTION of
   *  what they cost, which also brings the next purchase price back down. */
  sellBuilding(buildingId: string, quantity = 1): boolean {
    const def = this.getBuildingDef(buildingId);
    const refund = this.getBuildingSellRefund(buildingId, quantity);
    if (!def || !refund) return false;
    for (const r of refund) this.engine.giveBack(r.resource, r.amount);
    this.state.buildings[buildingId] = this.getBuildingQuantity(buildingId) - quantity;
    this.engine.incrementStatistic("buildingsSold:total", quantity);
    this.notifications.push(
      "status",
      `Sold ${quantity}x ${def.name} for ${refund.map((r) => `${r.amount} ${r.resource}`).join(", ")}.`
    );
    return true;
  }
}
