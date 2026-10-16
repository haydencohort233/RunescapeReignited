// In-page dialogs, used instead of window.confirm and file downloads.
// Those native APIs are blocked in some embedded/sandboxed hosts (where
// confirm() silently returns false), and an in-page dialog looks like the
// rest of the game anyway. Framework-agnostic: DialogHost renders whatever
// is pending here.

/** One side of a "switch activity?" prompt: what's running, or what's next. */
export interface ActivityPreview {
  kind: "craft" | "gather" | "travel" | "combat";
  /** Skill icon to show (craft/gather). */
  skill?: string;
  title: string;
  /** "12 gathered · 4m in", "~19s trip". */
  detail?: string;
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
      speaker: string;
      line: string;
      options: string[];
      resolve: (choice: number | null) => void;
    }
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
}

/** An NPC says a line; the player picks one of `options` (resolves its
 *  index) or walks away (null). With no options there's just "Goodbye". */
export function showDialogue(speaker: string, line: string, options: string[] = []): Promise<number | null> {
  cancelPending();
  return new Promise((resolve) =>
    set({
      kind: "dialogue",
      speaker,
      line,
      options,
      resolve: (choice) => {
        set(null);
        resolve(choice);
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
