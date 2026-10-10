import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Only one quick menu is open at a time: opening one tells the others.
const OPEN_EVENT = "quickmenu:open";
let nextMenuId = 0;

/**
 * A floating menu at a screen position (from a right-click). Closes on an
 * outside click, Escape, or another menu opening; nudged back inside the
 * viewport if it would spill off the edge.
 */
export function QuickMenu({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [id] = useState(() => ++nextMenuId);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(x, window.innerWidth - width - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - height - 4)),
    });
    el.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }, [x, y]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    const onOtherOpen = (e: Event) => {
      if ((e as CustomEvent).detail !== id) onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener(OPEN_EVENT, onOtherOpen);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOtherOpen);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [id, onClose]);

  return (
    <div ref={ref} className="quick-menu" role="menu" style={pos}>
      {children}
    </div>
  );
}
