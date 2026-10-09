import { createContext, useContext, type ReactNode } from "react";
import { useGameEngine } from "./useGameEngine";

type GameEngineContextValue = ReturnType<typeof useGameEngine>;

const GameEngineContext = createContext<GameEngineContextValue | null>(null);

/**
 * Creates the ONE engine instance for the whole app and makes it available
 * to any component via useGame(). Mount this once, near the root — every
 * view (Game, Skills, Settings, Map, ...) reads from the same instance, so
 * switching views never interrupts the tick loop, autosave, or notifications.
 */
export function GameEngineProvider({ children }: { children: ReactNode }) {
  const value = useGameEngine();
  return <GameEngineContext.Provider value={value}>{children}</GameEngineContext.Provider>;
}

/** Access the shared engine/state/notifications/actions from any component. */
export function useGame(): GameEngineContextValue {
  const ctx = useContext(GameEngineContext);
  if (!ctx) {
    throw new Error("useGame() must be called inside a <GameEngineProvider>.");
  }
  return ctx;
}