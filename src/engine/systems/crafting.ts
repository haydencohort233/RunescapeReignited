import type { GameState, CraftingRecipe, BonusDrop, ItemDefinition, ToolType } from "../types";
import type { GameEngine } from "../gameEngine";
import { isUnlocked } from "../unlockConditions";
import { isWholeQuantity } from "../ledger";
import { capitalize } from "../format";
import { DEFAULT_GATHER_MAX_DURATION_MS, MAX_GATHER_LEVEL_SPEED_BONUS, MIN_GATHER_TIME_MS } from "../tuning";
import { levelForXp, MAX_LEVEL } from "../xpCurve";
import { getActiveCraftJob, getActiveGatherSession } from "../activeAction";

/** Crafting jobs (a fixed batch) and gathering sessions (open-ended, time-capped). */
export class CraftingSystem {
  private readonly engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  private get state(): GameState {
    return this.engine.getState();
  }

  private get notifications() {
    return this.engine.notifications;
  }

  private get craftJob() {
    return getActiveCraftJob(this.state);
  }

  private get gatherSession() {
    return getActiveGatherSession(this.state);
  }

  /** The fastest tool of a type the player owns (worn or not) and can use,
   *  or null. `owned` says whether they have one at all, usable or not. */
  getBestTool(type: ToolType): { def: ItemDefinition; owned: true } | { def: null; owned: boolean } {
    let best: ItemDefinition | null = null;
    let owned = false;
    for (const instance of Object.values(this.state.inventory)) {
      const def = this.engine.itemsById.get(instance.itemDefId);
      if (def?.tool?.type !== type) continue;
      owned = true;
      if (def.tool.requirement && !isUnlocked(def.tool.requirement, this.state)) continue;
      if (!best || def.tool.speedMultiplier < best.tool!.speedMultiplier) best = def;
    }
    return best ? { def: best, owned: true } : { def: null, owned };
  }

  /** Multiplier from skill level for gathering: 1 at level 1, down to
   *  1 - MAX_GATHER_LEVEL_SPEED_BONUS at 99. */
  getLevelSpeedMultiplier(skill: string): number {
    const level = levelForXp(this.state.skills[skill]?.xp ?? 0);
    return 1 - (MAX_GATHER_LEVEL_SPEED_BONUS * (level - 1)) / (MAX_LEVEL - 1);
  }

  /** Time per item for this player right now: gathering (no inputs) gets
   *  the level bonus, and any recipe with a tool gets the best tool's
   *  speed. Floored at MIN_GATHER_TIME_MS. Locked in when an action
   *  starts, like the rest of its timing. */
  getEffectiveTimePerItem(recipe: CraftingRecipe): number {
    let ms = recipe.timePerItemMs;
    if (recipe.inputs.length === 0) ms *= this.getLevelSpeedMultiplier(recipe.skill);
    if (recipe.tool) {
      const tool = this.getBestTool(recipe.tool).def;
      if (tool) ms *= tool.tool!.speedMultiplier;
    }
    return Math.max(Math.min(MIN_GATHER_TIME_MS, recipe.timePerItemMs), Math.round(ms));
  }

  /** Why this recipe can't start right now, or null: an unmet unlock, a
   *  missing tool, or not being at its station. Checked by every start. */
  getStartBlocker(recipe: CraftingRecipe): string | null {
    if (recipe.unlockCondition && !isUnlocked(recipe.unlockCondition, this.state)) {
      return "You don't meet the requirements to do this yet.";
    }
    if (recipe.tool) {
      const { def, owned } = this.getBestTool(recipe.tool);
      if (!def) {
        return owned
          ? `You don't have the level to use any ${TOOL_NAMES[recipe.tool]} you own.`
          : `You need ${TOOL_ARTICLE[recipe.tool]} ${TOOL_NAMES[recipe.tool]} for this.`;
      }
    }
    if (recipe.station) {
      const where = this.engine.content.stationLocations?.[recipe.station] ?? [];
      if (!where.includes(this.state.currentLocationId)) return `You need to be at a ${recipe.station} for this.`;
    }
    return null;
  }

