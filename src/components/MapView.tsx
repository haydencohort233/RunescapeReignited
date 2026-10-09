import { useEffect, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { MAP_LOCATIONS, getLocation } from "../content/mapLocations";
import { getAmenitiesAtLocation } from "../content/amenities";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { confirmAndStartTravel } from "../engine/actionHelpers";
import { AMENITY_ICON } from "./AmenityEntry";
import { worldMapPath, locationIconPath } from "../content/assetPaths";
import { preloadImages, isImageLoaded } from "../lib/imagePreloader";
import GameImage from "./GameImage";

// Placeholder coordinate space — swap in a real 2000x2000 map image later
// and this still works unchanged, since positions are rendered as
// percentages of this space, not fixed pixels.
const MAP_SPACE = 2000;
const DISPLAY_SIZE = 400;

export default function MapView() {
  const { engine, state } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  // Re-render every second so the "arriving in Xs" countdown stays live —
  // the engine's own 1s tick already drives state updates elsewhere, but
  // this view has no other state changing that would trigger a re-render.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Map background + every location icon, requested together up front.
  useEffect(() => {
    void preloadImages([worldMapPath(), ...MAP_LOCATIONS.map((l) => locationIconPath(l.name))]);
  }, []);

  const currentLocation = getLocation(state.currentLocationId);
  const travel = state.activeTravel;
  const selected = selectedId ? getLocation(selectedId) : undefined;

  const travelRemainingMs = travel
    ? Math.max(0, travel.startedAt + travel.durationMs - Date.now())
    : 0;

  return (
    <section style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>World Map</h2>

      {travel && (
        <p style={{ fontSize: 13 }}>
          Traveling to {travel.destinationName} — arriving in {Math.ceil(travelRemainingMs / 1000)}s
          <button style={{ marginLeft: 8 }} onClick={() => engine.cancelTravel()}>
            Cancel
          </button>
        </p>
      )}

      <div
        style={{
          position: "relative",
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          border: "1px solid #999",
          background: "#eef6ee",
          backgroundImage: isImageLoaded(worldMapPath()) ? `url(${worldMapPath()})` : undefined,
          backgroundSize: "cover",
        }}
      >
        {MAP_LOCATIONS.map((loc) => {
          const isUnlockedHere = !loc.unlockCondition || describeUnmetCondition(loc.unlockCondition, state) === null;
          const isCurrent = loc.id === state.currentLocationId;
          const left = (loc.x / MAP_SPACE) * DISPLAY_SIZE;
          const top = (loc.y / MAP_SPACE) * DISPLAY_SIZE;
          return (
            <button
              key={loc.id}
              onClick={() => setSelectedId(loc.id)}
              title={loc.name}
              style={{
                position: "absolute",
                left,
                top,
                transform: "translate(-50%, -50%)",
                width: 24,
                height: 24,
                padding: 0,
                border: isCurrent ? "2px solid #1a5fa8" : "none",
                borderRadius: "50%",
                background: "transparent",
                cursor: "pointer",
                opacity: isUnlockedHere ? 1 : 0.45,
              }}
            >
              <GameImage
                src={locationIconPath(
                  loc.name,
                  isCurrent ? "current" : loc.id === selectedId ? "selected" : "default"
                )}
                alt={loc.name}
                style={{ width: 20, height: 20 }}
                fallback={
                  <span
                    style={{
                      display: "block",
                      width: 14,
                      height: 14,
                      margin: "0 auto",
                      borderRadius: "50%",
                      border: "1px solid #555",
                      background: isUnlockedHere ? (isCurrent ? "#1a5fa8" : "#4b8") : "#999",
                    }}
                  />
                }
              />
            </button>
          );
        })}
      </div>

      {currentLocation && (
        <p style={{ fontSize: 13, color: "#666" }}>Currently at: {currentLocation.name}</p>
      )}

      {selected && (
        <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, marginTop: 8 }}>
          <strong>{selected.name}</strong>
          {selected.id === state.currentLocationId ? (
            <p style={{ fontSize: 13, color: "#888" }}>You're already here.</p>
          ) : selected.unlockCondition && describeUnmetCondition(selected.unlockCondition, state) ? (
            <p style={{ fontSize: 13, color: "#b91c1c" }}>
              {describeUnmetCondition(selected.unlockCondition, state)}
            </p>
          ) : (
            <>
              {currentLocation && (
                <p style={{ fontSize: 13, color: "#666", margin: "0 0 6px" }}>
                  Estimated travel time:{" "}
                  {Math.round(engine.getTravelDurationEstimate(currentLocation, selected) / 1000)}s
                </p>
              )}
              <button
                disabled={!!travel}
                onClick={() => {
                  if (!currentLocation) return;
                  confirmAndStartTravel(engine, currentLocation, selected);
                }}
              >
                Travel here
              </button>
            </>
          )}

          {/* Quick, read-only preview — not interactive here (Home handles
              full interaction for wherever you currently are). Shown for
              ANY selected location, even ones you haven't traveled to yet,
              so you know what's worth going somewhere for. */}
          {(() => {
            const amenities = getAmenitiesAtLocation(selected.id);
            if (amenities.length === 0) return null;
            return (
              <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                Here: {amenities.map((a) => `${AMENITY_ICON[a.kind]} ${a.name}`).join(", ")}
              </p>
            );
          })()}
        </div>
      )}
    </section>
  );
}