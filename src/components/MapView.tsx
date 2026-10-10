import { useEffect, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { MAP_LOCATIONS, getLocation } from "../content/mapLocations";
import { getAmenitiesAtLocation } from "../content/amenities";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { CONDITION_LABELS } from "../content/display";
import { formatDuration } from "../engine/format";
import ActivityCard from "./ActivityCard";
import { Page } from "./ui/Page";
import { confirmAndStartTravel } from "../engine/actionHelpers";
import { AMENITY_ICON } from "../content/amenities";
import { worldMapPath, locationIconPath } from "../content/assetPaths";
import { preloadImages, isImageLoaded } from "../lib/imagePreloader";
import GameImage from "./GameImage";

// Placeholder coordinate space — swap in a real 2000x2000 map image later
// and this still works unchanged, since positions are rendered as
// percentages of this space, not fixed pixels.
const MAP_SPACE = 2000;

export default function MapView() {
  const { engine, state } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Map background + every location icon, requested together up front.
  useEffect(() => {
    void preloadImages([worldMapPath(), ...MAP_LOCATIONS.map((l) => locationIconPath(l.name))]);
  }, []);

  const currentLocation = getLocation(state.currentLocationId);
  const selected = selectedId ? getLocation(selectedId) : undefined;
  const lockReason = (loc: typeof selected) =>
    loc?.unlockCondition ? describeUnmetCondition(loc.unlockCondition, state, CONDITION_LABELS) : null;

  return (
    <Page title="World map" meta={currentLocation ? `You're at ${currentLocation.name}` : undefined}>
      <ActivityCard />

      {/* Positions are percentages of the map space, so the map scales to
          the column width (and a phone screen) without moving pins. */}
      <div
        className="world-map"
        style={{ backgroundImage: isImageLoaded(worldMapPath()) ? `url(${worldMapPath()})` : undefined }}
      >
        {MAP_LOCATIONS.map((loc) => {
          const unlocked = !lockReason(loc);
          const isCurrent = loc.id === state.currentLocationId;
          return (
            <button
              key={loc.id}
              type="button"
              className={`map-pin${isCurrent ? " is-current" : ""}${loc.id === selectedId ? " is-selected" : ""}`}
              onClick={() => setSelectedId(loc.id)}
              title={loc.name}
              aria-label={loc.name}
              style={{
                left: `${(loc.x / MAP_SPACE) * 100}%`,
                top: `${(loc.y / MAP_SPACE) * 100}%`,
                opacity: unlocked ? 1 : 0.45,
              }}
            >
              <GameImage
                src={locationIconPath(loc.name, isCurrent ? "current" : loc.id === selectedId ? "selected" : "default")}
                alt=""
                style={{ width: 20, height: 20 }}
                fallback={
                  <span
                    className="map-pin-dot"
                    style={{ background: unlocked ? (isCurrent ? "var(--info)" : "var(--good)") : "var(--text-faint)" }}
                  />
                }
              />
            </button>
          );
        })}
      </div>

      {!selected && <p className="empty-state">Select a location on the map to see what's there.</p>}

      {selected && (
        <div className={`card${lockReason(selected) ? " is-locked" : ""}`}>
          <div className="card-header">
            <span className="card-title">{selected.name}</span>
            {selected.id === state.currentLocationId ? (
              <span className="tag tag-success">You're here</span>
            ) : lockReason(selected) ? (
              <span className="card-meta">🔒 Locked</span>
            ) : currentLocation ? (
              <span className="card-meta">
                {formatDuration(engine.getTravelDurationEstimate(currentLocation, selected))} away
              </span>
            ) : null}
          </div>

          {lockReason(selected) && <p className="locked-note">{lockReason(selected)}</p>}

          {/* Read-only preview of what's there, even before you've been —
              Home handles interaction for wherever you currently are. */}
          {getAmenitiesAtLocation(selected.id).length > 0 && (
            <p className="text-muted">
              {getAmenitiesAtLocation(selected.id)
                .map((a) => `${AMENITY_ICON[a.kind]} ${a.name}`)
                .join(" · ")}
            </p>
          )}

          {selected.id !== state.currentLocationId && !lockReason(selected) && (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => currentLocation && confirmAndStartTravel(engine, currentLocation, selected)}
              >
                Travel here
              </button>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