  /**
   * Starts a crafting job for `quantity` items. Materials for the FULL
   * quantity are deducted immediately (RuneScape-style: you commit the
   * batch up front). Only one job runs at a time in v1 — starting a new
   * one while another is active is rejected.
   */
  startCraftJob(recipe: CraftingRecipe, quantity: number): boolean {
    if (!isWholeQuantity(quantity)) return false;
    this.engine.catchUpToNow();

    const blocker = this.getStartBlocker(recipe);
    if (blocker) {
      this.notifications.push("status", blocker, { severity: "warning" });
      return false;
    }

    if (!this.engine.ensureIdle()) return false;

    const short = recipe.inputs.find((input) => this.engine.getOwnedCount(input.resource) < input.amount * quantity);
    if (short) {
      this.notifications.push(
        "status",
        `Not enough ${this.engine.nameOf(short.resource)} to make ${quantity}x ${recipe.name}.`,
        { severity: "warning" }
      );
      return false;
    }

    this.engine.payFor(recipe.inputs, quantity);
    const timePerItemMs = this.getEffectiveTimePerItem(recipe);

    this.state.activeAction = {
      kind: "craft",
      recipeId: recipe.id,
      recipeName: recipe.name,
      skill: recipe.skill,
      xpPerItem: recipe.xpPerItem,
      timePerItemMs,
      output: recipe.output,
      extraStatistic: recipe.extraStatistic,
      bonusDrops: recipe.bonusDrops,
      inputsPerItem: recipe.inputs,
      // The real current time, not the last tick: the tick can be stale
      // (a throttled background tab), and anchoring to it would credit the
      // job with time from before it was started.
      startedAt: this.engine.now(),
      quantityTotal: quantity,
      quantityCompleted: 0,
    };

    const totalSeconds = Math.round((timePerItemMs * quantity) / 1000);
    this.notifications.push(
      "status",
      `${recipe.activityLabel ?? `Crafting ${recipe.name}`}: ${quantity} queued (~${totalSeconds}s)`
    );
    return true;
  }

  /**
   * Cancels the active job. Refunds materials for whatever wasn't completed
   * yet (proportional to quantityTotal - quantityCompleted), since those
   * items were never actually produced.
   */
  cancelCraftJob(): void {
    this.engine.catchUpToNow(); // items finished since the last tick count
    const job = this.craftJob;
    if (!job) return;
    const remaining = job.quantityTotal - job.quantityCompleted;
    for (const input of job.inputsPerItem) {
      this.engine.giveBack(input.resource, input.amount * remaining);
    }
    this.state.activeAction = null;
    this.notifications.push("status", `Cancelled crafting ${job.recipeName}. Unused materials refunded.`);
  }

  /** The output of `count` finished items, plus each bonus drop rolled
   *  once per item. Shared by crafting jobs and gathering sessions. */
  private grantOutput(output: CraftingRecipe["output"], bonusDrops: BonusDrop[] | undefined, count: number): void {
    if (output) this.engine.addItem(output.resource, output.amount * count);
    for (const drop of bonusDrops ?? []) {
      let hits = 0;
      for (let i = 0; i < count; i++) if (Math.random() < drop.chance) hits++;
      if (hits > 0) this.engine.addItem(drop.resource, drop.amount * hits);
    }
  }

  /** Resolve craft-job completions up to `effectiveNow`. Internal — called from resolveElapsed(). */
  resolveCraftJob(effectiveNow: number): void {
    const job = this.craftJob;
    if (!job) return;

    const elapsedSinceStart = effectiveNow - job.startedAt;
    const completedByNow = Math.min(
      job.quantityTotal,
      Math.floor(elapsedSinceStart / job.timePerItemMs)
    );
    const newCompletions = completedByNow - job.quantityCompleted;
    if (newCompletions <= 0) return;

    this.grantOutput(job.output, job.bonusDrops, newCompletions);

    this.engine.addSkillXp(job.skill, job.xpPerItem * newCompletions);
    this.engine.incrementStatistic(`crafted:${job.recipeId}`, newCompletions);
    if (job.extraStatistic) this.engine.incrementStatistic(job.extraStatistic, newCompletions);

    job.quantityCompleted = completedByNow;

    // One toast per job, updated in place as it progresses — a 30-item
    // batch used to leave 30 separate toasts behind.
    const replaceKey = "craft-progress";
    if (job.quantityCompleted >= job.quantityTotal) {
      this.notifications.push(
        "production",
        `${job.recipeName}: all ${job.quantityTotal} done (+${job.xpPerItem * job.quantityTotal} ${capitalize(job.skill)} XP)`,
        { replaceKey }
      );
      this.state.activeAction = null;
    } else {
      this.notifications.push(
        "production",
        `${job.recipeName}: ${job.quantityCompleted}/${job.quantityTotal} done (+${job.xpPerItem * job.quantityCompleted} ${capitalize(job.skill)} XP)`,
        { replaceKey }
      );
    }
  }

