import type {
  Facing,
  FurnitureDefinition,
  FurniturePlacement,
  FurnitureSkin,
  GameState,
  HouseState,
  PlacedFurniture,
  RoomCosmetic,
  StationType,
} from "../types";
import type { GameEngine } from "../gameEngine";
import { formatDuration } from "../format";
import { isUnlocked } from "../unlockConditions";
import {
  HOUSE_BASE_FURNITURE_LIMIT,
  HOUSE_BASE_STORAGE,
  HOUSE_FLOOR_COLS,
  HOUSE_FLOOR_ROWS,
  HOUSE_MAX_STORAGE,
  HOUSE_STORAGE_PER_FIVE_LEVELS,
  HOUSE_WALL_COLS,
  HOUSE_WALL_ROWS,
} from "../tuning";

const ALL_FACINGS: Facing[] = ["front", "right", "back", "left"];

/** Cells a piece covers, as columns and rows. Side facings swap width
 *  and depth. */
export function footprint(def: FurnitureDefinition, facing: Facing): { w: number; d: number } {
  const side = def.slot === "floor" && (facing === "right" || facing === "left");
  return side ? { w: def.depth, d: def.width } : { w: def.width, d: def.depth };
}

/** The facings rotation steps through, in order. */
export function facingsOf(def: FurnitureDefinition): Facing[] {
  if (def.slot !== "floor") return ["front"];
  return def.facings && def.facings.length > 0 ? def.facings : ALL_FACINGS;
}

/**
 * The player house: building furniture over time, and placing, moving,
 * turning and storing it in the room. The engine enforces every rule here
 * (grid, limits, storage, levels, being at the house); the UI only asks.
 * Building runs beside the one active action, so it never blocks anything.
 */
export class HouseSystem {
  private readonly engine: GameEngine;
  private readonly furnitureById: Map<string, FurnitureDefinition>;
  private readonly skinsById: Map<string, FurnitureSkin>;

  constructor(engine: GameEngine) {
    this.engine = engine;
    const house = engine.content.house;
    this.furnitureById = new Map((house?.furniture ?? []).map((f) => [f.id, f]));
    this.skinsById = new Map((house?.skins ?? []).map((s) => [s.id, s]));
  }

  private get state(): GameState {
    return this.engine.getState();
  }

  private get house(): HouseState {
    return this.state.house;
  }

  private warn(message: string): false {
    this.engine.notifications.push("status", message, { severity: "warning" });
    return false;
  }

  getFurnitureDef(id: string): FurnitureDefinition | undefined {
    return this.furnitureById.get(id);
  }

  getSkin(id: string): FurnitureSkin | undefined {
    return this.skinsById.get(id);
  }

  /** Content-driven tidy-up on load: wallpaper and rug default from
   *  content, and pieces whose furniture no longer exists are dropped.
   *  A surface piece whose host is gone goes back into storage. */
  normalize(): void {
    const content = this.engine.content.house;
    if (!content) return;
    const layout = this.house.layout;
    if (!content.wallpapers.some((w) => w.id === layout.wallpaperId)) layout.wallpaperId = content.wallpapers[0]?.id ?? "";
    if (!content.floors.some((f) => f.id === layout.floorId)) layout.floorId = content.floors[0]?.id ?? "";
    if (!content.rugs.some((r) => r.id === layout.rugId)) layout.rugId = content.rugs[0]?.id ?? "";
    layout.inside = layout.inside.filter((p) => this.furnitureById.has(p.furnitureId));
    layout.yard = layout.yard.filter((p) => this.furnitureById.has(p.furnitureId));
    this.house.storage = this.house.storage.filter((s) => this.furnitureById.has(s.furnitureId));
    const uids = new Set(layout.inside.map((p) => p.uid));
    for (const p of [...layout.inside]) {
      if (p.hostId !== undefined && !uids.has(p.hostId)) {
        layout.inside = layout.inside.filter((q) => q.uid !== p.uid);
        this.house.storage.push({ uid: p.uid, furnitureId: p.furnitureId, ...(p.skinId ? { skinId: p.skinId } : {}) });
      }
    }
    // One facility of each station stands in the house (decided Oct 23):
    // extras from before the rule go back into storage.
    const stations = new Set<StationType>();
    for (const p of [...layout.inside]) {
      const station = this.furnitureById.get(p.furnitureId)?.station;
      if (!station) continue;
      if (!stations.has(station)) {
        stations.add(station);
        continue;
      }
      const going = layout.inside.filter((q) => q.uid === p.uid || q.hostId === p.uid);
      layout.inside = layout.inside.filter((q) => !going.includes(q));
      for (const q of going) this.house.storage.push({ uid: q.uid, furnitureId: q.furnitureId, ...(q.skinId ? { skinId: q.skinId } : {}) });
    }
    if (this.house.build && !this.furnitureById.has(this.house.build.furnitureId)) {
      for (const c of this.house.build.paid) this.engine.giveBack(c.resource, c.amount);
      this.house.build = null;
    }
  }

