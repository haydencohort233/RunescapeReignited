import type { Facing, FurnitureDefinition, FurnitureSlot, PlacedFurniture } from "../../engine/types";
import { footprint } from "../../engine/systems/house";
import { furnitureDrawing } from "./furnitureSprites";
import type { ArtSize } from "./artCache";
import { HOUSE_FLOOR_COLS, HOUSE_FLOOR_ROWS, HOUSE_WALL_COLS, HOUSE_WALL_ROWS } from "../../engine/tuning";

// Where things sit in the room picture. Positions are in picture units:
// the room art's own 1536 x 1024 canvas (assets/house/), cropped to the
// band that has art in it (ART_Y_OFFSET from the top, ROOM_H tall). The
// view turns them into percentages, so the room scales to any width. The
// numbers below trace the default floor and wall art; a new floor or wall
// cosmetic is drawn on the same canvas so it lines up.

export const ROOM_W = 1536;
export const ROOM_H = 830;
/** Where the cropped room starts on the art canvas. */
export const ART_Y_OFFSET = 100;
export const ART_CANVAS = { w: 1536, h: 1024 };

/** Art pixels per floor cell width: a 128-pixel bed is one cell wide, a
 *  64-pixel chair half a cell, at the row's perspective scale. */
export const ART_PX_PER_CELL = 128;

// The walkable floor (a trapezoid, narrow at the back).
const FLOOR_TOP = 278;
const FLOOR_BOTTOM = 784;
const BACK_LEFT = 302;
const BACK_RIGHT = 1229;
const FRONT_LEFT = 52;
const FRONT_RIGHT = 1480;
// The back wall's panel, where wall pieces hang.
const WALL_LEFT = 322;
const WALL_RIGHT = 1218;
const WALL_TOP = 42;
const WALL_BOTTOM = 268;

export interface Pt {
  x: number;
  y: number;
}

export const ROOM_SHAPE = {
  floorTop: FLOOR_TOP,
  floorBottom: FLOOR_BOTTOM,
  backLeft: BACK_LEFT,
  backRight: BACK_RIGHT,
  frontLeft: FRONT_LEFT,
  frontRight: FRONT_RIGHT,
  wallLeft: WALL_LEFT,
  wallRight: WALL_RIGHT,
  wallTop: WALL_TOP,
  wallBottom: WALL_BOTTOM,
};

/** Floor and rug pieces share the floor grid. */
export type GridSlot = "floor" | "wall";
export const gridOf = (slot: FurnitureSlot): GridSlot => (slot === "wall" ? "wall" : "floor");

/** A grid corner on the floor: col 0..8, row 0..4 (0 at the back wall). */
export function floorPoint(col: number, row: number): Pt {
  const t = row / HOUSE_FLOOR_ROWS;
  const y = FLOOR_TOP + t * (FLOOR_BOTTOM - FLOOR_TOP);
  const left = BACK_LEFT + (FRONT_LEFT - BACK_LEFT) * t;
  const right = BACK_RIGHT + (FRONT_RIGHT - BACK_RIGHT) * t;
  return { x: left + ((right - left) * col) / HOUSE_FLOOR_COLS, y };
}

/** A grid corner on the back wall: col 0..8, row 0..2 (0 at the top). */
export function wallPoint(col: number, row: number): Pt {
  return {
    x: WALL_LEFT + ((WALL_RIGHT - WALL_LEFT) * col) / HOUSE_WALL_COLS,
    y: WALL_TOP + ((WALL_BOTTOM - WALL_TOP) * row) / HOUSE_WALL_ROWS,
  };
}

/** Width of one floor cell at a row (fractional rows allowed). */
function cellWidthAt(row: number): number {
  return floorPoint(1, row).x - floorPoint(0, row).x;
}

/** The outline of a block of cells, as an SVG points string. */
export function cellsPolygon(slot: FurnitureSlot, x: number, y: number, w: number, d: number): string {
  const p = gridOf(slot) === "floor" ? floorPoint : wallPoint;
  return [p(x, y), p(x + w, y), p(x + w, y + d), p(x, y + d)].map((q) => `${q.x},${q.y}`).join(" ");
}

/** The grid cell under a point in picture units, or null off the grid. */
export function cellAt(slot: FurnitureSlot, px: number, py: number): { x: number; y: number } | null {
  if (gridOf(slot) === "wall") {
    const x = Math.floor(((px - WALL_LEFT) / (WALL_RIGHT - WALL_LEFT)) * HOUSE_WALL_COLS);
    const y = Math.floor(((py - WALL_TOP) / (WALL_BOTTOM - WALL_TOP)) * HOUSE_WALL_ROWS);
    return x >= 0 && x < HOUSE_WALL_COLS && y >= 0 && y < HOUSE_WALL_ROWS ? { x, y } : null;
  }
  const t = (py - FLOOR_TOP) / (FLOOR_BOTTOM - FLOOR_TOP);
  const left = BACK_LEFT + (FRONT_LEFT - BACK_LEFT) * t;
  const right = BACK_RIGHT + (FRONT_RIGHT - BACK_RIGHT) * t;
  const x = Math.floor(((px - left) / (right - left)) * HOUSE_FLOOR_COLS);
  const y = Math.floor(t * HOUSE_FLOOR_ROWS);
  return x >= 0 && x < HOUSE_FLOOR_COLS && y >= 0 && y < HOUSE_FLOOR_ROWS ? { x, y } : null;
}

