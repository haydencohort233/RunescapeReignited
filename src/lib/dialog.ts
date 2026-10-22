// In-page dialogs, used instead of window.confirm and file downloads.
// Those native APIs are blocked in some embedded/sandboxed hosts (where
// confirm() silently returns false), and an in-page dialog looks like the
// rest of the game anyway. Framework-agnostic: DialogHost renders whatever
// is pending here.

import type { AwaySummary } from "../engine/awaySummary";

/** One side of a "switch activity?" prompt: what's running, or what's next. */
export interface ActivityPreview {
  kind: "craft" | "gather" | "travel" | "combat";
  /** Skill icon to show (craft/gather). */
  skill?: string;
  title: string;
  /** "12 gathered · 4m in", "~19s trip". */
  detail?: string;
}

/** Who is talking: a name, plus a title and an emoji chat head for NPCs. */
export interface Speaker {
  name: string;
  title?: string;
  portrait?: string;
}

/** A reply the player can pick. `tag` marks quest replies with a Q. */
export interface DialogueOption {
  label: string;
  tag?: "quest";
}

/** One line of a conversation so far, shown above the newest line. */
export interface ConversationTurn {
  who: "npc" | "you";
  text: string;
}

export type DialogRequest =
  | { kind: "switch"; from: ActivityPreview; to: ActivityPreview; resolve: (ok: boolean) => void }
  | {
      kind: "confirm";
      message: string;
      confirmLabel: string;
      danger: boolean;
      resolve: (ok: boolean) => void;
    }
  | { kind: "text"; title: string; message: string; text: string; resolve: () => void }
  | {
      kind: "dialogue";
      speaker: Speaker;
      line: string;
      options: DialogueOption[];
      /** Earlier lines of this conversation, oldest first (not `line`). */
      history: ConversationTurn[];
      resolve: (choice: number | null) => void;
    }
  | {
      kind: "questComplete";
      questName: string;
      /** "300 GP", "200 Attack XP". */
      rewards: string[];
      resolve: () => void;
    }
  | { kind: "away"; summary: AwaySummary; resolve: () => void }
  | {
      kind: "quantity";
      message: string;
      max: number;
      confirmLabel: string;
      resolve: (quantity: number | null) => void;
    };

let current: DialogRequest | null = null;
const listeners = new Set<() => void>();

function set(next: DialogRequest | null): void {
  current = next;
  listeners.forEach((l) => l());
}

export function getDialog(): DialogRequest | null {
  return current;
}

export function subscribeDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Resolves true if the player confirms, false if they cancel. */
export function requestConfirm(
  message: string,
  opts: { confirmLabel?: string; danger?: boolean } = {}
): Promise<boolean> {
  cancelPending();
  return new Promise((resolve) =>
    set({
      kind: "confirm",
      message,
      confirmLabel: opts.confirmLabel ?? "Continue",
      danger: opts.danger ?? false,
      resolve: (ok) => {
        set(null);
        resolve(ok);
      },
    })
  );
}

/** "Stop what you're doing and start this instead?" Resolves true to
 *  switch, false to keep going. */
export function requestSwitch(from: ActivityPreview, to: ActivityPreview): Promise<boolean> {
  cancelPending();
  return new Promise((resolve) =>
    set({
      kind: "switch",
      from,
      to,
      resolve: (ok) => {
        set(null);
        resolve(ok);
      },
    })
  );
}

/** Asks "how many?", from 1 to `max`. Resolves null if cancelled. */
export function requestQuantity(
  message: string,
  max: number,
  opts: { confirmLabel?: string } = {}
): Promise<number | null> {
  cancelPending();
  return new Promise((resolve) =>
    set({
      kind: "quantity",
      message,
      max,
      confirmLabel: opts.confirmLabel ?? "OK",
      resolve: (quantity) => {
        set(null);
        resolve(quantity);
      },
    })
  );
}