  // ── Where and how much ──

  /** At a house portal and not on the road. */
  isAtHouse(): boolean {
    if (this.state.activeAction?.kind === "travel") return false;
    return (this.engine.content.house?.portalLocationIds ?? []).includes(this.state.currentLocationId);
  }

  private requireAtHouse(): boolean {
    return this.isAtHouse() || this.warn("You need to be at your house for that.");
  }

  getFurnitureLimit(): number {
    return HOUSE_BASE_FURNITURE_LIMIT + Math.floor((this.engine.getSkillLevel("construction") - 1) / 2);
  }

  getStorageCapacity(): number {
    const fives = Math.floor(this.engine.getSkillLevel("construction") / 5);
    return Math.min(HOUSE_MAX_STORAGE, HOUSE_BASE_STORAGE + HOUSE_STORAGE_PER_FIVE_LEVELS * fives);
  }

  /** Storage slots in use, counting the one a build in progress will fill. */
  getStorageUsed(): number {
    return this.house.storage.length + (this.house.build ? 1 : 0);
  }

  getPlacedCount(): number {
    return this.house.layout.inside.length;
  }

  /** The best bed standing in the house adds to the offline cap. A bed in
   *  storage does nothing (decided Oct 21). */
  getOfflineCapBonusMs(): number {
    let best = 0;
    for (const piece of this.house.layout.inside) {
      best = Math.max(best, this.furnitureById.get(piece.furnitureId)?.offlineCapBonusMs ?? 0);
    }
    return best;
  }

  /** A facility for this station is standing in the house, and the player
   *  is there to use it. */
  hasStationHere(station: StationType): boolean {
    return this.isAtHouse() && this.hasPlacedStation(station);
  }

  /** A facility for this station is standing in the house, wherever the
   *  player is (servants work it while they're away). */
  hasPlacedStation(station: StationType): boolean {
    return !!this.getPlacedFacility(station);
  }

  /** The facility standing in the house for this station (one at most). */
  getPlacedFacility(station: StationType): FurnitureDefinition | undefined {
    for (const p of this.house.layout.inside) {
      const def = this.furnitureById.get(p.furnitureId);
      if (def?.station === station) return def;
    }
    return undefined;
  }

  /** The facility of this station the player owns anywhere (placed,
   *  stored or being built). A house holds one of each (decided Oct 23). */
  private ownedFacility(station: StationType): FurnitureDefinition | undefined {
    const ids = [...this.house.layout.inside, ...this.house.storage].map((p) => p.furnitureId);
    if (this.house.build) ids.push(this.house.build.furnitureId);
    return ids.map((id) => this.furnitureById.get(id)).find((d) => d?.station === station);
  }

  getWallpaper(): RoomCosmetic | undefined {
    return this.engine.content.house?.wallpapers.find((w) => w.id === this.house.layout.wallpaperId);
  }

  getFloor(): RoomCosmetic | undefined {
    return this.engine.content.house?.floors.find((f) => f.id === this.house.layout.floorId);
  }

