import { describe, expect, it } from "vitest";
import { makeEngine, SECOND } from "./helpers";
import { WOODEN_BOW_RECIPE } from "../../content/recipes";

describe("crafting notifications", () => {
  it("a 30-item job leaves one toast, not 30", () => {
    const g = makeEngine();
    g.engine.addItem("wood", 30);
    g.engine.startCraftJob(WOODEN_BOW_RECIPE, 30);
    for (let i = 0; i < 60; i++) g.advance(SECOND);
    const production = g.engine.notifications.getAll().filter((n) => n.type === "production");
    expect(production).toHaveLength(1);
    expect(production[0].message).toContain("all 30 done");
  });
});

describe("notification queue", () => {
  it("keeps at most 8 toasts on screen, dropping the oldest non-error first", async () => {
    const { NotificationQueue } = await import("../notificationQueue");
    const q = new NotificationQueue();
    q.push("error", "keep me", { severity: "error" });
    for (let i = 0; i < 20; i++) q.push("quest", `quest ${i}`);
    const active = q.getAll();
    expect(active).toHaveLength(8);
    expect(active[0].message).toBe("keep me");
    expect(active.at(-1)!.message).toBe("quest 19");
    q.clear();
  });
});

describe("away summary", () => {
  it("reports gathered items and production by name", async () => {
    const { CHOP_NORMAL_TREE_RECIPE } = await import("../../content/recipes");
    const g = makeEngine();
    g.engine.startGatherSession("trees", CHOP_NORMAL_TREE_RECIPE);
    g.advance(10 * 60 * SECOND);
    const summary = g.engine.notifications.getAll().find((n) => n.type === "offline-summary");
    expect(summary?.message).toContain("200 Wood");
    expect(summary?.message).toContain("600 GP");
  });
});
