import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useGame } from "../../engine/GameEngineContext";
import type { Facing, FurnitureDefinition, FurniturePlacement, HouseArea, PlacedFurniture, StationType } from "../../engine/types";
import type { HouseVisit } from "../../lib/dialog";
import { facingsOf, footprint } from "../../engine/systems/house";
import { formatDuration } from "../../engine/format";
import { recipesAtStation } from "../../content/recipes";
import { CraftCard } from "../TrainingCards";
import { Modal } from "../ui/Modal";
import { CardPanelContext } from "../ui/cardPanel";
import { FurnitureIcon, FurnitureSprite, SkinPicker } from "./houseParts";
import { HousePanel, PanelBody } from "./HousePanels";
import { PANEL_TABS, type PaintTool, type PanelTab } from "./panelTabs";
import { BuildLimit } from "./BuildLimit";
import { WeatherLayer } from "./WeatherLayer";
import { weatherFor } from "./weather";
import { usePreferences } from "../../lib/preferences";
import { setHouseScreenOpen } from "../../lib/sidebar";
import { ConnectorSprite } from "./connectors";
import { connectorBox } from "./connectorGeometry";
import { YardBackdrop } from "./YardBackdrop";
import { ART_CANVAS, ART_Y_OFFSET, geometryOf, gridOf, pct, ROOM_H, ROOM_W, surfaceAtOf, surfaceBox, YARD_DOOR, type SpriteBox } from "./roomGeometry";
import { artSize, pieceArt, useArtVersion } from "./artCache";
import { houseImagePath } from "../../content/assetPaths";

type Mode = "default" | "build";

/** A piece coming out of storage: the next tap on the picture puts it down. */
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
const AREA_KEY = "idlegame:houseArea";

/** Where the owner was last (outside or in), per browser. Visitors always
 *  start outside (decided Oct 24). */
function lastArea(): HouseArea {
  try {
    return window.sessionStorage.getItem(AREA_KEY) === "inside" ? "inside" : "yard";
  } catch {
    return "yard";
  }
}

/**
 * The player house: the yard in front of it and one big room inside, seen
 * from the side like a Club Penguin igloo. The door in the yard goes in;
 * "Outside" comes back out. Use mode uses facilities. Build mode selects a
 * piece: drag it, or Move / Rotate (R) / Store / Cosmetics. With `visit`
 * it shows someone else's layout, read-only. The engine checks every
 * rule; this only asks.
 */
