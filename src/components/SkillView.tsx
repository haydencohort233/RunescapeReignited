import { useGame } from "../engine/GameEngineContext";
import { SKILL_CATALOG, getSkill } from "../content/skills";
import { RECIPE_CATALOG } from "../content/recipes";
import { AMENITY_CATALOG, type ResourceNodeAmenity } from "../content/amenities";
import { getLocation } from "../content/mapLocations";
import { getEnemy } from "../content/enemies";
import { CONDITION_LABELS, formatAmounts } from "../content/display";
import { describeUnmetCondition, isUnlocked } from "../engine/unlockConditions";
import { getLevelProgress, MAX_LEVEL } from "../engine/xpCurve";
import { formatDuration, formatNumber, formatXp } from "../engine/format";
import { confirmAndStartCraftJob, confirmAndStartGatherSession } from "../engine/actionHelpers";
import { skillIconPath } from "../content/assetPaths";
import type { CraftingRecipe } from "../engine/types";
import GameImage from "./GameImage";
import ActivityCard from "./ActivityCard";
import { RecipeIcon, RecipeYield } from "./ui/GameIcons";
import { ActionCard, LockedCard, type CardAction } from "./ui/ActionCard";
import { quantityActions } from "./ui/quantity";
import { EmptyState, Page, Section } from "./ui/Page";

const COMBAT_SKILLS = new Set(["attack", "strength", "defence", "hitpoints"]);

/** "Riverside Town (Trees), Dark Forest (Trees)". */
function foundAt(nodes: ResourceNodeAmenity[]): string {
  return nodes.map((n) => `${getLocation(n.locationId)?.name ?? n.locationId} (${n.name})`).join(", ");
}

function RecipeEntry({ recipe }: { recipe: CraftingRecipe }) {
  const { engine, state } = useGame();
  const lock = recipe.unlockCondition ? describeUnmetCondition(recipe.unlockCondition, state, CONDITION_LABELS) : null;
  const icon = <RecipeIcon recipe={recipe} />;
  if (lock) return <LockedCard icon={icon} title={recipe.name} reason={lock} />;

  const seconds = (recipe.timePerItemMs / 1000).toFixed(1);
  const meta = `${seconds}s · ${formatXp(recipe.xpPerItem)} XP each`;

  // Gathering happens at a resource node, so it can only start where one
  // is; elsewhere this just says where to go.
  if (recipe.inputs.length === 0) {
    const nodes = AMENITY_CATALOG.filter(
      (a): a is ResourceNodeAmenity => a.kind === "resourceNode" && a.recipeId === recipe.id
    );
    // Same gates as the node's card on Home: its location and its own lock.
    const here = nodes.find(
      (n) => n.locationId === state.currentLocationId && (!n.unlockCondition || isUnlocked(n.unlockCondition, state))
    );
    let actions: CardAction[] = [];
    if (here?.gatherMode === "session") {
      actions = [
        {
          label: here.actionLabel,
          variant: "primary",
          onClick: () =>
            confirmAndStartGatherSession(engine, here.id, recipe, {
              maxDurationMs: here.maxDurationMs,
              requiresKeepAliveEveryMs: here.requiresKeepAliveEveryMs,
            }),
        },
      ];
    } else if (here) {
      actions = [1, 5, 10, 25].map((n) => ({
        label: `${here.actionLabel} x${n}`,
        onClick: () => confirmAndStartCraftJob(engine, recipe, n),
      }));
    }
    return (
      <ActionCard
        icon={icon}
        title={recipe.name}
        meta={meta}
        description={
          <>
            <RecipeYield recipe={recipe} />
            <div>{nodes.length > 0 ? `Found at: ${foundAt(nodes)}` : "Not found anywhere yet."}</div>
            {nodes.length > 0 && !here && <div className="text-faint">Travel to one of those places to start.</div>}
          </>
        }
        actions={actions}
      />
    );
  }

  const maxMakeable = Math.min(
    ...recipe.inputs.map((input) => Math.floor(engine.getOwnedCount(input.resource) / input.amount))
  );
  return (
    <ActionCard
      icon={icon}
      title={recipe.name}
      meta={meta}
      description={
        <>
          <RecipeYield recipe={recipe} />
          <div className="text-faint">
            You have enough for {formatNumber(maxMakeable)}
            {maxMakeable > 0 && ` (about ${formatDuration(maxMakeable * recipe.timePerItemMs)})`}.
          </div>
        </>
      }
      actions={quantityActions(
        recipe.verb ?? getSkill(recipe.skill)?.verb ?? "Make",
        maxMakeable,
        (q) => confirmAndStartCraftJob(engine, recipe, q),
        `Needs ${formatAmounts(recipe.inputs, " + ")} each`
      )}
    />
  );
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
