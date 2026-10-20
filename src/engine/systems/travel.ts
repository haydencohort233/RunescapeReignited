import type { ItemDefinition, MapLocation, GameState, RecipeInput } from "../types";
import type { GameEngine } from "../gameEngine";
import { isUnlocked } from "../unlockConditions";
import { DEFAULT_MS_PER_DISTANCE_UNIT } from "../tuning";
import { getActiveTravel } from "../activeAction";
import { findRoute, type TravelRoute } from "../roads";

/** World-map travel, teleports and first-visit discovery. */
export class TravelSystem {
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

  private get travel() {
    return getActiveTravel(this.state);
  }

  /** Product of all active multiplicative "travelSpeed"-targeted modifiers,
   *  combined with a simple Agility-derived bonus (capped at 50% faster at
   *  level 100 — tune this formula freely, it's isolated here on purpose). */
  getTravelSpeedMultiplier(): number {
    const modifierMultiplier = this.engine.getModifiedValue("travelSpeed", 1);
    const agilityLevel = this.engine.getSkillLevel("agility");
    const agilityBonus = 1 - Math.min(0.5, agilityLevel * 0.005);
    return modifierMultiplier * agilityBonus;
  }

  /** The road route from `from` to `to`, never through a place the player
   *  can't enter yet. Null when no open road connects them. */
  getTravelRoute(from: MapLocation, to: MapLocation): TravelRoute | null {
    const locations = this.engine.content.locations ?? [];
    const known = new Set(locations.map((l) => l.id));
    const all = [...locations, ...[from, to].filter((l) => !known.has(l.id))];
    const byId = new Map(all.map((l) => [l.id, l]));
    return findRoute(all, this.engine.content.roads, from.id, to.id, {
      canPassThrough: (id) => {
        const loc = byId.get(id);
        return !loc?.unlockCondition || isUnlocked(loc.unlockCondition, this.state);
      },
      canUseRoad: (road) => !road.requires || isUnlocked(road.requires, this.state),
    });
  }

  /** What travelling to `to` costs right now: its toll, unless waived. */
  getTravelToll(to: MapLocation): RecipeInput[] {
    if (!to.travelCost || (to.travelCostWaivedBy && this.engine.getFlag(to.travelCostWaivedBy))) return [];
    return to.travelCost;
  }

  /** Pure calculation, no state mutation. Used both by startTravel and by
   *  the UI to preview a trip's duration before committing to it. Follows
   *  the road route, or a straight line when there's none (the UI shows
   *  that case as "no road", and startTravel refuses it). */
  getTravelDurationEstimate(from: MapLocation, to: MapLocation, opts?: { msPerDistanceUnit?: number }): number {
    const distance = this.getTravelRoute(from, to)?.distance ?? Math.hypot(to.x - from.x, to.y - from.y);
    const baseDurationMs = distance * (opts?.msPerDistanceUnit ?? DEFAULT_MS_PER_DISTANCE_UNIT);
    return Math.max(1000, Math.round(baseDurationMs * this.getTravelSpeedMultiplier()));
  }

  startTravel(from: MapLocation, to: MapLocation, opts?: { msPerDistanceUnit?: number }): boolean {
    this.engine.catchUpToNow();
    // Duration is computed from `from`, so it has to be where the player is.
    if (from.id !== this.state.currentLocationId) return false;
    if (this.state.currentLocationId === to.id) {
      this.notifications.push("status", `You're already at ${to.name}.`, { severity: "warning" });
      return false;
    }
    if (to.unlockCondition && !isUnlocked(to.unlockCondition, this.state)) {
      this.notifications.push("status", `You can't travel to ${to.name} yet.`, { severity: "warning" });
      return false;
    }
    if (!this.getTravelRoute(from, to)) {
      this.notifications.push("status", `There's no open road to ${to.name} from here.`, { severity: "warning" });
      return false;
    }
    const toll = this.getTravelToll(to);
    if (toll.some((c) => this.engine.getOwnedCount(c.resource) < c.amount)) {
      this.notifications.push("status", `You can't pay the toll to ${to.name}.`, { severity: "warning" });
      return false;
    }
    if (!this.engine.ensureIdle()) return false;

    const durationMs = this.getTravelDurationEstimate(from, to, opts);
    this.engine.payFor(toll);

    this.state.activeAction = {
      kind: "travel",
      destinationLocationId: to.id,
      destinationName: to.name,
      startedAt: this.engine.now(),
      durationMs,
      onArriveSetFlag: to.onArriveSetFlag,
      ...(toll.length > 0 ? { tollPaid: toll } : {}),
    };
    this.notifications.push("status", `Traveling to ${to.name} (~${Math.round(durationMs / 1000)}s).`);
    return true;
  }

