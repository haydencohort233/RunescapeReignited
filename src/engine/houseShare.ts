import type { Facing, HouseArea, HouseContent, HouseLayout, PathTile, PlacedFurniture } from "./types";
import { areasOf, footprint, groundGrid } from "./systems/house";
import { GRID_SUBDIVISION, HOUSE_BASE_FURNITURE_LIMIT, HOUSE_WALL_COLS, HOUSE_WALL_ROWS, YARD_DECOR_SLOTS, YARD_PATH_TILES } from "./tuning";
import { MAX_LEVEL } from "./xpCurve";

/**
 * Share codes (Player House, Phase 5): a house's whole layout, inside and
 * yard, as plain data (decided: one code for both). This file turns a
 * layout into a compact JSON string and back, checking everything in an
 * incoming one against content: a code is untrusted input from anyone.
 * lib/shareCode.ts compresses the string and adds the "RRH1." prefix.
 *
 * Compact form, version 1:
 *   { v: 1, n: name, w: wallpaperId, f: floorId, r: rugId,
 *     i: Piece[] (inside), y: Piece[] (yard),
 *     xf: frontId, xr: roofId, xg: groundId, xs: skyId, p: Path[] }
 *   Path = [x, y, pathId]. The outside keys came later (Oct 25) and are
 *   optional: older codes get the default looks and no paths.
 *   g: 2 marks codes made on the finer grid (Oct 25); codes without it are
 *   in the old, bigger squares and are doubled when read.
 *   Piece = [furnitureId, x, y, facing (0-3), hostIndex (-1 for none), skinId?]
 * hostIndex points at another piece in the same list.
 */

export const SHARE_FORMAT_VERSION = 1;
const FACINGS: Facing[] = ["front", "right", "back", "left"];
/** The most pieces any house can hold inside (the limit at level 99). */
const MAX_INSIDE = HOUSE_BASE_FURNITURE_LIMIT + Math.floor((MAX_LEVEL - 1) / 2);
export const MAX_SHARE_NAME = 24;

/** A house as shared: who it belongs to and its layout. */
export interface SharedHouse {
  name: string;
  layout: HouseLayout;
}

type CompactPiece = [string, number, number, number, number, string?];

function compactList(pieces: PlacedFurniture[]): CompactPiece[] {
  const index = new Map(pieces.map((p, i) => [p.uid, i]));
  return pieces.map((p) => {
    const host = p.hostId !== undefined ? (index.get(p.hostId) ?? -1) : -1;
    const row: CompactPiece = [p.furnitureId, p.x, p.y, Math.max(0, FACINGS.indexOf(p.facing)), host];
    if (p.skinId) row.push(p.skinId);
    return row;
  });
}

/** The compact JSON for a layout (no prefix or compression). */
export function encodeHouse(house: SharedHouse): string {
  const l = house.layout;
  return JSON.stringify({
    v: SHARE_FORMAT_VERSION,
    n: cleanName(house.name),
    w: l.wallpaperId,
    f: l.floorId,
    r: l.rugId,
    i: compactList(l.inside),
    y: compactList(l.yard),
    xf: l.frontId,
    xr: l.roofId,
    xg: l.groundId,
    xs: l.skyId,
    p: l.paths.map((t) => [t.x, t.y, t.pathId]),
    g: GRID_SUBDIVISION,
    xw: l.weather,
  });
}

/** A house name with control characters and extra spaces taken out,
 *  cut to MAX_SHARE_NAME characters. */
export function cleanName(name: unknown): string {
  if (typeof name !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_SHARE_NAME).trim();
}

/**
 * Reads compact JSON back into a layout, or null if it isn't one. Pieces
 * that don't fit what content allows are dropped: unknown furniture or
 * skins, the wrong area, off the grid, overlapping, a second facility of
 * a kind, or more pieces than any house could hold. Looks fall back to
 * the defaults. The result is safe to draw; it is never saved.
 */
