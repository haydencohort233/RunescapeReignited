import { useGame } from "../engine/GameEngineContext";
import { PROCESSING_RECIPES } from "../content/recipes";
import { SKILL_CATALOG } from "../content/skills";
import { getResourceMeta } from "../content/resources";
import { confirmAndStartCraftJob } from "../engine/actionHelpers";
import { getActiveCraftJob } from "../engine/activeAction";
import { describeUnmetCondition } from "../engine/unlockConditions";
import type { CraftingRecipe, RecipeInput } from "../engine/types";
import SkillProgress from "./SkillProgress";

function formatAmounts(amounts: RecipeInput[]): string {
  return amounts.map((a) => `${a.amount} ${getResourceMeta(a.resource).name}`).join(" + ");
}

function RecipeRow({ recipe }: { recipe: CraftingRecipe }) {
  const { engine, state } = useGame();
  const lockReason = recipe.unlockCondition ? describeUnmetCondition(recipe.unlockCondition, state) : null;
  const maxCraftable = Math.min(
    ...recipe.inputs.map((input) => Math.floor(engine.getOwnedCount(input.resource) / input.amount))
  );
  const seconds = (quantity: number) => ((recipe.timePerItemMs * quantity) / 1000).toFixed(0);
  const craft = (quantity: number) => {
    if (quantity > 0) confirmAndStartCraftJob(engine, recipe, quantity);
  };

  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 8 }}>
      <div style={{ fontSize: 13 }}>
        <strong>{recipe.name}</strong>{" "}
        <span style={{ color: "var(--text-muted)" }}>
          {formatAmounts(recipe.inputs)} → {formatAmounts([recipe.output])}
        </span>
      </div>
      {lockReason ? (
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{lockReason}</div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <button onClick={() => craft(1)} disabled={maxCraftable < 1}>
            Make 1 ({seconds(1)}s)
          </button>
          <button onClick={() => craft(5)} disabled={maxCraftable < 5}>
            Make 5 ({seconds(5)}s)
          </button>
          <button onClick={() => craft(maxCraftable)} disabled={maxCraftable === 0}>
            Make All ({maxCraftable}x, {seconds(maxCraftable)}s)
          </button>
        </div>
      )}
    </div>
  );
}

/** Every processing recipe (materials in, product out), grouped by skill.
 *  New recipes in content/recipes.ts show up here without UI changes. */
export default function RecipeList() {
  const { engine, state } = useGame();
  const job = getActiveCraftJob(state);
  const skills = SKILL_CATALOG.filter((skill) => PROCESSING_RECIPES.some((r) => r.skill === skill.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {job && (
        <div>
          Making {job.recipeName}: {job.quantityCompleted}/{job.quantityTotal}
          <button style={{ marginLeft: 8 }} onClick={() => engine.cancelCraftJob()}>
            Cancel
          </button>
        </div>
      )}
      {skills.map((skill) => (
        <div key={skill.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SkillProgress skillId={skill.id} label={skill.name} />
          {PROCESSING_RECIPES.filter((r) => r.skill === skill.id).map((recipe) => (
            <RecipeRow key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ))}
    </div>
  );
}