/** A newer question replaces an unanswered one, which counts as "no". */
function cancelPending(): void {
  if (current?.kind === "confirm" || current?.kind === "switch") current.resolve(false);
  else if (current?.kind === "quantity" || current?.kind === "dialogue") current.resolve(null);
  else if (current?.kind === "questComplete" || current?.kind === "away") current.resolve();
}

/** The conversation that just had a reply picked: if the same speaker says
 *  something straight after, it carries on in the same window. */
let lastTalk: { speaker: string; history: ConversationTurn[] } | null = null;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

/** An NPC says a line; the player picks one of `options` (resolves its
 *  index) or walks away (null). With no options there's just "Goodbye".
 *  Calls made right after a reply, to the same speaker, read as one
 *  conversation: the window stays open and keeps what was said. */
export function showDialogue(
  speaker: string | Speaker,
  line: string,
  options: (string | DialogueOption)[] = []
): Promise<number | null> {
  const who: Speaker = typeof speaker === "string" ? { name: speaker } : speaker;
  const opts: DialogueOption[] = options.map((o) => (typeof o === "string" ? { label: o } : o));
  clearTimeout(closeTimer);
  const history = lastTalk && lastTalk.speaker === who.name ? lastTalk.history : [];
  lastTalk = null;
  cancelPending();
  return new Promise((resolve) => {
    let done = false;
    const request: DialogRequest = {
      kind: "dialogue",
      speaker: who,
      line,
      options: opts,
      history,
      resolve: (choice) => {
        if (done) return;
        done = true;
        const picked = choice === null ? undefined : opts[choice];
        if (!picked) {
          // Walked away: close now.
          set(null);
          resolve(choice);
          return;
        }
        lastTalk = { speaker: who.name, history: [...history, { who: "npc", text: line }, { who: "you", text: picked.label }] };
        // Leave the window up for a moment in case the speaker replies.
        closeTimer = setTimeout(() => {
          lastTalk = null;
          if (current === request) set(null);
        }, 0);
        resolve(choice);
      },
    };
    set(request);
  });
}

/** Asks every open panel (a building opened from the town scene, say) to
 *  close, so the player is back at the town picture. Sent when a
 *  conversation ends and when a quest completes. */
const backToTownListeners = new Set<() => void>();

export function backToTown(): void {
  backToTownListeners.forEach((l) => l());
}

export function subscribeBackToTown(listener: () => void): () => void {
  backToTownListeners.add(listener);
  return () => backToTownListeners.delete(listener);
}

const openHouseListeners = new Set<() => void>();

/** Steps through the house portal: Home shows the house instead of the
 *  town picture. */
export function openHouse(): void {
  openHouseListeners.forEach((l) => l());
}

export function subscribeOpenHouse(listener: () => void): () => void {
  openHouseListeners.add(listener);
  return () => openHouseListeners.delete(listener);
}

/** The "Quest complete!" scroll: the quest's name and what it awarded.
 *  Closes whatever else is open first. */
export function showQuestComplete(questName: string, rewards: string[]): Promise<void> {
  cancelPending();
  backToTown();
  return new Promise((resolve) =>
    set({
      kind: "questComplete",
      questName,
      rewards,
      resolve: () => {
        set(null);
        resolve();
      },
    })
  );
}

/** "While you were away": what changed since the player left. */
export function showAwaySummary(summary: AwaySummary): Promise<void> {
  cancelPending();
  return new Promise((resolve) =>
    set({
      kind: "away",
      summary,
      resolve: () => {
        set(null);
        resolve();
      },
    })
  );
}

/** Shows a block of text the player can copy (e.g. an exported save). */
export function showText(title: string, message: string, text: string): Promise<void> {
  return new Promise((resolve) =>
    set({
      kind: "text",
      title,
      message,
      text,
      resolve: () => {
        set(null);
        resolve();
      },
    })
  );
}