export default function HouseView({ onLeave, visit, visitExtra }: { onLeave: () => void; visit?: HouseVisit; visitExtra?: ReactNode }) {
  const { engine, state, actions } = useGame();
  const house = state.house;
  const layout = visit?.layout ?? house.layout;
  const readOnly = !!visit;
  const [area, setAreaState] = useState<HouseArea>(() => (visit ? "yard" : lastArea()));
  const [mode, setMode] = useState<Mode>("default");
  const [selected, setSelected] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [placeFacing, setPlaceFacing] = useState<Facing>("front");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [station, setStation] = useState<{ station: StationType; name: string } | null>(null);
  // Phones: the panel under the scene (always shown). Wide screens: the
  // left bar's and the bottom bar's tabs.
  const [phoneTab, setPhoneTab] = useState<PanelTab>("build");
  const [leftTab, setLeftTab] = useState<PanelTab>("build");
  const [bottomTab, setBottomTab] = useState<PanelTab>("storage");
  const [phone, setPhone] = useState(() => window.innerWidth < 1024);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const prefs = usePreferences();
  // The yard painter (Build > Paths): a path style or the eraser.
  const [paint, setPaint] = useState<PaintTool>(null);
  const painting = useRef<string | null>(null);
  const paintDown = useRef(false);
  const [skinsFor, setSkinsFor] = useState<string | null>(null);
  // Wide screens fit the picture to the space (no zoom, no scrollbars).
  // Phones start at 1x so the panel under the scene has room; the zoom
  // button enlarges it and a swipe pans (its scrollbar is hidden).
  const [zoom, setZoom] = useState(1);
  const roomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const justDragged = useRef(false);

  useArtVersion(); // re-render as house art finishes loading
  const geo = geometryOf(area);
  const pieces = layout[area];
  const defOf = (id: string) => engine.getFurnitureDef(id);
  const skinArtOf = (piece: PlacedFurniture) => (piece.skinId ? engine.getFurnitureSkin(piece.skinId)?.art : undefined);
  const artFor = (piece: PlacedFurniture) => {
    const def = defOf(piece.furnitureId);
    return def ? pieceArt(def, piece.facing, skinArtOf(piece)) : null;
  };
  const artOf = (piece: PlacedFurniture) => artFor(piece)?.size ?? null;
  // Rebuilt every render: the engine changes the layout in place.
  const byUid = new Map(pieces.map((p) => [p.uid, p]));
  const atHouse = !readOnly && engine.isAtHouse();
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
    if (next === "default") setPaint(null);
    setSelected(null);
    setPlacing(null);
    setMoving(null);
    setHover(null);
  };

  const setArea = (next: HouseArea) => {
    setAreaState(next);
    setPaint(null);
    setSelected(null);
    setPlacing(null);
    setMoving(null);
    setHover(null);
    if (!readOnly) {
      try {
        window.sessionStorage.setItem(AREA_KEY, next);
      } catch {
        // Remembering is a convenience only.
      }
    }
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
      ? engine.placeFurniture(active.uid, { ...placement, facing: placeFacing }, area)
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
    const taken = new Set(pieces.filter((p) => p.hostId === host.uid && p.uid !== ignoreUid).map((p) => p.x));
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

  // The shell hides its sidebar while the house screen is open.
  useEffect(() => {
    setHouseScreenOpen(true);
    return () => setHouseScreenOpen(false);
  }, []);

  // Phones (narrow screens) stack the panel under the scene; wide screens
  // have the left bar and the bottom bar.
  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Phones: the panel fills the space left down to the tab bar.
  useEffect(() => {
    if (!phone || readOnly) return;
    const fit = () => {
      const panel = bodyRef.current?.querySelector<HTMLElement>(".house-panel.is-phone");
      if (!panel) return;
      const nav = document.querySelector<HTMLElement>(".bottom-nav");
      const bottom = nav ? nav.getBoundingClientRect().top : window.innerHeight;
      const room = Math.max(140, bottom - panel.getBoundingClientRect().top - 8);
      panel.style.setProperty("--panel-h", `${room}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    const t = window.setTimeout(fit, 50);
    return () => {
      window.removeEventListener("resize", fit);
      window.clearTimeout(t);
    };
  });

  // Zooming in (phones) starts from the middle of the picture.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [zoom, area]);

  /** A pointer position in picture units. */
  const roomPoint = (clientX: number, clientY: number) => {
    const rect = roomRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { px: ((clientX - rect.left) / rect.width) * ROOM_W, py: ((clientY - rect.top) / rect.height) * ROOM_H };
  };

  /** The host whose top is under a point, for dropping surface pieces. */
  const hostAt = (px: number, py: number, ignoreUid: string): PlacedFurniture | undefined => {
    let best: { host: PlacedFurniture; z: number } | undefined;
    for (const p of pieces) {
      const d = defOf(p.furnitureId);
      if (!d?.surfaceSlots || p.uid === ignoreUid) continue;
      const b = geo.spriteBox(d, p.x, p.y, p.facing, artOf(p));
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
      const cell = geo.cellAt(def.slot, pt.px, pt.py);
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
    const cell = geo.cellAt(drag.def.slot, pt.px, pt.py);
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
    if (readOnly) return;
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

  // Pieces in draw order: back rows first, things on surfaces after their
  // host. Connecting pieces (fences) are drawn with their neighbours' rails.
  const drawn = pieces
    .map((piece) => {
      const def = defOf(piece.furnitureId);
      return { piece, def, box: def?.connects ? connectorBox(geo, piece, pieces) : geo.placedBox(piece, defOf, byUid, artOf) };
    })
    .filter((e): e is { piece: PlacedFurniture; def: FurnitureDefinition; box: SpriteBox } => !!e.def && !!e.box)
    .sort((a, b) => a.box.z - b.box.z);

  // The ghost of the piece being put down, under the pointer.
  let ghost: { points: string; ok: boolean; reason: string | null } | null = null;
  if (active && hover && active.def.slot !== "surface") {
    const reason = engine.getFurniturePlacementBlocker(active.def, { x: hover.x, y: hover.y, facing: active.facing }, placing ? undefined : active.uid, area);
    const { w, d } = footprint(active.def, active.facing);
    ghost = { points: geo.cellsPolygon(active.def.slot, hover.x, hover.y, w, d), ok: !reason, reason };
  }

  const build = house.build;
  const buildLeft = build ? Math.max(0, build.startedAt + build.durationMs - engine.now()) : 0;
  const capMs = engine.getOfflineCapMs();
  const bedBonus = capMs - engine.getBaseOfflineCapMs();
  const tapTargets = !!active && active.def.slot !== "surface" && !drag;
  // Build mode always shows the grid (decided Oct 26): the floor, and the
  // wall inside. The kind being placed is drawn a little stronger.
  const gridSlot = active ? active.def.slot : selectedDef?.slot;
  const strongGrid = gridSlot && gridSlot !== "surface" ? gridOf(gridSlot) : undefined;
  const showFloorGrid = (mode === "build" && !readOnly) || !!paint;
  const showWallGrid = mode === "build" && !readOnly && area === "inside";

  /** Paints (or clears) the square under the pointer, once per square. */
  const paintAt = (clientX: number, clientY: number) => {
    if (!paint) return;
    const pt = roomPoint(clientX, clientY);
    const cell = pt ? geo.cellAt("floor", pt.px, pt.py) : null;
    if (!cell) return;
    const key = `${cell.x},${cell.y}`;
    if (painting.current === key) return;
    painting.current = key;
    run(paint.kind === "erase" ? engine.erasePath(cell.x, cell.y) : engine.paintPath(cell.x, cell.y, paint.pathId));
  };

  // Room looks, from the layout shown (yours or a visited one): art on its
  // canvas when it has loaded, else a drawn stand-in.
  const S = geo.shape;
  const looks = engine.content.house;
  const wallLook = looks?.wallpapers.find((w) => w.id === layout.wallpaperId) ?? looks?.wallpapers[0];
  const floorLook = looks?.floors.find((f) => f.id === layout.floorId) ?? looks?.floors[0];
  const rugLook = looks?.rugs.find((r) => r.id === layout.rugId);
  const wallArt = wallLook?.art ? houseImagePath(wallLook.art) : undefined;
  const floorArt = floorLook?.art ? houseImagePath(floorLook.art) : undefined;
  const wallReady = !!wallArt && !!artSize(wallArt);
  const floorReady = !!floorArt && !!artSize(floorArt);
  const wallColors = wallLook?.colors ?? ["#d9c9a8", "#c7b48f"];
  const floorColors = floorLook?.colors ?? ["#a87a4c", "#7a5432"];
  const rugColors = rugLook?.colors ?? [];
  const rug = [geo.floorPoint(4, 2), geo.floorPoint(12, 2), geo.floorPoint(12.8, 6.8), geo.floorPoint(3.2, 6.8)];
  const canvas = { x: 0, y: -ART_Y_OFFSET, width: ART_CANVAS.w, height: ART_CANVAS.h };
  const inside = area === "inside";

  const yardLooks = {
    front: looks?.fronts.find((l) => l.id === layout.frontId) ?? looks?.fronts[0],
    roof: looks?.roofs.find((l) => l.id === layout.roofId) ?? looks?.roofs[0],
    ground: looks?.grounds.find((l) => l.id === layout.groundId) ?? looks?.grounds[0],
    sky: looks?.skies.find((l) => l.id === layout.skyId) ?? looks?.skies[0],
  };
  const building = mode === "build" && !readOnly;
  const panelCtx = {
    area,
    paint,
    onPaint: (tool: PaintTool) => {
      setPaint(tool);
      if (tool) {
        setMode("build");
        setSelected(null);
        setPlacing(null);
        setMoving(null);
      }
    },
    onPlace: (uid: string, def: FurnitureDefinition) => {
      setMode("build");
      setPaint(null);
      setSelected(null);
      setMoving(null);
      setPlaceFacing(facingsOf(def)[0]);
      setPlacing({ uid, furnitureId: def.id });
    },
  };
  const selectedBox = selectedPiece && building && !active ? drawn.find((d) => d.piece.uid === selectedPiece.uid)?.box : undefined;

  return (
    <section className={`page house${building ? " is-building" : ""}`}>
      <header className="house-header">
        <button type="button" className="btn btn-danger btn-small" onClick={onLeave} title={readOnly ? "Stop visiting" : "Back to town"}>
          ← Leave
        </button>
        <h2 className="page-title house-title">{visit ? visit.name : "Your House"}</h2>
        {!readOnly && (
          <div className="house-seg" role="tablist" aria-label="House mode">
            <button type="button" role="tab" aria-selected={mode === "default"} className={mode === "default" ? "is-active" : ""} onClick={() => switchMode("default")} title="Use facilities">
              Use
            </button>
            <button type="button" role="tab" aria-selected={mode === "build"} className={mode === "build" ? "is-active" : ""} onClick={() => switchMode("build")} title="Move, turn and store pieces">
              Build
            </button>
          </div>
        )}
        {!phone && (
          <button type="button" className="btn btn-small" onClick={() => setArea(inside ? "yard" : "inside")} title={inside ? "Go out to the yard" : "Go in through the door"}>
            {inside ? "🌳 Outside" : "🚪 Inside"}
          </button>
        )}
        {readOnly ? (
          <div className="house-stats text-small">{visitExtra}</div>
        ) : (
          <div className="house-stats text-small">
            <BuildLimit label={inside ? "Build limit" : "Yard limit"} used={pieces.length} max={engine.getHouseAreaLimit(area)} />
            <span title={bedBonus > 0 ? `Your bed adds ${formatDuration(bedBonus)}` : "Place a bed to rest longer while away"}>
              Offline time {formatDuration(capMs)}
              {bedBonus > 0 && ` (bed +${formatDuration(bedBonus).replace(/ 0s$/, "")})`}
            </span>
          </div>
        )}
      </header>

      {!readOnly && !atHouse && !building && <p className="text-warning text-small">You're away from your house portal. You can look, but not change anything.</p>}

      <div className={`house-body is-${readOnly ? "visit" : phone ? "phone" : "wide"}`} ref={bodyRef}>
        {!readOnly && !phone && <HousePanel tabs={["build", "scenery", "houses"]} tab={leftTab} onTab={setLeftTab} ctx={panelCtx} className="is-left" />}
        <div className="house-main">
        <div className="house-stage">
          <div className={`house-scroll${zoom > 1 ? " is-zoomed" : ""}`} ref={scrollRef}>
            <div
              ref={roomRef}
              className={`house-room${inside ? "" : " is-yard"}${building ? " is-build" : ""}${active ? " is-placing" : ""}${drag ? " is-dragging" : ""}${paint ? " is-painting" : ""}`}
              style={zoom > 1 ? { width: `${zoom * 100}%` } : undefined}
              onPointerLeave={() => !drag && setHover(null)}
            >
              <svg className="house-room-bg" viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} preserveAspectRatio="none" aria-hidden="true">
                {inside ? (
                  <>
                    {floorReady ? (
                      <image href={floorArt} {...canvas} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />
                    ) : (
                      <>
                        <polygon points={`${S.backLeft},${S.floorTop} ${S.backRight},${S.floorTop} ${S.frontRight},${S.floorBottom} ${S.frontLeft},${S.floorBottom}`} fill={floorColors[0]} />
                        {Array.from({ length: geo.cols * 2 - 1 }, (_, i) => {
                          const a = geo.floorPoint((i + 1) / 2, 0);
                          const b = geo.floorPoint((i + 1) / 2, geo.rows);
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
                  </>
                ) : (
                  <YardBackdrop geo={geo} looks={yardLooks} paths={layout.paths} pathStyles={looks?.paths ?? []} />
                )}

                {/* Grid lines: a dark outline under a light line, so they read on snow, grass and wood alike. */}
                {showFloorGrid && (
                  <g className={`house-grid${strongGrid === "floor" || paint ? " is-strong" : ""}`}>
                    <path d={geo.gridPath("floor")} className="house-grid-under" />
                    <path d={geo.gridPath("floor")} className="house-grid-over" />
                  </g>
                )}
                {showWallGrid && (
                  <g className={`house-grid${strongGrid === "wall" ? " is-strong" : ""}`}>
                    <path d={geo.gridPath("wall")} className="house-grid-under" />
                    <path d={geo.gridPath("wall")} className="house-grid-over" />
                  </g>
                )}
                {selectedPiece && selectedDef && selectedDef.slot !== "surface" && !active && (
                  <polygon
                    points={geo.cellsPolygon(selectedDef.slot, selectedPiece.x, selectedPiece.y, footprint(selectedDef, selectedPiece.facing).w, footprint(selectedDef, selectedPiece.facing).d)}
                    className="house-footprint is-selected"
                  />
                )}
                {ghost && <polygon points={ghost.points} className={`house-footprint ${ghost.ok ? "is-ok" : "is-bad"}`} />}
              </svg>

              {!inside && layout.weather !== "off" && prefs.weatherEffects && weatherFor(layout.groundId) && <WeatherLayer kind={weatherFor(layout.groundId)!} />}

              <div className="house-room-layer">
                {/* The front door: in you go. */}
                {!inside && !active && !paint && (
                  <button type="button" className="house-door" style={pct({ left: YARD_DOOR.left, top: YARD_DOOR.top, width: YARD_DOOR.right - YARD_DOOR.left, height: YARD_DOOR.bottom - YARD_DOOR.top })} onClick={() => setArea("inside")} aria-label="Go inside">
                    <span className="house-door-label">Enter</span>
                  </button>
                )}

                {drawn.map(({ piece, def, box }) => {
                  const usable = !readOnly && mode === "default" && !!def.station;
                  const inert = readOnly || (mode === "default" && !def.station);
                  return (
                    <button
                      key={piece.uid}
                      type="button"
                      tabIndex={inert ? -1 : undefined}
                      className={`house-piece${piece.uid === selected ? " is-selected" : ""}${usable ? " is-usable" : ""}${inert ? " is-inert" : ""}${active?.uid === piece.uid ? " is-moving" : ""}`}
                      style={{ ...pct(box), zIndex: Math.round(box.z * 10) }}
                      title={usable ? `${STATION_LABEL[def.station!]} at the ${def.name}` : building || readOnly ? def.name : undefined}
                      aria-label={def.name}
                      onPointerDown={(e) => startDrag(e, piece, def)}
                      onPointerMove={onDragMove}
                      onPointerUp={endDrag}
                      onPointerCancel={() => (setDrag(null), setHover(null))}
                      onClick={() => tapPiece(piece, def)}
                    >
                      {def.connects ? (
                        <ConnectorSprite def={def} geo={geo} piece={piece} pieces={pieces} />
                      ) : (
                        <FurnitureSprite def={def} facing={piece.facing} art={artFor(piece)} skinned={!!piece.skinId} box={box} />
                      )}
                      {building && facingsOf(def).length > 1 && (
                        <span className="house-facing" aria-hidden="true">
                          {FACING_ARROW[piece.facing]}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* The selected piece's tools, floating above it. */}
                {selectedBox && selectedPiece && selectedDef && (
                  <div className="house-piece-tools" style={{ left: `${((selectedBox.left + selectedBox.width / 2) / ROOM_W) * 100}%`, top: `${(selectedBox.top / ROOM_H) * 100}%` }}>
                    {facingsOf(selectedDef).length > 1 && (
                      <button type="button" className="btn btn-small" disabled={!atHouse} onClick={rotate} title="Turn it (R)">
                        ⟳ Turn
                      </button>
                    )}
                    <button type="button" className="btn btn-small" disabled={!atHouse} onClick={() => setMoving(selectedPiece.uid)} title="Or drag it">
                      ✥ Move
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!atHouse}
                      onClick={() => {
                        if (run(engine.storeFurniture(selectedPiece.uid))) setSelected(null);
                      }}
                      title="Put it back in storage"
                    >
                      📦 Store
                    </button>
                    {engine.getAvailableFurnitureSkins(selectedDef.id).length > 0 && (
                      <button type="button" className="btn btn-small" disabled={!atHouse} onClick={() => setSkinsFor(selectedPiece.uid)}>
                        ✨ Looks
                      </button>
                    )}
                    <button type="button" className="btn btn-small btn-ghost" aria-label="Deselect" onClick={() => setSelected(null)}>
                      ✕
                    </button>
                  </div>
                )}

                {/* Tap targets for putting a piece down: one per grid cell. */}
                {tapTargets && active && (
                  <svg className="house-targets" viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} preserveAspectRatio="none">
                    {(gridOf(active.def.slot) === "floor" ? geo.floorCells : geo.wallCells).map((c) => (
                      <polygon
                        key={`${c.x}-${c.y}`}
                        points={geo.cellsPolygon(active.def.slot, c.x, c.y, 1, 1)}
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

                {/* The path painter: press and drag across the yard. */}
                {paint && !inside && (
                  <svg
                    className="house-targets is-paint"
                    viewBox={`0 0 ${ROOM_W} ${ROOM_H}`}
                    preserveAspectRatio="none"
                    onPointerDown={(e) => {
                      try {
                        (e.currentTarget as Element).setPointerCapture(e.pointerId);
                      } catch {
                        // Capture only keeps a drag going past the edge.
                      }
                      paintDown.current = true;
                      painting.current = null;
                      paintAt(e.clientX, e.clientY);
                    }}
                    onPointerMove={(e) => paintDown.current && paintAt(e.clientX, e.clientY)}
                    onPointerUp={() => {
                      paintDown.current = false;
                      painting.current = null;
                    }}
                    onPointerCancel={() => (paintDown.current = false)}
                  >
                    <rect x="0" y="0" width={ROOM_W} height={ROOM_H} fill="transparent" />
                  </svg>
                )}

                {/* Free surface slots, while putting down a surface piece. */}
                {active?.def.slot === "surface" &&
                  !drag &&
                  pieces.map((host) => {
                    const hostDef = defOf(host.furnitureId);
                    if (!hostDef?.surfaceSlots) return null;
                    const hostArt = artOf(host);
                    const hostBox = geo.spriteBox(hostDef, host.x, host.y, host.facing, hostArt);
                    const taken = new Set(pieces.filter((p) => p.hostId === host.uid && p.uid !== active.uid).map((p) => p.x));
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

          {/* Phones: inside / outside sits in the scene's corner. */}
        {phone && (
          <button type="button" className="house-area-btn" onClick={() => setArea(inside ? "yard" : "inside")} title={inside ? "Go out to the yard" : "Go in through the door"}>
            {inside ? "🌳 Outside" : "🚪 Inside"}
          </button>
        )}

        {/* Phones: the globe opens Houses and everything online. */}
        {!readOnly && phone && (
          <button type="button" className={`house-globe${phoneTab === "houses" ? " is-active" : ""}`} aria-label="Houses and online" title="Houses and online" onClick={() => setPhoneTab(phoneTab === "houses" ? "build" : "houses")}>
            🌐
          </button>
        )}

        {/* What's being put down, over the top of the scene. */}
          {active && (
            <div className="house-hint-bar">
              <FurnitureIcon def={active.def} size={20} />
              <span className="house-hint-text">
                {placing ? "Placing" : "Moving"} <strong>{active.def.name}</strong>: {active.def.slot === "surface" ? "tap a + on a table or shelf." : `tap a ${gridOf(active.def.slot) === "wall" ? "wall" : inside ? "floor" : "ground"} square.`}
                {ghost?.reason && <span className="text-warning"> {ghost.reason}</span>}
              </span>
              {placing && facingsOf(active.def).length > 1 && (
                <button type="button" className="btn btn-small" onClick={rotate} title="R">
                  Turn {FACING_ARROW[placeFacing]}
                </button>
              )}
              <button type="button" className="btn btn-small" onClick={() => (setPlacing(null), setMoving(null), setHover(null))}>
                Cancel
              </button>
            </div>
          )}
          {paint && !active && <div className="house-hint-bar">{paint.kind === "erase" ? "Tap or drag over path tiles to clear them." : "Tap or drag across the yard to lay path."}</div>}

          <button type="button" className="house-zoom btn" title="Zoom" onClick={() => setZoom(ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length])}>
            🔍 {zoom}x
          </button>
        </div>
          {!readOnly && !phone && <HousePanel tabs={["storage", "servant"]} tab={bottomTab} onTab={setBottomTab} ctx={panelCtx} className="is-bottom" horizontal />}

          {!readOnly && phone && (
            <>
              <div className="house-toolbar" role="tablist" aria-label="House">
                {PANEL_TABS.filter((t) => t.id !== "houses").map((t) => (
                  <button key={t.id} type="button" role="tab" className={`house-tool${phoneTab === t.id ? " is-active" : ""}`} aria-selected={phoneTab === t.id} onClick={() => setPhoneTab(t.id)}>
                    <span aria-hidden="true">{t.id === "servant" ? (servantDef?.portrait ?? t.icon) : t.icon}</span>
                    <span className="house-tool-label">{t.label}</span>
                    {t.id === "build" && build && <span className="house-count">{formatDuration(buildLeft).replace(/ \d+s$/, "")}</span>}
                    {t.id === "storage" && house.storage.length > 0 && <span className="house-count">{house.storage.length}</span>}
                    {t.id === "servant" && servantNote && <span className="house-count">{servantNote}</span>}
                  </button>
                ))}
              </div>
              <section className="house-panel is-phone">
                {phoneTab === "houses" && <h3 className="house-panel-title">🌐 Houses</h3>}
                <div className="house-panel-body">
                  <PanelBody tab={phoneTab} ctx={panelCtx} />
                </div>
              </section>
            </>
          )}
        </div>
      </div>

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
