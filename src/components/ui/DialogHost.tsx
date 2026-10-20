import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { getDialog, subscribeDialog, type ActivityPreview, type DialogRequest } from "../../lib/dialog";
import { Conversation } from "./Conversation";
import { AwaySummaryView } from "../AwaySummaryView";
import { formatNumber } from "../../engine/format";
import { SkillIcon } from "./GameIcons";

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
      if (dialog.kind === "confirm" || dialog.kind === "switch") dialog.resolve(false);
      else if (dialog.kind === "quantity" || dialog.kind === "dialogue") dialog.resolve(null);
      else dialog.resolve();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog]);

  if (!dialog) return null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className={`dialog card${dialog.kind === "switch" ? " switch-dialog" : ""}${dialog.kind === "dialogue" ? " convo-dialog" : ""}${dialog.kind === "questComplete" ? " quest-done-dialog" : ""}${dialog.kind === "away" ? " away-dialog" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={dialog.kind === "dialogue" ? `Talking to ${dialog.speaker.name}` : undefined}
      >
        {dialog.kind === "quantity" ? (
          <QuantityPrompt key={dialog.message} dialog={dialog} />
        ) : dialog.kind === "away" ? (
          <AwaySummaryView summary={dialog.summary} onClose={() => dialog.resolve()} primaryRef={primaryRef} />
        ) : dialog.kind === "questComplete" ? (
          <div className="quest-done">
            <span className="quest-done-badge" aria-hidden="true">
              Q
            </span>
            <p className="quest-done-kicker">Quest complete!</p>
            <h3 className="quest-done-name">{dialog.questName}</h3>
            {dialog.rewards.length > 0 && (
              <>
                <p className="quest-done-label">You are awarded:</p>
                <ul className="quest-done-rewards">
                  {dialog.rewards.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            <button ref={primaryRef} type="button" className="btn btn-primary" onClick={() => dialog.resolve()}>
              Continue
            </button>
          </div>
        ) : dialog.kind === "dialogue" ? (
          // Keyed per line so each new line types out from the start.
          <Conversation key={`${dialog.history.length}:${dialog.line}`} dialog={dialog} />
        ) : dialog.kind === "switch" ? (
          <SwitchPrompt dialog={dialog} primaryRef={primaryRef} />
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

const VERB: Record<ActivityPreview["kind"], { now: string; next: string; keep: string }> = {
  craft: { now: "Crafting", next: "Craft", keep: "Keep crafting" },
  gather: { now: "Gathering", next: "Gather", keep: "Keep gathering" },
  travel: { now: "Traveling to", next: "Travel to", keep: "Keep traveling" },
  combat: { now: "Fighting", next: "Fight", keep: "Keep fighting" },
};

function ActivityTile({ preview, side }: { preview: ActivityPreview; side: "now" | "next" }) {
  return (
    <div className={`switch-tile is-${side}`}>
      <span className="switch-tile-tag">{side === "now" ? "Now" : "Next"}</span>
      <span className="switch-tile-icon" aria-hidden="true">
        {preview.skill ? <SkillIcon skillId={preview.skill} size={28} /> : preview.kind === "travel" ? "🧭" : "⚔️"}
      </span>
      <span className="switch-tile-verb">{side === "now" ? VERB[preview.kind].now : VERB[preview.kind].next}</span>
      <strong className="switch-tile-title">{preview.title}</strong>
      {preview.detail && <span className="switch-tile-detail">{preview.detail}</span>}
    </div>
  );
}

/** "Switch activity?": what's running, what would replace it, and two
 *  clear choices. Esc or "Keep ..." keeps the current one. */
function SwitchPrompt({
  dialog,
  primaryRef,
}: {
  dialog: Extract<DialogRequest, { kind: "switch" }>;
  primaryRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="stack">
      <div className="stack-sm">
        <h3 className="switch-title">Switch activity?</h3>
        <p className="text-muted">You can only do one thing at a time. Anything already finished is kept.</p>
      </div>
      <div className="switch-flow">
        <ActivityTile preview={dialog.from} side="now" />
        <span className="switch-arrow" aria-hidden="true">
          ➜
        </span>
        <ActivityTile preview={dialog.to} side="next" />
      </div>
      <div className="switch-actions">
        <button type="button" className="btn" onClick={() => dialog.resolve(false)}>
          {VERB[dialog.from.kind].keep}
        </button>
        <button ref={primaryRef} type="button" className="btn btn-primary" onClick={() => dialog.resolve(true)}>
          {VERB[dialog.to.kind].next} {dialog.to.title}
        </button>
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