  getRug(): RoomCosmetic | undefined {
    return this.engine.content.house?.rugs.find((r) => r.id === this.house.layout.rugId);
  }

  // ── Building ──

  /** Why this piece can't be started now, or null. */
  getBuildBlocker(furnitureId: string): string | null {
    const def = this.furnitureById.get(furnitureId);
    if (!def) return "There's no such furniture.";
    if (this.engine.getSkillLevel("construction") < def.levelRequired) return `You need Construction level ${def.levelRequired}.`;
    if (!this.isAtHouse()) return "You need to be at your house for that.";
    if (this.house.build) return "You're already building something.";
    const owned = def.station ? this.ownedFacility(def.station) : undefined;
    if (owned) return `You already have a ${owned.name}. A house holds one of each facility.`;
    if (this.getStorageUsed() >= this.getStorageCapacity()) return "Your house storage is full.";
    const short = def.cost.find((c) => this.engine.getOwnedCount(c.resource) < c.amount);
    if (short) return `You need ${short.amount} ${this.engine.nameOf(short.resource)}.`;
    return null;
  }

  startBuild(furnitureId: string): boolean {
    this.engine.catchUpToNow();
    const blocker = this.getBuildBlocker(furnitureId);
    if (blocker) return this.warn(blocker);
    const def = this.furnitureById.get(furnitureId)!;
    this.engine.payFor(def.cost);
    this.house.build = {
      furnitureId,
      // The real time, as for every other action anchor (see startCraftJob).
      startedAt: this.engine.now(),
      durationMs: def.buildTimeMs,
      paid: def.cost.map((c) => ({ ...c })),
    };
    this.engine.notifications.push("status", `Building ${def.name} (${formatDuration(def.buildTimeMs)}).`);
    return true;
  }

  /** Stops the build and gives back what it cost. */
  cancelBuild(): boolean {
    this.engine.catchUpToNow();
    const build = this.house.build;
    if (!build) return false;
    for (const c of build.paid) this.engine.giveBack(c.resource, c.amount);
    this.house.build = null;
    this.engine.notifications.push("status", `Stopped building ${this.furnitureById.get(build.furnitureId)?.name ?? "furniture"}. Materials returned.`);
    return true;
  }

  /** Finishes the build if its time is up. Internal: called from resolveElapsed. */
  resolveBuild(effectiveNow: number): void {
    const build = this.house.build;
    if (!build || effectiveNow < build.startedAt + build.durationMs) return;
    const def = this.furnitureById.get(build.furnitureId);
    this.house.build = null;
    if (!def) return;
    this.house.storage.push({ uid: this.newUid(), furnitureId: def.id });
    this.engine.addSkillXp("construction", def.xp);
    this.engine.incrementStatistic(`furnitureBuilt:${def.id}`, 1);
    this.engine.incrementStatistic("furnitureBuilt", 1);
    this.engine.notifications.push("production", `Your ${def.name} is built (+${def.xp} Construction XP). It's in your house storage.`, {
      replaceKey: "furniture-build",
    });
  }

  /** Moves the build's anchor when time is skipped (see shiftActionAnchors). */
  shiftAnchors(ms: number): void {
    if (this.house.build) this.house.build.startedAt += ms;
  }

