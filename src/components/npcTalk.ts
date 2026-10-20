import type { GameEngine } from "../engine/gameEngine";
import type { NpcDefinition, QuestDefinition } from "../engine/types";
import { QUEST_CATALOG } from "../content/quests";
import { getItemDef } from "../content/items";
import { resourceName } from "../content/display";
import { formatNumber } from "../engine/format";
import { backToTown, showDialogue, type DialogueOption, type Speaker } from "../lib/dialog";

export function speakerOf(npc: NpcDefinition): Speaker {
  return { name: npc.name, title: npc.title, portrait: npc.portrait };
}

/** Lines still to come from each list, so a list shows every line once
 *  (in a random order) before any repeats. Keyed by the list itself. */
const unshown = new WeakMap<string[], number[]>();
let lastShown: string | undefined;

/** The next line from `lines`, cycling through them all. */
export function nextLine(lines: string[] | undefined, fallback: string): string {
  if (!lines || lines.length === 0) return fallback;
  let left = unshown.get(lines);
  if (!left || left.length === 0) {
    left = lines.map((_, i) => i).sort(() => Math.random() - 0.5);
    // Don't start a new round with the line that ended the last one.
    if (left.length > 1 && lines[left[0]] === lastShown) left.push(left.shift()!);
    unshown.set(lines, left);
  }
  lastShown = lines[left.shift()!];
  return lastShown;
}

/** What an NPC greets you with: for a quest of theirs you're on, its
 *  current stage's lines (else the quest's); then a quest of theirs you've
 *  done; then their everyday dialogue. Lines live in content/quests.ts. */
export function greetingFor(engine: GameEngine, npc: NpcDefinition): string {
  const quests = questsGivenBy(npc.id);
  for (const quest of quests) {
    if (engine.getQuestStatus(quest.id) !== "in-progress") continue;
    const stage = quest.stages[engine.getState().quests[quest.id].stage];
    const lines = stage?.lines ?? quest.inProgressLines;
    if (lines?.length) return nextLine(lines, "");
  }
  // The latest quest in the catalog that's done and has lines.
  const done = quests.filter((q) => engine.getQuestStatus(q.id) === "completed" && q.completedLines?.length).pop();
  if (done) return nextLine(done.completedLines, "");
  return nextLine(npc.dialogue, "Hello.");
}

/** Quests this NPC gives out. */
export function questsGivenBy(npcId: string): QuestDefinition[] {
  return QUEST_CATALOG.filter((q) => q.giverNpcId === npcId);
}

/** A reply in the conversation menu, and what happens when it's picked:
 *  the NPC's next line, or null to end the conversation. */
interface Reply {
  option: DialogueOption;
  run: () => Promise<string | null>;
}

/** "Smelt 5 bars." -> "smelt 5 bars." for "You still need to ...". */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The quest offer: the giver's pitch, then questions the player can ask
 *  (each answered once) until they agree or turn it down. Resolves the
 *  giver's next line, or null if the player walked away. */
async function offerQuest(engine: GameEngine, npc: NpcDefinition, quest: QuestDefinition): Promise<string | null> {
  const speaker = speakerOf(npc);
  let line = quest.startLine ?? quest.description;
  let unasked = quest.questions ?? [];
  for (;;) {
    const choice = await showDialogue(speaker, line, [
      { label: "I'll help.", tag: "quest" },
      ...unasked.map((q) => q.ask),
      "Not right now.",
    ]);
    if (choice === null) return null;
    if (choice === 0) {
      if (!engine.startQuest(quest.id)) return "Not just yet, I think.";
      if (quest.acceptLine) return quest.acceptLine;
      // A first step that's already done moves the quest on at once.
      const now = quest.stages[engine.getState().quests[quest.id]?.stage ?? 0];
      return now ? `Thank you. You'll need to ${lowerFirst(now.description)}` : "Thank you.";
    }
    if (choice === unasked.length + 1) return "Very well. You know where to find me.";
    const asked = unasked[choice - 1];
    unasked = unasked.filter((q) => q !== asked);
    line = asked.answer;
  }
}

