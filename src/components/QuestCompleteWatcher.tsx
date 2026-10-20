import { useEffect, useRef, useSyncExternalStore } from "react";
import { useGame } from "../engine/GameEngineContext";
import { QUEST_CATALOG } from "../content/quests";
import { formatReward } from "../content/display";
import { getDialog, showQuestComplete, subscribeDialog } from "../lib/dialog";

/**
 * Shows the "Quest complete!" scroll whenever a quest finishes, however it
 * finished (a hand-in, or a last step that completes on its own). Waits
 * until no other dialog is open, so it never cuts off the giver's last
 * line. Quests already done when the game loads don't count. Mounted once.
 */
export function QuestCompleteWatcher() {
  const { engine, state } = useGame();
  const dialog = useSyncExternalStore(subscribeDialog, getDialog);
  const known = useRef<Set<string> | null>(null);
  const queue = useRef<string[]>([]);

  const done = QUEST_CATALOG.filter((q) => engine.getQuestStatus(q.id) === "completed").map((q) => q.id);
  if (known.current === null) known.current = new Set(done);
  for (const id of done) {
    if (!known.current.has(id)) {
      known.current.add(id);
      queue.current.push(id);
    }
  }
  // A reset quest can be completed (and celebrated) again.
  for (const id of [...known.current]) if (!done.includes(id)) known.current.delete(id);

  useEffect(() => {
    if (dialog || queue.current.length === 0) return;
    const quest = QUEST_CATALOG.find((q) => q.id === queue.current[0]);
    queue.current.shift();
    if (!quest) return;
    const rewards = [...formatReward(quest.reward).split(", ").filter(Boolean), ...(quest.rewardNotes ?? [])];
    void showQuestComplete(quest.name, rewards);
  }, [dialog, state]);

  return null;
}
