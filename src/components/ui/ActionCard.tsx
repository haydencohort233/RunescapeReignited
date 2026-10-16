import { useCallback, useContext, useState, type ReactNode } from "react";
import { CardPanelContext } from "./cardPanel";
import { QuickMenu } from "./QuickMenu";

export interface CardAction {
  label: ReactNode;
  onClick: () => void;
  /** When set, the action shows but can't be used; `reason` explains why
   *  (shown as the button's tooltip). */
  disabled?: boolean;
  reason?: string;
  /** Tooltip while the action is usable ("Go to Lake Shore (12s)"). */
  hint?: string;
  variant?: "primary" | "danger";
}

/** One action as a button (or a menu item), with its reason/hint tooltip. */
export function ActionButton({ action, inMenu = false, onDone }: { action: CardAction; inMenu?: boolean; onDone?: () => void }) {
  return (
    <button
      type="button"
      role={inMenu ? "menuitem" : undefined}
      // A filled "primary" button would read as white-on-white in a menu.
      className={`btn${action.variant && !(inMenu && action.variant === "primary") ? ` btn-${action.variant}` : ""}`}
      disabled={action.disabled}
      title={action.disabled ? action.reason : action.hint}
      onClick={() => {
        action.onClick();
        onDone?.();
      }}
    >
      {action.label}
    </button>
  );
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
  quickAction,
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
  /** One button shown on the right under `meta` without expanding the card
   *  (Net Shrimps / Travel). Also first in the right-click menu. */
  quickAction?: CardAction;
  /** Extra expanded content below the actions (a shop's item list, etc.). */
  children?: ReactNode;
  /** Optional control from the parent (e.g. keep a fight's card open). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const asPanel = useContext(CardPanelContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => {
    setLocalOpen(value);
    onOpenChange?.(value);
  };
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenuPos(null), []);

  const renderActions = (inMenu: boolean) =>
    actions.map((action, i) => <ActionButton key={i} action={action} inMenu={inMenu} onDone={inMenu ? closeMenu : undefined} />);
  const hasMenu = actions.length > 0 || quickAction !== undefined;

  if (asPanel) {
    return (
      <div className={`card-panel ${className}`}>
        {meta !== undefined && <span className="card-meta">{meta}</span>}
        {description && <div className="text-muted">{description}</div>}
        {hasMenu && (
          <div className="btn-row">
            {quickAction && <ActionButton action={quickAction} />}
            {renderActions(false)}
          </div>
        )}
        {/* Only the outer card is a panel; cards inside it (a station's
            recipes) stay normal cards. */}
        <CardPanelContext.Provider value={false}>{children}</CardPanelContext.Provider>
      </div>
    );
  }

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
          if (!hasMenu) return;
          e.preventDefault();
          setMenuPos({ x: e.clientX, y: e.clientY });
        }}
      >
        <span className="card-title">
          {icon && <span aria-hidden="true">{icon}</span>}
          <span>{title}</span>
        </span>
        {meta !== undefined && <span className="card-meta">{meta}</span>}
      </button>

      {/* Outside the toggle (a button can't hold a button), right under meta. */}
      {quickAction && (
        <div className="card-quick">
          <ActionButton action={quickAction} />
        </div>
      )}

      {open && (
        <>
          {description && <div className="text-muted">{description}</div>}
          {actions.length > 0 && <div className="btn-row">{renderActions(false)}</div>}
          {children}
        </>
      )}

      {menuPos && (
        <QuickMenu x={menuPos.x} y={menuPos.y} onClose={closeMenu}>
          {quickAction && <ActionButton action={quickAction} inMenu onDone={closeMenu} />}
          {renderActions(true)}
        </QuickMenu>
      )}
    </div>
  );
}

/** Something that exists but isn't available yet: a dashed card with the
 *  reason, never a red error. */
export function LockedCard({ icon, title, reason }: { icon?: ReactNode; title: ReactNode; reason: ReactNode }) {
  const asPanel = useContext(CardPanelContext);
  if (asPanel) return <p className="locked-note card-panel-locked">🔒 {reason}</p>;
  return (
    <div className="card is-locked">
      <div className="card-header">
        <span className="card-title text-faint">
          {icon && <span aria-hidden="true">{icon}</span>}
          <span>{title}</span>
        </span>
        <span className="card-meta">🔒 Locked</span>
      </div>
      <div className="locked-note">{reason}</div>
    </div>
  );
}
