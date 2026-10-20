import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { MAP_LOCATIONS, MAP_WIDTH, MAP_HEIGHT, getLocation } from "../content/mapLocations";
import { ROADS } from "../content/roads";
import { AMENITY_ICON, getAmenitiesAtLocation, type Amenity } from "../content/amenities";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { CONDITION_LABELS } from "../content/display";
import { formatDuration } from "../engine/format";
import { formatCountdown } from "../engine/time";
import { getActiveTravel } from "../engine/activeAction";
import { pointAlongRoute, type TravelRoute } from "../engine/roads";
import type { MapLocation, MapPoint, RecipeInput, RoadDefinition } from "../engine/types";
import ActivityCard from "./ActivityCard";
import { confirmAndStartTravel } from "../engine/actionHelpers";
import { worldMapPath, locationIconPath, mapUiIconPath, skillIconPath } from "../content/assetPaths";
import { preloadImages } from "../lib/imagePreloader";
import { centerOn, frame, toScreen, type Camera, type Size } from "../lib/mapCamera";
import { useMapCamera } from "./map/useMapCamera";
import { pinStatus, questsAt, type PinStatus } from "./map/locationStatus";
import { QUEST_CATALOG } from "../content/quests";
import { getNpc } from "../content/npcs";
import { formatNumber } from "../engine/format";
import GameImage from "./GameImage";

const MAP: Size = { w: MAP_WIDTH, h: MAP_HEIGHT };
/** Zoom the list flies to when you pick a place. */
const PICK_SCALE = 0.75;
/** Below this width the place panel is a sheet across the map; from it,
 *  a PANEL_WIDTH card in the lower left. */
const WIDE_LAYOUT_PX = 760;
const PANEL_WIDTH = 320;

/** Order the amenity icons and the panel's list are shown in. */
const AMENITY_ORDER: Amenity["kind"][] = [
  "shop",
  "jobBoard",
  "npc",
  "craftingStation",
  "resourceNode",
  "combatEncounter",
  "dungeonEntrance",
];

const SHORTCUTS = ROADS.filter((r) => r.requires);

/** Where the map was left, so switching tabs and back doesn't reset it. */
let savedCamera: { cam: Camera; view: Size } | null = null;

function locationsFrame(view: Size): Camera {
  return frame(MAP_LOCATIONS, view, Math.min(80, view.w / 6), 1.2);
}

/** The player's position: on the route while travelling, else where they stand. */
function playerPoint(route: TravelRoute | null, startedAt: number, durationMs: number, now: number, here?: MapPoint): MapPoint | null {
  if (route) return pointAlongRoute(route.points, (now - startedAt) / durationMs);
  return here ? { x: here.x, y: here.y } : null;
}

function roadPoints(road: RoadDefinition): MapPoint[] {
  const a = getLocation(road.from)!;
  const b = getLocation(road.to)!;
  return [a, ...(road.via ?? []), b];
}

const svgPoints = (points: MapPoint[]) => points.map((p) => `${p.x},${p.y}`).join(" ");

