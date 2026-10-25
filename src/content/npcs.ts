import type { NpcDefinition } from "../engine/types";

/** The starting tools every save gets once (see GameEngine.grantStarterKit). */
export const STARTER_KIT = ["bronze-axe", "bronze-pickaxe", "fishing-net", "tinderbox"];

export const NPC_CATALOG: NpcDefinition[] = [
  {
    id: "aggie",
    name: "Aggie",
    title: "Witch",
    portrait: "🧙",
    locationId: "draynor-village",
    dialogue: [
      "What can I do for you, dearie? Got an amulet that's lost its spark?",
      "Charges don't come back on their own, you know. That's what I'm for.",
      "Mind the bank on your way out. Something odd about that place.",
    ],
    services: ["recharge"],
  },
  {
    id: "guildmistress-wren",
    name: "Mistress Wren",
    title: "Servants' Guild",
    portrait: "👩‍💼",
    locationId: "draynor-village",
    dialogue: [
      "Looking for help around the house? Every one of mine is trained, bonded and punctual.",
      "Keep their coin pouch full and they'll work while you're off adventuring.",
      "A servant only works what you've built. No range, no cooking. Simple as that.",
      "The demon butler? Oh, he's very good. Just don't ask about his last employer.",
    ],
    services: ["servants"],
  },
  {
    id: "hans",
    name: "Hans",
    title: "Castle servant",
    portrait: "🧔",
    locationId: "town",
    dialogue: [
      "Hello there. Lovely day for a stroll around the castle, isn't it?",
      "I've been walking these grounds for years. Not much gets past me.",
      "The Duke's busy, as always. Anything I can help with?",
    ],
  },
  {
    id: "doric",
    name: "Doric",
    title: "Quarry master",
    portrait: "⛏️",
    locationId: "quarry",
    dialogue: [
      "Mind your head. And your feet. And everything else, really.",
      "Good rock down here, if you know where to swing.",
      "Ah, a fresh face. Come to break some stone?",
    ],
  },
  {
    id: "leela",
    name: "Leela",
    title: "Prince Ali's friend",
    portrait: "👩",
    locationId: "draynor-village",
    dialogue: [
      "Keep your voice down. You never know who's listening around here.",
      "Have you come far? The roads aren't as safe as they used to be.",
      "I'm waiting on word from Al-Kharid. Any day now.",
    ],
  },
];

const NPCS_BY_ID = new Map(NPC_CATALOG.map((n) => [n.id, n]));

export function getNpc(id: string): NpcDefinition | undefined {
  return NPCS_BY_ID.get(id);
}
