import type { PlacedFurniture } from "../../engine/types";
import type { AreaGeometry, Pt, SpriteBox } from "./roomGeometry";

// Where pieces that join up with their neighbours (fences) are drawn: a
// post at the middle of their square and half a rail toward each
// neighbour of the same kind. connectors.tsx draws them.

/** The four neighbours that count: left, right, behind, in front. */
const SIDES = [
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
];

/** Which of a piece's sides have a neighbour of the same kind. */
function connectedSides(piece: PlacedFurniture, pieces: PlacedFurniture[]): { dx: number; dy: number }[] {
  const at = new Set(pieces.filter((p) => p.furnitureId === piece.furnitureId).map((p) => `${p.x},${p.y}`));
  return SIDES.filter((s) => at.has(`${piece.x + s.dx},${piece.y + s.dy}`));
}

export interface ConnectorLayout {
  box: SpriteBox;
  base: Pt;
  height: number;
  ends: Pt[];
  post: number;
}

/** Where a connecting piece and its rails go, in picture units. */
export function layoutOf(geo: AreaGeometry, piece: PlacedFurniture, pieces: PlacedFurniture[]): ConnectorLayout {
  const sides = connectedSides(piece, pieces);
  const base = geo.floorPoint(piece.x + 0.5, piece.y + 0.5);
  const cell = geo.floorPoint(piece.x + 1, piece.y + 0.5).x - geo.floorPoint(piece.x, piece.y + 0.5).x;
  const height = cell * 1.2;
  const post = cell * 0.22;
  // Rails run to the midpoint toward each neighbour; alone, a short panel.
  const ends = (sides.length > 0 ? sides : [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }]).map((s) => {
    const n = geo.floorPoint(piece.x + 0.5 + s.dx, piece.y + 0.5 + s.dy);
    const reach = sides.length > 0 ? 0.5 : 0.4;
    return { x: base.x + (n.x - base.x) * reach, y: base.y + (n.y - base.y) * reach };
  });
  const xs = [base.x, ...ends.map((e) => e.x)];
  const ys = [base.y, ...ends.map((e) => e.y)];
  const left = Math.min(...xs) - post;
  const right = Math.max(...xs) + post;
  const top = Math.min(...ys) - height - post;
  const bottom = Math.max(...ys) + 4;
  const z = 10 + (piece.y + 1) * 10 + piece.x * 0.1;
  return { box: { left, top, width: right - left, height: bottom - top, z, scale: cell / 64 }, base, height, ends, post };
}

/** The box a connecting piece is drawn in. */
export function connectorBox(geo: AreaGeometry, piece: PlacedFurniture, pieces: PlacedFurniture[]): SpriteBox {
  return layoutOf(geo, piece, pieces).box;
}

