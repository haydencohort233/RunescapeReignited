import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { clampCamera, clampScale, lerpCamera, viewCenter, centerOn, zoomAt, zoomAtLimited, type Camera, type Point, type Size } from "../../lib/mapCamera";

/** Movement (px) before a press counts as a drag rather than a tap. */
const DRAG_THRESHOLD = 6;
const ANIMATION_MS = 280;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Pan and zoom for a map drawn inside `ref`: drag with a mouse or one
 * finger, pinch with two, wheel to zoom at the pointer, arrow keys and
 * +/- when focused. The camera is clamped so the map never leaves the
 * view. `initial` picks the first camera once the view has a size.
 * `wasDrag()` tells a click handler to ignore the click that ends a drag.
 */
export function useMapCamera(ref: RefObject<HTMLElement | null>, map: Size, initial: (view: Size) => Camera) {
  const [view, setView] = useState<Size | null>(null);
  const [cam, setCam] = useState<Camera | null>(null);
  const camRef = useRef<Camera | null>(null);
  const viewRef = useRef<Size | null>(null);
  const animRef = useRef<number | null>(null);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const apply = useCallback(
    (c: Camera) => {
      const v = viewRef.current;
      if (!v) return;
      const next = clampCamera(c, v, map);
      camRef.current = next;
      setCam(next);
    },
    [map]
  );

  const stopAnimation = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  const animateTo = useCallback(
    (target: Camera) => {
      stopAnimation();
      const from = camRef.current;
      const v = viewRef.current;
      if (!from || !v) return;
      const to = clampCamera(target, v, map);
      targetRef.current = to;
      if (prefersReducedMotion()) return apply(to);
      const start = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / ANIMATION_MS);
        const eased = 1 - (1 - k) ** 3;
        apply(k >= 1 ? to : lerpCamera(from, to, eased, v));
        animRef.current = k < 1 ? requestAnimationFrame(step) : null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [apply, map, stopAnimation]
  );

  /** Where the camera is heading: an animation's end, else where it is.
   *  Zoom steps build on this, so tapping + quickly adds up evenly. */
  const targetRef = useRef<Camera | null>(null);

  /** Zoom by `factor` around the middle of the view, animated. */
  const zoomBy = useCallback(
    (factor: number) => {
      const c = (animRef.current !== null && targetRef.current) || camRef.current;
      const v = viewRef.current;
      if (c && v) animateTo(zoomAtLimited(c, factor, { x: v.w / 2, y: v.h / 2 }, v, map));
    },
    [animateTo, map]
  );

  // Track the view's size. On a resize, keep the same map point centred.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const next = { w: rect.width, h: rect.height };
      const prev = viewRef.current;
      if (prev && prev.w === next.w && prev.h === next.h) return;
      viewRef.current = next;
      setView(next);
      const c = camRef.current;
      apply(c && prev ? centerOn(viewCenter(c, prev), c.scale, next) : initialRef.current(next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, apply]);

  useEffect(() => stopAnimation, [stopAnimation]);

  // ── Pointers: drag and pinch ─────────────────────────────────────────
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ cam: Camera; pts: Point[] } | null>(null);
  const moved = useRef(false);

  const local = (e: { clientX: number; clientY: number }): Point => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const restartGesture = () => {
    gesture.current =
      pointers.current.size > 0 && camRef.current ? { cam: camRef.current, pts: [...pointers.current.values()] } : null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopAnimation();
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(e.pointerId, local(e));
    restartGesture();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (pts.length === 1 && g.pts.length === 1) {
      const dx = pts[0].x - g.pts[0].x;
      const dy = pts[0].y - g.pts[0].y;
      if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!moved.current) {
        moved.current = true;
        // Captured only once it's a drag, so a tap still reaches the pin.
        ref.current?.setPointerCapture(e.pointerId);
      }
      apply({ ...g.cam, x: g.cam.x + dx, y: g.cam.y + dy });
    } else if (pts.length >= 2 && g.pts.length >= 2) {
      moved.current = true;
      const [a, b] = pts;
      const [a0, b0] = g.pts;
      const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt(g.cam, clampScale((g.cam.scale * d) / d0, viewRef.current!, map) / g.cam.scale, mid0);
      apply({ ...zoomed, x: zoomed.x + mid.x - mid0.x, y: zoomed.y + mid.y - mid0.y });
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
    restartGesture();
  };

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const c = camRef.current;
      if (!c) return;
      e.preventDefault();
      stopAnimation();
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      apply(zoomAtLimited(c, Math.exp(-delta * 0.0015), local(e), viewRef.current!, map));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // local() only reads ref, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, apply, stopAnimation, map]);

  const onKeyDown = (e: KeyboardEvent) => {
    const c = camRef.current;
    if (!c) return;
    const step = 80;
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (pan[e.key]) {
      e.preventDefault();
      animateTo({ ...c, x: c.x + pan[e.key][0], y: c.y + pan[e.key][1] });
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.5);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(1 / 1.5);
    }
  };

  return {
    view,
    cam,
    animateTo,
    zoomBy,
    wasDrag: () => moved.current,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
    },
  };
}