  private newUid(): string {
    return `f-${this.engine.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ── Placing ──

  private findPlaced(uid: string): PlacedFurniture | undefined {
    return this.house.layout.inside.find((p) => p.uid === uid);
  }

  /** Why `def` can't stand at `placement`, or null. `ignore` is the uid of
   *  the piece being moved or turned, which mustn't block itself. */
  getPlacementBlocker(def: FurnitureDefinition, placement: FurniturePlacement, ignore?: string): string | null {
    const facing = placement.facing ?? "front";
    if (!facingsOf(def).includes(facing)) return `${def.name} can't face that way.`;
    const { x, y } = placement;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return "That's not a spot in the room.";
    const inside = this.house.layout.inside;

    if (def.slot === "surface") {
      const host = placement.hostId ? this.findPlaced(placement.hostId) : undefined;
      const hostDef = host ? this.furnitureById.get(host.furnitureId) : undefined;
      if (!host || !hostDef?.surfaceSlots) return `${def.name} has to sit on a table or shelf.`;
      if (y !== 0 || x < 0 || x >= hostDef.surfaceSlots) return "There's no room for it there.";
      const taken = inside.some((p) => p.uid !== ignore && p.hostId === host.uid && p.x === x);
      return taken ? "Something is already there." : null;
    }

    const { w, d } = footprint(def, facing);
    const [cols, rows] = def.slot === "wall" ? [HOUSE_WALL_COLS, HOUSE_WALL_ROWS] : [HOUSE_FLOOR_COLS, HOUSE_FLOOR_ROWS];
    if (x < 0 || y < 0 || x + w > cols || y + d > rows) return "It doesn't fit there.";
    for (const other of inside) {
      if (other.uid === ignore) continue;
      const otherDef = this.furnitureById.get(other.furnitureId);
      if (!otherDef || otherDef.slot !== def.slot) continue;
      const o = footprint(otherDef, other.facing);
      const overlaps = x < other.x + o.w && other.x < x + w && y < other.y + o.d && other.y < y + d;
      if (overlaps) return `${otherDef.name} is in the way.`;
    }
    return null;
  }

  /** Takes a piece out of storage and stands it in the room. */
  placeFromStorage(storageUid: string, placement: FurniturePlacement): boolean {
    if (!this.requireAtHouse()) return false;
    const stored = this.house.storage.find((s) => s.uid === storageUid);
    const def = stored ? this.furnitureById.get(stored.furnitureId) : undefined;
    if (!stored || !def) return false;
    if (this.getPlacedCount() >= this.getFurnitureLimit()) {
      return this.warn(`Your house holds ${this.getFurnitureLimit()} pieces at your Construction level. Store something first.`);
    }
    const standing = def.station ? this.getPlacedFacility(def.station) : undefined;
    if (standing) return this.warn(`There's already a ${standing.name} in the house. A house holds one of each facility.`);
    const facing = placement.facing ?? facingsOf(def)[0];
    const blocker = this.getPlacementBlocker(def, { ...placement, facing });
    if (blocker) return this.warn(blocker);
    this.house.storage = this.house.storage.filter((s) => s.uid !== storageUid);
    this.house.layout.inside.push({
      uid: stored.uid,
      furnitureId: def.id,
      ...(stored.skinId ? { skinId: stored.skinId } : {}),
      x: placement.x,
      y: placement.y,
      facing,
      ...(def.slot === "surface" ? { hostId: placement.hostId } : {}),
    });
    return true;
  }

  /** Moves a placed piece. Anything on its surface moves with it. */
  moveFurniture(uid: string, placement: FurniturePlacement): boolean {
    if (!this.requireAtHouse()) return false;
    const piece = this.findPlaced(uid);
    const def = piece ? this.furnitureById.get(piece.furnitureId) : undefined;
    if (!piece || !def) return false;
    if (def.slot === "surface" && placement.hostId === uid) return false;
    const blocker = this.getPlacementBlocker(def, { ...placement, facing: piece.facing }, uid);
    if (blocker) return this.warn(blocker);
    piece.x = placement.x;
    piece.y = placement.y;
    if (def.slot === "surface") piece.hostId = placement.hostId;
    return true;
  }

  /** Turns a floor piece to its next facing, if it still fits. */
  rotateFurniture(uid: string): boolean {
    if (!this.requireAtHouse()) return false;
    const piece = this.findPlaced(uid);
    const def = piece ? this.furnitureById.get(piece.furnitureId) : undefined;
    if (!piece || !def) return false;
    const facings = facingsOf(def);
    if (facings.length < 2) return this.warn(`${def.name} doesn't turn.`);
    const next = facings[(facings.indexOf(piece.facing) + 1) % facings.length];
    const blocker = this.getPlacementBlocker(def, { x: piece.x, y: piece.y, facing: next }, uid);
    if (blocker) return this.warn(`No room to turn it there. ${blocker}`);
    piece.facing = next;
    return true;
  }

