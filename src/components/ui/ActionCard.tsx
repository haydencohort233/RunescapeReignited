import { useCallback, useState, type ReactNode } from "react";
import { QuickMenu } from "./QuickMenu";

export interface CardAction {
  label: ReactNode;
  onClick: () => void;
  /** When set, the action shows but can't be used; `reason` explains why
   *  (shown as the button's tooltip). */
  disabled?: boolean;
  reason?: string;
  variant?: "primary" | "danger";
}

/**
 * The one interaction pattern for anything you can act on (an amenity, an
 * inventory item, a shop item): click the card to show its actions inline,
 * or right-click for the same actions in a quick menu. The inline panel
 * always has every action, so nothing depends on right-click (phones).
 */
export function ActionCard({
  icon,
  title,
  meta,
  description,
  actions,
  children,
  open: controlledOpen,
  onOpenChange,
  className = "",
}: {
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Shown above the actions when expanded. */
  description?: ReactNode;
  actions: CardAction[];
  /** Extra expanded content below the actions (a shop's item list, etc.). */
  children?: ReactNode;
  /** Optional control from the parent (e.g. keep a fight's card open). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => {
    setLocalOpen(value);
    onOpenChange?.(value);
  };
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenuPos(null), []);

  const renderActions = (inMenu: boolean) =>
    actions.map((action, i) => (
      <button
        key={i}
        type="button"
        role={inMenu ? "menuitem" : undefined}
        className={`btn${action.variant ? ` btn-${action.variant}` : ""}`}
        disabled={action.disabled}
        title={action.disabled ? action.reason : undefined}
        onClick={() => {
          action.onClick();
          if (inMenu) closeMenu();
        }}
      >
        {action.label}
      </button>
    ));

  return (
    <div className={`card ${className}`}>
      <button
        type="button"
        className="card-toggle card-header"
        aria-expanded={open}
        onClick={() => {
          setMenuPos(null);
          setOpen(!open);
        }}
        onContextMenu={(e) => {
          if (actions.length === 0) return;
          e.preventDefault();
          setMenuPos({ x: e.clientX, y: e.clientY });
        }}
      >
        <span className="card-title">
          {icon}
          {title}
        </span>
        {meta !== undefined && <span className="card-meta">{meta}</span>}
      </button>

      {open && (
        <>
          {description && <div className="text-muted">{description}</div>}
          {actions.length > 0 && <div className="btn-row">{renderActions(false)}</div>}
          {children}
        </>
      )}

      {menuPos && (
        <QuickMenu x={menuPos.x} y={menuPos.y} onClose={closeMenu}>
          {renderActions(true)}
        </QuickMenu>
      )}
    </div>
  );
}

/** Something that exists but isn't available yet: a dashed card with the
 *  reason, never a red error. */
export function LockedCard({ icon, title, reason }: { icon?: ReactNode; title: ReactNode; reason: ReactNode }) {
  return (
    <div className="card is-locked">
      <div className="card-header">
        <span className="card-title text-faint">
          {icon}
          {title}
        </span>
        <span className="card-meta">🔒 Locked</span>
      </div>
      <div className="locked-note">{reason}</div>
    </div>
  );
}
