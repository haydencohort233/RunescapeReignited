import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DialogRequest } from "../../lib/dialog";
import { enemyImagePath } from "../../content/assetPaths";
import GameImage from "../GameImage";

/** Characters typed per tick, and the tick length. About 110 characters a
 *  second: quick enough not to wait on, slow enough to feel spoken. */
const CHARS_PER_TICK = 2;
const TICK_MS = 18;
/** Earlier lines kept on screen above the newest one. */
const HISTORY_SHOWN = 6;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** An NPC's chat head: their art when it exists, else their emoji. */
export function ChatHead({ name, portrait, size = 56 }: { name: string; portrait?: string; size?: number }) {
  return (
    <span className="chat-head" style={{ width: size, height: size, fontSize: size * 0.55 }} aria-hidden="true">
      <GameImage src={enemyImagePath(name, 100)} alt="" style={{ width: size - 8, height: size - 8 }} fallback={<span>{portrait ?? "💬"}</span>} />
    </span>
  );
}

/**
 * A conversation with an NPC, in an OSRS-style chatbox: their chat head
 * and name, what's been said so far, the newest line typing out, and the
 * replies numbered so keys 1 to 9 pick them. Click the line, or press
 * Space or Enter, to show it all at once.
 */
export function Conversation({ dialog }: { dialog: Extract<DialogRequest, { kind: "dialogue" }> }) {
  const { speaker, line, options, history } = dialog;
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? line.length : 0));
  const typing = shown < line.length;
  const logRef = useRef<HTMLDivElement | null>(null);
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!typing) return;
    const id = setInterval(() => setShown((n) => Math.min(line.length, n + CHARS_PER_TICK)), TICK_MS);
    return () => clearInterval(id);
  }, [typing, line.length]);

  // Keep the newest line in view as it types.
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, history.length]);

  useEffect(() => {
    if (!typing) firstOptionRef.current?.focus();
  }, [typing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setShown(line.length);
        return;
      }
      const n = Number(e.key);
      if (!typing && Number.isInteger(n) && n >= 1) {
        if (n <= options.length) dialog.resolve(n - 1);
        else if (n === options.length + 1) dialog.resolve(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [typing, line.length, options.length, dialog]);

  return (
    <div className="convo">
      <header className="convo-head">
        <ChatHead name={speaker.name} portrait={speaker.portrait} />
        <div className="convo-who">
          <strong className="convo-name">{speaker.name}</strong>
          {speaker.title && <span className="convo-title">{speaker.title}</span>}
        </div>
      </header>

      <div className="convo-log" ref={logRef} aria-live="polite">
        {history.slice(-HISTORY_SHOWN).map((turn, i) => (
          <p key={i} className={`convo-msg is-${turn.who} is-past`}>
            {turn.who === "you" && <span className="convo-you">You: </span>}
            {turn.text}
          </p>
        ))}
        <p className="convo-msg is-npc" onClick={() => setShown(line.length)}>
          {line.slice(0, shown)}
          {typing && <span className="convo-caret" aria-hidden="true" />}
        </p>
      </div>

      <ol className={`convo-options${typing ? " is-waiting" : ""}`} aria-hidden={typing}>
        {options.map((option, i) => (
          <li key={i}>
            <button
              ref={i === 0 ? firstOptionRef : undefined}
              type="button"
              className={`convo-option${option.tag === "quest" ? " is-quest" : ""}`}
              tabIndex={typing ? -1 : 0}
              onClick={() => dialog.resolve(i)}
            >
              <span className="convo-key">{i + 1}</span>
              {option.tag === "quest" && <span className="map-badge is-quest">Q</span>}
              <span>{option.label}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            ref={options.length === 0 ? firstOptionRef : undefined}
            type="button"
            className="convo-option is-leave"
            tabIndex={typing ? -1 : 0}
            onClick={() => dialog.resolve(null)}
          >
            <span className="convo-key">{options.length + 1}</span>
            <span>Goodbye</span>
          </button>
        </li>
      </ol>
      {typing && (
        <button type="button" className="convo-skip" onClick={() => setShown(line.length)}>
          Click to skip
        </button>
      )}
    </div>
  );
}
