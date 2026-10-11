import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getDialog, subscribeDialog, type DialogRequest } from "../../lib/dialog";
import { formatNumber } from "../../engine/format";

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
      else if (dialog.kind === "quantity" || dialog.kind === "dialogue") dialog.resolve(null);
      else dialog.resolve();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog]);

  if (!dialog) return null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog card" role="dialog" aria-modal="true">
        {dialog.kind === "quantity" ? (
          <QuantityPrompt key={dialog.message} dialog={dialog} />
        ) : dialog.kind === "dialogue" ? (
          <>
            <h3 className="card-title">{dialog.speaker}</h3>
            <p className="dialogue-line">{dialog.line}</p>
            <div className="stack-sm">
              {dialog.options.map((option, i) => (
                <button
                  key={i}
                  ref={i === 0 ? primaryRef : undefined}
                  type="button"
                  className="btn dialogue-option"
                  onClick={() => dialog.resolve(i)}
                >
                  {option}
                </button>
              ))}
              <button
                ref={dialog.options.length === 0 ? primaryRef : undefined}
                type="button"
                className="btn btn-ghost dialogue-option"
                onClick={() => dialog.resolve(null)}
              >
                Goodbye
              </button>
            </div>
          </>
        ) : dialog.kind === "confirm" ? (
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

/** "How many?" with a number field (Enter submits) and 1 / All shortcuts. */
function QuantityPrompt({ dialog }: { dialog: Extract<DialogRequest, { kind: "quantity" }> }) {
  const [value, setValue] = useState("1");
  const quantity = Math.floor(Number(value));
  const valid = Number.isFinite(quantity) && quantity >= 1 && quantity <= dialog.max;
  const submit = () => valid && dialog.resolve(quantity);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="dialog-quantity">{dialog.message}</label>
      <div className="row">
        <input
          id="dialog-quantity"
          type="number"
          min={1}
          max={dialog.max}
          step={1}
          value={value}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: 110 }}
        />
        <button type="button" className="btn" onClick={() => dialog.resolve(1)}>
          1
        </button>
        <button type="button" className="btn" onClick={() => dialog.resolve(dialog.max)}>
          All ({formatNumber(dialog.max)})
        </button>
      </div>
      <div className="btn-row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={() => dialog.resolve(null)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          {dialog.confirmLabel}
        </button>
      </div>
    </form>
  );
}
