import type {
  ActiveAction,
  ActiveCombatSession,
  ActiveCraftJob,
  ActiveGatherSession,
  ActiveTravel,
  GameState,
} from "./types";

// Pure selectors over GameState.activeAction — UI code reads these instead
// of switching on `kind` itself.

export function getActiveCraftJob(state: GameState): ActiveCraftJob | null {
  const a = state.activeAction;
  return a?.kind === "craft" ? a : null;
}

export function getActiveGatherSession(state: GameState): ActiveGatherSession | null {
  const a = state.activeAction;
  return a?.kind === "gather" ? a : null;
}

export function getActiveTravel(state: GameState): ActiveTravel | null {
  const a = state.activeAction;
  return a?.kind === "travel" ? a : null;
}

export function getActiveCombat(state: GameState): ActiveCombatSession | null {
  const a = state.activeAction;
  return a?.kind === "combat" ? a : null;
}

/** "crafting Wooden Bow", "fighting Goblin" — for "you're busy ..." prompts. */
export function describeAction(action: ActiveAction): string {
  switch (action.kind) {
    case "craft":
      return `crafting ${action.recipeName}`;
    case "gather":
      return `gathering ${action.recipeName}`;
    case "travel":
      return `traveling to ${action.destinationName}`;
    case "combat":
      return `fighting ${action.enemyName}`;
  }
}
