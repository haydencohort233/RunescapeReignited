import type { Facing, FurnitureDefinition, FurnitureSlot, HouseArea, PlacedFurniture } from "../../engine/types";
import { footprint, groundGrid } from "../../engine/systems/house";
import { furnitureDrawing } from "./furnitureSprites";
import type { ArtSize } from "./artCache";
import { HOUSE_WALL_COLS, HOUSE_WALL_ROWS } from "../../engine/tuning";

// Where things sit in the house pictures. Positions are in picture units:
// the room art's own 1536 x 1024 canvas (assets/house/), cropped to the
// band that has art in it (ART_Y_OFFSET from the top, ROOM_H tall). The
// view turns them into percentages, so the picture scales to any width.
// The room's numbers trace the default floor and wall art; a new floor or
// wall cosmetic is drawn on the same canvas so it lines up. The yard uses
// the same picture size with its own ground (a lawn in front of the house).

export const ROOM_W = 1536;
export const ROOM_H = 830;
/** Where the cropped room starts on the art canvas. */
export const ART_Y_OFFSET = 100;
export const ART_CANVAS = { w: 1536, h: 1024 };

/** Art pixels per grid square (decided Oct 25: 64 px per square): a
 *  64-pixel chair is one square wide, a 128-pixel table two, at the row's
 *  perspective scale. */
export const ART_PX_PER_CELL = 64;

/** Drawn stand-ins give their heights in widths of the old, bigger
 *  squares (two of today's). */
const DRAWING_UNIT = 2;

export interface Pt {
  x: number;
  y: number;
}

/** The walkable ground (a trapezoid, narrow at the back) and the wall
 *  panel where wall pieces hang (inside only). */
export interface AreaShape {
  floorTop: number;
  floorBottom: number;
  backLeft: number;
  backRight: number;
  frontLeft: number;
  frontRight: number;
  wallLeft: number;
  wallRight: number;
  wallTop: number;
  wallBottom: number;
}

const ROOM_SHAPE: AreaShape = {
  floorTop: 278,
  floorBottom: 784,
  backLeft: 302,
  backRight: 1229,
  frontLeft: 52,
  frontRight: 1480,
  wallLeft: 322,
  wallRight: 1218,
  wallTop: 42,
  wallBottom: 268,
};

/** The yard: the house front across the back, a lawn in front of it.
 *  No wall grid (wall pieces hang inside). */
const YARD_SHAPE: AreaShape = {
  floorTop: 392,
  floorBottom: 812,
  backLeft: 150,
  backRight: 1386,
  frontLeft: 0,
  frontRight: 1536,
  wallLeft: 0,
  wallRight: 0,
  wallTop: 0,
  wallBottom: 0,
};

/** Where the house front and its door are drawn in the yard picture. */
export const YARD_HOUSE = { left: 380, right: 1156, top: 70, bottom: 392 };
export const YARD_DOOR = { left: 712, right: 824, top: 236, bottom: 392 };

/** Floor and rug pieces share the floor grid. */
export type GridSlot = "floor" | "wall";
export const gridOf = (slot: FurnitureSlot): GridSlot => (slot === "wall" ? "wall" : "floor");

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

/** One area's picture maths: grid corners, cells under the pointer and
 *  where each piece is drawn. */
export interface AreaGeometry {
  area: HouseArea;
  shape: AreaShape;
  cols: number;
  rows: number;
  floorCells: { x: number; y: number }[];
  wallCells: { x: number; y: number }[];
  floorPoint(col: number, row: number): Pt;
  cellsPolygon(slot: FurnitureSlot, x: number, y: number, w: number, d: number): string;
  cellAt(slot: FurnitureSlot, px: number, py: number): { x: number; y: number } | null;
  /** Every line of a grid as one SVG path (drawn twice for contrast). */
  gridPath(grid: GridSlot): string;
  spriteBox(def: FurnitureDefinition, x: number, y: number, facing: Facing, art?: ArtSize | null): SpriteBox;
  placedBox(
    piece: PlacedFurniture,
    defOf: (id: string) => FurnitureDefinition | undefined,
    byUid: Map<string, PlacedFurniture>,
    artOf: (piece: PlacedFurniture) => ArtSize | null | undefined
  ): SpriteBox | null;
}

