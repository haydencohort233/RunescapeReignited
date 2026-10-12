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
    g.engine.setFlag("denCleared");
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

  it("a job with a level requirement can't be accepted until it's met", () => {
    const g = makeEngine();
    const job = getJob("oak-order")!;
    g.state().currentLocationId = "lumber-camp";
    expect(g.engine.acceptJob(job, "lumber-camp")).toBe(false);
    g.engine.setSkillLevel("woodcutting", 15);
    expect(g.engine.acceptJob(job, "lumber-camp")).toBe(true);
  });

  it("one-time jobs stay accepted across the daily reset; daily ones expire", () => {
    const g = makeEngine();
    g.engine.acceptJob(getJob("reach-woodcutting-15")!, "town");
    g.engine.acceptJob(getJob("deliver-wood")!, "town");
    g.advance(DAY);
    expect(g.engine.isJobAccepted("reach-woodcutting-15")).toBe(true);
    expect(g.engine.isJobAccepted("deliver-wood")).toBe(false);
  });
});
