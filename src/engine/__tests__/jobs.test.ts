import { describe, expect, it } from "vitest";
import { makeEngine, HOUR } from "./helpers";
import { getJob } from "../../content/jobs";
import type { JobDefinition } from "../types";

const DAY = 24 * HOUR;

describe("job board", () => {
  it("counts kills from when the job was accepted, not lifetime", () => {
    const g = makeEngine();
    const job = getJob("goblin-trouble")!;
    g.state().statistics["kills:goblin"] = 40;
    g.engine.acceptJob(job, "town");
    expect(g.engine.isJobObjectiveMet(job)).toBe(false);
    g.state().statistics["kills:goblin"] = 44;
    expect(g.engine.isJobObjectiveMet(job)).toBe(false);
    g.state().statistics["kills:goblin"] = 45;
    expect(g.engine.turnInJob(job, "town")).toBe(true);
  });

  it("a daily job comes back after the UTC reset", () => {
    const g = makeEngine();
    const job: JobDefinition = { id: "j", title: "J", description: "", objective: { kind: "flag", flag: "x" } };
    g.engine.setFlag("x");
    g.engine.acceptJob(job, "town");
    g.engine.turnInJob(job, "town");
    expect(g.engine.acceptJob(job, "town")).toBe(false);
    g.setNow(g.now() + DAY);
    expect(g.engine.acceptJob(job, "town")).toBe(true);
  });

  it("a once job never comes back, and its reward isn't repeatable", () => {
    const g = makeEngine();
    const job = getJob("clear-the-den")!;
    g.engine.setFlag("investigatedDen");
    g.engine.acceptJob(job, "town");
    g.engine.turnInJob(job, "town");
    g.setNow(g.now() + 3 * DAY);
    g.engine.devForceJobBoardReset();
    expect(g.engine.acceptJob(job, "town")).toBe(false);
  });

  it("a repeatable job can be accepted again right away", () => {
    const g = makeEngine();
    const job = getJob("flax-for-the-fletcher")!;
    g.engine.addItem("flax", 20);
    g.engine.acceptJob(job, "town");
    g.engine.turnInJob(job, "town");
    expect(g.engine.acceptJob(job, "town")).toBe(true);
  });

  it("job progress no longer lives in statistics", () => {
    const g = makeEngine();
    const job = getJob("deliver-wood")!;
    g.engine.addItem("wood", 20);
    g.engine.acceptJob(job, "town");
    g.engine.turnInJob(job, "town");
    expect(Object.keys(g.state().statistics).some((k) => k.startsWith("jobCompletedPeriod:"))).toBe(false);
  });
});
