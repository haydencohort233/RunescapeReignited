import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useGame } from "../../engine/GameEngineContext";
import type { Amenity } from "../../content/amenities";
import { CONDITION_LABELS } from "../../content/display";
import { describeUnmetCondition } from "../../engine/unlockConditions";
import { getActiveGatherSession } from "../../engine/activeAction";
import { getTownScene, SCENE_THEMES, type DecorKind, type ScenePoint, type SceneSpot, type TownScene as Scene } from "../../content/townScenes";
import { showText } from "../../lib/dialog";
import { usePreferences } from "../../lib/preferences";
import { backgroundMarkup, pickSprite, spriteMarkup, SPRITE_GROUND, SPRITE_VIEWBOX } from "./sprites";
import { sceneToCode } from "./sceneCode";

/** Picture width in SVG units; the height depends on the shape (see below). */
const UNITS_W = 800;
/** Desktop is 4:3. Phones get a taller picture so rows of buildings and
 *  their name tags have room; the same percentages spread out on their own. */
const UNITS_H_WIDE = 600;
const UNITS_H_TALL = 1000;

function useTallScene(): boolean {
  const query = "(max-width: 600px)";
  const [tall, setTall] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setTall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return tall;
}

/** Where each amenity sits: its spot from the scene data, or (for one the
 *  data doesn't mention yet) a place along the bottom so it's still
 *  reachable. */
function placeSpots(scene: Scene, amenities: Amenity[]): { amenity: Amenity; spot: SceneSpot }[] {
  const missing = amenities.filter((a) => !scene.spots[a.id]);
  return amenities.map((amenity) => {
    const spot = scene.spots[amenity.id];
    if (spot) return { amenity, spot };
    const i = missing.indexOf(amenity);
    return { amenity, spot: { x: ((i + 1) / (missing.length + 1)) * 100, y: 92 } };
  });
}

type DragTarget =
  | { kind: "spot"; id: string }
  | { kind: "decor"; index: number }
  | { kind: "path"; path: number; point: number }
  | { kind: "plaza" };

/** Moves every path point within a few percent of `near` by `delta`, so
 *  roads stay attached to the building or plaza being dragged. */
function shiftNear(paths: ScenePoint[][], near: ScenePoint, delta: ScenePoint): ScenePoint[][] {
  return paths.map((pts) => pts.map((q) => (Math.hypot(q.x - near.x, q.y - near.y) < 4 ? { x: q.x + delta.x, y: q.y + delta.y } : q)));
}

/** The current position of whatever is being dragged. */
function pointOf(scene: Scene, target: DragTarget, amenities: Amenity[]): ScenePoint {
  switch (target.kind) {
    case "spot":
      return placeSpots(scene, amenities).find((p) => p.amenity.id === target.id)?.spot ?? { x: 50, y: 50 };
    case "decor":
      return scene.decor[target.index];
    case "path":
      return scene.paths[target.path][target.point];
    case "plaza":
      return scene.plaza ?? { x: 50, y: 50 };
  }
}

const ADDABLE: DecorKind[] = ["tree", "pine", "willow", "bush", "rock", "stump", "logs", "pond"];

/**
 * The Home tab's picture of where you are: the place's name on a sign,
 * and every amenity drawn as a building or spot with a clickable name tag.
 * Layouts live in content/townScenes.ts; with the scene editor on (dev
 * tools) everything can be dragged and the new layout copied out.
 */
