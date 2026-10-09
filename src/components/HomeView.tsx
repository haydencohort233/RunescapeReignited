import { useGame } from "../engine/GameEngineContext";
import { getLocation } from "../content/mapLocations";
import { getAmenitiesAtLocation } from "../content/amenities";
import { confirmAndStartCraftJob } from "../engine/actionHelpers";
import { WOODEN_BOW_RECIPE } from "../content/recipes";
import ResourceList from "./ResourceList";
import SkillProgress from "./SkillProgress";
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

  const wood = state.resources.wood?.amount ?? 0;
  const woodPerSecond = engine.getEffectiveRatePerSecond("wood");
  const job = state.activeCraftJob;
  const woodPerBow = WOODEN_BOW_RECIPE.inputs[0].amount;
  const maxCraftable = Math.floor(wood / woodPerBow);

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

  const craft = (quantity: number) => {
    if (quantity <= 0) return;
    confirmAndStartCraftJob(engine, WOODEN_BOW_RECIPE, quantity);
  };

  return (
    <div>
      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>{currentLocation?.name ?? "Unknown Location"}</h2>
        <div style={{ maxWidth: 220, marginBottom: 8 }}>
          <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="Health" />
        </div>
        {amenities.length === 0 ? (
          <p style={{ fontSize: 13, color: "#888" }}>Nothing here yet.</p>
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
        <p style={{ fontSize: 13, color: "#888", marginTop: -8, marginBottom: 16 }}>
          No wood income yet — visit the Buildings tab to buy your first Lumbermill.
        </p>
      )}

      <section style={{ marginBottom: 16 }}>
        <button onClick={grantSpeedBuff}>Grant 30s Wood x2 Buff</button>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Fletching</h2>
        <div style={{ marginBottom: 8 }}>
          <SkillProgress skillId="fletching" label="Fletching" />
        </div>
        {job ? (
          <div>
            Crafting {job.recipeName}: {job.quantityCompleted}/{job.quantityTotal}
            <button style={{ marginLeft: 8 }} onClick={() => engine.cancelCraftJob()}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => craft(1)}>
              Make 1 Bow ({(WOODEN_BOW_RECIPE.timePerItemMs / 1000).toFixed(0)}s)
            </button>
            <button onClick={() => craft(5)}>
              Make 5 Bows ({((WOODEN_BOW_RECIPE.timePerItemMs * 5) / 1000).toFixed(0)}s)
            </button>
            <button onClick={() => craft(maxCraftable)} disabled={maxCraftable === 0}>
              Make All ({maxCraftable}x, {((WOODEN_BOW_RECIPE.timePerItemMs * maxCraftable) / 1000).toFixed(0)}s)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}