import type { DungeonDefinition } from "../engine/types";

/** Loadout size for every dungeon for now: decided 4 to 8 as a test, so
 *  this sits in the middle. One number to change. */
export const DEFAULT_LOADOUT_SLOTS = 6;

export const DUNGEON_CATALOG: DungeonDefinition[] = [
  {
    id: "overgrown-den",
    name: "Overgrown Den",
    locationId: "dark-forest",
    waves: ["goblin", "goblin", "bandit"],
    bossId: "den-guardian",
    loadoutSlots: DEFAULT_LOADOUT_SLOTS,
    // The quest is the investigation; the dungeon is going back in.
    unlockCondition: { kind: "flag", flag: "investigatedDen", label: "Complete the quest The Overgrown Den" },
    clearFlag: "denCleared",
  },
];

const DUNGEONS_BY_ID = new Map(DUNGEON_CATALOG.map((d) => [d.id, d]));

export function getDungeon(id: string): DungeonDefinition | undefined {
  return DUNGEONS_BY_ID.get(id);
}
