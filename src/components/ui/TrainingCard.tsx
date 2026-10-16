import { useCallback, useState, type ReactNode } from "react";
import { ActionButton, type CardAction } from "./ActionCard";
import { QuickMenu } from "./QuickMenu";

/**
 * One way to train a skill (Net Shrimps, Cook Trout, Chop Oak), laid out
 * the same everywhere: the skill page, Home's crafting list, and the popups
 * on the town picture.
 *
 *   [icon] Title                         3.0s · 10 XP each
 *          info lines (children)             [ Primary ]
 *          ...                       [more] [more] [more]
 *
 * Info lines are free-form, so a skill that needs to say more (a tool, a
 * bait, where it's found, a timer) just adds a line. Right-click for every
 * action in a menu. Locked: dimmed, with the reason, no buttons.
 */
export function TrainingCard({
  icon,
  title,
  stats,
  primary,
  more = [],
  lockReason,
  active = false,
  status,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  /** Time and XP: "3.0s · 10 XP each". */
  stats?: ReactNode;
  /** The obvious button, top-right under the stats. */
  primary?: CardAction;
  /** Extra choices (x5, x10, all; Stop) in a row at the bottom. */
  more?: CardAction[];
  /** Set when it can't be done yet; shown instead of buttons. */
  lockReason?: ReactNode;
  /** It's what you're doing right now. */
  active?: boolean;
  /** A live line while active ("x12 · ends in 7:59:10"). */
  status?: ReactNode;
  children?: ReactNode;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const all = lockReason ? [] : [...(primary ? [primary] : []), ...more];

  return (
    <div
      className={`card train-card${lockReason ? " is-locked" : ""}${active ? " is-active" : ""}`}
      onContextMenu={(e) => {
        if (all.length === 0) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="train-main">
        <span className="train-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="train-body">
          <span className="train-title">
            {title}
            {active && <span className="tag tag-success">Active</span>}
          </span>
          {status && <span className="train-status">{status}</span>}
          {children}
          {lockReason && <span className="train-lock">🔒 {lockReason}</span>}
        </div>
        <div className="train-side">
          {stats && <span className="card-meta">{stats}</span>}
          {primary && !lockReason && <ActionButton action={primary} />}
        </div>
      </div>
      {more.length > 0 && !lockReason && (
        <div className="train-more">
          {more.map((a, i) => (
            <ActionButton key={i} action={a} />
          ))}
        </div>
      )}
      {menu && (
        <QuickMenu x={menu.x} y={menu.y} onClose={closeMenu}>
          {all.map((a, i) => (
            <ActionButton key={i} action={a} inMenu onDone={closeMenu} />
          ))}
        </QuickMenu>
      )}
    </div>
  );
}

/** A small line on a training card: an icon-ish lead and text. */
export function TrainInfo({ children, tone }: { children: ReactNode; tone?: "warning" | "faint" }) {
  return <span className={`train-info${tone ? ` is-${tone}` : ""}`}>{children}</span>;
}
