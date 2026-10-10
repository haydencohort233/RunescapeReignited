import type { GameState, CraftingRecipe } from "../types";
import type { GameEngine } from "../gameEngine";
import { isUnlocked } from "../unlockConditions";
import { isWholeQuantity } from "../ledger";
import { capitalize } from "../format";
import { DEFAULT_GATHER_MAX_DURATION_MS } from "../tuning";
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

  /**
   * Starts a crafting job for `quantity` items. Materials for the FULL
   * quantity are deducted immediately (RuneScape-style: you commit the
   * batch up front). Only one job runs at a time in v1 — starting a new
   * one while another is active is rejected.
   */
  startCraftJob(recipe: CraftingRecipe, quantity: number): boolean {
    if (!isWholeQuantity(quantity)) return false;

    if (recipe.unlockCondition && !isUnlocked(recipe.unlockCondition, this.state)) {
      this.notifications.push("status", `You don't meet the requirements to do this yet.`, {
        severity: "warning",
      });
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

    this.state.activeAction = {
      kind: "craft",
      recipeId: recipe.id,
      recipeName: recipe.name,
      skill: recipe.skill,
      xpPerItem: recipe.xpPerItem,
      timePerItemMs: recipe.timePerItemMs,
      output: recipe.output,
      inputsPerItem: recipe.inputs,
      // The real current time, not the last tick: the tick can be stale
      // (a throttled background tab), and anchoring to it would credit the
      // job with time from before it was started.
      startedAt: this.engine.now(),
      quantityTotal: quantity,
      quantityCompleted: 0,
    };

    const totalSeconds = Math.round((recipe.timePerItemMs * quantity) / 1000);
    this.notifications.push(
      "status",
      `Started crafting ${quantity}x ${recipe.name} (~${totalSeconds}s)`
    );
    return true;
  }

  /**
   * Cancels the active job. Refunds materials for whatever wasn't completed
   * yet (proportional to quantityTotal - quantityCompleted), since those
   * items were never actually produced.
   */
  cancelCraftJob(): void {
    const job = this.craftJob;
    if (!job) return;
    const remaining = job.quantityTotal - job.quantityCompleted;
    for (const input of job.inputsPerItem) {
      this.engine.giveBack(input.resource, input.amount * remaining);
    }
    this.state.activeAction = null;
    this.notifications.push("status", `Cancelled crafting ${job.recipeName}. Unused materials refunded.`);
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

    this.engine.addItem(job.output.resource, job.output.amount * newCompletions);

    this.engine.addSkillXp(job.skill, job.xpPerItem * newCompletions);
    this.engine.incrementStatistic(`crafted:${job.recipeId}`, newCompletions);

    job.quantityCompleted = completedByNow;

    // One toast per job, updated in place as it progresses — a 30-item
    // batch used to leave 30 separate toasts behind.
    const replaceKey = "craft-progress";
    if (job.quantityCompleted >= job.quantityTotal) {
      this.notifications.push(
        "production",
        `Made x${job.quantityTotal} ${job.recipeName} (+${job.xpPerItem * job.quantityTotal} ${capitalize(job.skill)} XP)`,
        { replaceKey }
      );
      this.state.activeAction = null;
    } else {
      this.notifications.push(
        "production",
        `Made ${job.quantityCompleted}/${job.quantityTotal} ${job.recipeName} so far (+${job.xpPerItem * job.quantityCompleted} ${capitalize(job.skill)} XP)`,
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
    if (recipe.unlockCondition && !isUnlocked(recipe.unlockCondition, this.state)) {
      this.notifications.push("status", `You don't meet the requirements to do this yet.`, {
        severity: "warning",
      });
      return false;
    }

    if (!this.engine.ensureIdle()) return false;

    const now = this.engine.now();
    this.state.activeAction = {
      kind: "gather",
      amenityId,
      recipeId: recipe.id,
      recipeName: recipe.name,
      skill: recipe.skill,
      xpPerItem: recipe.xpPerItem,
      timePerItemMs: recipe.timePerItemMs,
      output: recipe.output,
      startedAt: now,
      quantityGathered: 0,
      maxDurationMs: opts?.maxDurationMs ?? DEFAULT_GATHER_MAX_DURATION_MS,
      requiresKeepAliveEveryMs: opts?.requiresKeepAliveEveryMs,
      lastKeepAliveAt: opts?.requiresKeepAliveEveryMs ? now : undefined,
    };
    this.notifications.push("status", `Started gathering ${recipe.name}.`);
    return true;
  }

  /** Stops the current session early (player choice, not a cap being hit). */
  stopGatherSession(): void {
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
      this.engine.addItem(session.output.resource, session.output.amount * newCompletions);
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
