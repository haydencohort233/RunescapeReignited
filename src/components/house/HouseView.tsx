import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useGame } from "../../engine/GameEngineContext";
import type { Facing, FurnitureDefinition, FurniturePlacement, PlacedFurniture, StationType } from "../../engine/types";
import { facingsOf, footprint } from "../../engine/systems/house";
import { HOUSE_FLOOR_COLS, HOUSE_FLOOR_ROWS, HOUSE_WALL_COLS, HOUSE_WALL_ROWS } from "../../engine/tuning";
import { formatDuration } from "../../engine/format";
import { recipesAtStation } from "../../content/recipes";
import { CraftCard } from "../TrainingCards";
import { Modal } from "../ui/Modal";
import { CardPanelContext } from "../ui/cardPanel";
import { BuildMenu, FurnitureIcon, FurnitureSprite, SkinPicker, StoragePanel } from "./houseParts";
import { ServantPanel } from "./ServantPanel";
import { ART_CANVAS, ART_Y_OFFSET, cellAt, cellsPolygon, floorPoint, gridOf, pct, placedBox, ROOM_H, ROOM_SHAPE, ROOM_W, spriteBox, surfaceAtOf, surfaceBox, type SpriteBox } from "./roomGeometry";
import { artSize, pieceArt, useArtVersion } from "./artCache";
import { houseImagePath } from "../../content/assetPaths";

type Mode = "default" | "build";

/** A piece coming out of storage: the next tap on the room puts it down. */
type Placing = { uid: string; furnitureId: string };

/** A selected piece being dragged to a new spot. */
interface Drag {
  uid: string;
  def: FurnitureDefinition;
  facing: Facing;
  /** Which of its cells the pointer grabbed, so it doesn't jump. */
  grabX: number;
  grabY: number;
  moved: boolean;
}

const STATION_LABEL: Record<StationType, string> = {
  range: "Cook",
  furnace: "Smelt",
  anvil: "Smith",
  sawmill: "Saw planks",
  altar: "Offer bones",
};

const FACING_ARROW: Record<Facing, string> = { front: "↓", right: "→", back: "↑", left: "←" };
const ZOOMS = [1, 1.5, 2];

const floorCells: { x: number; y: number }[] = [];
for (let y = 0; y < HOUSE_FLOOR_ROWS; y++) for (let x = 0; x < HOUSE_FLOOR_COLS; x++) floorCells.push({ x, y });
const wallCells: { x: number; y: number }[] = [];
for (let y = 0; y < HOUSE_WALL_ROWS; y++) for (let x = 0; x < HOUSE_WALL_COLS; x++) wallCells.push({ x, y });

/**
 * The player house: one big room seen from the side, like a Club Penguin
 * igloo. Use mode uses facilities (a sawhorse opens its crafting). Build
 * mode selects a piece: drag it, or Move / Rotate (R) / Store /
 * Cosmetics. Build and Storage sit in the room's bottom corners. The
 * engine checks every rule; this only asks.
 */
