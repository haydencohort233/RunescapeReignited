import { GameEngine, createInitialState } from "../gameEngine";

export const T0 = 1_800_000_000_000;
export const SECOND = 1000;
export const HOUR = 60 * 60 * SECOND;

/** An engine on a fake clock. `advance(ms)` moves time and runs one tick,
 *  the same thing the live 1s loop (or an offline catch-up) does. */
export function makeEngine() {
  let now = T0;
  const clock = () => now;
  const engine = new GameEngine(createInitialState(now), undefined, { clock });
  return {
    engine,
    state: () => engine.getState(),
    advance(ms: number) {
      now += ms;
      engine.resolveElapsed();
    },
    setNow(t: number) {
      now = t;
    },
    now: () => now,
  };
}
