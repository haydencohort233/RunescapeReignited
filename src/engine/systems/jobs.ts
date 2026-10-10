import type { GameState, UnlockCondition, JobDefinition } from "../types";
import type { GameEngine } from "../gameEngine";
import { isUnlocked, captureBaselines, offsetByBaselines } from "../unlockConditions";
import { getDailyPeriodNumber } from "../time";

/** The job board: accepting, objectives measured from acceptance, turn-in, daily expiry. */
export class JobBoardSystem {
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

  isJobAccepted(jobId: string): boolean {
    return !!this.state.jobs.accepted[jobId];
  }

  /** Whether the job is done and not currently offerable — see
   *  JobDefinition.frequency. Daily completion is checked by comparing the
   *  stored period to today's, so it flips back on its own at UTC midnight
   *  with no scheduled reset process. */
  isJobCompleted(job: JobDefinition): boolean {
    const frequency = job.frequency ?? "daily";
    if (frequency === "repeatable") return false;
    if (frequency === "once") return !!this.state.jobs.completedOnce[job.id];
    return this.state.jobs.lastCompletedPeriod[job.id] === getDailyPeriodNumber(this.engine.now());
  }

  /** Accepts a job, at its board's location. Refuses if already accepted,
   *  or already completed (see isJobCompleted). Snapshots any counters the
   *  objective reads, so progress counts from now. */
  acceptJob(job: JobDefinition, boardLocationId: string): boolean {
    if (this.state.currentLocationId !== boardLocationId) {
      this.notifications.push("status", "You need to be at the job board to accept this.", {
        severity: "warning",
      });
      return false;
    }
    if (this.isJobCompleted(job)) {
      this.notifications.push("status", `You've already completed "${job.title}".`, {
        severity: "warning",
      });
      return false;
    }
    if (this.isJobAccepted(job.id)) {
      this.notifications.push("status", `You've already accepted "${job.title}".`, {
        severity: "warning",
      });
      return false;
    }
    this.state.jobs.accepted[job.id] = {
      acceptedAt: this.state.lastTickTimestamp,
      acceptedPeriod: getDailyPeriodNumber(this.engine.now()),
      baselines: captureBaselines(job.objective, this.state),
    };
    this.notifications.push("status", `Accepted job: ${job.title}.`);
    return true;
  }

  /** The job's objective as it applies right now: for an accepted job,
   *  counters are measured from when it was accepted. */
  getJobObjective(job: JobDefinition): UnlockCondition {
    const accepted = this.state.jobs.accepted[job.id];
    return accepted ? offsetByBaselines(job.objective, accepted.baselines) : job.objective;
  }

  /** Whether a job's objective is currently met — same check used to gate
   *  the turn-in button in the UI and to enforce it here. */
  isJobObjectiveMet(job: JobDefinition): boolean {
    return isUnlocked(this.getJobObjective(job), this.state);
  }

  /** Turns in an accepted job: consumes deliveries (if any), grants the
   *  reward (GP/achievement points modifier-scaled, items and flags never
   *  scaled), and records completion per the job's frequency. Must be at
   *  the board's location — same enforcement as accepting. */
  turnInJob(job: JobDefinition, boardLocationId: string): boolean {
    if (this.state.currentLocationId !== boardLocationId) {
      this.notifications.push("status", "You need to be at the job board to turn this in.", {
        severity: "warning",
      });
      return false;
    }
    if (!this.isJobAccepted(job.id)) return false;
    if (!this.isJobObjectiveMet(job)) {
      this.notifications.push("status", `You haven't finished "${job.title}" yet.`, {
        severity: "warning",
      });
      return false;
    }

    if (job.consumesOnTurnIn) {
      for (const cost of job.consumesOnTurnIn) {
        if (this.engine.getOwnedCount(cost.resource) < cost.amount) {
          // Objective and consumption requirements should normally agree,
          // but content could theoretically diverge — fail safe rather
          // than deduct into the negative.
          this.notifications.push("status", `You don't have enough to turn this in.`, {
            severity: "warning",
          });
          return false;
        }
      }
      this.engine.payFor(job.consumesOnTurnIn);
    }

    if (job.reward?.gp) {
      this.engine.gainResource("gp", this.engine.getModifiedValue("jobReward:gp", job.reward.gp));
    }
    if (job.reward?.achievementPoints) {
      this.engine.gainResource(
        "achievement-points",
        this.engine.getModifiedValue("jobReward:achievementPoints", job.reward.achievementPoints)
      );
    }
    if (job.reward?.items) {
      // Deliberately NOT modifier-scaled — a fixed item count is a fixed
      // item count, scaling item rewards would be a dupe/balance risk.
      for (const item of job.reward.items) {
        this.engine.addItem(item.itemDefId, item.quantity);
      }
    }
    if (job.reward?.setFlags) {
      // The quest-chaining hook: a job's completion can unlock a building,
      // a location, or another job the exact same way any other flag does.
      for (const flag of job.reward.setFlags) this.engine.setFlag(flag, true);
    }

    delete this.state.jobs.accepted[job.id];
    this.engine.incrementStatistic(`jobCompletions:${job.id}`, 1);
    this.engine.incrementStatistic("jobCompletions:total", 1);
    const frequency = job.frequency ?? "daily";
    if (frequency === "daily") {
      this.state.jobs.lastCompletedPeriod[job.id] = getDailyPeriodNumber(this.engine.now());
    } else if (frequency === "once") {
      this.state.jobs.completedOnce[job.id] = true;
    }

    this.notifications.push("reward", `Turned in "${job.title}".`);
    return true;
  }

  /** Dev tool — immediately unlocks every daily job, without waiting for
   *  the actual UTC reset. "once" jobs stay done; nothing in progress is
   *  un-accepted. */
  devForceJobBoardReset(): void {
    this.state.jobs.lastCompletedPeriod = {};
    this.notifications.push("status", "Dev: job board reset forced.", { severity: "warning" });
  }

  /** Cancels any accepted-but-unfinished job whose acceptance period no
   *  longer matches today — the shift reset, so the job posting is gone,
   *  same flavor as it being picked up by someone else. Uses the REAL
   *  current day (the raw `now` resolveElapsed received, not the
   *  offline-capped effectiveNow) since job resets are wall-clock-based,
   *  same as isJobCompleted/getActiveJobIds elsewhere. */
  resolveJobExpiry(now: number): void {
    const currentPeriod = getDailyPeriodNumber(now);
    let expiredCount = 0;
    for (const [jobId, record] of Object.entries(this.state.jobs.accepted)) {
      if (record.acceptedPeriod !== currentPeriod) {
        delete this.state.jobs.accepted[jobId];
        expiredCount++;
      }
    }
    if (expiredCount > 0) {
      this.notifications.push(
        "status",
        expiredCount === 1
          ? "An accepted job expired when the board reset."
          : `${expiredCount} accepted jobs expired when the board reset.`,
        { severity: "warning" }
      );
    }
  }
}
