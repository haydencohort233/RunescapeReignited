import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getDialog, subscribeDialog } from "../../lib/dialog";

/** Renders the pending in-page dialog (see lib/dialog.ts). Mounted once. */
export function DialogHost() {
  const dialog = useSyncExternalStore(subscribeDialog, getDialog);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
    primaryRef.current?.focus();
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dialog.kind === "confirm") dialog.resolve(false);
      else dialog.resolve();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog]);

  if (!dialog) return null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog card" role="dialog" aria-modal="true">
        {dialog.kind === "confirm" ? (
          <>
            <p>{dialog.message}</p>
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => dialog.resolve(false)}>
                Cancel
              </button>
              <button
                ref={primaryRef}
                type="button"
                className={`btn ${dialog.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => dialog.resolve(true)}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="card-title">{dialog.title}</h3>
            <p className="text-muted">{dialog.message}</p>
            <textarea
              id="dialog-text"
              ref={textRef}
              className="dialog-text"
              readOnly
              value={dialog.text}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(dialog.text)
                    .then(() => setCopied(true))
                    .catch(() => textRef.current?.select());
                  if (!navigator.clipboard) textRef.current?.select();
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button ref={primaryRef} type="button" className="btn btn-primary" onClick={() => dialog.resolve()}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
