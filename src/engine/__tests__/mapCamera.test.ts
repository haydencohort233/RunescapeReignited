import { describe, expect, it } from "vitest";
import { clampCamera, centerOn, frame, lerpCamera, MAX_SCALE, MIN_SCALE, minScale, toScreen, viewCenter, zoomAt, zoomAtLimited } from "../../lib/mapCamera";

const MAP = { w: 2560, h: 1440 };
const PHONE = { w: 343, h: 500 };

describe("map camera", () => {
  it("can't zoom out past the limit or in past the max", () => {
    const short = { w: 600, h: 300 };
    expect(clampCamera({ x: 0, y: 0, scale: 0.0001 }, short, MAP).scale).toBe(MIN_SCALE);
    expect(clampCamera({ x: 0, y: 0, scale: 99 }, PHONE, MAP).scale).toBe(MAX_SCALE);
  });

  it("zoomed right out, the art still fills the whole view", () => {
    for (const view of [PHONE, { w: 900, h: 700 }, { w: 2000, h: 600 }, { w: 5120, h: 2880 }]) {
      const cam = clampCamera({ x: 0, y: 0, scale: 0 }, view, MAP);
      expect(cam.scale).toBe(minScale(view, MAP));
      expect(cam.x).toBeLessThanOrEqual(0);
      expect(cam.y).toBeLessThanOrEqual(0);
      expect(cam.x + MAP.w * cam.scale).toBeGreaterThanOrEqual(view.w - 1e-6);
      expect(cam.y + MAP.h * cam.scale).toBeGreaterThanOrEqual(view.h - 1e-6);
    }
  });

  it("stops the map at its edges", () => {
    const zoomed = clampCamera({ x: 100, y: -99999, scale: 1 }, PHONE, MAP);
    expect(zoomed.x).toBe(0);
    expect(zoomed.y).toBe(PHONE.h - MAP.h);
  });

  it("zooms around the pointer, keeping the map point under it still", () => {
    const cam = { x: -300, y: -200, scale: 0.5 };
    const at = { x: 120, y: 80 };
    const mapPoint = { x: (at.x - cam.x) / cam.scale, y: (at.y - cam.y) / cam.scale };
    const after = zoomAt(cam, 2, at);
    const s = toScreen(after, mapPoint);
    expect(s.x).toBeCloseTo(at.x);
    expect(s.y).toBeCloseTo(at.y);
  });

  it("spamming zoom past either limit doesn't slide the view to an edge", () => {
    const view = { w: 800, h: 500 };
    const start = clampCamera(centerOn({ x: 1300, y: 750 }, 1, view), view, MAP);
    const middle = viewCenter(start, view);
    let cam = start;
    for (let i = 0; i < 40; i++) cam = clampCamera(zoomAtLimited(cam, 1.5, { x: 400, y: 250 }, view, MAP), view, MAP);
    expect(cam.scale).toBe(MAX_SCALE);
    expect(viewCenter(cam, view).x).toBeCloseTo(middle.x);
    expect(viewCenter(cam, view).y).toBeCloseTo(middle.y);
    for (let i = 0; i < 40; i++) cam = clampCamera(zoomAtLimited(cam, 1 / 1.5, { x: 400, y: 250 }, view, MAP), view, MAP);
    expect(cam.scale).toBe(minScale(view, MAP));
    // Fully out, the view sits where the edges allow, still around the same spot.
    expect(Math.abs(viewCenter(cam, view).x - middle.x)).toBeLessThan(400);
  });

  it("a limited scale keeps the middle of the view where it was", () => {
    const view = { w: 800, h: 500 };
    const asked = centerOn({ x: 1300, y: 750 }, 50, view);
    const cam = clampCamera(asked, view, MAP);
    expect(cam.scale).toBe(MAX_SCALE);
    expect(viewCenter(cam, view).x).toBeCloseTo(1300);
    expect(viewCenter(cam, view).y).toBeCloseTo(750);
  });

  it("frames a set of points inside the padding", () => {
    const pts = [{ x: 1000, y: 600 }, { x: 1600, y: 900 }];
    const cam = frame(pts, PHONE, 40, MAX_SCALE);
    for (const p of pts) {
      const s = toScreen(cam, p);
      expect(s.x).toBeGreaterThanOrEqual(39.9);
      expect(s.x).toBeLessThanOrEqual(PHONE.w - 39.9);
      expect(s.y).toBeGreaterThanOrEqual(39.9);
      expect(s.y).toBeLessThanOrEqual(PHONE.h - 39.9);
    }
  });

  it("an animation starts and ends on its cameras", () => {
    const a = centerOn({ x: 100, y: 100 }, 0.3, PHONE);
    const b = centerOn({ x: 2000, y: 1000 }, 2, PHONE);
    expect(lerpCamera(a, b, 0, PHONE).scale).toBeCloseTo(a.scale);
    const end = lerpCamera(a, b, 1, PHONE);
    expect(end.x).toBeCloseTo(b.x);
    expect(end.y).toBeCloseTo(b.y);
    expect(viewCenter(lerpCamera(a, b, 0.5, PHONE), PHONE).x).toBeCloseTo(1050);
  });
});