function questReplies(engine: GameEngine, npc: NpcDefinition): Reply[] {
  const speaker = speakerOf(npc);
  const replies: Reply[] = [];
  for (const quest of questsGivenBy(npc.id)) {
    const status = engine.getQuestStatus(quest.id);
    if (status === "not-started") {
      if (!engine.canStartQuest(quest.id)) continue;
      replies.push({ option: { label: `Ask about ${quest.name}`, tag: "quest" }, run: () => offerQuest(engine, npc, quest) });
    } else if (status === "in-progress") {
      const stage = quest.stages[engine.getState().quests[quest.id].stage];
      if (stage.consumes && engine.isQuestStageMet(quest.id)) {
        const plural = (name: string, n: number) => (n === 1 || name.endsWith("s") ? name : `${name}s`);
        const items = stage.consumes.map((c) => `${formatNumber(c.amount)} ${plural(resourceName(c.resource), c.amount)}`).join(", ");
        replies.push({
          option: { label: `Hand over ${items}`, tag: "quest" },
          run: async () => {
            if (!engine.advanceQuest(quest.id)) return "That's not quite everything.";
            if (engine.getQuestStatus(quest.id) === "completed") {
              // The giver's last word; the quest complete scroll follows
              // once the conversation closes (QuestCompleteWatcher).
              await showDialogue(speaker, quest.completeLine ?? "Thank you. This is for you.");
              return null;
            }
            const next = quest.stages[engine.getState().quests[quest.id].stage];
            return `Thank you. Now you'll need to ${lowerFirst(next.description)}`;
          },
        });
      } else {
        replies.push({
          option: { label: `About ${quest.name}...`, tag: "quest" },
          run: async () => `You still need to ${lowerFirst(stage.description)}`,
        });
      }
    }
  }
  return replies;
}

function rechargeReply(engine: GameEngine, npc: NpcDefinition): Reply {
  const speaker = speakerOf(npc);
  return {
    option: { label: "Can you recharge my jewellery?" },
    run: async () => {
      const charged = engine.getInventoryItems().filter((i) => getItemDef(i.itemDefId)?.maxCharges !== undefined);
      const needing = charged.filter((i) => engine.getRechargeCost(i.instanceId) > 0);
      if (needing.length === 0) {
        return charged.length === 0 ? "You've nothing for me to charge, dearie." : "Those are full already. Come back when they're spent.";
      }
      const total = needing.reduce((sum, i) => sum + engine.getRechargeCost(i.instanceId), 0);
      const yes = await showDialogue(speaker, `That'll be ${total.toLocaleString()} GP for the lot.`, ["Here you go.", "That's too much."]);
      if (yes === 0) {
        if (engine.getOwnedCount("gp") < total) return "You don't have the coin, dearie. Come back when you do.";
        for (const i of needing) engine.rechargeItem(npc, i.instanceId);
        return "There. Good as new, more or less.";
      }
      return yes === 1 ? "Your loss." : null;
    },
  };
}

/** Talks to an NPC: their greeting, then a menu of replies (quests they
 *  give, hand-ins, services) until the player says goodbye, which closes
 *  every open panel and leaves them at the town picture. */
export async function talkTo(engine: GameEngine, npc: NpcDefinition, greeting = greetingFor(engine, npc)): Promise<void> {
  let line = greeting;
  for (;;) {
    const replies = [...questReplies(engine, npc), ...(npc.services?.includes("recharge") ? [rechargeReply(engine, npc)] : [])];
    const choice = await showDialogue(speakerOf(npc), line, replies.map((r) => r.option));
    const next = choice === null ? null : await replies[choice].run();
    if (next === null) {
      backToTown();
      return;
    }
    line = next;
  }
}
