import type { RecipeInput, UnlockCondition } from "../engine/types";
import { MIN_ATTACK_SPEED_MS } from "../engine/tuning";
import { ITEM_CATALOG } from "./items";
import { BUILDING_CATALOG } from "./buildings";
import { RECIPE_CATALOG } from "./recipes";
import { ENEMY_CATALOG } from "./enemies";
import { MAP_LOCATIONS } from "./mapLocations";
import { SHOP_CATALOG } from "./shops";
import { AMENITY_CATALOG } from "./amenities";
import { JOB_CATALOG } from "./jobs";
import { JOB_BOARD_CATALOG } from "./jobBoards";
import { QUEST_CATALOG } from "./quests";
import { ACHIEVEMENT_CATALOG } from "./achivements";
import { SKILL_CATALOG } from "./skills";
import { SPELL_CATALOG } from "./spells";
import { NPC_CATALOG, STARTER_KIT } from "./npcs";
import { getSpecialAttack } from "../engine/specialAttacks";
import { DUNGEON_CATALOG } from "./dungeons";

/** Ledger ids that are plain currencies rather than items. */
const CURRENCIES = new Set(["gp", "achievement-points"]);

/**
 * Cross-checks every content catalog: unique ids, every reference pointing
 * at something that exists, and numbers the engine can't handle (zero
 * craft times, zero attack speeds). Returns one message per problem; an
 * empty array means the content is consistent. Run by the test suite and
 * at dev startup, so a typo in content fails loudly instead of showing up
 * as a silent no-op in game.
 */
