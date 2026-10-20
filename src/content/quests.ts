import type { QuestDefinition } from "../engine/types";

// Quests are ordered stages over the same UnlockCondition language
// everything else uses. Stages without `consumes` complete on their own;
// stages with it need the player to hand the items over.
//
// What the giver greets you with depends on the quest: a stage's `lines`
// while you're on it, else `inProgressLines`, then `completedLines` once
// it's done (their usual `dialogue` before you start). Each list shows
// every line once, in a random order, before any repeats. Add or edit
// lines freely; any number works.
export const QUEST_CATALOG: QuestDefinition[] = [
  {
    id: "overgrown-den",
    name: "The Overgrown Den",
    description: "Something is living in the den at the Dark Forest. The town wants to know what.",
    locationId: "town",
    giverNpcId: "hans",
    startLine: "There's something living in the old den in the Dark Forest. The guards won't go near it. Could you take a look?",
    acceptLine: "Thank you. Be careful out there, and bring back some proof of what you find.",
    completeLine: "Bones... so it was goblins after all. I'll let the guards know. Here, for your trouble.",
    // Proposed: Hans's greetings while the quest is on, and after.
    inProgressLines: [
      "Any news from the den? The guards keep asking me.",
      "Be careful in the Dark Forest. Whatever's in that den has scared off braver folk than me.",
      "Bring back proof, mind. The Duke won't take my word for it.",
      "I'd go myself, but these old legs aren't what they were.",
      "Still in one piece? Good. How goes it at the den?",
    ],
    completedLines: [
      "Goblins in the den. Who'd have thought? The guards are sleeping easier, at least.",
      "Thanks again for clearing out that den. The Duke was most pleased.",
      "Ah, the hero of the Dark Forest. Lovely day for a stroll, isn't it?",
      "The guards say they owe you a drink. Good luck getting them to pay.",
      "It's been quiet since you dealt with those goblins. I like quiet.",
    ],
    stages: [
      {
        description: "Travel to the Dark Forest.",
        objective: { kind: "flag", flag: "visited:dark-forest", label: "Travel to the Dark Forest" },
      },
      {
        description: "Defeat 3 goblins near the den.",
        objective: { kind: "statisticAtLeast", statistic: "kills:goblin", atLeast: 3 },
      },
      {
        description: "Bring 5 bones back as proof.",
        objective: { kind: "resourceAtLeast", resource: "bones", amount: 5 },
        consumes: [{ resource: "bones", amount: 5 }],
      },
    ],
    // investigatedDen is what the "Something's Living in the Den" job
    // waits on.
    reward: { gp: 300, xp: { attack: 200 }, setFlags: ["investigatedDen"] },
  },
  {
    // Proposed: a small Mining and Smithing starter quest, added to try out
    // quest markers on the world map.
    id: "quarry-masters-order",
    name: "The Quarry Master's Order",
    description: "The quarry master is short on bronze for new tools and will pay well for help.",
    locationId: "quarry",
    giverNpcId: "doric",
    startLine: "I'm out of bronze, and these picks won't make themselves. Smelt me five bronze bars and I'll pay you for them.",
    acceptLine: "Good. There's a furnace in Riverside Town. Bring the bars here when they're done.",
    completeLine: "Good, solid bars. That'll keep the forge busy for a while. Here's your pay.",
    // Proposed: Doric's greetings while the quest is on, and after.
    inProgressLines: [
      "Got those bars yet? The forge is going cold.",
      "One copper and one tin for each bar. Even a goblin could manage it.",
      "The furnace is in Riverside Town. Don't tell me you've lost your way.",
      "These picks won't make themselves. Neither will the bars.",
      "Five bronze bars. Not four, not six. Five.",
    ],
    completedLines: [
      "Those bars made fine picks. Good work.",
      "Back again? The forge has been busy thanks to you.",
      "Good rock down here, and good bronze too, now.",
      "If you ever want honest work, there's always rock to break.",
      "Still swinging that pickaxe? Good. Keeps you strong.",
    ],
    stages: [
      {
        description: "Smelt 5 bronze bars at a furnace.",
        objective: { kind: "statisticAtLeast", statistic: "crafted:smelt-bronze-bar", atLeast: 5 },
      },
      {
        description: "Bring the quarry master 5 bronze bars.",
        objective: { kind: "resourceAtLeast", resource: "bronze-bar", amount: 5 },
        consumes: [{ resource: "bronze-bar", amount: 5 }],
      },
    ],
    reward: { gp: 250, xp: { mining: 150, smithing: 150 } },
  },
  {
    // Proposed: a short stand-in for OSRS's Prince Ali Rescue. Its reward
    // is free passage through the Al-Kharid toll gate.
    id: "prince-ali-rescue",
    name: "Prince Ali Rescue",
    description: "Leela in Draynor needs help freeing Prince Ali. The guards at the Al-Kharid gate will let you through for free afterwards.",
    locationId: "draynor-village",
    giverNpcId: "leela",
    startLine: "I need help. Prince Ali of Al-Kharid has been kidnapped by Lady Keli, and I can't free him alone.",
    // Adapted from OSRS's Prince Ali Rescue.
    questions: [
      {
        ask: "Who is Prince Ali?",
        answer: "He's the son of the Emir of Al-Kharid, and a good friend of mine. He was taken while visiting Draynor.",
      },
      {
        ask: "Who is Lady Keli?",
        answer: "A rather unpleasant woman who runs with a gang of thugs. She's holding him in a cell near the village.",
      },
      {
        ask: "What do you need me to do?",
        answer: "Go to Al-Kharid, so the Emir's guards know you're working with us. Then bring me some bronze, so I can have a key made for the prince's cell.",
      },
      {
        ask: "What's in it for me?",
        answer: "The Emir pays his debts. And his guards will let you through the gate without the toll from then on.",
      },
    ],
    acceptLine: "Thank you! Head to Al-Kharid first. You'll need coins for the gate toll.",
    completeLine: "The prince is free! Al-Kharid owes you a great deal. Show this to the gate guards and they'll wave you through.",
    // Proposed: Leela's greetings after the quest. While it's on, each
    // step has its own (below).
    completedLines: [
      "Thank you so much for helping Prince Ali. I hope you enjoy your free gate passage.",
      "The prince is safe home in Al-Kharid. I still can't quite believe it.",
      "Lady Keli is furious, I hear. Good.",
      "The gate guards know your face now. No more tolls for you.",
      "Al-Kharid won't forget what you did, and neither will I.",
    ],
    stages: [
      {
        description: "Pay the toll and travel to Al-Kharid.",
        objective: { kind: "flag", flag: "visited:al-kharid", label: "Travel to Al-Kharid" },
        lines: [
          "Have you informed the guards yet? Please hurry.",
          "The Emir's guards in Al-Kharid need to know you're working with us.",
          "You'll need coins for the gate toll. The guards won't let you through without it.",
          "Every day Lady Keli holds him is a day too long.",
          "Keep your voice down. Keli's thugs are all over Draynor.",
        ],
      },
      {
        description: "Bring Leela 3 bronze bars to make a key for the prince's cell.",
        objective: { kind: "resourceAtLeast", resource: "bronze-bar", amount: 3 },
        consumes: [{ resource: "bronze-bar", amount: 3 }],
        lines: [
          "Did you bring the bronze? I need three bars for the key.",
          "Three bronze bars, and I can have a copy of the cell key made.",
          "Copper and tin make bronze. Any furnace will do.",
          "The guards in Al-Kharid are ready. Now we just need that key.",
          "Hurry with the bronze. Keli won't keep him in Draynor forever.",
        ],
      },
    ],
    reward: { gp: 300, setFlags: ["princeAliRescued"] },
    rewardNotes: ["Free passage through the Al-Kharid gate"],
  },
];

export function getQuest(id: string): QuestDefinition | undefined {
  return QUEST_CATALOG.find((q) => q.id === id);
}
