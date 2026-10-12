import { useGame } from "../engine/GameEngineContext";
import { PROCESSING_RECIPES } from "../content/recipes";
import { SKILL_CATALOG, getSkill } from "../content/skills";
import { CONDITION_LABELS, formatAmounts } from "../content/display";
import { confirmAndStartCraftJob } from "../engine/actionHelpers";
import { describeUnmetCondition } from "../engine/unlockConditions";
import type { CraftingRecipe } from "../engine/types";
import SkillProgress from "./SkillProgress";
import { RecipeIcon, RecipeYield } from "./ui/GameIcons";
import { ActionCard, LockedCard } from "./ui/ActionCard";
import { quantityActions } from "./ui/quantity";

export function RecipeCard({ recipe }: { recipe: CraftingRecipe }) {
  const { engine, state } = useGame();
  const lockReason = recipe.unlockCondition
    ? describeUnmetCondition(recipe.unlockCondition, state, CONDITION_LABELS)
    : null;
  if (lockReason) return <LockedCard icon={<RecipeIcon recipe={recipe} />} title={recipe.name} reason={lockReason} />;

  // A missing tool (a tinderbox) blocks it the same way a level does.
  const blocker = engine.getRecipeStartBlocker(recipe);
  const maxCraftable = Math.min(
    ...recipe.inputs.map((input) => Math.floor(engine.getOwnedCount(input.resource) / input.amount))
  );
  const actions = quantityActions(
    recipe.verb ?? getSkill(recipe.skill)?.verb ?? "Make",
    maxCraftable,
    (q) => confirmAndStartCraftJob(engine, recipe, q),
    `Needs ${formatAmounts(recipe.inputs, " + ")} each`
  );
  return (
    <ActionCard
      icon={<RecipeIcon recipe={recipe} />}
      title={recipe.name}
      meta={`${(engine.getEffectiveTimePerItem(recipe) / 1000).toFixed(1)}s · ${recipe.xpPerItem} XP each`}
      description={
        <>
          <RecipeYield recipe={recipe} />
          {blocker && <span className="text-warning text-small">{blocker}</span>}
        </>
      }
      actions={blocker ? actions.map((a) => ({ ...a, disabled: true, reason: blocker })) : actions}
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