export default function HouseView({ onLeave }: { onLeave: () => void }) {
  const { engine, state, actions } = useGame();
  const house = state.house;
  const [mode, setMode] = useState<Mode>("default");
  const [selected, setSelected] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [placeFacing, setPlaceFacing] = useState<Facing>("front");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [station, setStation] = useState<{ station: StationType; name: string } | null>(null);
  const [panel, setPanel] = useState<"build" | "storage" | "servant" | null>(null);
  const [skinsFor, setSkinsFor] = useState<string | null>(null);
  // Phones start zoomed in so the furniture is a comfortable size; the
  // room then scrolls sideways inside its frame.
  const [zoom, setZoom] = useState(() => (window.innerWidth < 600 ? 1.5 : 1));
  const roomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const justDragged = useRef(false);

  useArtVersion(); // re-render as house art finishes loading
  const defOf = (id: string) => engine.getFurnitureDef(id);
  const skinArtOf = (piece: PlacedFurniture) => (piece.skinId ? engine.getFurnitureSkin(piece.skinId)?.art : undefined);
  const artFor = (piece: PlacedFurniture) => {
    const def = defOf(piece.furnitureId);
    return def ? pieceArt(def, piece.facing, skinArtOf(piece)) : null;
  };
  const artOf = (piece: PlacedFurniture) => artFor(piece)?.size ?? null;
  // Rebuilt every render: the engine changes the layout in place.
  const byUid = new Map(house.layout.inside.map((p) => [p.uid, p]));
  const atHouse = engine.isAtHouse();
  const servantDef = engine.getHiredServant();
  const servantOrder = state.servant?.order;
  // On the Servant button: how far the order is.
  const servantNote = servantOrder ? `${Math.floor((servantOrder.quantityCompleted / servantOrder.quantityTotal) * 100)}%` : null;
  const selectedPiece = selected ? byUid.get(selected) : undefined;
  const selectedDef = selectedPiece ? defOf(selectedPiece.furnitureId) : undefined;

  const run = (ok: boolean) => {
    actions.refresh();
    return ok;
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setSelected(null);
    setPlacing(null);
    setMoving(null);
    setHover(null);
  };

  // What's being put down, if anything: from storage, a Move, or a drag.
  const active: { uid: string; def: FurnitureDefinition; facing: Facing } | null = (() => {
    if (placing) {
      const def = defOf(placing.furnitureId);
      return def ? { uid: placing.uid, def, facing: placeFacing } : null;
    }
    const uid = moving ?? (drag?.moved ? drag.uid : null);
    const piece = uid ? byUid.get(uid) : undefined;
    const def = piece ? defOf(piece.furnitureId) : undefined;
    return piece && def ? { uid: piece.uid, def, facing: piece.facing } : null;
  })();

  /** Puts the active piece at a cell, or a host's surface slot. */
  const putDown = (placement: FurniturePlacement) => {
    if (!active) return false;
    const ok = placing
      ? engine.placeFurniture(active.uid, { ...placement, facing: placeFacing })
      : engine.moveFurniture(active.uid, placement);
    run(ok);
    if (ok) {
      setSelected(active.uid);
      setPlacing(null);
      setMoving(null);
      setHover(null);
    }
    return ok;
  };

  /** A free slot on a host for a surface piece, or undefined. */
  const freeSlot = (host: PlacedFurniture, ignoreUid?: string): number | undefined => {
    const hostDef = defOf(host.furnitureId);
    if (!hostDef?.surfaceSlots) return undefined;
    const taken = new Set(house.layout.inside.filter((p) => p.hostId === host.uid && p.uid !== ignoreUid).map((p) => p.x));
    return Array.from({ length: hostDef.surfaceSlots }, (_, i) => i).find((i) => !taken.has(i));
  };

  const rotate = () => {
    if (placing) {
      const def = defOf(placing.furnitureId);
      if (!def) return;
      const f = facingsOf(def);
      setPlaceFacing(f[(f.indexOf(placeFacing) + 1) % f.length]);
    } else if (selectedPiece && atHouse) {
      run(engine.rotateFurniture(selectedPiece.uid));
    }
  };

  // R turns the selected piece (or the one being placed) on desktop.
  const rotateRef = useRef(rotate);
  rotateRef.current = rotate;
  useEffect(() => {
    if (mode !== "build") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector(".dialog-backdrop")) return;
      e.preventDefault();
      rotateRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  // Zooming in (phones) starts from the middle of the room.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [zoom]);

  /** A pointer position in picture units. */
  const roomPoint = (clientX: number, clientY: number) => {
    const rect = roomRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { px: ((clientX - rect.left) / rect.width) * ROOM_W, py: ((clientY - rect.top) / rect.height) * ROOM_H };
  };

  /** The host whose top is under a point, for dropping surface pieces. */
  const hostAt = (px: number, py: number, ignoreUid: string): PlacedFurniture | undefined => {
    let best: { host: PlacedFurniture; z: number } | undefined;
    for (const p of house.layout.inside) {
      const d = defOf(p.furnitureId);
      if (!d?.surfaceSlots || p.uid === ignoreUid) continue;
      const b = spriteBox(d, p.x, p.y, p.facing, artOf(p));
      if (px >= b.left && px <= b.left + b.width && py >= b.top - 30 && py <= b.top + b.height && (!best || b.z > best.z)) best = { host: p, z: b.z };
    }
    return best?.host;
  };

  const startDrag = (e: ReactPointerEvent, piece: PlacedFurniture, def: FurnitureDefinition) => {
    if (mode !== "build" || placing || moving || piece.uid !== selected || !atHouse || e.button !== 0) return;
    const pt = roomPoint(e.clientX, e.clientY);
    if (!pt) return;
    let grabX = 0;
    let grabY = 0;
    if (def.slot !== "surface") {
      const cell = cellAt(def.slot, pt.px, pt.py);
      const { w, d } = footprint(def, piece.facing);
      grabX = cell ? Math.min(w - 1, Math.max(0, cell.x - piece.x)) : 0;
      grabY = cell ? Math.min(d - 1, Math.max(0, cell.y - piece.y)) : 0;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ uid: piece.uid, def, facing: piece.facing, grabX, grabY, moved: false });
  };

  const onDragMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const pt = roomPoint(e.clientX, e.clientY);
    if (!pt) return;
    const piece = byUid.get(drag.uid);
    if (!piece) return;
    if (drag.def.slot === "surface") {
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    const cell = cellAt(drag.def.slot, pt.px, pt.py);
    if (!cell) return;
    const target = { x: cell.x - drag.grabX, y: cell.y - drag.grabY };
    if (target.x !== piece.x || target.y !== piece.y || drag.moved) {
      if (!drag.moved) setDrag({ ...drag, moved: true });
      setHover(target);
    }
  };

  const endDrag = (e: ReactPointerEvent) => {
    if (!drag) return;
    if (drag.moved) {
      justDragged.current = true;
      const pt = roomPoint(e.clientX, e.clientY);
      if (drag.def.slot === "surface") {
        const host = pt ? hostAt(pt.px, pt.py, drag.uid) : undefined;
        const slot = host ? freeSlot(host, drag.uid) : undefined;
        if (host && slot !== undefined) run(engine.moveFurniture(drag.uid, { x: slot, y: 0, hostId: host.uid }));
      } else if (hover) {
        run(engine.moveFurniture(drag.uid, hover));
      }
    }
    setDrag(null);
    setHover(null);
  };

  const tapPiece = (piece: PlacedFurniture, def: FurnitureDefinition) => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    // Putting a surface piece down: tapping a table puts it there.
    if (active?.def.slot === "surface" && def.surfaceSlots) {
      const slot = freeSlot(piece, active.uid);
      if (slot === undefined) {
        engine.notifications.push("status", `There's no room on the ${def.name}.`, { severity: "warning" });
        run(false);
        return;
      }
      putDown({ x: slot, y: 0, hostId: piece.uid });
      return;
    }
    if (active) return;
    if (mode === "build") {
      setSelected(piece.uid === selected ? null : piece.uid);
      return;
    }
    if (def.station) setStation({ station: def.station, name: def.name });
  };

  // Pieces in draw order: back rows first, things on surfaces after their host.
  const drawn = house.layout.inside
    .map((piece) => ({ piece, def: defOf(piece.furnitureId), box: placedBox(piece, defOf, byUid, artOf) }))
    .filter((e): e is { piece: PlacedFurniture; def: FurnitureDefinition; box: SpriteBox } => !!e.def && !!e.box)
    .sort((a, b) => a.box.z - b.box.z);

  // The ghost of the piece being put down, under the pointer.
  let ghost: { points: string; ok: boolean; reason: string | null } | null = null;
  if (active && hover && active.def.slot !== "surface") {
    const reason = engine.getFurniturePlacementBlocker(active.def, { x: hover.x, y: hover.y, facing: active.facing }, placing ? undefined : active.uid);
    const { w, d } = footprint(active.def, active.facing);
    ghost = { points: cellsPolygon(active.def.slot, hover.x, hover.y, w, d), ok: !reason, reason };
  }

  const build = house.build;
  const buildDef = build ? defOf(build.furnitureId) : undefined;
  const buildLeft = build ? Math.max(0, build.startedAt + build.durationMs - engine.now()) : 0;
  const capMs = engine.getOfflineCapMs();
  const bedBonus = capMs - engine.getBaseOfflineCapMs();
  const tapTargets = !!active && active.def.slot !== "surface" && !drag;
  const gridSlot = mode === "build" ? (active ? active.def.slot : selectedDef?.slot) : undefined;
  const showGrid = gridSlot && gridSlot !== "surface" ? gridOf(gridSlot) : undefined;

  // Room looks: art on its canvas when it has loaded, else a drawn stand-in.
  const S = ROOM_SHAPE;
  const wallLook = engine.getHouseWallpaper();
  const floorLook = engine.getHouseFloor();
  const rugLook = engine.getHouseRug();
  const wallArt = wallLook?.art ? houseImagePath(wallLook.art) : undefined;
  const floorArt = floorLook?.art ? houseImagePath(floorLook.art) : undefined;
  const wallReady = !!wallArt && !!artSize(wallArt);
  const floorReady = !!floorArt && !!artSize(floorArt);
  const wallColors = wallLook?.colors ?? ["#d9c9a8", "#c7b48f"];
  const floorColors = floorLook?.colors ?? ["#a87a4c", "#7a5432"];
  const rugColors = rugLook?.colors ?? [];
  const rug = [floorPoint(2, 1), floorPoint(6, 1), floorPoint(6.4, 3.4), floorPoint(1.6, 3.4)];
  const canvas = { x: 0, y: -ART_Y_OFFSET, width: ART_CANVAS.w, height: ART_CANVAS.h };

  return (
    <section className="page house">
      <header className="house-header">
        <button type="button" className="btn" onClick={onLeave} title="Back to town">
          ← Leave
        </button>
        <h2 className="page-title house-title">Your House</h2>
        <div className="house-modes" role="tablist" aria-label="House mode">
          <button type="button" role="tab" aria-selected={mode === "default"} className={`btn${mode === "default" ? " btn-primary" : ""}`} onClick={() => switchMode("default")}>
            Use
          </button>
          <button type="button" role="tab" aria-selected={mode === "build"} className={`btn${mode === "build" ? " btn-primary" : ""}`} onClick={() => switchMode("build")}>
            Build
          </button>
        </div>
        <div className="house-stats text-small">
          <span>
            Pieces {house.layout.inside.length}/{engine.getFurnitureLimit()}
          </span>
          <span title={bedBonus > 0 ? `Your bed adds ${formatDuration(bedBonus)}` : "Place a bed to rest longer while away"}>
            Offline time {formatDuration(capMs)}
            {bedBonus > 0 && ` (bed +${formatDuration(bedBonus).replace(/ 0s$/, "")})`}
          </span>
        </div>
      </header>

      {!atHouse && <p className="text-warning text-small">You're away from your house portal. You can look, but not change anything.</p>}

      {build && buildDef && (
        <div className="card house-build">
          <div className="row row-between">
            <span className="row" style={{ gap: 6 }}>
              <FurnitureIcon def={buildDef} size={22} />
              <span>
                Building <strong>{buildDef.name}</strong>
              </span>
            </span>
            <span className="text-muted text-small">{formatDuration(buildLeft)} left</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min(100, (1 - buildLeft / Math.max(1, build.durationMs)) * 100)}%` }} />
          </div>
          <div className="btn-row house-build-actions">
            <button
              type="button"
              className="btn"
              title="Dev tool for now: skips the time. Later a paid speed-up."
              onClick={() => {
                engine.devSkipTime(buildLeft + 1000);
                actions.refresh();
              }}
            >
              ⚡ Finish now (dev)
            </button>
            <button type="button" className="btn btn-danger" onClick={() => run(engine.cancelFurnitureBuild())}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="house-stage">
        <div className="house-scroll" ref={scrollRef}>
          <div
            ref={roomRef}
            className={`house-room${mode === "build" ? " is-build" : ""}${active ? " is-placing" : ""}${drag ? " is-dragging" : ""}`}
            style={{ aspectRatio: `${ROOM_W} / ${ROOM_H}`, width: `${zoom * 100}%` }}
            onPointerLeave={() => !drag && setHover(null)}
          >
            <svg className="house-room-bg" viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} preserveAspectRatio="none" aria-hidden="true">
              {floorReady ? (
                <image href={floorArt} {...canvas} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />
              ) : (
                <>
                  <polygon points={`${S.backLeft},${S.floorTop} ${S.backRight},${S.floorTop} ${S.frontRight},${S.floorBottom} ${S.frontLeft},${S.floorBottom}`} fill={floorColors[0]} />
                  {Array.from({ length: HOUSE_FLOOR_COLS * 2 - 1 }, (_, i) => {
                    const a = floorPoint((i + 1) / 2, 0);
                    const b = floorPoint((i + 1) / 2, HOUSE_FLOOR_ROWS);
                    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={floorColors[1]} strokeWidth="3" opacity="0.5" />;
                  })}
                </>
              )}
              {wallReady ? (
                <image href={wallArt} {...canvas} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />
              ) : (
                <>
                  <rect x={S.wallLeft - 20} y={S.wallTop - 20} width={S.wallRight - S.wallLeft + 40} height={S.floorTop - S.wallTop + 20} fill={wallColors[0]} />
                  <rect x={S.wallLeft - 20} y={S.floorTop - 24} width={S.wallRight - S.wallLeft + 40} height="24" fill={wallColors[1]} />
                </>
              )}
              {rugColors.length > 0 && <polygon points={rug.map((p) => `${p.x},${p.y}`).join(" ")} fill={rugColors[0]} stroke={rugColors[1]} strokeWidth="10" opacity="0.9" />}

              {showGrid === "floor" && floorCells.map((c) => <polygon key={`f${c.x}-${c.y}`} points={cellsPolygon("floor", c.x, c.y, 1, 1)} className="house-cell" />)}
              {showGrid === "wall" && wallCells.map((c) => <polygon key={`w${c.x}-${c.y}`} points={cellsPolygon("wall", c.x, c.y, 1, 1)} className="house-cell" />)}
              {selectedPiece && selectedDef && selectedDef.slot !== "surface" && !active && (
                <polygon
                  points={cellsPolygon(selectedDef.slot, selectedPiece.x, selectedPiece.y, footprint(selectedDef, selectedPiece.facing).w, footprint(selectedDef, selectedPiece.facing).d)}
                  className="house-footprint is-selected"
                />
              )}
              {ghost && <polygon points={ghost.points} className={`house-footprint ${ghost.ok ? "is-ok" : "is-bad"}`} />}
            </svg>

            <div className="house-room-layer">
              {drawn.map(({ piece, def, box }) => {
                const usable = mode === "default" && !!def.station;
                const inert = mode === "default" && !def.station;
                return (
                  <button
                    key={piece.uid}
                    type="button"
                    tabIndex={inert ? -1 : undefined}
                    className={`house-piece${piece.uid === selected ? " is-selected" : ""}${usable ? " is-usable" : ""}${inert ? " is-inert" : ""}${active?.uid === piece.uid ? " is-moving" : ""}`}
                    style={{ ...pct(box), zIndex: Math.round(box.z * 10) }}
                    title={usable ? `${STATION_LABEL[def.station!]} at the ${def.name}` : mode === "build" ? def.name : undefined}
                    aria-label={def.name}
                    onPointerDown={(e) => startDrag(e, piece, def)}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={() => (setDrag(null), setHover(null))}
                    onClick={() => tapPiece(piece, def)}
                  >
                    <FurnitureSprite def={def} facing={piece.facing} art={artFor(piece)} skinned={!!piece.skinId} box={box} />
                    {mode === "build" && facingsOf(def).length > 1 && (
                      <span className="house-facing" aria-hidden="true">
                        {FACING_ARROW[piece.facing]}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Tap targets for putting a piece down: one per grid cell. */}
              {tapTargets && active && (
                <svg className="house-targets" viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} preserveAspectRatio="none">
                  {(gridOf(active.def.slot) === "floor" ? floorCells : wallCells).map((c) => (
                    <polygon
                      key={`${c.x}-${c.y}`}
                      points={cellsPolygon(active.def.slot, c.x, c.y, 1, 1)}
                      className="house-target"
                      onPointerEnter={() => setHover(c)}
                      onClick={() => {
                        setHover(c);
                        putDown(c);
                      }}
                    />
                  ))}
                </svg>
              )}

              {/* Free surface slots, while putting down a surface piece. */}
              {active?.def.slot === "surface" &&
                !drag &&
                house.layout.inside.map((host) => {
                  const hostDef = defOf(host.furnitureId);
                  if (!hostDef?.surfaceSlots) return null;
                  const hostArt = artOf(host);
                  const hostBox = spriteBox(hostDef, host.x, host.y, host.facing, hostArt);
                  const taken = new Set(house.layout.inside.filter((p) => p.hostId === host.uid && p.uid !== active.uid).map((p) => p.x));
                  return Array.from({ length: hostDef.surfaceSlots }, (_, i) =>
                    taken.has(i) ? null : (
                      <button
                        key={`${host.uid}-${i}`}
                        type="button"
                        className="house-slot"
                        style={{ ...pct(surfaceBox(hostBox, hostDef.surfaceSlots!, i, surfaceAtOf(hostDef, host.facing, !!hostArt), { w: 40, h: 40 })), zIndex: 9999 }}
                        aria-label={`Put it on the ${hostDef.name}`}
                        onClick={() => putDown({ x: i, y: 0, hostId: host.uid })}
                      >
                        +
                      </button>
                    )
                  );
                })}
            </div>
          </div>
        </div>

        <button type="button" className="house-zoom btn" title="Zoom" onClick={() => setZoom(ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length])}>
          🔍 {zoom}x
        </button>
      </div>

      <div className="house-corners">
        <button type="button" className="btn btn-primary house-corner" onClick={() => setPanel("build")}>
          🔨 Build
        </button>
        <button type="button" className="btn house-corner" onClick={() => setPanel("servant")}>
          {servantDef?.portrait ?? "🛎️"} Servant
          {servantNote && <span className="house-count">{servantNote}</span>}
        </button>
        <button type="button" className="btn house-corner" onClick={() => setPanel("storage")}>
          📦 Storage {house.storage.length > 0 && <span className="house-count">{house.storage.length}</span>}
        </button>
      </div>

      {active && (
        <div className="card house-bar">
          <div className="row row-between">
            <span className="row" style={{ gap: 6 }}>
              <FurnitureIcon def={active.def} size={22} />
              <span>
                {placing ? "Placing" : "Moving"} <strong>{active.def.name}</strong>
              </span>
            </span>
            <button type="button" className="btn" onClick={() => (setPlacing(null), setMoving(null), setHover(null))}>
              Cancel
            </button>
          </div>
          <p className="text-small text-muted">
            {active.def.slot === "surface" ? "Tap a + on a table or shelf." : `Tap a ${gridOf(active.def.slot)} square.`}
            {ghost?.reason && <span className="text-warning"> {ghost.reason}</span>}
          </p>
          {placing && facingsOf(active.def).length > 1 && (
            <div className="btn-row">
              <button type="button" className="btn" onClick={rotate} title="R">
                Turn ({FACING_ARROW[placeFacing]})
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "build" && !active && selectedPiece && selectedDef && (
        <div className="card house-bar">
          <div className="row row-between">
            <span className="row" style={{ gap: 6 }}>
              <FurnitureIcon def={selectedDef} size={22} />
              <strong>{selectedDef.name}</strong>
              {selectedPiece.skinId && <span className="text-muted">({engine.getFurnitureSkin(selectedPiece.skinId)?.name})</span>}
            </span>
            <button type="button" className="btn btn-ghost" aria-label="Deselect" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          <div className="btn-row house-actions">
            <button type="button" className="btn" disabled={!atHouse} onClick={() => setMoving(selectedPiece.uid)} title="Or drag it">
              Move
            </button>
            {facingsOf(selectedDef).length > 1 && (
              <button type="button" className="btn" disabled={!atHouse} onClick={rotate} title="R">
                Rotate
              </button>
            )}
            <button
              type="button"
              className="btn"
              disabled={!atHouse}
              onClick={() => {
                if (run(engine.storeFurniture(selectedPiece.uid))) setSelected(null);
              }}
            >
              Store
            </button>
            {engine.getAvailableFurnitureSkins(selectedDef.id).length > 0 && (
              <button type="button" className="btn" disabled={!atHouse} onClick={() => setSkinsFor(selectedPiece.uid)}>
                Cosmetics
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "build" && !active && !selectedPiece && (
        <p className="text-small text-muted house-hint">Tap a piece to select it, then drag it to move it. R turns it on a keyboard.</p>
      )}

      {panel === "build" && <BuildMenu onClose={() => setPanel(null)} />}
      {panel === "servant" && <ServantPanel onClose={() => setPanel(null)} />}
      {panel === "storage" && (
        <StoragePanel
          onClose={() => setPanel(null)}
          onPick={(uid, def) => {
            setPanel(null);
            setMode("build");
            setSelected(null);
            setMoving(null);
            setPlaceFacing(facingsOf(def)[0]);
            setPlacing({ uid, furnitureId: def.id });
          }}
        />
      )}

      {station && (
        <Modal title={station.name} onClose={() => setStation(null)} wide>
          <CardPanelContext.Provider value={true}>
            <div className="stack-sm">
              {engine.isHouseStationBusy(station.station) && (
                <p className="text-small text-warning">
                  Your {servantDef?.name ?? "servant"} is using this.{" "}
                  {(engine.content.stationLocations?.[station.station] ?? []).includes(state.currentLocationId)
                    ? "You're using the one in town instead."
                    : "Cancel their order to use it yourself."}
                </p>
              )}
              {recipesAtStation(station.station).map((recipe) => (
                <CraftCard key={recipe.id} recipe={recipe} onStarted={() => setStation(null)} />
              ))}
            </div>
          </CardPanelContext.Provider>
        </Modal>
      )}

      {skinsFor && (
        <SkinPicker
          uid={skinsFor}
          onClose={() => {
            setSkinsFor(null);
            actions.refresh();
          }}
        />
      )}
    </section>
  );
}
