import { useGame } from "../engine/GameEngineContext";
import { confirmAndStartCraftJob } from "../engine/actionHelpers";
import ResourceList from "./ResourceList";
import SkillProgress from "./SkillProgress";
import type { CraftingRecipe } from "../engine/types";

const WOODEN_BOW_RECIPE: CraftingRecipe = {
  id: "wooden-bow",
  name: "Wooden Bow",
  skill: "fletching",
  xpPerItem: 5,
  timePerItemMs: 2000,
  inputs: [{ resource: "wood", amount: 1 }],
  output: { kind: "item", itemDefId: "wooden-bow-u", quantity: 1, stackable: true },
};

export default function GameView() {
  const { engine, state } = useGame();

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