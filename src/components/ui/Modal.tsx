import { useEffect, useRef, type ReactNode } from "react";

// How many modals are open: the page stays locked until the last closes.
let openCount = 0;

function lockPageScroll(): () => void {
  openCount++;
  if (openCount === 1) document.documentElement.classList.add("is-modal-open");
  return () => {
    openCount--;
    if (openCount === 0) document.documentElement.classList.remove("is-modal-open");
  };
}

/** True when this backdrop is the one on top: the last dialog in the page
 *  (a nested modal, or the dialogue box, comes after its parent) and no
 *  right-click menu is open over it. */
function isTopmost(backdrop: HTMLElement | null): boolean {
  if (!backdrop || document.querySelector(".quick-menu")) return false;
  const all = document.querySelectorAll(".dialog-backdrop");
  return all[all.length - 1] === backdrop;
}

/** Sheets (phones) can be swiped down past this to close. */
const SWIPE_CLOSE_PX = 90;

/**
 * A panel over the page (item details, the loadout picker, a shop): closes
 * on Escape, the close button, or a tap outside it. On phones it rises
 * from the bottom as a sheet and can be swiped down to close. While it's
 * open the page behind it doesn't scroll.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
  className = "",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content (Save/Cancel). */
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // Read through a ref so a new onClose each render doesn't re-run the
  // effect (which would steal focus back to the close button every tick).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const unlock = lockPageScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopmost(backdropRef.current)) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>(".modal-close")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
    };
  }, []);

  // Swipe down to close, only when it's a bottom sheet (phones). Starts
  // from the header anywhere, or from the content when it's scrolled to
  // the top, so scrolling a long list still works.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let startY = 0;
    let startTime = 0;
    let dragging = false;
    let offset = 0;

    const isSheet = () => window.matchMedia("(max-width: 1023px)").matches;
    const onStart = (e: TouchEvent) => {
      if (!isSheet() || e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      const inBody = bodyRef.current?.contains(target);
      if (inBody && (bodyRef.current!.scrollTop > 0 || target.closest("input, select, textarea"))) return;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      dragging = true;
      offset = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        // Moving up: let the content scroll instead.
        if (offset === 0) {
          dragging = false;
          return;
        }
      }
      offset = Math.max(0, dy);
      if (e.cancelable) e.preventDefault();
      panel.style.transition = "none";
      panel.style.transform = `translateY(${offset}px)`;
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      const fast = offset > 40 && Date.now() - startTime < 250;
      panel.style.transition = "";
      if (offset > SWIPE_CLOSE_PX || fast) {
        panel.style.transform = "translateY(100%)";
        window.setTimeout(() => onCloseRef.current(), 160);
      } else {
        panel.style.transform = "";
      }
      offset = 0;
    };
    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div
      ref={backdropRef}
      className="dialog-backdrop modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className={`dialog card modal${wide ? " is-wide" : ""} ${className}`} role="dialog" aria-modal="true">
        <span className="modal-grabber" aria-hidden="true" />
        <div className="card-header">
          <span className="card-title">{title}</span>
          <button type="button" className="btn btn-ghost modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div ref={bodyRef} className="modal-body">
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