export function validateContent(): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  const ids = (label: string, list: { id: string }[]) => {
    const seen = new Set<string>();
    for (const { id } of list) {
      if (seen.has(id)) err(`${label}: duplicate id "${id}"`);
      seen.add(id);
    }
    return seen;
  };
  const items = ids("items", ITEM_CATALOG);
  const buildings = ids("buildings", BUILDING_CATALOG);
  const recipes = ids("recipes", RECIPE_CATALOG);
  const enemies = ids("enemies", ENEMY_CATALOG);
  const locations = ids("locations", MAP_LOCATIONS);
  const shops = ids("shops", SHOP_CATALOG);
  const jobs = ids("jobs", JOB_CATALOG);
  const boards = ids("job boards", JOB_BOARD_CATALOG);
  const skills = ids("skills", SKILL_CATALOG);
  ids("amenities", AMENITY_CATALOG);
  ids("spells", SPELL_CATALOG);
  const npcs = ids("npcs", NPC_CATALOG);
  ids("quests", QUEST_CATALOG);
  ids("achievements", ACHIEVEMENT_CATALOG);

  const ledgerId = (where: string, id: string) => {
    if (!items.has(id) && !CURRENCIES.has(id)) err(`${where}: unknown item or currency "${id}"`);
  };
  const amounts = (where: string, list: RecipeInput[] = []) => {
    for (const a of list) {
      ledgerId(where, a.resource);
      if (!(a.amount > 0)) err(`${where}: amount for "${a.resource}" must be > 0`);
    }
  };
  const condition = (where: string, c: UnlockCondition) => {
    switch (c.kind) {
      case "skillLevel":
        if (!skills.has(c.skill)) err(`${where}: unknown skill "${c.skill}"`);
        break;
      case "resourceAtLeast":
      case "resourceLifetimeAtLeast":
        ledgerId(where, c.resource);
        break;
      case "buildingOwned":
        if (!buildings.has(c.buildingId)) err(`${where}: unknown building "${c.buildingId}"`);
        break;
      case "all":
      case "any":
        c.conditions.forEach((sub) => condition(where, sub));
        break;
    }
  };
  const rewardItems = (where: string, list: { itemDefId: string; quantity: number }[] = []) => {
    for (const i of list) {
      if (!items.has(i.itemDefId)) err(`${where}: unknown reward item "${i.itemDefId}"`);
      if (!(i.quantity > 0)) err(`${where}: reward quantity must be > 0`);
    }
  };

  for (const item of ITEM_CATALOG) {
    const where = `item "${item.id}"`;
    // Worn as a whole stack only makes sense for ammo and food.
    if (item.equipSlot && item.stackable && item.equipSlot !== "ammo" && item.equipSlot !== "food") {
      err(`${where}: only ammo and food can be stackable equipment`);
    }
    if (item.equipSlot === "food" && !item.healAmount) err(`${where}: worn as food but has no healAmount`);
    if (item.actions.includes("bury") && !(item.prayerXp && item.prayerXp > 0)) err(`${where}: has "bury" but no prayerXp`);
    if (item.specialAttack && !getSpecialAttack(item.specialAttack)) err(`${where}: unknown special attack "${item.specialAttack}"`);
    if (item.specialAttack && item.equipSlot !== "weapon") err(`${where}: only weapons have special attacks`);
    for (const runeId of item.infiniteRunes ?? []) ledgerId(where, runeId);
    if (item.brokenItemId && !items.has(item.brokenItemId)) err(`${where}: unknown broken item "${item.brokenItemId}"`);
    if (item.brokenItemId && item.maxDurability === undefined) err(`${where}: breaks but has no maxDurability`);
    if (item.repairsTo && !items.has(item.repairsTo)) err(`${where}: repairs to unknown item "${item.repairsTo}"`);
    if (item.maxCharges !== undefined && !(item.maxCharges > 0)) err(`${where}: maxCharges must be > 0`);
    if (item.tool?.requirement) condition(where, item.tool.requirement);
    if (item.tool && item.stackable) err(`${where}: tools can't be stackable`);
    if (item.actions.includes("equip") && !item.equipSlot) err(`${where}: has "equip" but no equipSlot`);
    if (item.actions.includes("eat") && !(item.healAmount && item.healAmount > 0)) err(`${where}: has "eat" but no healAmount`);
    if (item.teleportTo && !locations.has(item.teleportTo)) err(`${where}: teleports to unknown location`);
    if (item.attackSpeedMs !== undefined && item.attackSpeedMs < MIN_ATTACK_SPEED_MS) err(`${where}: attackSpeedMs below ${MIN_ATTACK_SPEED_MS}`);
    if (item.equipRequirement) condition(where, item.equipRequirement);
  }

  for (const b of BUILDING_CATALOG) {
    const where = `building "${b.id}"`;
    ledgerId(where, b.resource);
    amounts(where, b.baseCost);
    if (!(b.baseRatePerSecond >= 0)) err(`${where}: baseRatePerSecond must be >= 0`);
    if (b.unlockCondition) condition(where, b.unlockCondition);
  }

  for (const r of RECIPE_CATALOG) {
    const where = `recipe "${r.id}"`;
    if (!skills.has(r.skill)) err(`${where}: unknown skill "${r.skill}"`);
    if (!(r.timePerItemMs > 0)) err(`${where}: timePerItemMs must be > 0`);
    amounts(where, r.inputs);
    amounts(where, [r.output]);
    for (const d of r.bonusDrops ?? []) {
      ledgerId(where, d.resource);
      if (!(d.amount > 0)) err(`${where}: bonus drop amount must be > 0`);
      if (!(d.chance > 0 && d.chance <= 1)) err(`${where}: bonus drop chance must be in (0, 1]`);
    }
    if (r.unlockCondition) condition(where, r.unlockCondition);
    if (r.tool && !ITEM_CATALOG.some((i) => i.tool?.type === r.tool)) err(`${where}: no item is a "${r.tool}" tool`);
    if (r.station && !AMENITY_CATALOG.some((a) => a.kind === "craftingStation" && a.station === r.station)) {
      err(`${where}: no "${r.station}" station exists anywhere`);
    }
  }

  for (const spell of SPELL_CATALOG) {
    const where = `spell "${spell.id}"`;
    amounts(where, spell.runes);
    if (!(spell.maxHit > 0)) err(`${where}: maxHit must be > 0`);
  }

  for (const npc of NPC_CATALOG) {
    if (!locations.has(npc.locationId)) err(`npc "${npc.id}": unknown location "${npc.locationId}"`);
    if (npc.dialogue.length === 0) err(`npc "${npc.id}": needs at least one line of dialogue`);
  }

  for (const id of STARTER_KIT) if (!items.has(id)) err(`starter kit: unknown item "${id}"`);

  const dungeons = ids("dungeons", DUNGEON_CATALOG);
  for (const d of DUNGEON_CATALOG) {
    const where = `dungeon "${d.id}"`;
    if (!locations.has(d.locationId)) err(`${where}: unknown location "${d.locationId}"`);
    for (const id of [...d.waves, d.bossId]) if (!enemies.has(id)) err(`${where}: unknown enemy "${id}"`);
    if (!(d.loadoutSlots > 0)) err(`${where}: loadoutSlots must be > 0`);
    if (d.unlockCondition) condition(where, d.unlockCondition);
  }

  for (const e of ENEMY_CATALOG) {
    const where = `enemy "${e.id}"`;
    if (!(e.maxHp > 0)) err(`${where}: maxHp must be > 0`);
    if (e.attackSpeedMs !== undefined && e.attackSpeedMs < MIN_ATTACK_SPEED_MS) err(`${where}: attackSpeedMs below ${MIN_ATTACK_SPEED_MS}`);
    for (const entry of e.lootTable ?? []) {
      if (entry.id) ledgerId(where, entry.id);
      if (!(entry.weight > 0)) err(`${where}: loot weight must be > 0`);
      if ((entry.quantityMin ?? 1) > (entry.quantityMax ?? 1)) err(`${where}: loot quantityMin > quantityMax`);
    }
  }

  for (const loc of MAP_LOCATIONS) {
    if (loc.unlockCondition) condition(`location "${loc.id}"`, loc.unlockCondition);
  }

  for (const shop of SHOP_CATALOG) {
    const where = `shop "${shop.id}"`;
    if (!locations.has(shop.locationId)) err(`${where}: unknown location "${shop.locationId}"`);
    for (const si of shop.items) {
      if (!items.has(si.itemDefId)) err(`${where}: sells unknown item "${si.itemDefId}"`);
      amounts(where, si.price);
    }
  }

  for (const a of AMENITY_CATALOG) {
    const where = `amenity "${a.id}"`;
    if (!locations.has(a.locationId)) err(`${where}: unknown location "${a.locationId}"`);
    if (a.unlockCondition) condition(where, a.unlockCondition);
    if (a.kind === "shop" && !shops.has(a.shopId)) err(`${where}: unknown shop "${a.shopId}"`);
    if (a.kind === "resourceNode" && !recipes.has(a.recipeId)) err(`${where}: unknown recipe "${a.recipeId}"`);
    if (a.kind === "jobBoard" && !boards.has(a.boardId)) err(`${where}: unknown job board "${a.boardId}"`);
    if (a.kind === "combatEncounter" && !enemies.has(a.enemyId)) err(`${where}: unknown enemy "${a.enemyId}"`);
    if (a.kind === "npc" && !npcs.has(a.npcId)) err(`${where}: unknown npc "${a.npcId}"`);
    if (a.kind === "dungeonEntrance" && !dungeons.has(a.dungeonId)) err(`${where}: unknown dungeon "${a.dungeonId}"`);
    if (a.kind === "npc" && NPC_CATALOG.find((n) => n.id === a.npcId)?.locationId !== a.locationId) {
      err(`${where}: npc "${a.npcId}" lives somewhere else`);
    }
  }

  for (const board of JOB_BOARD_CATALOG) {
    const where = `job board "${board.id}"`;
    if (!locations.has(board.locationId)) err(`${where}: unknown location "${board.locationId}"`);
    for (const id of board.jobIds) if (!jobs.has(id)) err(`${where}: unknown job "${id}"`);
  }

  for (const job of JOB_CATALOG) {
    const where = `job "${job.id}"`;
    condition(where, job.objective);
    amounts(where, job.consumesOnTurnIn);
    rewardItems(where, job.reward?.items);
  }

  for (const quest of QUEST_CATALOG) {
    const where = `quest "${quest.id}"`;
    if (quest.stages.length === 0) err(`${where}: has no stages`);
    if (quest.startCondition) condition(where, quest.startCondition);
    quest.stages.forEach((stage, i) => {
      condition(`${where} stage ${i + 1}`, stage.objective);
      amounts(`${where} stage ${i + 1}`, stage.consumes);
    });
    rewardItems(where, quest.reward?.items);
    for (const skill of Object.keys(quest.reward?.xp ?? {})) {
      if (!skills.has(skill)) err(`${where}: rewards XP in unknown skill "${skill}"`);
    }
  }

  for (const ach of ACHIEVEMENT_CATALOG) {
    condition(`achievement "${ach.id}"`, ach.condition);
    rewardItems(`achievement "${ach.id}"`, ach.reward?.items);
  }

  return errors;
}
