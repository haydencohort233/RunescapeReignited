import type { CraftingRecipe, GameState, NpcDefinition, ServantDefinition, ServantOrder, ServantState } from "../types";
import type { GameEngine } from "../gameEngine";
import { capitalize, formatDuration } from "../format";
import { isUnlocked } from "../unlockConditions";
import { isWholeQuantity } from "../ledger";

/**
 * Servants (Player House, Phase 4). One at a time, hired at the Servants'
 * Guild. A servant works an order at a facility standing in the house, a
 * share as fast as the player would, beside whatever the player is doing.
 * While they use a facility the player can't (decided Oct 23). Wages come
 * out of their coin pouch only while they work, and an order only starts
 * when the pouch covers all of it, so they never run dry mid-order. Their
 * work is resolved in resolveElapsed like everything else, so it runs
 * offline within the same capped window.
 */
export class ServantSystem {
  private readonly engine: GameEngine;
  private readonly byId: Map<string, ServantDefinition>;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.byId = new Map((engine.content.house?.servants ?? []).map((s) => [s.id, s]));
  }

  private get state(): GameState {
    return this.engine.getState();
  }

  private get servant(): ServantState | null {
    return this.state.servant;
  }

  private warn(message: string): false {
    this.engine.notifications.push("status", message, { severity: "warning" });
    return false;
  }

  getDefinitions(): ServantDefinition[] {
    return [...this.byId.values()];
  }

  getDefinition(id: string): ServantDefinition | undefined {
    return this.byId.get(id);
  }

  /** The hired servant's definition, if any. */
  getHired(): ServantDefinition | undefined {
    return this.servant ? this.byId.get(this.servant.servantId) : undefined;
  }

  /** Content clean-up on load: a servant who no longer exists in content
   *  leaves, giving back their pouch and order materials. */
  normalize(): void {
    if (this.servant && !this.byId.has(this.servant.servantId)) this.leave(true);
  }

  // ── Hiring ──

  /** Why this servant can't be hired from `npc` now, or null. */
  getHireBlocker(npc: NpcDefinition, servantId: string): string | null {
    const def = this.byId.get(servantId);
    if (!def) return "There's no such servant.";
    if (!npc.services?.includes("servants")) return `${npc.name} doesn't hire out servants.`;
    if (this.state.currentLocationId !== npc.locationId || this.state.activeAction?.kind === "travel") return `You need to be with ${npc.name} to hire a servant.`;
    if (this.servant) return "You already have a servant. Dismiss them first.";
    if (this.engine.getSkillLevel("construction") < def.levelRequired) return `You need Construction level ${def.levelRequired}.`;
    if (this.engine.getOwnedCount("gp") < def.hireCostGp) return `Hiring a ${def.name} costs ${def.hireCostGp.toLocaleString()} GP.`;
    return null;
  }

  hire(npc: NpcDefinition, servantId: string): boolean {
    this.engine.catchUpToNow();
    const blocker = this.getHireBlocker(npc, servantId);
    if (blocker) return this.warn(blocker);
    const def = this.byId.get(servantId)!;
    this.engine.spendResource("gp", def.hireCostGp);
    this.state.servant = { servantId, purse: 0, order: null };
    this.engine.incrementStatistic("servantsHired", 1);
    this.engine.notifications.push("status", `You hired a ${def.name}. Give them an order from your house, and fill their coin pouch.`);
    return true;
  }

  /** Sends the servant away. Their pouch and any unused materials come back. */
  dismiss(): boolean {
    this.engine.catchUpToNow();
    const def = this.getHired();
    if (!this.servant) return false;
    this.leave(true);
    this.engine.notifications.push("status", `You dismissed your ${def?.name ?? "servant"}. Their coin pouch and unused materials are back with you.`);
    return true;
  }

  /** The servant goes: unused order materials come back, and the pouch
   *  too when `refundPurse`. */
  private leave(refundPurse: boolean): void {
    const servant = this.servant;
    if (!servant) return;
    if (servant.order) this.refundOrder(servant.order);
    if (refundPurse) this.engine.giveBack("gp", Math.floor(servant.purse));
    this.state.servant = null;
  }

  // ── Wages ──

  deposit(amount: number): boolean {
    this.engine.catchUpToNow();
    const servant = this.servant;
    if (!servant) return false;
    if (!isWholeQuantity(amount)) return false;
    if (this.engine.getOwnedCount("gp") < amount) return this.warn(`You don't have ${amount.toLocaleString()} GP.`);
    // Moved into the pouch, not spent: wages count as spent when paid.
    this.state.resources.gp.amount -= amount;
    servant.purse += amount;
    return true;
  }

  /** GP that can come back out of the pouch: everything the order in
   *  progress doesn't still need for its wages. */
  getWithdrawable(): number {
    const servant = this.servant;
    const def = this.getHired();
    if (!servant || !def) return 0;
    const owed = (this.getOrderTimeLeftMs() * def.wagePerSecond) / 1000;
    return Math.max(0, Math.floor(servant.purse - owed + 1e-9));
  }

  /** Takes GP back out of the pouch (not what the current order needs). */
  withdraw(amount: number): boolean {
    this.engine.catchUpToNow();
    const servant = this.servant;
    if (!servant || !isWholeQuantity(amount)) return false;
    const free = this.getWithdrawable();
    if (amount > free) return this.warn(free > 0 ? `You can take out up to ${free.toLocaleString()} GP; the rest pays for the current order.` : "The pouch only holds what the current order needs.");
    servant.purse -= amount;
    this.engine.giveBack("gp", amount);
    return true;
  }

  /** How long the pouch pays for, in ms of work. */
  getPurseTimeMs(): number {
    const def = this.getHired();
    if (!this.servant || !def || def.wagePerSecond <= 0) return Infinity;
    return (this.servant.purse / def.wagePerSecond) * 1000;
  }

  // ── Orders ──

  /** Whether a facility of this station stands in the house (wherever
   *  the player is). */
  private hasFacility(station: CraftingRecipe["station"]): boolean {
    return !!station && this.engine.hasPlacedHouseStation(station);
  }

  /** Why the servant can't take this order, or null. */
  getOrderBlocker(recipe: CraftingRecipe, quantity: number): string | null {
    const def = this.getHired();
    if (!this.servant || !def) return "You don't have a servant.";
    if (!this.engine.isAtHouse()) return "You need to be at your house to give orders.";
    if (this.servant.order) return "Your servant is already working on an order.";
    if (!recipe.station) return "Servants only work at facilities in your house.";
    if (!this.hasFacility(recipe.station)) return `You need a facility for that in your house.`;
    if (this.engine.isPlayerUsingHouseStation(recipe.station)) return "You're using that facility yourself.";
    if (recipe.unlockCondition && !isUnlocked(recipe.unlockCondition, this.state)) return "You don't meet the requirements to make that yet.";
    if (recipe.tool && !this.engine.getBestTool(recipe.tool)) return `You need a usable ${recipe.tool} for that.`;
    if (!isWholeQuantity(quantity)) return "Pick how many to make.";
    if (quantity > def.orderLimit) return `A ${def.name} takes orders of up to ${def.orderLimit.toLocaleString()}.`;
    const short = recipe.inputs.find((input) => this.engine.getOwnedCount(input.resource) < input.amount * quantity);
    if (short) return `Not enough ${this.engine.nameOf(short.resource)} for ${quantity.toLocaleString()}.`;
    const wages = this.getOrderWages(recipe, quantity);
    if (this.servant.purse < wages) return `This order needs ${Math.ceil(wages).toLocaleString()} GP in the coin pouch.`;
    return null;
  }

  /** Wages for a whole order at this servant's pace. An order only
   *  starts when the pouch holds this much. */
  getOrderWages(recipe: CraftingRecipe, quantity: number): number {
    const def = this.getHired();
    return def ? (this.getTimePerItem(recipe) * quantity * def.wagePerSecond) / 1000 : 0;
  }

  /** The station a servant's order is using, if any. */
  getBusyStation(): CraftingRecipe["station"] {
    return this.servant?.order?.station;
  }

  /** Most of this recipe the servant could take now: their order limit,
   *  and what the player's materials cover. */
  getMaxOrder(recipe: CraftingRecipe): number {
    const def = this.getHired();
    if (!def) return 0;
    let max = def.orderLimit;
    for (const input of recipe.inputs) max = Math.min(max, Math.floor(this.engine.getOwnedCount(input.resource) / input.amount));
    return Math.max(0, max);
  }

  /** The servant's time per item: the player's time over their share. */
  getTimePerItem(recipe: CraftingRecipe): number {
    const def = this.getHired();
    const share = def && def.rateShare > 0 ? def.rateShare : 1;
    return Math.round(this.engine.getEffectiveTimePerItem(recipe) / share);
  }

  startOrder(recipe: CraftingRecipe, quantity: number): boolean {
    this.engine.catchUpToNow();
    const blocker = this.getOrderBlocker(recipe, quantity);
    if (blocker) return this.warn(blocker);
    const servant = this.servant!;
    this.engine.payFor(recipe.inputs, quantity);
    const order: ServantOrder = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      skill: recipe.skill,
      xpPerItem: recipe.xpPerItem,
      timePerItemMs: this.getTimePerItem(recipe),
      ...(recipe.output ? { output: recipe.output } : {}),
      ...(recipe.extraStatistic ? { extraStatistic: recipe.extraStatistic } : {}),
      ...(recipe.bonusDrops ? { bonusDrops: recipe.bonusDrops } : {}),
      inputsPerItem: recipe.inputs,
      station: recipe.station!,
      quantityTotal: quantity,
      quantityCompleted: 0,
      progressMs: 0,
      resolvedTo: this.engine.now(),
    };
    servant.order = order;
    this.engine.notifications.push("status", `Your ${this.getHired()!.name} starts on ${quantity.toLocaleString()} ${recipe.name} (${formatDuration(order.timePerItemMs * quantity)}).`, {
      replaceKey: "servant",
    });
    return true;
  }

  /** Stops the order; unused materials come back. */
  cancelOrder(): boolean {
    this.engine.catchUpToNow();
    const servant = this.servant;
    if (!servant?.order) return false;
    const order = servant.order;
    this.refundOrder(order);
    servant.order = null;
    this.engine.notifications.push("status", `Order cancelled: ${order.quantityCompleted.toLocaleString()} of ${order.quantityTotal.toLocaleString()} ${order.recipeName} made. Unused materials returned.`, {
      replaceKey: "servant",
    });
    return true;
  }

  private refundOrder(order: ServantOrder): void {
    const remaining = order.quantityTotal - order.quantityCompleted;
    for (const input of order.inputsPerItem) this.engine.giveBack(input.resource, input.amount * remaining);
  }

  /** Called when a facility is put away: an order that needed the last
   *  one of its kind stops, with a refund (like the player's own craft). */
  stopIfFacilityGone(storedName: string): void {
    const order = this.servant?.order;
    if (!order || this.hasFacility(order.station)) return;
    this.refundOrder(order);
    this.servant!.order = null;
    this.engine.notifications.push("status", `You put away the ${storedName}, so your ${this.getHired()?.name ?? "servant"} stops making ${order.recipeName}. Unused materials returned.`, {
      severity: "warning",
      replaceKey: "servant",
    });
  }

  /** Time left on the order at the servant's pace (ignoring wages). */
  getOrderTimeLeftMs(): number {
    const order = this.servant?.order;
    if (!order) return 0;
    return Math.max(0, (order.quantityTotal - order.quantityCompleted) * order.timePerItemMs - order.progressMs);
  }

  // ── Time ──

  /** Works the order up to `effectiveNow`, paying wages per ms worked.
   *  The pouch covered the whole order when it started. Internal: called
   *  from resolveElapsed. */
  resolve(effectiveNow: number): void {
    const servant = this.servant;
    const def = this.getHired();
    const order = servant?.order;
    if (!servant || !def || !order) return;

    const elapsed = effectiveNow - order.resolvedTo;
    if (elapsed <= 0) return;
    const work = Math.min(elapsed, this.getOrderTimeLeftMs());
    order.progressMs += work;
    const done = Math.min(order.quantityTotal - order.quantityCompleted, Math.floor(order.progressMs / order.timePerItemMs));
    if (done > 0) {
      order.progressMs -= done * order.timePerItemMs;
      this.grant(order, done);
      order.quantityCompleted += done;
    }
    const paid = Math.min(servant.purse, (work * def.wagePerSecond) / 1000);
    servant.purse = Math.max(0, servant.purse - paid);
    this.engine.incrementStatistic("servantWagesPaid", paid);
    this.engine.incrementStatistic("gp:spent", paid);
    order.resolvedTo = effectiveNow;

    if (order.quantityCompleted >= order.quantityTotal) {
      servant.order = null;
      this.engine.notifications.push(
        "production",
        `Your ${def.name} finished ${order.quantityTotal.toLocaleString()} ${order.recipeName} (+${(order.xpPerItem * order.quantityTotal).toLocaleString()} ${capitalize(order.skill)} XP).`,
        { replaceKey: "servant" }
      );
    }
  }

  private grant(order: ServantOrder, count: number): void {
    if (order.output) this.engine.addItem(order.output.resource, order.output.amount * count);
    for (const drop of order.bonusDrops ?? []) {
      let hits = 0;
      for (let i = 0; i < count; i++) if (Math.random() < drop.chance) hits++;
      if (hits > 0) this.engine.addItem(drop.resource, drop.amount * hits);
    }
    this.engine.addSkillXp(order.skill, order.xpPerItem * count);
    this.engine.incrementStatistic(`crafted:${order.recipeId}`, count);
    this.engine.incrementStatistic(`servantMade:${order.recipeId}`, count);
    if (order.extraStatistic) this.engine.incrementStatistic(order.extraStatistic, count);
  }

  /** Moves the order's anchor when time is skipped (see shiftActionAnchors). */
  shiftAnchors(ms: number): void {
    const servant = this.servant;
    if (!servant) return;
    if (servant.order) servant.order.resolvedTo += ms;
  }

  /** Dev tool: hires a servant on the spot, ignoring the guild and level. */
  devHire(servantId: string): void {
    const def = this.byId.get(servantId);
    if (!def) return;
    this.leave(true);
    this.state.servant = { servantId, purse: 0, order: null };
    this.engine.notifications.push("status", `Hired a ${def.name} (dev).`);
  }
}
