import { useGame } from "../engine/GameEngineContext";
import { getLocation } from "../content/mapLocations";
import { getAmenitiesAtLocation } from "../content/amenities";
import ResourceList from "./ResourceList";
import RecipeList from "./RecipeList";
import AmenityEntry from "./AmenityEntry";
import HpBar from "./HpBar";

/**
 * The main/home tab — where players spend most of their time. Shows where
 * you are, what's here (amenities), your resources, and ongoing actions.
 * Deliberately built to be added to freely: new amenity kinds, new skill
 * sections, whatever comes next all have a natural place here without
 * restructuring the page.
 */
export default function HomeView() {
  const { engine, state } = useGame();
  const currentLocation = getLocation(state.currentLocationId);
  const amenities = getAmenitiesAtLocation(state.currentLocationId);

  const woodPerSecond = engine.getEffectiveRatePerSecond("wood");

  const grantSpeedBuff = () => {
    engine.addModifier({
      id: "buff-woodcutting-frenzy",
      source: "buff",
      target: "wood",
      type: "multiplicative",
      value: 2,
      expiresAt: Date.now() + 30_000,
      label: "Woodcutting Frenzy (x2 wood, 30s)",
    });
  };

  return (
    <div>
      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>{currentLocation?.name ?? "Unknown Location"}</h2>
        <div style={{ maxWidth: 220, marginBottom: 8 }}>
          <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="Health" />
        </div>
        {amenities.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Nothing here yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {amenities.map((amenity) => (
              <AmenityEntry key={amenity.id} amenity={amenity} />
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 16 }}>
        <ResourceList category="currency" />
        <ResourceList category="material" />
      </section>

      {woodPerSecond === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: -8, marginBottom: 16 }}>
          No wood income yet — visit the Buildings tab to buy your first Lumbermill.
        </p>
      )}

      <section style={{ marginBottom: 16 }}>
        <button onClick={grantSpeedBuff}>Grant 30s Wood x2 Buff</button>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Crafting</h2>
        <RecipeList />
      </section>
    </div>
  );
}