import type { RecipeInput, UnlockCondition } from "../engine/types";
import { MIN_ATTACK_SPEED_MS } from "../engine/tuning";
import { ITEM_CATALOG } from "./items";
import { BUILDING_CATALOG } from "./buildings";
import { RECIPE_CATALOG } from "./recipes";
import { ENEMY_CATALOG } from "./enemies";
import { MAP_LOCATIONS, MAP_WIDTH, MAP_HEIGHT } from "./mapLocations";
import { ROADS } from "./roads";
import { unreachableLocations } from "../engine/roads";
import { STARTING_LOCATION_ID } from "../engine/state";
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
import { FLOOR_CATALOG, FRONT_CATALOG, FURNITURE_CATALOG, GROUND_CATALOG, HOUSE_PORTAL_LOCATIONS, PATH_CATALOG, ROOF_CATALOG, RUG_CATALOG, SERVANT_CATALOG, SKIN_CATALOG, SKY_CATALOG, WALLPAPER_CATALOG } from "./house";
import { HOUSE_FLOOR_COLS, HOUSE_FLOOR_ROWS, HOUSE_WALL_COLS, HOUSE_WALL_ROWS } from "../engine/tuning";

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
    if (r.output) amounts(where, [r.output]);
    else if (r.inputs.length === 0) err(`${where}: a gathering recipe needs an output`);
    for (const d of r.bonusDrops ?? []) {
      ledgerId(where, d.resource);
      if (!(d.amount > 0)) err(`${where}: bonus drop amount must be > 0`);
      if (!(d.chance > 0 && d.chance <= 1)) err(`${where}: bonus drop chance must be in (0, 1]`);
    }
    if (r.unlockCondition) condition(where, r.unlockCondition);
    if (r.tool && !ITEM_CATALOG.some((i) => i.tool?.type === r.tool)) err(`${where}: no item is a "${r.tool}" tool`);
    if (
      r.station &&
      !AMENITY_CATALOG.some((a) => a.kind === "craftingStation" && a.station === r.station) &&
      !FURNITURE_CATALOG.some((f) => f.station === r.station)
    ) {
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
    amounts(`location "${loc.id}" travel cost`, loc.travelCost);
    if (!(loc.x >= 0 && loc.x <= MAP_WIDTH && loc.y >= 0 && loc.y <= MAP_HEIGHT)) err(`location "${loc.id}": off the map`);
  }

  const roadPairs = new Set<string>();
  for (const road of ROADS) {
    const where = `road "${road.from}" - "${road.to}"`;
    if (!locations.has(road.from)) err(`${where}: unknown location "${road.from}"`);
    if (!locations.has(road.to)) err(`${where}: unknown location "${road.to}"`);
    if (road.from === road.to) err(`${where}: a road can't end where it starts`);
    const pair = [road.from, road.to].sort().join("|");
    if (roadPairs.has(pair)) err(`${where}: duplicate road`);
    roadPairs.add(pair);
    if (road.requires) condition(where, road.requires);
    for (const p of road.via ?? []) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) err(`${where}: waypoint is not a number`);
    }
  }
  for (const id of unreachableLocations(MAP_LOCATIONS, ROADS, STARTING_LOCATION_ID)) {
    err(`location "${id}": no road leads there from the start`);
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
    if (job.requirement) condition(where, job.requirement);
    amounts(where, job.consumesOnTurnIn);
    rewardItems(where, job.reward?.items);
  }

  for (const quest of QUEST_CATALOG) {
    const where = `quest "${quest.id}"`;
    if (quest.stages.length === 0) err(`${where}: has no stages`);
    if (quest.locationId && !locations.has(quest.locationId)) err(`${where}: unknown location "${quest.locationId}"`);
    if (quest.giverNpcId) {
      const giver = NPC_CATALOG.find((n) => n.id === quest.giverNpcId);
      if (!giver) err(`${where}: unknown giver "${quest.giverNpcId}"`);
      else if (giver.locationId !== quest.locationId) err(`${where}: giver "${giver.id}" isn't at the quest's location`);
    }
    if (quest.startCondition) condition(where, quest.startCondition);
    quest.stages.forEach((stage, i) => {
      condition(`${where} stage ${i + 1}`, stage.objective);
      amounts(`${where} stage ${i + 1}`, stage.consumes);
      if (stage.lines?.some((l) => !l.trim())) err(`${where} stage ${i + 1}: has an empty line`);
    });
    for (const lines of [quest.inProgressLines, quest.completedLines]) {
      if (lines?.some((l) => !l.trim())) err(`${where}: has an empty greeting line`);
    }
    rewardItems(where, quest.reward?.items);
    for (const skill of Object.keys(quest.reward?.xp ?? {})) {
      if (!skills.has(skill)) err(`${where}: rewards XP in unknown skill "${skill}"`);
    }
  }

  // The player house.
  const furniture = ids("furniture", FURNITURE_CATALOG);
  const skins = ids("furniture skins", SKIN_CATALOG);
  ids("wallpapers", WALLPAPER_CATALOG);
  ids("floors", FLOOR_CATALOG);
  ids("rugs", RUG_CATALOG);
  if (WALLPAPER_CATALOG.length === 0) err("house: needs at least one wallpaper");
  if (FLOOR_CATALOG.length === 0) err("house: needs at least one floor");
  for (const c of [...WALLPAPER_CATALOG, ...FLOOR_CATALOG, ...RUG_CATALOG]) {
    if (c.art && (c.art !== c.art.toLowerCase() || c.art.includes("-"))) err(`room look "${c.id}": art names are lowercase with underscores`);
  }
  if (RUG_CATALOG.length === 0) err("house: needs at least one rug");
  for (const [what, list] of [["house fronts", FRONT_CATALOG], ["roofs", ROOF_CATALOG], ["grounds", GROUND_CATALOG], ["skies", SKY_CATALOG]] as const) {
    ids(what, list);
    if (list.length === 0) err(`house: needs at least one of ${what}`);
    for (const c of list) if (c.colors.length < 2) err(`${what} "${c.id}": needs at least two colours to draw`);
  }
  ids("paths", PATH_CATALOG);
  for (const p of PATH_CATALOG) {
    amounts(`path "${p.id}"`, p.cost);
    if (!(p.levelRequired >= 1 && p.levelRequired <= 99)) err(`path "${p.id}": levelRequired must be 1 to 99`);
    if (p.colors.length < 2) err(`path "${p.id}": needs a fill and an edge colour`);
  }
  const achievements = new Set(ACHIEVEMENT_CATALOG.map((a) => a.id));
  for (const f of FURNITURE_CATALOG) {
    const where = `furniture "${f.id}"`;
    amounts(where, f.cost);
    if (f.cost.length === 0) err(`${where}: needs a cost`);
    if (!(f.buildTimeMs > 0)) err(`${where}: buildTimeMs must be > 0`);
    if (!(f.xp >= 0)) err(`${where}: xp must be >= 0`);
    if (!(f.levelRequired >= 1 && f.levelRequired <= 99)) err(`${where}: levelRequired must be 1 to 99`);
    if (!Number.isInteger(f.width) || !Number.isInteger(f.depth) || f.width < 1 || f.depth < 1) err(`${where}: width and depth must be whole cells`);
    const [cols, rows] = f.slot === "wall" ? [HOUSE_WALL_COLS, HOUSE_WALL_ROWS] : [HOUSE_FLOOR_COLS, HOUSE_FLOOR_ROWS];
    if (f.art !== undefined && (f.art !== f.art.toLowerCase() || f.art.includes("-") || f.art.endsWith(".png"))) err(`${where}: art is a lowercase file name with underscores, without .png`);
    if (f.surfaceAt !== undefined && !(f.surfaceAt >= 0 && f.surfaceAt <= 1)) err(`${where}: surfaceAt must be between 0 and 1`);
    if (f.slot === "rug" && (f.surfaceSlots || f.station)) err(`${where}: a rug can't hold things or be a station`);
    if (f.slot !== "surface" && (Math.max(f.width, f.depth) > Math.max(cols, rows) || f.width > cols || f.depth > rows)) err(`${where}: too big for the room`);
    if (f.slot !== "floor" && f.facings && f.facings.some((x) => x !== "front")) err(`${where}: only floor pieces rotate`);
    if (f.facings && f.facings.length === 0) err(`${where}: facings can't be empty (leave it out for all four)`);
    if (f.slot === "surface" && f.surfaceSlots) err(`${where}: a surface piece can't hold others`);
    if (f.station && f.kind !== "facility") err(`${where}: a crafting station must be a facility`);
    if (f.areas && (f.areas.length === 0 || f.areas.some((x) => x !== "inside" && x !== "yard"))) err(`${where}: areas must list "inside" and/or "yard"`);
    if (f.slot === "wall" && f.areas?.includes("yard")) err(`${where}: wall pieces hang inside only`);
    if (f.offlineCapBonusMs && f.areas?.includes("yard")) err(`${where}: beds only count inside`);
    if (f.connects && (f.slot !== "floor" || f.width !== 1 || f.depth !== 1 || f.facings)) err(`${where}: connecting pieces are 1x1 floor pieces that don't turn`);
    if (f.offlineCapBonusMs !== undefined && !(f.offlineCapBonusMs > 0)) err(`${where}: offlineCapBonusMs must be > 0`);
    for (const id of f.skins ?? []) {
      const skin = SKIN_CATALOG.find((x) => x.id === id);
      if (!skin) err(`${where}: unknown skin "${id}"`);
      else if (skin.furnitureId !== f.id) err(`${where}: skin "${id}" belongs to "${skin.furnitureId}"`);
    }
  }
  for (const skin of SKIN_CATALOG) {
    const where = `furniture skin "${skin.id}"`;
    if (!furniture.has(skin.furnitureId)) err(`${where}: unknown furniture "${skin.furnitureId}"`);
    else if (!FURNITURE_CATALOG.find((f) => f.id === skin.furnitureId)?.skins?.includes(skin.id)) err(`${where}: its furniture doesn't list it`);
    if (skin.art !== skin.art.toLowerCase() || skin.art.includes("-")) err(`${where}: art names are lowercase with underscores`);
    const src = skin.unlockSource;
    if (src.kind === "achievement" && !achievements.has(src.achievementId)) err(`${where}: unknown achievement "${src.achievementId}"`);
    if (src.kind === "drop" && !enemies.has(src.enemyId)) err(`${where}: unknown enemy "${src.enemyId}"`);
    if (src.kind === "shop" && !shops.has(src.shopId)) err(`${where}: unknown shop "${src.shopId}"`);
  }
  void skins;
  for (const id of HOUSE_PORTAL_LOCATIONS) {
    if (!locations.has(id)) err(`house portal: unknown location "${id}"`);
    if (!AMENITY_CATALOG.some((a) => a.kind === "housePortal" && a.locationId === id)) err(`house portal at "${id}": no House Portal amenity there`);
  }
  for (const a of AMENITY_CATALOG) {
    if (a.kind === "housePortal" && !HOUSE_PORTAL_LOCATIONS.includes(a.locationId)) err(`amenity "${a.id}": not a house portal location in content/house.ts`);
  }
  ids("servants", SERVANT_CATALOG);
  for (const sv of SERVANT_CATALOG) {
    const where = `servant "${sv.id}"`;
    if (!(sv.levelRequired >= 1 && sv.levelRequired <= 99)) err(`${where}: levelRequired must be 1 to 99`);
    if (!(sv.rateShare > 0 && sv.rateShare <= 1)) err(`${where}: rateShare must be above 0 and at most 1`);
    if (!(sv.wagePerSecond >= 0)) err(`${where}: wagePerSecond must be >= 0`);
    if (!Number.isInteger(sv.orderLimit) || sv.orderLimit < 1) err(`${where}: orderLimit must be a whole number >= 1`);
    if (!(sv.hireCostGp >= 0)) err(`${where}: hireCostGp must be >= 0`);
  }
  if (SERVANT_CATALOG.length > 0 && !NPC_CATALOG.some((n) => n.services?.includes("servants"))) err("servants: no NPC hires them (services: [\"servants\"])");

  for (const ach of ACHIEVEMENT_CATALOG) {
    condition(`achievement "${ach.id}"`, ach.condition);
    rewardItems(`achievement "${ach.id}"`, ach.reward?.items);
  }

  return errors;
}