  /** Puts a placed piece (and anything on it) back into storage. */
  storeFurniture(uid: string): boolean {
    if (!this.requireAtHouse()) return false;
    // Work done up to now counts before a facility goes away.
    this.engine.catchUpToNow();
    const piece = this.findPlaced(uid);
    if (!piece) return false;
    const attached = this.house.layout.inside.filter((p) => p.hostId === uid);
    const going = [piece, ...attached];
    // Storage counts the build in progress, but a piece already standing in
    // the house must always be able to go back: only check the real space.
    if (this.house.storage.length + going.length > this.getStorageCapacity()) {
      return this.warn(`Not enough room in storage (${going.length} needed).`);
    }
    const ids = new Set(going.map((p) => p.uid));
    this.house.layout.inside = this.house.layout.inside.filter((p) => !ids.has(p.uid));
    for (const p of going) this.house.storage.push({ uid: p.uid, furnitureId: p.furnitureId, ...(p.skinId ? { skinId: p.skinId } : {}) });
    const storedName = this.furnitureById.get(piece.furnitureId)?.name ?? "it";
    this.stopCraftingWithoutStation(storedName);
    this.engine.stopServantIfFacilityGone(storedName);
    return true;
  }

  /** A craft that needs a station stops (with a refund) once no station
   *  of that kind is left where the player is: putting away the sawhorse
   *  mid-sawing ends the sawing. */
  private stopCraftingWithoutStation(storedName: string): void {
    const action = this.state.activeAction;
    if (action?.kind !== "craft" || !action.station) return;
    const inTown = (this.engine.content.stationLocations?.[action.station] ?? []).includes(this.state.currentLocationId);
    if (inTown || this.hasStationHere(action.station)) return;
    this.engine.cancelCraftJob();
    this.engine.notifications.push("status", `You put away the ${storedName}, so you stop making ${action.recipeName}.`, { severity: "warning" });
  }

  // ── Cosmetics ──

  /** Unlocked skins that fit this kind of piece. */
  getAvailableSkins(furnitureId: string): FurnitureSkin[] {
    const def = this.furnitureById.get(furnitureId);
    return (def?.skins ?? [])
      .map((id) => this.skinsById.get(id))
      .filter((s): s is FurnitureSkin => !!s && s.furnitureId === furnitureId && this.house.unlockedSkins.includes(s.id));
  }

  /** Dresses a placed piece in an unlocked skin, or back to plain (null). */
  setFurnitureSkin(uid: string, skinId: string | null): boolean {
    if (!this.requireAtHouse()) return false;
    const piece = this.findPlaced(uid);
    if (!piece) return false;
    if (skinId === null) {
      delete piece.skinId;
      return true;
    }
    if (!this.getAvailableSkins(piece.furnitureId).some((s) => s.id === skinId)) return this.warn("You haven't unlocked that look.");
    piece.skinId = skinId;
    return true;
  }

  unlockSkin(skinId: string): boolean {
    if (!this.skinsById.has(skinId) || this.house.unlockedSkins.includes(skinId)) return false;
    this.house.unlockedSkins.push(skinId);
    return true;
  }

  /** Dev tool until Phase 2 adds real unlock sources. */
  devUnlockAllSkins(): void {
    for (const id of this.skinsById.keys()) this.unlockSkin(id);
    this.engine.notifications.push("status", "Unlocked every furniture skin.");
  }

  /** Dev tool: finishes the build now. */
  devFinishBuild(): void {
    const build = this.house.build;
    if (build) this.resolveBuild(build.startedAt + build.durationMs);
  }

  /** Whether `def`'s level requirement is met (for build lists). */
  meetsLevel(def: FurnitureDefinition): boolean {
    return isUnlocked({ kind: "skillLevel", skill: "construction", atLeast: def.levelRequired }, this.state);
  }
}
