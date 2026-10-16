import { useGame } from "../engine/GameEngineContext";
import { SKILL_CATALOG } from "../content/skills";
import { RECIPE_CATALOG } from "../content/recipes";
import { AMENITY_CATALOG } from "../content/amenities";
import { getLocation } from "../content/mapLocations";
import { getEnemy } from "../content/enemies";
import { getLevelProgress, MAX_LEVEL } from "../engine/xpCurve";
import { formatNumber } from "../engine/format";
import { skillIconPath } from "../content/assetPaths";
import type { CraftingRecipe } from "../engine/types";
import GameImage from "./GameImage";
import ActivityCard from "./ActivityCard";
import { CraftCard, GatherCard } from "./TrainingCards";
import { EmptyState, Page, Section } from "./ui/Page";

const COMBAT_SKILLS = new Set(["attack", "strength", "defence", "hitpoints"]);

function RecipeEntry({ recipe }: { recipe: CraftingRecipe }) {
  // Gathering happens at a spot (start here, or Travel to the closest);
  // everything else is made from materials. Same cards as Home's popups.
  return recipe.inputs.length === 0 ? <GatherCard recipe={recipe} /> : <CraftCard recipe={recipe} />;
}

/** One skill's page: level and XP, then every way to train it with its
 *  time, XP, requirements and extra rewards. Processing recipes start from
 *  here wherever you are; gathering shows where it's found. */
export default function SkillView({ skillId, onBack }: { skillId: string; onBack: () => void }) {
  const { engine } = useGame();
  const skill = SKILL_CATALOG.find((s) => s.id === skillId);
  const xp = engine.getSkillXp(skillId);
  const progress = getLevelProgress(xp);
  const recipes = RECIPE_CATALOG.filter((r) => r.skill === skillId);
  const enemies = AMENITY_CATALOG.filter((a) => a.kind === "combatEncounter");

  return (
    <Page
      title={
        <span className="row" style={{ gap: 8 }}>
          <GameImage src={skillIconPath(skillId)} alt="" style={{ width: 24, height: 24 }} fallback={null} />
          {skill?.name ?? skillId}
        </span>
      }
      meta={
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ All skills
        </button>
      }
    >
      <ActivityCard />

      <div className="card">
        <div className="row row-between">
          <span className="card-title">Level {progress.level}</span>
          <span className="text-muted">{formatNumber(xp)} XP</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress.percent * 100}%` }} />
        </div>
        <span className="text-faint text-small">
          {progress.level >= MAX_LEVEL
            ? "Max level"
            : `${formatNumber(progress.xpForThisLevel - progress.xpIntoLevel)} XP to level ${progress.level + 1}`}
        </span>
      </div>

      <Section title="Ways to train">
        {COMBAT_SKILLS.has(skillId) ? (
          <div className="card">
            <p className="text-muted">
              Trained by defeating enemies: each kill splits its XP across Attack, Strength, Defence and Hitpoints.
            </p>
            {enemies.map((a) => (
              <div key={a.id} className="data-row">
                <span>{a.kind === "combatEncounter" ? (getEnemy(a.enemyId)?.name ?? a.name) : a.name}</span>
                <span>{getLocation(a.locationId)?.name}</span>
              </div>
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <EmptyState>There's no way to train {skill?.name ?? skillId} yet.</EmptyState>
        ) : (
          <div className="stack-sm">
            {recipes.map((recipe) => (
              <RecipeEntry key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </Section>
    </Page>
  );
}
