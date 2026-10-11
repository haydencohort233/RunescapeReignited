import type { GameContent } from "../engine/types";
import { BUILDING_CATALOG } from "./buildings";
import { ITEM_CATALOG } from "./items";
import { QUEST_CATALOG } from "./quests";
import { SHOP_CATALOG } from "./shops";
import { NPC_CATALOG, STARTER_KIT } from "./npcs";
import { SPELL_CATALOG } from "./spells";
import { AMENITY_CATALOG } from "./amenities";
import type { StationType } from "../engine/types";

const stationLocations: Partial<Record<StationType, string[]>> = {};
for (const a of AMENITY_CATALOG) {
  if (a.kind === "craftingStation") (stationLocations[a.station] ??= []).push(a.locationId);
}

/** The content bundle handed to every GameEngine the app creates. */
export const GAME_CONTENT: GameContent = {
  buildings: BUILDING_CATALOG,
  items: ITEM_CATALOG,
  quests: QUEST_CATALOG,
  shops: SHOP_CATALOG,
  npcs: NPC_CATALOG,
  spells: SPELL_CATALOG,
  stationLocations,
  starterKit: STARTER_KIT,
};
