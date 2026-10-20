// Pan and zoom math for the world map, kept pure so it can be tested.
// A camera maps map space to screen space: screen = map * scale + (x, y).

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Most zoomed in: three screen pixels per map-art pixel. */
export const MAX_SCALE = 3;
/** Most zoomed out: far enough to see a good stretch of the world, not
 *  shrink it to a stamp. The art also always fills the view (minScale). */
export const MIN_SCALE = 0.3;

/** The scale that fits the whole map in the view. */
export function fitScale(view: Size, map: Size): number {
  return Math.min(view.w / map.w, view.h / map.h);
}

/** The zoom-out limit: MIN_SCALE, or more where needed so the art covers
 *  the whole view with no empty band around it. */
export function minScale(view: Size, map: Size): number {
  return Math.max(MIN_SCALE, view.w / map.w, view.h / map.h);
}

/** Keeps the scale between minScale and MAX_SCALE, and the map on screen:
 *  it can't be dragged past its edges (an axis that is somehow smaller
 *  than the view is centred). */
export function clampCamera(cam: Camera, view: Size, map: Size): Camera {
  const scale = clampScale(cam.scale, view, map);
  // A scale that had to be limited keeps the same map point in the middle,
  // so the view doesn't jump to an edge.
  if (scale !== cam.scale) cam = centerOn(viewCenter(cam, view), scale, view);
  const axis = (pos: number, viewLen: number, mapLen: number) => {
    const content = mapLen * scale;
    if (content <= viewLen) return (viewLen - content) / 2;
    return Math.min(0, Math.max(viewLen - content, pos));
  };
  return { scale, x: axis(cam.x, view.w, map.w), y: axis(cam.y, view.h, map.h) };
}

export function clampScale(scale: number, view: Size, map: Size): number {
  const min = minScale(view, map);
  return Math.min(Math.max(scale, min), Math.max(min, MAX_SCALE));
}

/** Zooms by `factor`, keeping the map point under screen point `at` still. */
export function zoomAt(cam: Camera, factor: number, at: Point): Camera {
  const scale = cam.scale * factor;
  const k = scale / cam.scale;
  return { scale, x: at.x - (at.x - cam.x) * k, y: at.y - (at.y - cam.y) * k };
}

/** zoomAt, but the scale is limited first, so zooming past the limit
 *  stops still instead of sliding the view towards an edge. */
export function zoomAtLimited(cam: Camera, factor: number, at: Point, view: Size, map: Size): Camera {
  const scale = clampScale(cam.scale * factor, view, map);
  return zoomAt(cam, scale / cam.scale, at);
}

/** A camera with map point `p` at the centre of the view (or at `anchor`). */
export function centerOn(p: Point, scale: number, view: Size, anchor: Point = { x: view.w / 2, y: view.h / 2 }): Camera {
  return { scale, x: anchor.x - p.x * scale, y: anchor.y - p.y * scale };
}

/** The camera that frames every point with `pad` screen pixels to spare,
 *  zoomed in no further than `maxScale`. */
export function frame(points: Point[], view: Size, pad: number, maxScale: number): Camera {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min(maxScale, (view.w - pad * 2) / w, (view.h - pad * 2) / h);
  return centerOn({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, scale, view);
}

export function toScreen(cam: Camera, p: Point): Point {
  return { x: p.x * cam.scale + cam.x, y: p.y * cam.scale + cam.y };
}

/** The map point at the centre of the view. */
export function viewCenter(cam: Camera, view: Size): Point {
  return { x: (view.w / 2 - cam.x) / cam.scale, y: (view.h / 2 - cam.y) / cam.scale };
}

/** Blend between two cameras, t from 0 to 1. The scale blends in log space
 *  and the centre point in map space, so an animated zoom feels even and
 *  doesn't swing sideways on the way. */
export function lerpCamera(a: Camera, b: Camera, t: number, view: Size): Camera {
  const scale = Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * t);
  const ca = viewCenter(a, view);
  const cb = viewCenter(b, view);
  return centerOn({ x: ca.x + (cb.x - ca.x) * t, y: ca.y + (cb.y - ca.y) * t }, scale, view);
}