export default function TownScene({
  locationId,
  locationName,
  amenities,
  onOpen,
}: {
  locationId: string;
  locationName: string;
  amenities: Amenity[];
  onOpen: (amenity: Amenity) => void;
}) {
  const { state } = useGame();
  const editing = usePreferences().sceneEditor;
  const tall = useTallScene();
  const unitsH = tall ? UNITS_H_TALL : UNITS_H_WIDE;

  // The editor works on a copy; it starts from the data file and resets
  // when you travel or turn the editor off.
  const source = getTownScene(locationId);
  const [draft, setDraft] = useState<Scene>(source);
  const [selectedDecor, setSelectedDecor] = useState<number | null>(null);
  useEffect(() => {
    setDraft(getTownScene(locationId));
    setSelectedDecor(null);
  }, [locationId, editing]);
  const scene = editing ? draft : source;
  const theme = SCENE_THEMES[scene.theme] ?? SCENE_THEMES.town;

  const background = useMemo(() => backgroundMarkup(locationId, scene, theme, UNITS_W, unitsH), [locationId, scene, theme, unitsH]);
  const placed = placeSpots(scene, amenities).sort((a, b) => a.spot.y - b.spot.y);
  const gathering = getActiveGatherSession(state);

  // ── Editor dragging ──
  const boxRef = useRef<HTMLDivElement | null>(null);
  // Where the pointer grabbed the thing, relative to its point, so it
  // doesn't jump to the pointer when the drag starts.
  const drag = useRef<{ target: DragTarget; offset: ScenePoint } | null>(null);
  const toPercent = (e: { clientX: number; clientY: number }): ScenePoint => {
    const rect = boxRef.current!.getBoundingClientRect();
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    return { x: clamp(((e.clientX - rect.left) / rect.width) * 100), y: clamp(((e.clientY - rect.top) / rect.height) * 100) };
  };
  const moveTo = (target: DragTarget, p: ScenePoint) =>
    setDraft((s) => {
      switch (target.kind) {
        case "spot": {
          // Path ends that touch the building's doorstep come along with it.
          const from = pointOf(s, target, amenities);
          const door = { x: from.x, y: from.y + 3 };
          return {
            ...s,
            spots: { ...s.spots, [target.id]: { ...(s.spots[target.id] ?? {}), ...p } },
            paths: shiftNear(s.paths, door, { x: p.x - from.x, y: p.y - from.y }),
          };
        }
        case "decor":
          return { ...s, decor: s.decor.map((d, i) => (i === target.index ? { ...d, ...p } : d)) };
        case "path":
          return { ...s, paths: s.paths.map((pts, i) => (i === target.path ? pts.map((q, j) => (j === target.point ? p : q)) : pts)) };
        case "plaza": {
          // Roads that meet at the plaza stay joined to it.
          const from = s.plaza ?? p;
          return { ...s, plaza: p, paths: shiftNear(s.paths, from, { x: p.x - from.x, y: p.y - from.y }) };
        }
      }
    });
  const startDrag = (target: DragTarget) => (e: ReactPointerEvent) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const at = toPercent(e);
    const from = pointOf(draft, target, amenities);
    drag.current = { target, offset: { x: at.x - from.x, y: at.y - from.y } };
    if (target.kind === "decor") setSelectedDecor(target.index);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const at = toPercent(e);
    const { offset } = drag.current;
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    moveTo(drag.current.target, { x: clamp(at.x - offset.x), y: clamp(at.y - offset.y) });
  };
  const endDrag = () => {
    drag.current = null;
  };

  const copyLayout = () =>
    void showText(
      `${locationName} layout`,
      `Paste this over the "${locationId}" block in src/content/townScenes.ts.`,
      sceneToCode(locationId, { ...draft, spots: Object.fromEntries(placeSpots(draft, amenities).map(({ amenity, spot }) => [amenity.id, spot])) })
    );
  const editDecor = (patch: (d: Scene["decor"][number]) => Scene["decor"][number] | null) =>
    setDraft((s) => {
      if (selectedDecor === null) return s;
      const next = s.decor.map((d, i) => (i === selectedDecor ? patch(d) : d)).filter((d): d is NonNullable<typeof d> => d !== null);
      return { ...s, decor: next };
    });
  const selected = selectedDecor !== null ? draft.decor[selectedDecor] : undefined;

  return (
    <div className="stack-sm">
      {editing && (
        <div className="scene-editor card">
          <div className="row row-between">
            <strong>Scene layout editor</strong>
            <span className="btn-row">
              <button type="button" className="btn btn-primary" onClick={copyLayout}>
                Copy layout
              </button>
              <button type="button" className="btn" onClick={() => setDraft(getTownScene(locationId))}>
                Reset
              </button>
            </span>
          </div>
          <p className="text-muted text-small">
            Drag buildings, green dots (trees, rocks, ponds), brown squares (path points) or the ring (plaza). Click a dot to pick it.
          </p>
          <div className="row text-small">
            <span className="text-faint">Add:</span>
            {ADDABLE.map((kind) => (
              <button
                key={kind}
                type="button"
                className="chip"
                onClick={() => {
                  setDraft((s) => ({ ...s, decor: [...s.decor, { kind, x: 50, y: 50 }] }));
                  setSelectedDecor(draft.decor.length);
                }}
              >
                {kind}
              </button>
            ))}
          </div>
          {selected && (
            <div className="row text-small">
              <span>
                Picked: <strong>{selected.kind}</strong> at {selected.x.toFixed(1)}, {selected.y.toFixed(1)} · size {(selected.size ?? 1).toFixed(1)}
              </span>
              <span className="btn-row">
                <button type="button" className="btn" onClick={() => editDecor((d) => ({ ...d, size: Math.max(0.3, (d.size ?? 1) - 0.1) }))}>
                  Smaller
                </button>
                <button type="button" className="btn" onClick={() => editDecor((d) => ({ ...d, size: Math.min(3, (d.size ?? 1) + 0.1) }))}>
                  Bigger
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    editDecor(() => null);
                    setSelectedDecor(null);
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
          )}
        </div>
      )}

      <div
        ref={boxRef}
        className={`scene${tall ? " is-tall" : ""}${editing ? " is-editing" : ""}`}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg className="scene-bg" viewBox={`0 0 ${UNITS_W} ${unitsH}`} preserveAspectRatio="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: background }} />

        <h2 className="scene-sign">{locationName}</h2>

        {placed.map(({ amenity, spot }) => {
          const lock = amenity.unlockCondition ? describeUnmetCondition(amenity.unlockCondition, state, CONDITION_LABELS) : null;
          const active = gathering?.amenityId === amenity.id;
          const { sprite, look } = pickSprite(amenity, spot);
          const label = spot.label ?? amenity.name;
          return (
            <button
              key={amenity.id}
              type="button"
              className={`scene-spot${lock ? " is-locked" : ""}${active ? " is-active" : ""}`}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                transform: `translate(-50%, -${SPRITE_GROUND * 100}%) scale(${spot.size ?? 1})`,
                transformOrigin: `50% ${SPRITE_GROUND * 100}%`,
              }}
              title={lock ? `${label} (locked)` : amenity.description}
              onPointerDown={startDrag({ kind: "spot", id: amenity.id })}
              onClick={() => {
                if (editing) return;
                onOpen(amenity);
              }}
            >
              <svg viewBox={SPRITE_VIEWBOX} aria-hidden="true" dangerouslySetInnerHTML={{ __html: spriteMarkup(sprite, look, amenity) }} />
              <span className="scene-label">
                {lock ? "🔒 " : active ? <span className="scene-live" aria-hidden="true" /> : null}
                {label}
              </span>
            </button>
          );
        })}

        {editing && (
          <>
            {scene.decor.map((d, i) => (
              <span
                key={`d${i}`}
                className={`scene-handle is-decor${selectedDecor === i ? " is-selected" : ""}`}
                style={{ left: `${d.x}%`, top: `${d.y}%` }}
                title={`${d.kind} (${d.x.toFixed(1)}, ${d.y.toFixed(1)})`}
                onPointerDown={startDrag({ kind: "decor", index: i })}
              />
            ))}
            {scene.paths.map((pts, pi) =>
              pts.map((p, j) => (
                <span
                  key={`p${pi}-${j}`}
                  className="scene-handle is-path"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={`path ${pi + 1}, point ${j + 1}`}
                  onPointerDown={startDrag({ kind: "path", path: pi, point: j })}
                />
              ))
            )}
            {scene.plaza && (
              <span className="scene-handle is-plaza" style={{ left: `${scene.plaza.x}%`, top: `${scene.plaza.y}%` }} title="plaza" onPointerDown={startDrag({ kind: "plaza" })} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

