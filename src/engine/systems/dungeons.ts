import type { ActiveCombatSession, DungeonDefinition, DungeonRun, GameState, LoadoutEntry } from "../types";
import type { GameEngine } from "../gameEngine";
import { isUnlocked } from "../unlockConditions";
import { ENEMY_RESPAWN_MS } from "../tuning";

/**
 * Dungeons: a run of waves, then a pause to regear, then the boss. Only a
 * small loadout comes in. Loadout items are never taken out of the ledger;
 * the run just limits what can be used (equipped, eaten) to what was
 * brought, and counts food down as it's eaten.
 */
export class DungeonSystem {
  private readonly engine: GameEngine;
  private readonly dungeonsById: Map<string, DungeonDefinition>;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.dungeonsById = new Map((engine.content.dungeons ?? []).map((d) => [d.id, d]));
  }

  private get state(): GameState {
    return this.engine.getState();
  }

  private get notifications() {
    return this.engine.notifications;
  }

  getDungeon(id: string): DungeonDefinition | undefined {
    return this.dungeonsById.get(id);
  }

  get run(): DungeonRun | null {
    return this.state.dungeonRun;
  }

  /** Slots a loadout takes: one per piece of gear, one per stack (arrows).
   *  Food takes none: the food slot's stack comes in on its own. */
  slotsUsed(entries: LoadoutEntry[]): number {
    let slots = 0;
    for (const e of entries) {
      const def = this.engine.itemsById.get(e.itemDefId);
      if (!def || e.quantity <= 0 || def.healAmount) continue;
      slots += 1;
    }
    return slots;
  }

  /** Food is never picked for a loadout; the worn food is added on entry. */
  private withoutFood(loadout: LoadoutEntry[]): LoadoutEntry[] {
    return loadout.filter((e) => !this.engine.itemsById.get(e.itemDefId)?.healAmount);
  }

  /** The loadout saved for a dungeon, trimmed to what can still be brought:
   *  copies still owned and not worn, stacks at what's held now. */
  getSavedLoadout(dungeonId: string): LoadoutEntry[] {
    const worn = new Set(Object.values(this.state.equipment));
    const entries: LoadoutEntry[] = [];
    for (const e of this.state.savedLoadouts[dungeonId] ?? []) {
      const def = this.engine.itemsById.get(e.itemDefId);
      if (!def?.equipSlot || def.healAmount) continue;
      if (def.stackable) {
        const held = Math.floor(this.engine.getResourceAmount(def.id));
        if (held >= 1 && !worn.has(`stack:${def.id}`)) entries.push({ itemDefId: def.id, quantity: held });
      } else if (e.instanceId && this.state.inventory[e.instanceId]?.itemDefId === def.id && !worn.has(e.instanceId)) {
        entries.push({ itemDefId: def.id, instanceId: e.instanceId, quantity: 1 });
      }
    }
    return entries;
  }

  /** Remembers a loadout for next time (set up from the Equipment tab).
   *  Only gear and ammo; at most the dungeon's slot count. */
  setSavedLoadout(dungeonId: string, loadout: LoadoutEntry[]): boolean {
    const dungeon = this.getDungeon(dungeonId);
    if (!dungeon) return false;
    const entries = this.withoutFood(loadout).filter((e) => this.engine.itemsById.get(e.itemDefId)?.equipSlot && e.quantity > 0);
    if (this.slotsUsed(entries) > dungeon.loadoutSlots) {
      this.notifications.push("status", `You can only bring ${dungeon.loadoutSlots} items.`, { severity: "warning" });
      return false;
    }
    this.state.savedLoadouts[dungeonId] = entries.map((e) => ({
      itemDefId: e.itemDefId,
      quantity: e.instanceId ? 1 : e.quantity,
      ...(e.instanceId ? { instanceId: e.instanceId } : {}),
    }));
    return true;
  }

  /** Why the player can't enter with this loadout right now, or null. */
  getEnterBlocker(dungeonId: string, loadout: LoadoutEntry[]): string | null {
    const dungeon = this.getDungeon(dungeonId);
    if (!dungeon) return "There's no such dungeon.";
    if (this.run) return "You're already in a dungeon.";
    if (this.state.currentLocationId !== dungeon.locationId) return `You need to be at the ${dungeon.name}.`;
    if (dungeon.unlockCondition && !isUnlocked(dungeon.unlockCondition, this.state)) return "You can't enter yet.";
    if (this.engine.getCurrentHp() <= 0) return "You need to heal first.";
    loadout = this.withoutFood(loadout);
    if (this.slotsUsed(loadout) > dungeon.loadoutSlots) return `You can only bring ${dungeon.loadoutSlots} items.`;
    const worn = new Set(Object.values(this.state.equipment));
    for (const e of loadout) {
      const def = this.engine.itemsById.get(e.itemDefId);
      if (!def || !Number.isInteger(e.quantity) || e.quantity <= 0) return "That loadout has something odd in it.";
      if (def.stackable) {
        if (this.engine.getResourceAmount(e.itemDefId) < e.quantity) return `You don't have ${e.quantity}x ${def.name}.`;
      } else {
        const instance = e.instanceId ? this.state.inventory[e.instanceId] : undefined;
        if (!instance || instance.itemDefId !== e.itemDefId || e.quantity !== 1) return `You don't have that ${def.name}.`;
        if (worn.has(instance.instanceId)) return `${def.name} is already worn; worn gear comes in for free.`;
      }
    }
    return null;
  }

  /** Enters with `loadout` (worn gear and the food slot's stack come along
   *  without using slots) and starts the first wave. */
  enterDungeon(dungeonId: string, loadout: LoadoutEntry[]): boolean {
    this.engine.catchUpToNow();
    const blocker = this.getEnterBlocker(dungeonId, loadout);
    if (blocker) {
      this.notifications.push("status", blocker, { severity: "warning" });
      return false;
    }
    if (!this.engine.ensureIdle()) return false;
    const dungeon = this.getDungeon(dungeonId)!;
    const entries = this.withoutFood(loadout).map((e) => ({ ...e }));
    const food = this.engine.getEquipmentBonuses().foodItemId;
    if (food && this.engine.getResourceAmount(food) >= 1) {
      entries.push({ itemDefId: food, quantity: Math.floor(this.engine.getResourceAmount(food)) });
    }
    this.state.dungeonRun = { dungeonId, wavesCleared: 0, awaitingBoss: false, loadout: entries };
    this.engine.incrementStatistic(`dungeonEntered:${dungeonId}`, 1);
    this.notifications.push("status", `You enter the ${dungeon.name}.`);
    this.startStage(this.engine.now());
    return true;
  }

  /** The boss, after the regear stop. */
  continueToBoss(): boolean {
    this.engine.catchUpToNow();
    const run = this.run;
    if (!run?.awaitingBoss) return false;
    if (this.engine.getCurrentHp() <= 0) return false;
    run.awaitingBoss = false;
    this.startStage(this.engine.now());
    return true;
  }

  /** Leaves at the regear stop (a wave in progress is fled instead). */
  leave(): boolean {
    this.engine.catchUpToNow();
    const run = this.run;
    if (!run) return false;
    if (this.state.activeAction?.kind === "combat") return this.engine.fleeCombat();
    this.end("You leave the dungeon.");
    return true;
  }

  /** Ends the run however it ended; loadout leftovers are simply usable again. */
  end(message?: string): void {
    const run = this.run;
    if (!run) return;
    this.state.dungeonRun = null;
    if (message) this.notifications.push("status", message, { severity: "warning" });
  }

  /** Called by combat on a dungeon kill: next wave, the regear stop, or done. */
  onFightWon(session: ActiveCombatSession, at: number, lootMessages: string[]): void {
    const run = this.run;
    const dungeon = run ? this.getDungeon(run.dungeonId) : undefined;
    if (!run || !dungeon) return;
    const loot = lootMessages.length > 0 ? ` You got: ${lootMessages.join(", ")}.` : "";

    if (run.wavesCleared >= dungeon.waves.length) {
      // The boss is down.
      if (dungeon.clearFlag) this.engine.setFlag(dungeon.clearFlag);
      this.engine.incrementStatistic(`dungeonClears:${dungeon.id}`, 1);
      this.state.dungeonRun = null;
      this.notifications.push("quest", `You cleared the ${dungeon.name}, defeating ${session.enemyName}!${loot}`);
      return;
    }

    run.wavesCleared += 1;
    if (run.wavesCleared >= dungeon.waves.length) {
      run.awaitingBoss = true;
      const boss = this.engine.getEnemy(dungeon.bossId);
      this.notifications.push(
        "quest",
        `Wave ${run.wavesCleared} of ${dungeon.waves.length} cleared.${loot} The way to ${boss?.name ?? "the boss"} is open: regear from your loadout, then continue.`
      );
      return;
    }
    if (!this.engine.catchUp) {
      this.notifications.push("reward", `Wave ${run.wavesCleared} of ${dungeon.waves.length} cleared.${loot}`, {
        replaceKey: "dungeon-wave",
      });
    }
    this.startStage(at + ENEMY_RESPAWN_MS);
  }

  private startStage(startAt: number): void {
    const run = this.run;
    const dungeon = run ? this.getDungeon(run.dungeonId) : undefined;
    if (!run || !dungeon) return;
    const enemyId = run.wavesCleared < dungeon.waves.length ? dungeon.waves[run.wavesCleared] : dungeon.bossId;
    const enemy = this.engine.getEnemy(enemyId);
    if (!enemy) {
      this.end(`The ${dungeon.name} is missing an enemy ("${enemyId}").`);
      return;
    }
    this.engine.startDungeonFight(enemy, dungeon.id, startAt, this.firstFood());
  }

  /** Food left in the loadout. */
  foodLeft(itemDefId: string): number {
    const run = this.run;
    if (!run) return 0;
    const entry = run.loadout.find((e) => e.itemDefId === itemDefId);
    return Math.min(entry?.quantity ?? 0, Math.floor(this.engine.getResourceAmount(itemDefId)));
  }

  /** One unit of loadout food eaten. */
  useFood(itemDefId: string): void {
    const entry = this.run?.loadout.find((e) => e.itemDefId === itemDefId);
    if (entry) entry.quantity = Math.max(0, entry.quantity - 1);
  }

  private firstFood(): string | undefined {
    return this.run?.loadout.find((e) => this.engine.itemsById.get(e.itemDefId)?.healAmount && this.foodLeft(e.itemDefId) > 0)
      ?.itemDefId;
  }

  /** Whether an item copy may be equipped during the run: it was brought,
   *  or worn coming in. */
  canUseInstance(instanceId: string): boolean {
    return !!this.run?.loadout.some((e) => e.instanceId === instanceId);
  }

  /** Something taken off mid-run stays usable for the rest of it. */
  rememberUnequipped(itemDefId: string, instanceId: string | undefined): void {
    const run = this.run;
    if (!run || !instanceId || run.loadout.some((e) => e.instanceId === instanceId)) return;
    run.loadout.push({ itemDefId, instanceId, quantity: 1 });
  }
}