/** Where a piece's picture goes. `scale` is picture units per art pixel
 *  at its spot, so things on it can be drawn at the same scale. */
export interface SpriteBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Larger is drawn in front. */
  z: number;
  scale: number;
}

/**
 * The box for a piece at a spot. With art, the image is drawn at its
 * pixel size times the row's scale: floor pieces stand on the middle of
 * the front row of their footprint, centred across it; rugs lie centred
 * on their cells; wall pieces hang centred in their cells. Without art
 * the drawn stand-in fills a box sized by its drawing.
 */
export function spriteBox(def: FurnitureDefinition, x: number, y: number, facing: Facing, art?: ArtSize | null): SpriteBox {
  const { w, d } = footprint(def, facing);
  if (def.slot === "wall") {
    const a = wallPoint(x, y);
    const b = wallPoint(x + w, y + d);
    const scale = cellWidthAt(0) / ART_PX_PER_CELL;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    if (art) return { left: cx - (art.w * scale) / 2, top: cy - (art.h * scale) / 2, width: art.w * scale, height: art.h * scale, z: 1, scale };
    const pad = 12;
    return { left: a.x + pad, top: a.y + pad, width: b.x - a.x - pad * 2, height: b.y - a.y - pad * 2, z: 1, scale };
  }
  if (def.slot === "rug") {
    const row = y + d / 2;
    const cell = cellWidthAt(row);
    const scale = cell / ART_PX_PER_CELL;
    const c = floorPoint(x + w / 2, row);
    const width = art ? art.w * scale : cell * w * 0.9;
    const height = art ? art.h * scale : cell * d * 0.4;
    return { left: c.x - width / 2, top: c.y - height / 2, width, height, z: 2 + row * 0.01, scale };
  }
  // The line through the middle of the front row it covers.
  const mid = y + d - 0.5;
  const midL = floorPoint(x, mid);
  const midR = floorPoint(x + w, mid);
  const cell = (midR.x - midL.x) / w;
  const scale = cell / ART_PX_PER_CELL;
  const cx = (midL.x + midR.x) / 2;
  const bottom = midL.y + cell * 0.12;
  const z = 10 + (y + d) * 10 + x * 0.1;
  if (art) return { left: cx - (art.w * scale) / 2, top: bottom - art.h * scale, width: art.w * scale, height: art.h * scale, z, scale };
  // Drawn stand-ins: how tall they stand comes from the drawing.
  const width = (midR.x - midL.x) * 0.92;
  const height = cell * furnitureDrawing(def, facing).height;
  return { left: cx - width / 2, top: bottom - height, width, height, z, scale };
}

/** A surface piece on its host, spread across the host's top. */
export function surfaceBox(hostBox: SpriteBox, hostSlots: number, slot: number, surfaceAt: number, art?: ArtSize | null): SpriteBox {
  const slotW = hostBox.width / hostSlots;
  const cx = hostBox.left + slotW * (slot + 0.5);
  const surfaceY = hostBox.top + hostBox.height * surfaceAt;
  const width = art ? art.w * hostBox.scale : Math.min(slotW * 0.7, 100);
  const height = art ? art.h * hostBox.scale : width;
  return { left: cx - width / 2, top: surfaceY - height, width, height, z: hostBox.z + 0.5, scale: hostBox.scale };
}

/** Where a host's top surface is, from its art or its drawing. */
export function surfaceAtOf(def: FurnitureDefinition, facing: Facing, hasArt: boolean): number {
  return hasArt ? (def.surfaceAt ?? 0.15) : (furnitureDrawing(def, facing).surfaceAt ?? 0.3);
}

/** The box for any placed piece (a surface piece through its host).
 *  `artOf` gives a piece's loaded art size, if any. */
export function placedBox(
  piece: PlacedFurniture,
  defOf: (id: string) => FurnitureDefinition | undefined,
  byUid: Map<string, PlacedFurniture>,
  artOf: (piece: PlacedFurniture) => ArtSize | null | undefined
): SpriteBox | null {
  const def = defOf(piece.furnitureId);
  if (!def) return null;
  if (def.slot !== "surface") return spriteBox(def, piece.x, piece.y, piece.facing, artOf(piece));
  const host = piece.hostId ? byUid.get(piece.hostId) : undefined;
  const hostDef = host ? defOf(host.furnitureId) : undefined;
  if (!host || !hostDef?.surfaceSlots) return null;
  const hostArt = artOf(host);
  const hostBox = spriteBox(hostDef, host.x, host.y, host.facing, hostArt);
  return surfaceBox(hostBox, hostDef.surfaceSlots, piece.x, surfaceAtOf(hostDef, host.facing, !!hostArt), artOf(piece));
}

/** Percent strings for absolute positioning over the picture. */
export function pct(box: { left: number; top: number; width: number; height: number }): { left: string; top: string; width: string; height: string } {
  return {
    left: `${(box.left / ROOM_W) * 100}%`,
    top: `${(box.top / ROOM_H) * 100}%`,
    width: `${(box.width / ROOM_W) * 100}%`,
    height: `${(box.height / ROOM_H) * 100}%`,
  };
}