export default function MapView() {
  const { engine, state } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void preloadImages([worldMapPath(), mapUiIconPath("player"), ...MAP_LOCATIONS.map((l) => locationIconPath(l.name))]);
  }, []);

  useEffect(() => {
    const el = layoutRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWide(el.getBoundingClientRect().width >= WIDE_LAYOUT_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const initialCamera = useCallback((view: Size) => {
    const saved = savedCamera;
    if (saved && saved.view.w === view.w && saved.view.h === view.h) return saved.cam;
    return locationsFrame(view);
  }, []);
  const { view, cam, animateTo, zoomBy, wasDrag, handlers } = useMapCamera(viewportRef, MAP, initialCamera);

  useEffect(() => {
    if (cam && view) savedCamera = { cam, view };
  }, [cam, view]);

  // Escape closes the open place.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentLocation = getLocation(state.currentLocationId);
  const selected = selectedId ? getLocation(selectedId) : undefined;
  const travel = getActiveTravel(state);
  const destination = travel ? getLocation(travel.destinationLocationId) : undefined;
  const travelRoute = useMemo(
    () => (currentLocation && destination ? engine.getTravelRoute(currentLocation, destination) : null),
    // Recomputed when the trip changes, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, currentLocation?.id, destination?.id, travel?.startedAt]
  );

  const lockReason = (loc: MapLocation) =>
    loc.unlockCondition ? describeUnmetCondition(loc.unlockCondition, state, CONDITION_LABELS) : null;
  const routeTo = (loc: MapLocation) =>
    currentLocation && loc.id !== currentLocation.id && !lockReason(loc) ? engine.getTravelRoute(currentLocation, loc) : null;
  const previewRoute = selected ? routeTo(selected) : null;
  const statuses = new Map(MAP_LOCATIONS.map((l) => [l.id, pinStatus(engine, l.id)]));
  const shortcutOpen = (road: RoadDefinition) => !road.requires || !describeUnmetCondition(road.requires, state, CONDITION_LABELS);

  /** Selects a place. From the list (`pan`) the map flies to it; from a tap
   *  it only moves when the place would end up under the phone sheet. */
  const select = (id: string | null, pan: boolean) => {
    setSelectedId(id);
    const loc = id ? getLocation(id) : undefined;
    if (!loc || !cam || !view) return;
    // Aim for the part of the map the panel doesn't cover: right of the
    // card when wide, above the sheet when narrow.
    const anchor = wide ? { x: (view.w + PANEL_WIDTH) / 2, y: view.h / 2 } : { x: view.w / 2, y: view.h * 0.3 };
    const at = toScreen(cam, loc);
    if (pan) {
      animateTo(centerOn(loc, Math.max(cam.scale, PICK_SCALE), view, anchor));
    } else if (wide ? at.x < PANEL_WIDTH + 24 && at.y > view.h * 0.35 : at.y > view.h * 0.4) {
      animateTo(wide ? { ...cam, x: cam.x + anchor.x - at.x } : { ...cam, y: cam.y + anchor.y - at.y });
    }
  };

  const centerOnPlayer = () => {
    if (!cam || !view) return;
    const p = playerPoint(travelRoute, travel?.startedAt ?? 0, travel?.durationMs ?? 1, engine.now(), currentLocation);
    if (p) animateTo(centerOn(p, Math.max(cam.scale, PICK_SCALE), view));
  };


  return (
    <section className="page map-page" aria-label="World map">
      <div ref={layoutRef} className={`map-layout${wide ? " is-wide" : ""}`}>
        <div className="map-frame">
          <div
            ref={viewportRef}
            className="map-viewport"
            tabIndex={0}
            role="region"
            aria-label="World map. Drag to move, scroll or pinch to zoom, arrow keys and plus or minus when focused."
            {...handlers}
            onClick={() => {
              if (!wasDrag()) select(null, false);
            }}
          >
            {cam && view && (
              <>
                <img
                  className="map-art"
                  src={worldMapPath()}
                  alt=""
                  draggable={false}
                  width={MAP.w}
                  height={MAP.h}
                  style={{
                    transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
                    imageRendering: cam.scale >= 1 ? "pixelated" : "auto",
                  }}
                />
                <svg className="map-routes" width={view.w} height={view.h} aria-hidden="true">
                  <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.scale})`}>
                    {SHORTCUTS.map((road) => (
                      <g key={`${road.from}-${road.to}`}>
                        <polyline className="map-shortcut-casing" points={svgPoints(roadPoints(road))} vectorEffect="non-scaling-stroke" />
                        <polyline
                          className={`map-shortcut${shortcutOpen(road) ? "" : " is-locked"}`}
                          points={svgPoints(roadPoints(road))}
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    ))}
                    {travelRoute && (
                      <polyline className="map-route is-travel" points={svgPoints(travelRoute.points)} vectorEffect="non-scaling-stroke" />
                    )}
                    {previewRoute && selected?.id !== destination?.id && (
                      <>
                        <polyline className="map-route-casing" points={svgPoints(previewRoute.points)} vectorEffect="non-scaling-stroke" />
                        <polyline className="map-route is-preview" points={svgPoints(previewRoute.points)} vectorEffect="non-scaling-stroke" />
                      </>
                    )}
                  </g>
                </svg>

                {SHORTCUTS.map((road) => (
                  <ShortcutMarker
                    key={`${road.from}-${road.to}`}
                    road={road}
                    at={toScreen(cam, pointAlongRoute(roadPoints(road), 0.5))}
                    open={shortcutOpen(road)}
                    requirement={road.requires ? describeUnmetCondition(road.requires, state, CONDITION_LABELS) : null}
                  />
                ))}

                {MAP_LOCATIONS.map((loc) => (
                  <MapPin
                    key={loc.id}
                    loc={loc}
                    at={toScreen(cam, loc)}
                    locked={!!lockReason(loc)}
                    isCurrent={loc.id === state.currentLocationId && !travel}
                    isSelected={loc.id === selectedId}
                    status={statuses.get(loc.id)!}
                    icons={amenityKinds(getAmenitiesAtLocation(loc.id))}
                    eta={
                      loc.id === selectedId && previewRoute && currentLocation && loc.id !== destination?.id
                        ? formatDuration(engine.getTravelDurationEstimate(currentLocation, loc))
                        : null
                    }
                    onSelect={() => select(loc.id, false)}
                  />
                ))}

                <PlayerMarker
                  cam={cam}
                  route={travelRoute}
                  startedAt={travel?.startedAt ?? 0}
                  durationMs={travel?.durationMs ?? 1}
                  here={currentLocation}
                  now={() => engine.now()}
                />
              </>
            )}
          </div>

          {/* Where you are, or the trip in progress. Tapping it centres the map on you. */}
          <div className="map-status" role="status">
            {travel && destination ? (
              <>
                <button type="button" className="map-status-text" onClick={centerOnPlayer} title="Centre on me">
                  Walking to <strong>{destination.name}</strong> ·{" "}
                  {formatCountdown(travel.startedAt + travel.durationMs - engine.now())}
                </button>
                <button type="button" className="map-status-stop" onClick={() => engine.stopActiveAction()}>
                  Stop
                </button>
              </>
            ) : currentLocation ? (
              <button type="button" className="map-status-text" onClick={centerOnPlayer} title="Centre on me">
                You're at <strong>{currentLocation.name}</strong>
              </button>
            ) : null}
          </div>

          <div className="map-controls">
            <button type="button" className="map-ctrl" onClick={() => zoomBy(1.5)} aria-label="Zoom in" title="Zoom in">
              +
            </button>
            <button type="button" className="map-ctrl" onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out" title="Zoom out">
              −
            </button>
            <button type="button" className="map-ctrl" onClick={centerOnPlayer} aria-label="Centre on me" title="Centre on me">
              ◎
            </button>
            <button
              type="button"
              className="map-ctrl"
              onClick={() => view && animateTo(locationsFrame(view))}
              aria-label="Show every place"
              title="Show every place"
            >
              ⤢
            </button>
          </div>

          <aside className={`map-panel${selected || listOpen ? " is-open" : ""}`} aria-label="Places">
            {selected ? (
              <PlaceDetails
                loc={selected}
                currentLocation={currentLocation}
                lockReason={lockReason(selected)}
                route={previewRoute}
                status={statuses.get(selected.id)!}
                travellingHere={destination?.id === selected.id}
                shortcutOpen={shortcutOpen}
                onClose={() => select(null, false)}
                onTravel={() => currentLocation && void confirmAndStartTravel(engine, currentLocation, selected)}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="map-panel-handle"
                  onClick={() => setListOpen((o) => !o)}
                  aria-expanded={listOpen}
                >
                  <span>Places</span>
                  <span aria-hidden="true">{listOpen ? "▾" : "▴"}</span>
                </button>
                <PlaceList
                  currentId={state.currentLocationId}
                  destinationId={destination?.id}
                  eta={(loc) => {
                    if (!currentLocation || loc.id === currentLocation.id) return null;
                    return routeTo(loc) ? formatDuration(engine.getTravelDurationEstimate(currentLocation, loc)) : null;
                  }}
                  lockReason={lockReason}
                  statuses={statuses}
                  onPick={(id) => select(id, true)}
                />
              </>
            )}
          </aside>
        </div>
      </div>

      <ActivityCard />
    </section>
  );
}

function formatTollCost(toll: RecipeInput[]): string {
  return toll.map((c) => `${formatNumber(c.amount)} ${c.resource === "gp" ? "GP" : c.resource}`).join(", ");
}

function amenityKinds(amenities: Amenity[]): Amenity["kind"][] {
  return AMENITY_ORDER.filter((k) => amenities.some((a) => a.kind === k));
}

/** The badges on a pin or list row: a gold ! for a quest ready to hand
 *  in, a blue Q for one to start, a green ✓ for a job ready to turn in. */
function StatusBadges({ status }: { status: PinStatus }) {
  return (
    <>
      {status.questsReady > 0 && (
        <span className="map-badge is-quest-ready" title={`${status.questsReady === 1 ? "A quest" : `${status.questsReady} quests`} ready to hand in here`}>
          !
        </span>
      )}
      {status.questsToStart > 0 && (
        <span className="map-badge is-quest" title={`${status.questsToStart === 1 ? "A quest" : `${status.questsToStart} quests`} to start here`}>
          Q
        </span>
      )}
      {status.jobsReady > 0 && (
        <span
          className="map-badge is-ready"
          title={`${status.jobsReady} job${status.jobsReady === 1 ? "" : "s"} ready to hand in`}
        >
          ✓
        </span>
      )}
    </>
  );
}

function MapPin({
  loc,
  at,
  locked,
  isCurrent,
  isSelected,
  status,
  icons,
  eta,
  onSelect,
}: {
  loc: MapLocation;
  at: MapPoint;
  locked: boolean;
  isCurrent: boolean;
  isSelected: boolean;
  status: PinStatus;
  icons: Amenity["kind"][];
  eta: string | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`map-pin${isCurrent ? " is-current" : ""}${isSelected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
      style={{ left: at.x, top: at.y }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      aria-label={`${loc.name}${locked ? ", locked" : ""}${isCurrent ? ", you're here" : ""}`}
      aria-pressed={isSelected}
    >
      <span className="map-pin-icon">
        <span className="map-pin-art">
          <GameImage
            src={locationIconPath(loc.name, isCurrent ? "current" : isSelected ? "selected" : "default")}
            alt=""
            style={{ width: 22, height: 22 }}
            fallback={<span className="map-pin-dot" />}
          />
        </span>
        {locked && (
          <span className="map-pin-lock" aria-hidden="true">
            🔒
          </span>
        )}
        <span className="map-pin-badges">
          <StatusBadges status={status} />
        </span>
      </span>
      {eta && <span className="map-pin-eta">{eta}</span>}
      <span className="map-pin-label">{loc.name}</span>
      {icons.length > 0 && (
        <span className="map-pin-icons" aria-hidden="true">
          {icons.map((k) => (
            <span key={k}>{AMENITY_ICON[k]}</span>
          ))}
        </span>
      )}
    </button>
  );
}

/** An Agility shortcut's marker, halfway along it. */
function ShortcutMarker({ road, at, open, requirement }: { road: RoadDefinition; at: MapPoint; open: boolean; requirement: string | null }) {
  const label = `${road.name ?? "Shortcut"}${open ? " (Agility shortcut)" : `: ${requirement}`}`;
  return (
    <span className={`map-shortcut-marker${open ? "" : " is-locked"}`} style={{ left: at.x, top: at.y }} title={label} aria-label={label} role="img">
      <GameImage src={skillIconPath("agility")} alt="" style={{ width: 14, height: 14 }} fallback={<span aria-hidden="true">🏃</span>} />
    </span>
  );
}

/** The "you" marker. While travelling it walks the route, redrawn every
 *  animation frame by itself so the rest of the map doesn't re-render. */
function PlayerMarker({
  cam,
  route,
  startedAt,
  durationMs,
  here,
  now,
}: {
  cam: Camera;
  route: TravelRoute | null;
  startedAt: number;
  durationMs: number;
  here?: MapPoint;
  now: () => number;
}) {
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (!route) return;
    let id = requestAnimationFrame(function tick() {
      setFrame((f) => f + 1);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [route]);

  const p = playerPoint(route, startedAt, durationMs, now(), here);
  if (!p) return null;
  const s = toScreen(cam, p);
  return (
    <span className={`map-player${route ? " is-moving" : ""}`} style={{ left: s.x, top: s.y }} aria-hidden="true">
      <GameImage src={mapUiIconPath("player")} alt="" style={{ width: 24, height: 24 }} fallback={<span className="map-player-dot" />} />
    </span>
  );
}

function PlaceList({
  currentId,
  destinationId,
  eta,
  lockReason,
  statuses,
  onPick,
}: {
  currentId: string;
  destinationId?: string;
  eta: (loc: MapLocation) => string | null;
  lockReason: (loc: MapLocation) => string | null;
  statuses: Map<string, PinStatus>;
  onPick: (id: string) => void;
}) {
  // Where you are first, then open places, then locked ones.
  const rank = (l: MapLocation) => (l.id === currentId ? 0 : lockReason(l) ? 2 : 1);
  const places = [...MAP_LOCATIONS].sort((a, b) => rank(a) - rank(b));
  return (
    <ul className="map-place-list">
      {places.map((loc) => {
        const locked = !!lockReason(loc);
        const status =
          loc.id === currentId
            ? "You're here"
            : loc.id === destinationId
              ? "On your way"
              : locked
                ? "🔒 Locked"
                : (eta(loc) ?? "No road yet");
        return (
          <li key={loc.id}>
            <button
              type="button"
              className={`map-place${locked ? " is-locked" : ""}${loc.id === currentId ? " is-current" : ""}`}
              onClick={() => onPick(loc.id)}
            >
              <span className="map-place-name">{loc.name}</span>
              <StatusBadges status={statuses.get(loc.id)!} />
              <span className="map-place-status">{status}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PlaceDetails({
  loc,
  currentLocation,
  lockReason,
  route,
  status,
  travellingHere,
  shortcutOpen,
  onClose,
  onTravel,
}: {
  loc: MapLocation;
  currentLocation?: MapLocation;
  lockReason: string | null;
  route: TravelRoute | null;
  status: PinStatus;
  travellingHere: boolean;
  shortcutOpen: (road: RoadDefinition) => boolean;
  onClose: () => void;
  onTravel: () => void;
}) {
  const { engine, state } = useGame();
  const isHere = loc.id === currentLocation?.id;
  const amenities = [...getAmenitiesAtLocation(loc.id)].sort(
    (a, b) => AMENITY_ORDER.indexOf(a.kind) - AMENITY_ORDER.indexOf(b.kind)
  );
  const quests = questsAt(engine, loc.id);
  const via = route
    ? route.locationIds.slice(1, -1).map((id) => getLocation(id)?.name ?? id)
    : [];
  const shortcutsTaken = route ? route.roads.filter((r) => r.requires) : [];
  const shortcutsHere = SHORTCUTS.filter((r) => r.from === loc.id || r.to === loc.id);
  const toll = engine.getTravelToll(loc);
  const waiver = QUEST_CATALOG.find((q) => loc.travelCostWaivedBy && q.reward?.setFlags?.includes(loc.travelCostWaivedBy));
  const tollWaiverHint = waiver ? ` (free after ${waiver.name})` : "";

  return (
    <div className="map-place-details">
      <div className="map-place-head">
        <h3 className="map-place-title">{loc.name}</h3>
        <button type="button" className="map-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="map-place-tags">
        {isHere ? (
          <span className="tag tag-success">You're here</span>
        ) : travellingHere ? (
          <span className="tag">On your way</span>
        ) : lockReason ? (
          <span className="tag">🔒 Locked</span>
        ) : route && currentLocation ? (
          <span className="tag">🕑 {formatDuration(engine.getTravelDurationEstimate(currentLocation, loc))} away</span>
        ) : null}
        {status.jobsReady > 0 && <span className="tag tag-success">✓ {status.jobsReady} ready to hand in</span>}
      </div>

      {lockReason && (
        <p className="locked-note">
          <strong>How to get here:</strong> {lockReason}.
        </p>
      )}
      {!lockReason && loc.travelCost && (
        <p className="map-toll">
          {toll.length > 0 ? (
            <>
              Gate toll: <strong>{formatTollCost(toll)}</strong> each trip
              {tollWaiverHint}
            </>
          ) : (
            <>The gate toll is waived for you.</>
          )}
        </p>
      )}
      {!isHere && !lockReason && !route && <p className="locked-note">No open road leads here from where you are yet.</p>}
      {(via.length > 0 || shortcutsTaken.length > 0) && (
        <p className="text-muted text-small">
          {via.length > 0 && <>Via {via.join(", ")}</>}
          {via.length > 0 && shortcutsTaken.length > 0 && ", "}
          {shortcutsTaken.length > 0 && <>using the {shortcutsTaken.map((r) => r.name ?? "shortcut").join(" and ")}</>}
        </p>
      )}

      {quests.length > 0 && (
        <ul className="map-quests">
          {quests.map(({ quest, status: qs, canStart, readyToHandIn }) => {
            const blocked = quest.startCondition ? describeUnmetCondition(quest.startCondition, state, CONDITION_LABELS) : null;
            const giver = quest.giverNpcId ? getNpc(quest.giverNpcId) : undefined;
            return (
              <li key={quest.id} className="map-quest">
                <span className="map-badge is-quest" aria-hidden="true">
                  Q
                </span>
                <span className="map-quest-name">{quest.name}</span>
                {qs === "completed" ? (
                  <span className="tag tag-success">Done</span>
                ) : readyToHandIn ? (
                  <span className="map-quest-giver is-ready" title={giver ? `Return to ${giver.name} here to hand it in` : undefined}>
                    ! {giver ? `Return to ${giver.name}` : "Ready to hand in"}
                  </span>
                ) : qs === "in-progress" ? (
                  <span className="tag tag-gold">In progress</span>
                ) : canStart ? (
                  giver && (
                    <span className="map-quest-giver" title={`Talk to ${giver.name} here`}>
                      💬 {giver.name}
                    </span>
                  )
                ) : (
                  <span className="tag" title={blocked ?? undefined}>
                    🔒
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {amenities.length > 0 ? (
        <ul className="map-amenities">
          {amenities.map((a) => (
            <li key={a.id} title={a.description}>
              <span aria-hidden="true">{AMENITY_ICON[a.kind]}</span>
              <span className="map-amenity-name">{a.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-small">Nothing much here yet.</p>
      )}

      {shortcutsHere.map((road) => {
        const other = getLocation(road.from === loc.id ? road.to : road.from);
        const open = shortcutOpen(road);
        return (
          <p key={`${road.from}-${road.to}`} className="text-small text-muted">
            🏃 {road.name ?? "Shortcut"} to {other?.name}:{" "}
            {open ? "open" : (describeUnmetCondition(road.requires!, state, CONDITION_LABELS) ?? "locked")}
          </p>
        );
      })}

      {!isHere && !lockReason && route && !travellingHere && (
        <button type="button" className="btn btn-primary map-travel" onClick={onTravel}>
          Travel here
        </button>
      )}
    </div>
  );
}