function makeGeometry(area: HouseArea, S: AreaShape): AreaGeometry {
  const { cols, rows } = groundGrid(area);
  const wallCols = area === "inside" ? HOUSE_WALL_COLS : 0;
  const wallRows = area === "inside" ? HOUSE_WALL_ROWS : 0;

  /** A grid corner on the ground: col 0..cols, row 0..rows (0 at the back). */
  const floorPoint = (col: number, row: number): Pt => {
    const t = row / rows;
    const y = S.floorTop + t * (S.floorBottom - S.floorTop);
    const left = S.backLeft + (S.frontLeft - S.backLeft) * t;
    const right = S.backRight + (S.frontRight - S.backRight) * t;
    return { x: left + ((right - left) * col) / cols, y };
  };

  /** A grid corner on the back wall: col 0..8, row 0..2 (0 at the top). */
  const wallPoint = (col: number, row: number): Pt => ({
    x: S.wallLeft + ((S.wallRight - S.wallLeft) * col) / wallCols,
    y: S.wallTop + ((S.wallBottom - S.wallTop) * row) / wallRows,
  });

  /** Width of one ground cell at a row (fractional rows allowed). */
  const cellWidthAt = (row: number): number => floorPoint(1, row).x - floorPoint(0, row).x;

  const cellsPolygon = (slot: FurnitureSlot, x: number, y: number, w: number, d: number): string => {
    const p = gridOf(slot) === "floor" ? floorPoint : wallPoint;
    return [p(x, y), p(x + w, y), p(x + w, y + d), p(x, y + d)].map((q) => `${q.x},${q.y}`).join(" ");
  };

  const cellAt = (slot: FurnitureSlot, px: number, py: number): { x: number; y: number } | null => {
    if (gridOf(slot) === "wall") {
      if (wallCols === 0) return null;
      const x = Math.floor(((px - S.wallLeft) / (S.wallRight - S.wallLeft)) * wallCols);
      const y = Math.floor(((py - S.wallTop) / (S.wallBottom - S.wallTop)) * wallRows);
      return x >= 0 && x < wallCols && y >= 0 && y < wallRows ? { x, y } : null;
    }
    const t = (py - S.floorTop) / (S.floorBottom - S.floorTop);
    const left = S.backLeft + (S.frontLeft - S.backLeft) * t;
    const right = S.backRight + (S.frontRight - S.backRight) * t;
    const x = Math.floor(((px - left) / (right - left)) * cols);
    const y = Math.floor(t * rows);
    return x >= 0 && x < cols && y >= 0 && y < rows ? { x, y } : null;
  };

  /**
   * The box for a piece at a spot. With art, the image is drawn at its
   * pixel size times the row's scale: floor pieces stand on the middle of
   * the front row of their footprint, centred across it; rugs lie centred
   * on their cells; wall pieces hang centred in their cells. Without art
   * the drawn stand-in fills a box sized by its drawing.
   */
  const spriteBox = (def: FurnitureDefinition, x: number, y: number, facing: Facing, art?: ArtSize | null): SpriteBox => {
    const { w, d } = footprint(def, facing);
    if (def.slot === "wall") {
      const a = wallPoint(x, y);
      const b = wallPoint(x + w, y + d);
      const scale = cellWidthAt(0) / ART_PX_PER_CELL;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (art) return { left: cx - (art.w * scale) / 2, top: cy - (art.h * scale) / 2, width: art.w * scale, height: art.h * scale, z: 1, scale };
      const pad = 8;
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
    const height = cell * DRAWING_UNIT * furnitureDrawing(def, facing).height;
    return { left: cx - width / 2, top: bottom - height, width, height, z, scale };
  };

  const placedBox: AreaGeometry["placedBox"] = (piece, defOf, byUid, artOf) => {
    const def = defOf(piece.furnitureId);
    if (!def) return null;
    if (def.slot !== "surface") return spriteBox(def, piece.x, piece.y, piece.facing, artOf(piece));
    const host = piece.hostId ? byUid.get(piece.hostId) : undefined;
    const hostDef = host ? defOf(host.furnitureId) : undefined;
    if (!host || !hostDef?.surfaceSlots) return null;
    const hostArt = artOf(host);
    const hostBox = spriteBox(hostDef, host.x, host.y, host.facing, hostArt);
    return surfaceBox(hostBox, hostDef.surfaceSlots, piece.x, surfaceAtOf(hostDef, host.facing, !!hostArt), artOf(piece));
  };

  const floorCells: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) floorCells.push({ x, y });
  const wallCells: { x: number; y: number }[] = [];
  for (let y = 0; y < wallRows; y++) for (let x = 0; x < wallCols; x++) wallCells.push({ x, y });

  const gridPath = (grid: GridSlot): string => {
    const [c, r, p] = grid === "wall" ? [wallCols, wallRows, wallPoint] : [cols, rows, floorPoint];
    if (c === 0) return "";
    const seg = (a: Pt, b: Pt) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    const parts: string[] = [];
    for (let i = 0; i <= c; i++) parts.push(seg(p(i, 0), p(i, r)));
    for (let j = 0; j <= r; j++) parts.push(seg(p(0, j), p(c, j)));
    return parts.join("");
  };

  return { area, shape: S, cols, rows, floorCells, wallCells, floorPoint, cellsPolygon, cellAt, gridPath, spriteBox, placedBox };
}

export const ROOM_GEOMETRY = makeGeometry("inside", ROOM_SHAPE);
export const YARD_GEOMETRY = makeGeometry("yard", YARD_SHAPE);

export function geometryOf(area: HouseArea): AreaGeometry {
  return area === "yard" ? YARD_GEOMETRY : ROOM_GEOMETRY;
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

/** Percent strings for absolute positioning over the picture. */
export function pct(box: { left: number; top: number; width: number; height: number }): { left: string; top: string; width: string; height: string } {
  return {
    left: `${(box.left / ROOM_W) * 100}%`,
    top: `${(box.top / ROOM_H) * 100}%`,
    width: `${(box.width / ROOM_W) * 100}%`,
    height: `${(box.height / ROOM_H) * 100}%`,
  };
}