export function decodeHouse(json: string, content: HouseContent): SharedHouse | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.v !== SHARE_FORMAT_VERSION) return null;
  // Codes from before the finer grid are read in the new squares.
  const code = raw.g === GRID_SUBDIVISION ? raw : oldGridCode(raw);
  const furniture = new Map(content.furniture.map((f) => [f.id, f]));
  const skins = new Map(content.skins.map((s) => [s.id, s]));
  const stations = new Set<string>();
  const pick = (id: unknown, list: { id: string }[]) => (typeof id === "string" && list.some((x) => x.id === id) ? id : (list[0]?.id ?? ""));

  const readList = (rows: unknown, area: HouseArea, max: number): PlacedFurniture[] => {
    if (!Array.isArray(rows)) return [];
    const out: PlacedFurniture[] = [];
    const uidOf = (i: number) => `${area}-${i}`;
    const ground = groundGrid(area);
    // Floor, wall and rug pieces first; surface pieces need their host.
    const order = rows.map((_, i) => i).sort((a, b) => Number(isSurface(rows[a])) - Number(isSurface(rows[b])));
    function isSurface(row: unknown): boolean {
      return Array.isArray(row) && furniture.get(row[0])?.slot === "surface";
    }
    for (const i of order) {
      if (out.length >= max) break;
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const [id, x, y, f, host, skin] = row as unknown[];
      const def = typeof id === "string" ? furniture.get(id) : undefined;
      if (!def || !areasOf(def).includes(area)) continue;
      if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
      const facing = FACINGS[typeof f === "number" ? f : 0] ?? "front";
      const piece: PlacedFurniture = { uid: uidOf(i), furnitureId: def.id, x: x as number, y: y as number, facing: def.slot === "floor" ? facing : "front" };
      if (typeof skin === "string" && skins.get(skin)?.furnitureId === def.id) piece.skinId = skin;
      if (def.slot === "surface") {
        const hostPiece = typeof host === "number" ? out.find((p) => p.uid === uidOf(host)) : undefined;
        const hostDef = hostPiece ? furniture.get(hostPiece.furnitureId) : undefined;
        if (!hostPiece || !hostDef?.surfaceSlots || piece.y !== 0 || piece.x < 0 || piece.x >= hostDef.surfaceSlots) continue;
        if (out.some((p) => p.hostId === hostPiece.uid && p.x === piece.x)) continue;
        piece.hostId = hostPiece.uid;
      } else {
        const { w, d } = footprint(def, piece.facing);
        const [cols, rowsN] = def.slot === "wall" ? [HOUSE_WALL_COLS, HOUSE_WALL_ROWS] : [ground.cols, ground.rows];
        if (piece.x < 0 || piece.y < 0 || piece.x + w > cols || piece.y + d > rowsN) continue;
        const overlaps = out.some((o) => {
          const od = furniture.get(o.furnitureId)!;
          if (od.slot !== def.slot) return false;
          const of = footprint(od, o.facing);
          return piece.x < o.x + of.w && o.x < piece.x + w && piece.y < o.y + of.d && o.y < piece.y + d;
        });
        if (overlaps) continue;
      }
      if (def.station) {
        if (stations.has(def.station)) continue;
        stations.add(def.station);
      }
      out.push(piece);
    }
    return out;
  };

  return {
    name: cleanName(code.n),
    layout: {
      inside: readList(code.i, "inside", MAX_INSIDE),
      yard: readList(code.y, "yard", YARD_DECOR_SLOTS),
      wallpaperId: pick(code.w, content.wallpapers),
      floorId: pick(code.f, content.floors),
      rugId: pick(code.r, content.rugs),
      frontId: pick(code.xf, content.fronts),
      roofId: pick(code.xr, content.roofs),
      groundId: pick(code.xg, content.grounds),
      skyId: pick(code.xs, content.skies),
      paths: readPaths(code.p, content),
      weather: code.xw === "off" ? "off" : "auto",
    },
  };
}

/** A code from before the finer grid, in the new squares: positions of
 *  pieces not on a host double, and each path tile becomes four. */
function oldGridCode(raw: Record<string, unknown>): Record<string, unknown> {
  const by = GRID_SUBDIVISION;
  const scale = (rows: unknown) =>
    Array.isArray(rows) ? rows.map((r) => (Array.isArray(r) && typeof r[1] === "number" && typeof r[2] === "number" && (r[4] === -1 || r[4] === undefined) ? [r[0], r[1] * by, r[2] * by, ...r.slice(3)] : r)) : rows;
  const paths = Array.isArray(raw.p)
    ? raw.p.flatMap((r) => {
        if (!Array.isArray(r) || typeof r[0] !== "number" || typeof r[1] !== "number") return [];
        const out = [];
        for (let dy = 0; dy < by; dy++) for (let dx = 0; dx < by; dx++) out.push([r[0] * by + dx, r[1] * by + dy, r[2]]);
        return out;
      })
    : raw.p;
  return { ...raw, i: scale(raw.i), y: scale(raw.y), p: paths };
}

/** Path tiles: known styles, on the yard's grid, one per square. */
function readPaths(rows: unknown, content: HouseContent): PathTile[] {
  if (!Array.isArray(rows)) return [];
  const { cols, rows: rowCount } = groundGrid("yard");
  const seen = new Set<string>();
  const out: PathTile[] = [];
  for (const row of rows) {
    if (out.length >= YARD_PATH_TILES) break;
    if (!Array.isArray(row)) continue;
    const [x, y, id] = row as unknown[];
    if (!Number.isInteger(x) || !Number.isInteger(y) || typeof id !== "string") continue;
    const tx = x as number;
    const ty = y as number;
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rowCount || seen.has(`${tx},${ty}`) || !content.paths.some((p) => p.id === id)) continue;
    seen.add(`${tx},${ty}`);
    out.push({ x: tx, y: ty, pathId: id });
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
