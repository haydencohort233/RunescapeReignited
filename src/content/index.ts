import type { GameContent } from "../engine/types";
import { BUILDING_CATALOG } from "./buildings";
import { ITEM_CATALOG } from "./items";
import { QUEST_CATALOG } from "./quests";

/** The content bundle handed to every GameEngine the app creates. */
export const GAME_CONTENT: GameContent = {
  buildings: BUILDING_CATALOG,
  items: ITEM_CATALOG,
  quests: QUEST_CATALOG,
};
