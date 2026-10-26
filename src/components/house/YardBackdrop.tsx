import type { PathStyle, PathTile, RoomCosmetic } from "../../engine/types";
import { ROOM_H, ROOM_W, YARD_DOOR, YARD_HOUSE, type AreaGeometry } from "./roomGeometry";

export interface YardLooks {
  front?: RoomCosmetic;
  roof?: RoomCosmetic;
  ground?: RoomCosmetic;
  sky?: RoomCosmetic;
}

/**
 * The yard picture until yard art exists: sky, the house front with its
 * door (the door's button sits over YARD_DOOR), a lawn whose ground grid is
 * the yard's floor, and painted paths on it. Every part takes its colours
 * from the chosen looks (house front, roof, ground, sky). Drawn in picture
 * units like the room.
 */
export function YardBackdrop({ geo, looks, paths, pathStyles }: { geo: AreaGeometry; looks: YardLooks; paths: PathTile[]; pathStyles: PathStyle[] }) {
  const S = geo.shape;
  const H = YARD_HOUSE;
  const D = YARD_DOOR;
  const [wall, timber, base] = looks.front?.colors ?? ["#d9c9a8", "#6b4220", "#9a9184"];
  const [roof, roofLine] = looks.roof?.colors ?? ["#8a3b2a", "#6e2c1f"];
  const [grass, grassDark, hill] = looks.ground?.colors ?? ["#6fa046", "#4f7f2f", "#86b25a"];
  const [skyTop, skyBottom] = looks.sky?.colors ?? ["#8ec5e8", "#d6ecf5"];
  const night = looks.sky?.id === "night-sky";
  const roofPeak = 6;
  const eave = 40;
  const windows = [
    { x: H.left + 90, y: H.top + 120 },
    { x: H.right - 90 - 120, y: H.top + 120 },
  ];
  const isLog = looks.front?.id === "log-front";
  const isBrick = looks.front?.id === "brick-front";
  const isStone = looks.front?.id === "stone-front";
  const wallTop = H.top + 60;
  const wallBottom = H.bottom - 70;

  const styleOf = new Map(pathStyles.map((p) => [p.id, p]));
  const pathAt = new Map(paths.map((t) => [`${t.x},${t.y}`, t.pathId]));

  return (
    <g>
      <defs>
        <linearGradient id="yard-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyBottom} />
        </linearGradient>
        <linearGradient id="yard-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={grass} />
          <stop offset="1" stopColor={grassDark} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={ROOM_W} height={ROOM_H} fill="url(#yard-sky)" />
      {night && (
        <g fill="#fff8d6">
          <circle cx="1320" cy="80" r="36" />
          {[
            [120, 60],
            [260, 120],
            [420, 40],
            [980, 70],
            [1150, 140],
            [1460, 180],
            [60, 180],
            [700, 30],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />
          ))}
        </g>
      )}
      {/* Hills and hedges behind the house. */}
      <path d={`M0 ${S.floorTop - 70} Q 300 ${S.floorTop - 170} 620 ${S.floorTop - 90} T 1536 ${S.floorTop - 110} V ${S.floorTop} H 0 Z`} fill={hill} opacity={night ? 0.55 : 1} />
      <rect x="0" y={S.floorTop - 30} width={ROOM_W} height="40" fill={grassDark} />

      {/* The house front. */}
      <rect x={H.left} y={wallTop} width={H.right - H.left} height={H.bottom - wallTop} fill={wall} stroke="#3b2414" strokeWidth="6" />
      {isLog &&
        Array.from({ length: 7 }, (_, i) => (
          <line key={i} x1={H.left} y1={wallTop + 26 + i * 26} x2={H.right} y2={wallTop + 26 + i * 26} stroke={timber} strokeWidth="5" opacity="0.7" />
        ))}
      {(isBrick || isStone) &&
        Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: isBrick ? 14 : 9 }, (_, col) => {
            const w = (H.right - H.left) / (isBrick ? 14 : 9);
            const h = 24;
            const x = H.left + col * w + (row % 2 ? w / 2 : 0);
            const y = wallTop + 8 + row * h;
            if (x + w > H.right || y + h > wallBottom) return null;
            return <rect key={`${row}-${col}`} x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={isStone ? 6 : 1} fill="none" stroke={timber} strokeWidth="2" opacity="0.45" />;
          })
        )}
      <rect x={H.left} y={wallBottom} width={H.right - H.left} height="70" fill={base} stroke="#3b2414" strokeWidth="6" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line key={i} x1={H.left + ((H.right - H.left) * (i + 1)) / 8} y1={wallBottom} x2={H.left + ((H.right - H.left) * (i + 1)) / 8} y2={H.bottom} stroke="#3b2414" strokeWidth="3" opacity="0.35" />
      ))}
      {!isLog && !isBrick && !isStone && (
        <path d={`M${H.left + 10} ${H.top + 70} H ${H.right - 10} M ${H.left + 260} ${H.top + 70} V ${wallBottom} M ${H.right - 260} ${H.top + 70} V ${wallBottom}`} stroke={timber} strokeWidth="14" />
      )}
      {/* Roof and chimney. */}
      <rect x={H.right - 200} y={roofPeak + 10} width="56" height="70" fill={base} stroke="#3b2414" strokeWidth="5" />
      <polygon points={`${H.left - eave},${H.top + 70} ${(H.left + H.right) / 2},${roofPeak} ${H.right + eave},${H.top + 70}`} fill={roof} stroke="#3b2414" strokeWidth="6" strokeLinejoin="round" />
      {[1, 2, 3].map((i) => {
        const t = i / 4;
        const y = roofPeak + (H.top + 70 - roofPeak) * t;
        const half = ((H.right - H.left) / 2 + eave) * t;
        return <line key={i} x1={(H.left + H.right) / 2 - half} y1={y} x2={(H.left + H.right) / 2 + half} y2={y} stroke={roofLine} strokeWidth="5" />;
      })}
      {/* Windows, lit at night. */}
      {windows.map((w) => (
        <g key={w.x}>
          <rect x={w.x} y={w.y} width="120" height="96" fill={night ? "#ffd866" : "#f3d27a"} stroke="#3b2414" strokeWidth="6" />
          <path d={`M${w.x + 60} ${w.y} V ${w.y + 96} M ${w.x} ${w.y + 48} H ${w.x + 120}`} stroke="#3b2414" strokeWidth="5" />
          <rect x={w.x - 8} y={w.y + 96} width="136" height="12" fill={timber} stroke="#3b2414" strokeWidth="4" />
        </g>
      ))}
      {/* The door. */}
      <rect x={D.left - 12} y={D.top - 12} width={D.right - D.left + 24} height={D.bottom - D.top + 12} fill={timber} stroke="#3b2414" strokeWidth="6" />
      <rect x={D.left} y={D.top} width={D.right - D.left} height={D.bottom - D.top} fill="#8a5a2e" stroke="#3b2414" strokeWidth="4" />
      {[1, 2].map((i) => (
        <line key={i} x1={D.left + ((D.right - D.left) * i) / 3} y1={D.top + 6} x2={D.left + ((D.right - D.left) * i) / 3} y2={D.bottom - 6} stroke="#6b4220" strokeWidth="4" />
      ))}
      <circle cx={D.right - 22} cy={(D.top + D.bottom) / 2 + 10} r="7" fill="#e8c35a" stroke="#3b2414" strokeWidth="3" />

      {/* The lawn. */}
      <polygon points={`${S.backLeft - 160},${S.floorTop} ${S.backRight + 160},${S.floorTop} ${ROOM_W},${S.floorBottom} ${ROOM_W},${ROOM_H} 0,${ROOM_H} 0,${S.floorBottom}`} fill="url(#yard-grass)" />
      {Array.from({ length: geo.cols + 1 }, (_, i) => {
        const a = geo.floorPoint(i, 0);
        const b = geo.floorPoint(i, geo.rows);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeWidth="2" opacity="0.08" />;
      })}
      {night && <rect x="0" y="0" width={ROOM_W} height={ROOM_H} fill="#0b1030" opacity="0.28" />}

      {/* Painted paths: each tile fills its square; edges show only where
          the next square isn't the same path, so tiles join up. */}
      {paths.map((t) => {
        const style = styleOf.get(t.pathId);
        if (!style) return null;
        const p = (cx: number, cy: number) => geo.floorPoint(cx, cy);
        const a = p(t.x, t.y);
        const b = p(t.x + 1, t.y);
        const c = p(t.x + 1, t.y + 1);
        const d = p(t.x, t.y + 1);
        const same = (dx: number, dy: number) => pathAt.get(`${t.x + dx},${t.y + dy}`) === t.pathId;
        const edges = [
          !same(0, -1) && [a, b],
          !same(1, 0) && [b, c],
          !same(0, 1) && [c, d],
          !same(-1, 0) && [d, a],
        ].filter(Boolean) as [typeof a, typeof a][];
        return (
          <g key={`${t.x},${t.y}`}>
            <polygon points={[a, b, c, d].map((q) => `${q.x},${q.y}`).join(" ")} fill={style.colors[0]} />
            {t.pathId !== "dirt-path" && <polygon points={[a, b, c, d].map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke={style.colors[1]} strokeWidth="1.5" opacity="0.35" />}
            {edges.map(([from, to], i) => (
              <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={style.colors[1]} strokeWidth="5" strokeLinecap="round" />
            ))}
          </g>
        );
      })}
    </g>
  );
}
