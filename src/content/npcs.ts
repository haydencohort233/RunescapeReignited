import type { NpcDefinition } from "../engine/types";

/** The starting tools every save gets once (see GameEngine.grantStarterKit). */
export const STARTER_KIT = ["bronze-axe", "bronze-pickaxe", "fishing-net", "tinderbox"];

export const NPC_CATALOG: NpcDefinition[] = [
  {
    id: "aggie",
    name: "Aggie",
    locationId: "draynor-village",
    dialogue: [
      "What can I do for you, dearie? Got an amulet that's lost its spark?",
      "Charges don't come back on their own, you know. That's what I'm for.",
      "Mind the bank on your way out. Something odd about that place.",
    ],
    services: ["recharge"],
  },
];

const NPCS_BY_ID = new Map(NPC_CATALOG.map((n) => [n.id, n]));

export function getNpc(id: string): NpcDefinition | undefined {
  return NPCS_BY_ID.get(id);
}
