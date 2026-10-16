import type { GameEngine } from "../engine/gameEngine";
import type { CraftingRecipe, GameState, MapLocation } from "../engine/types";
import { AMENITY_CATALOG, type ResourceNodeAmenity } from "../content/amenities";
import { getLocation } from "../content/mapLocations";
import { isUnlocked } from "../engine/unlockConditions";
import { formatDuration } from "../engine/format";
import { formatCountdown } from "../engine/time";
import { getActiveGatherSession } from "../engine/activeAction";
import { confirmAndStartCraftJob, confirmAndStartGatherSession, confirmAndStartTravel } from "../engine/actionHelpers";
import type { CardAction } from "./ui/ActionCard";

/**
 * Where a gathering recipe (Net Shrimps, Chop Oak, Mine Tin...) can be done,
 * and the buttons for it: start here, tend/stop while running, or travel to
 * the nearest place that has the spot. Works for any recipe a resourceNode
 * amenity points at, so new skills (Hunter, etc.) get this for free by
 * adding nodes in content/amenities.ts.
 */

/** Every resource node for a recipe, in any location. */
export function nodesForRecipe(recipeId: string): ResourceNodeAmenity[] {
  return AMENITY_CATALOG.filter((a): a is ResourceNodeAmenity => a.kind === "resourceNode" && a.recipeId === recipeId);
}

function nodeOpen(node: ResourceNodeAmenity, state: GameState): boolean {
  return !node.unlockCondition || isUnlocked(node.unlockCondition, state);
}

export interface NearestSpot {
  node: ResourceNodeAmenity;
  location: MapLocation;
  travelMs: number;
}

/** The quickest open place (by travel time) with a spot for this recipe,
 *  not counting where you are now. */
export function nearestSpot(engine: GameEngine, state: GameState, recipeId: string): NearestSpot | undefined {
  const from = getLocation(state.currentLocationId);
  if (!from) return undefined;
  let best: NearestSpot | undefined;
  for (const node of nodesForRecipe(recipeId)) {
    if (node.locationId === from.id || !nodeOpen(node, state)) continue;
    const location = getLocation(node.locationId);
    if (!location || (location.unlockCondition && !isUnlocked(location.unlockCondition, state))) continue;
    const travelMs = engine.getTravelDurationEstimate(from, location);
    if (!best || travelMs < best.travelMs) best = { node, location, travelMs };
  }
  return best;
}

export interface GatherPlan {
  /** The open node being used: the one passed in, or one at this location. */
  here?: ResourceNodeAmenity;
  nearest?: NearestSpot;
  /** Running right now (this recipe, at this node if one was given). */
  active: boolean;
  /** "x12 gathered · ends in 7:59:10 · tend within 4:30". */
  status?: string;
  primary?: CardAction;
  more: CardAction[];
}

const BATCH_SIZES = [1, 5, 10, 25];

/** What a gathering recipe's card should offer right now. Pass `node` when
 *  the card is for one specific spot (a popup on the town picture).
 *  `onStarted` runs after something actually starts (to close a popup). */
export function gatherPlan(
  engine: GameEngine,
  state: GameState,
  recipe: CraftingRecipe,
  opts: { node?: ResourceNodeAmenity; onStarted?: () => void; refresh?: () => void } = {}
): GatherPlan {
  const nodes = nodesForRecipe(recipe.id);
  const here = opts.node ?? nodes.find((n) => n.locationId === state.currentLocationId && nodeOpen(n, state));
  const after = (started: boolean) => {
    if (started) opts.onStarted?.();
  };
  // A missing tool (a fishing net) blocks starting, wherever you are.
  const blocker = engine.getRecipeStartBlocker(recipe) ?? undefined;

  const session = getActiveGatherSession(state);
  const active = !!session && session.recipeId === recipe.id && (!opts.node || session.amenityId === opts.node.id);
  if (session && active) {
    const now = Date.now();
    let status = `x${session.quantityGathered.toLocaleString()} gathered · ends in ${formatCountdown(Math.max(0, session.startedAt + session.maxDurationMs - now))}`;
    const stop: CardAction = { label: "Stop", variant: "danger", onClick: () => engine.stopGatherSession() };
    if (session.requiresKeepAliveEveryMs !== undefined && session.lastKeepAliveAt !== undefined) {
      status += ` · tend within ${formatCountdown(Math.max(0, session.lastKeepAliveAt + session.requiresKeepAliveEveryMs - now))}`;
      const tend: CardAction = {
        label: "Tend to it",
        variant: "primary",
        onClick: () => {
          engine.keepGatherSessionAlive();
          opts.refresh?.();
        },
      };
      return { here, active, status, primary: tend, more: [stop] };
    }
    return { here, active, status, primary: stop, more: [] };
  }

  if (here?.gatherMode === "session") {
    return {
      here,
      active: false,
      more: [],
      primary: {
        label: here.actionLabel,
        variant: "primary",
        disabled: !!blocker,
        reason: blocker,
        onClick: () =>
          void confirmAndStartGatherSession(engine, here.id, recipe, {
            maxDurationMs: here.maxDurationMs,
            requiresKeepAliveEveryMs: here.requiresKeepAliveEveryMs,
          }).then(after),
      },
    };
  }

  if (here) {
    const sized = BATCH_SIZES.map(
      (n): CardAction => ({
        label: n === 1 ? here.actionLabel : `x${n}`,
        disabled: !!blocker,
        reason: blocker,
        onClick: () => void confirmAndStartCraftJob(engine, recipe, n).then(after),
      })
    );
    return { here, active: false, primary: { ...sized[0], variant: "primary" }, more: sized.slice(1) };
  }

  if (nodes.length === 0) return { active: false, more: [] };

  const nearest = nearestSpot(engine, state, recipe.id);
  const from = getLocation(state.currentLocationId);
  if (!nearest || !from) {
    return {
      active: false,
      more: [],
      primary: { label: "Travel", disabled: true, reason: "None of the places with this are open to you yet.", onClick: () => {} },
    };
  }
  return {
    nearest,
    active: false,
    more: [],
    primary: {
      label: `Travel to ${nearest.location.name}`,
      hint: `About ${formatDuration(nearest.travelMs)} away`,
      onClick: () => void confirmAndStartTravel(engine, from, nearest.location).then(after),
    },
  };
}
