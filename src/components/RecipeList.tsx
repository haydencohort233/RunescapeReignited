import { useGame } from "../engine/GameEngineContext";
import { PROCESSING_RECIPES } from "../content/recipes";
import { SKILL_CATALOG } from "../content/skills";
import { CONDITION_LABELS, formatAmounts } from "../content/display";
import { confirmAndStartCraftJob } from "../engine/actionHelpers";
import { describeUnmetCondition } from "../engine/unlockConditions";
import type { CraftingRecipe } from "../engine/types";
import SkillProgress from "./SkillProgress";
import { ActionCard, LockedCard } from "./ui/ActionCard";
import { quantityActions } from "./ui/quantity";

function RecipeCard({ recipe }: { recipe: CraftingRecipe }) {
  const { engine, state } = useGame();
  const lockReason = recipe.unlockCondition
    ? describeUnmetCondition(recipe.unlockCondition, state, CONDITION_LABELS)
    : null;
  if (lockReason) return <LockedCard title={recipe.name} reason={lockReason} />;

  const maxCraftable = Math.min(
    ...recipe.inputs.map((input) => Math.floor(engine.getOwnedCount(input.resource) / input.amount))
  );
  return (
    <ActionCard
      title={recipe.name}
      meta={`${(recipe.timePerItemMs / 1000).toFixed(1)}s each`}
      description={`${formatAmounts(recipe.inputs, " + ")} → ${formatAmounts([recipe.output])}`}
      actions={quantityActions(
        "Make",
        maxCraftable,
        (q) => confirmAndStartCraftJob(engine, recipe, q),
        `Needs ${formatAmounts(recipe.inputs, " + ")} each`
      )}
    />
  );
}

/** Every processing recipe (materials in, product out), grouped by skill.
 *  New recipes in content/recipes.ts show up here without UI changes. */
export default function RecipeList() {
  const skills = SKILL_CATALOG.filter((skill) => PROCESSING_RECIPES.some((r) => r.skill === skill.id));
  return (
    <div className="stack">
      {skills.map((skill) => (
        <div key={skill.id} className="stack-sm">
          <SkillProgress skillId={skill.id} label={skill.name} />
          {PROCESSING_RECIPES.filter((r) => r.skill === skill.id).map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ))}
    </div>
  );
}
