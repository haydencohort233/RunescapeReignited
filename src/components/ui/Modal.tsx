import { useEffect, useRef, type ReactNode } from "react";

/** A panel over the page (item details, the loadout picker): closes on
 *  Escape, the close button, or a tap outside it. On phones it rises from
 *  the bottom as a sheet. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content (Save/Cancel). */
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>(".modal-close")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className={`dialog card modal${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true">
        <div className="card-header">
          <span className="card-title">{title}</span>
          <button type="button" className="btn btn-ghost modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