  /** Starts an open-ended gathering session. Mutually exclusive with
   *  crafting (same "one action at a time" rule) and with another gather
   *  session. `recipe.inputs` should normally be empty for a gathering
   *  recipe, but nothing enforces that — a "gather" that consumes
   *  something isn't nonsensical, just unusual. */
  startGatherSession(
    amenityId: string,
    recipe: CraftingRecipe,
    opts?: { maxDurationMs?: number; requiresKeepAliveEveryMs?: number }
  ): boolean {
    this.engine.catchUpToNow();
    const blocker = this.getStartBlocker(recipe);
    if (blocker) {
      this.notifications.push("status", blocker, { severity: "warning" });
      return false;
    }

    if (!this.engine.ensureIdle()) return false;
    if (!recipe.output) return false;

    const now = this.engine.now();
    this.state.activeAction = {
      kind: "gather",
      amenityId,
      recipeId: recipe.id,
      recipeName: recipe.name,
      skill: recipe.skill,
      xpPerItem: recipe.xpPerItem,
      timePerItemMs: this.getEffectiveTimePerItem(recipe),
      output: recipe.output,
      bonusDrops: recipe.bonusDrops,
      startedAt: now,
      quantityGathered: 0,
      maxDurationMs: opts?.maxDurationMs ?? DEFAULT_GATHER_MAX_DURATION_MS,
      requiresKeepAliveEveryMs: opts?.requiresKeepAliveEveryMs,
      lastKeepAliveAt: opts?.requiresKeepAliveEveryMs ? now : undefined,
    };
    this.notifications.push("status", `${recipe.activityLabel ?? `Gathering ${recipe.name}`}.`);
    return true;
  }

  /** Stops the current session early (player choice, not a cap being hit). */
  stopGatherSession(): void {
    this.engine.catchUpToNow();
    const session = this.gatherSession;
    if (!session) return;
    this.state.activeAction = null;
    this.notifications.push(
      "status",
      `Stopped gathering ${session.recipeName}. Gathered ${session.quantityGathered.toLocaleString()} total.`
    );
  }

  /** Resets the keep-alive clock — call this from a "tend to it" UI action.
   *  Returns false if there's no session, or the session doesn't require
   *  keep-alives (nothing to reset). Uses the engine clock rather than the
   *  lastTickTimestamp anchor, since this is a live player action, not
   *  something resolved retroactively during offline catch-up. */
  keepGatherSessionAlive(): boolean {
    this.engine.catchUpToNow();
    const session = this.gatherSession;
    if (!session || session.requiresKeepAliveEveryMs === undefined) return false;
    session.lastKeepAliveAt = this.engine.now();
    return true;
  }

  /** Resolve gathering progress up to `effectiveNow`. Internal — called from
   *  resolveElapsed(). Mirrors resolveCraftJob's "completedByNow = floor(elapsed
   *  / timePerItem)" approach, except the cap is a TIME cutoff (whichever is
   *  sooner: maxDurationMs, or a missed keep-alive) instead of a fixed quantity. */
  resolveGatherSession(effectiveNow: number): void {
    const session = this.gatherSession;
    if (!session) return;

    let cutoff = session.startedAt + session.maxDurationMs;
    let endedFromInactivity = false;
    if (session.requiresKeepAliveEveryMs !== undefined && session.lastKeepAliveAt !== undefined) {
      const keepAliveCutoff = session.lastKeepAliveAt + session.requiresKeepAliveEveryMs;
      if (keepAliveCutoff < cutoff) {
        cutoff = keepAliveCutoff;
        endedFromInactivity = true;
      }
    }

    const cappedNow = Math.min(effectiveNow, cutoff);
    const totalByNow = Math.max(
      0,
      Math.floor((cappedNow - session.startedAt) / session.timePerItemMs)
    );
    const newCompletions = totalByNow - session.quantityGathered;

    if (newCompletions > 0) {
      this.grantOutput(session.output, session.bonusDrops, newCompletions);
      this.engine.addSkillXp(session.skill, session.xpPerItem * newCompletions);
      this.engine.incrementStatistic(`gathered:${session.recipeId}`, newCompletions);
      session.quantityGathered = totalByNow;
    }

    if (cappedNow >= cutoff) {
      const reason = endedFromInactivity ? "needed attention" : "reached its time limit";
      this.notifications.push(
        "status",
        `Your ${session.recipeName} gathering session ended (${reason}). Gathered ${session.quantityGathered.toLocaleString()} total.`
      );
      this.state.activeAction = null;
    }
  }
}

const TOOL_NAMES: Record<ToolType, string> = {
  axe: "axe",
  pickaxe: "pickaxe",
  net: "fishing net",
  rod: "fishing rod",
  harpoon: "harpoon",
  tinderbox: "tinderbox",
};

const TOOL_ARTICLE: Record<ToolType, string> = {
  axe: "an",
  pickaxe: "a",
  net: "a",
  rod: "a",
  harpoon: "a",
  tinderbox: "a",
};
