import type { GameEngine } from "../engine/gameEngine";
import { BUILDING_CATALOG } from "./buildings";

/**
 * Registers all starting content into a fresh (or loaded) engine, without
 * clobbering anything a save already has. Idempotent — safe to call every
 * time the app boots, including after loading an old save that predates
 * some of this content (those entries just get added at quantity 0).
 *
 * Centralized here (rather than scattered across whichever view happens to
 * render first) so every view sees the same producers regardless of which
 * tab the player opens first.
 */
export function registerStartingContent(engine: GameEngine): void {
  if (!engine.getState().producers["base-gp"]) {
    engine.registerProducer({
      id: "base-gp",
      name: "Base Income",
      resource: "gp",
      baseRatePerSecond: 1,
      quantity: 1,
      // No baseCost — this one isn't purchased, it's just always-on. Change
      // this to quantity: 0 (or remove the registerProducer call) whenever
      // you want GP to start at 0 until the player triggers something.
    });
  }

  for (const building of BUILDING_CATALOG) {
    if (!engine.getState().producers[building.id]) {
      engine.registerProducer({ ...building });
    }
  }
}