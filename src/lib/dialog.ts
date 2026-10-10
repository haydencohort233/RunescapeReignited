// In-page dialogs, used instead of window.confirm and file downloads.
// Those native APIs are blocked in some embedded/sandboxed hosts (where
// confirm() silently returns false), and an in-page dialog looks like the
// rest of the game anyway. Framework-agnostic: DialogHost renders whatever
// is pending here.

export type DialogRequest =
  | {
      kind: "confirm";
      message: string;
      confirmLabel: string;
      danger: boolean;
      resolve: (ok: boolean) => void;
    }
  | { kind: "text"; title: string; message: string; text: string; resolve: () => void };

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
  // A newer question replaces an unanswered one, which counts as "no".
  if (current?.kind === "confirm") current.resolve(false);
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
