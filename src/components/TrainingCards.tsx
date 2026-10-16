import { useGame } from "../engine/GameEngineContext";
import type { CraftingRecipe, ToolType } from "../engine/types";
import type { ResourceNodeAmenity } from "../content/amenities";
import { getLocation } from "../content/mapLocations";
import { getSkill } from "../content/skills";
import { CONDITION_LABELS, formatAmounts } from "../content/display";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { formatDuration, formatNumber, formatXp } from "../engine/format";
import { confirmAndStartCraftJob } from "../engine/actionHelpers";
import { gatherPlan, nodesForRecipe } from "./gatherSpots";
import { RecipeIcon, RecipeYield } from "./ui/GameIcons";
import { TrainInfo, TrainingCard } from "./ui/TrainingCard";
import { quantityActions } from "./ui/quantity";

const TOOL_LABEL: Record<ToolType, string> = {
  axe: "Axe",
  pickaxe: "Pickaxe",
  net: "Fishing Net",
  rod: "Fishing Rod",
  harpoon: "Harpoon",
  tinderbox: "Tinderbox",
};

/** "✓ Requires Harpoon" in green when you have a usable one (hover says
 *  which), "✗ Requires Harpoon" in red when you don't. */
function ToolRequirement({ recipe }: { recipe: CraftingRecipe }) {
  const { engine } = useGame();
  if (!recipe.tool) return null;
  const best = engine.getBestTool(recipe.tool);
  const why = best ? `Using your ${best.name}` : (engine.getRecipeStartBlocker(recipe) ?? undefined);
  return (
    <span className={`train-req${best ? " is-met" : " is-missing"}`} title={why}>
      <span aria-hidden="true">{best ? "✓" : "✗"}</span> Requires {TOOL_LABEL[recipe.tool]}
      {/* "· Bronze Axe" adds something; "· Fishing Net" would just repeat. */}
      {best && best.name.toLowerCase() !== TOOL_LABEL[recipe.tool].toLowerCase() && <span className="train-req-using"> · {best.name}</span>}
    </span>
  );
}

/** A start blocker that isn't just the missing tool (that's shown by
 *  ToolRequirement already). */
function otherBlocker(engine: ReturnType<typeof useGame>["engine"], recipe: CraftingRecipe): string | null {
  if (recipe.tool && !engine.getBestTool(recipe.tool)) return null;
  return engine.getRecipeStartBlocker(recipe);
}

/** "3.0s · 10 XP each", with tools and boosts applied. */
function stats(seconds: number, xp: number): string {
  return `${seconds.toFixed(1)}s · ${formatXp(xp)} XP each`;
}

/**
 * Gathering something from a spot (Shrimps, Oak logs, Tin ore). Same card
 * on the skill page and in a spot's popup on the town picture. With `node`
 * it's for that one spot; without, it starts here if there's a spot or
 * offers Travel to the closest one.
 */
export function GatherCard({ recipe, node, onStarted }: { recipe: CraftingRecipe; node?: ResourceNodeAmenity; onStarted?: () => void }) {
  const { engine, state, actions } = useGame();
  const lock = recipe.unlockCondition ? describeUnmetCondition(recipe.unlockCondition, state, CONDITION_LABELS) : null;
  const plan = gatherPlan(engine, state, recipe, { node, onStarted, refresh: actions.refresh });
  const blocker = otherBlocker(engine, recipe);
  const nodes = node ? [] : nodesForRecipe(recipe.id);

  return (
    <TrainingCard
      icon={<RecipeIcon recipe={recipe} />}
      title={recipe.name}
      stats={stats(engine.getEffectiveTimePerItem(recipe) / 1000, recipe.xpPerItem)}
      primary={plan.primary}
      more={plan.more}
      lockReason={lock}
      active={plan.active}
      status={plan.status}
    >
      {node && <TrainInfo tone="faint">{node.description}</TrainInfo>}
      <RecipeYield recipe={recipe} />
      <ToolRequirement recipe={recipe} />
      {blocker && !lock && <TrainInfo tone="warning">{blocker}</TrainInfo>}
      {nodes.length > 0 && (
        <TrainInfo tone="faint">
          Found at {nodes.map((n) => getLocation(n.locationId)?.name ?? n.locationId).join(", ")}
          {plan.nearest && ` · closest is ${formatDuration(plan.nearest.travelMs)} away`}
        </TrainInfo>
      )}
      {!node && nodes.length === 0 && <TrainInfo tone="faint">Not found anywhere yet.</TrainInfo>}
    </TrainingCard>
  );
}

/**
 * Making something from materials (Cook Trout, Smelt Bronze). Works
 * anywhere unless the recipe needs a station; same card on the skill page,
 * Home's crafting list and a station's popup.
 */
export function CraftCard({ recipe, onStarted }: { recipe: CraftingRecipe; onStarted?: () => void }) {
  const { engine, state } = useGame();
  const lock = recipe.unlockCondition ? describeUnmetCondition(recipe.unlockCondition, state, CONDITION_LABELS) : null;
  // A missing tool (a tinderbox) blocks it the same way a level does.
  const blocker = engine.getRecipeStartBlocker(recipe);
  const maxMakeable = Math.min(...recipe.inputs.map((input) => Math.floor(engine.getOwnedCount(input.resource) / input.amount)));
  const verb = recipe.verb ?? getSkill(recipe.skill)?.verb ?? "Make";
  const steps = quantityActions(
    verb,
    maxMakeable,
    (q) => void confirmAndStartCraftJob(engine, recipe, q).then((ok) => ok && onStarted?.()),
    `Needs ${formatAmounts(recipe.inputs, " + ")} each`
  ).map((a) => (blocker ? { ...a, disabled: true, reason: blocker } : a));
  // "Cook all (12)" is the usual choice in an idle game; 1/5/10 below it.
  const all = steps[steps.length - 1];
  const craft = state.activeAction?.kind === "craft" && state.activeAction.recipeId === recipe.id ? state.activeAction : null;

  return (
    <TrainingCard
      icon={<RecipeIcon recipe={recipe} />}
      title={recipe.name}
      stats={stats(engine.getEffectiveTimePerItem(recipe) / 1000, recipe.xpPerItem)}
      primary={craft ? { label: "Stop", variant: "danger", onClick: () => engine.stopActiveAction() } : { ...all, variant: "primary" }}
      // With nothing to use, one greyed-out button is enough.
      more={craft || maxMakeable < 1 ? [] : steps.slice(0, -1)}
      lockReason={lock}
      active={!!craft}
      status={craft ? `${formatNumber(craft.quantityCompleted)} of ${formatNumber(craft.quantityTotal)} done` : undefined}
    >
      <RecipeYield recipe={recipe} />
      <ToolRequirement recipe={recipe} />
      {blocker && !lock && otherBlocker(engine, recipe) && <TrainInfo tone="warning">{blocker}</TrainInfo>}
      {!blocker && !lock && !craft && (
        <TrainInfo tone="faint">
          {maxMakeable > 0
            ? `Enough for ${formatNumber(maxMakeable)} (about ${formatDuration(maxMakeable * engine.getEffectiveTimePerItem(recipe))})`
            : `Needs ${formatAmounts(recipe.inputs, " + ")} each`}
        </TrainInfo>
      )}
    </TrainingCard>
  );
}
