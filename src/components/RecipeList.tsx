import { PROCESSING_RECIPES } from "../content/recipes";
import { SKILL_CATALOG } from "../content/skills";
import SkillProgress from "./SkillProgress";
import { CraftCard } from "./TrainingCards";

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
            <CraftCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ))}
    </div>
  );
}