  /** Cancels an in-progress trip. Simplification: you stay at your ORIGIN,
   *  not somewhere partway there — no partial-position tracking (yet). */
  cancelTravel(): void {
    this.engine.catchUpToNow(); // a trip that already arrived stays arrived
    const travel = this.travel;
    if (!travel) return;
    this.state.activeAction = null;
    for (const c of travel.tollPaid ?? []) this.engine.giveBack(c.resource, c.amount);
    this.notifications.push(
      "status",
      `Travel to ${travel.destinationName} cancelled.${travel.tollPaid?.length ? " Your toll was given back." : ""}`
    );
  }

  /** Instantly moves the player to `destination`, bypassing normal travel
   *  time — e.g. an Amulet of Glory. Still respects the destination's
   *  unlockCondition (you can't teleport somewhere you haven't unlocked).
   *  Uses one charge on an item with maxCharges, and refuses at 0. */
  teleportTo(def: ItemDefinition, instanceId: string, destination: MapLocation): boolean {
    this.engine.catchUpToNow();
    const instance = this.state.inventory[instanceId];
    if (!instance || instance.itemDefId !== def.id || def.teleportTo !== destination.id) return false;
    if (destination.unlockCondition && !isUnlocked(destination.unlockCondition, this.state)) {
      this.notifications.push("status", `You can't teleport to ${destination.name} yet.`, {
        severity: "warning",
      });
      return false;
    }
    // Teleporting interrupts whatever you were doing, same as OSRS — but it
    // can't be used to escape a fight you aren't allowed to flee.
    if (this.state.dungeonRun) {
      this.notifications.push("status", "You can't teleport out of a dungeon. Leave it first.", { severity: "warning" });
      return false;
    }
    if (def.maxCharges !== undefined && (instance.charges ?? 0) <= 0) {
      this.notifications.push("status", `Your ${def.name} has no charges left. Aggie in Draynor Village can recharge it.`, {
        severity: "warning",
      });
      return false;
    }
    if (this.state.activeAction && !this.engine.stopActiveAction()) return false;
    if (def.maxCharges !== undefined) {
      instance.charges = (instance.charges ?? 0) - 1;
      const left = instance.charges;
      this.notifications.push("status", `Your ${def.name} has ${left} ${left === 1 ? "charge" : "charges"} left.`);
    }
    this.state.currentLocationId = destination.id;
    this.arriveAt(destination.id, destination.name, destination.onArriveSetFlag);
    this.notifications.push("status", `You teleport to ${destination.name} using ${def.name}.`);
    return true;
  }

  /** Puts the player at `destination` with no item, travel time or unlock
   *  check — the dev menu's teleport. The caller clears the active action. */
  arriveDirectly(destination: MapLocation): void {
    if (this.state.currentLocationId === destination.id) return;
    this.state.currentLocationId = destination.id;
    this.arriveAt(destination.id, destination.name, destination.onArriveSetFlag);
    this.notifications.push("status", `Teleported to ${destination.name}.`);
  }

  /** Resolve travel completion up to `effectiveNow`. Internal — called from resolveElapsed(). */
  resolveTravel(effectiveNow: number): void {
    const travel = this.travel;
    if (!travel) return;
    if (effectiveNow >= travel.startedAt + travel.durationMs) {
      this.state.currentLocationId = travel.destinationLocationId;
      this.state.activeAction = null;
      this.engine.incrementStatistic("totalTravelTimeMs", travel.durationMs);
      this.arriveAt(travel.destinationLocationId, travel.destinationName, travel.onArriveSetFlag);
      this.notifications.push("status", `Arrived at ${travel.destinationName}.`);
    }
  }

  /** Shared arrival logic for both normal travel and teleport. Tracks
   *  per-location visit counts always, but only fires the "you discover..."
   *  notification and any onArriveSetFlag the FIRST time — repeat visits
   *  are silent on that front (still increment traveledTo, still notify
   *  "Arrived at..." from the caller). This is what makes a flag-gated
   *  building's unlock moment actually visible instead of a silent
   *  background state change. */
  private arriveAt(locationId: string, locationName: string, onArriveSetFlag?: string): void {
    this.engine.incrementStatistic(`traveledTo:${locationId}`);

    const visitedFlag = `visited:${locationId}`;
    const isFirstVisit = !this.engine.getFlag(visitedFlag);
    if (!isFirstVisit) return;

    this.engine.setFlag(visitedFlag, true);
    this.engine.incrementStatistic("locationsDiscovered");
    if (onArriveSetFlag) this.engine.setFlag(onArriveSetFlag, true);
    this.notifications.push("quest", `You discover ${locationName} for the first time!`);
  }
}
