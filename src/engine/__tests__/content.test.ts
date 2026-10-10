import { describe, expect, it } from "vitest";
import { validateContent } from "../../content/validate";
import { levelForXp, xpForLevel, MAX_LEVEL } from "../xpCurve";

describe("content", () => {
  it("every catalog is internally consistent", () => {
    expect(validateContent()).toEqual([]);
  });
});

describe("levelForXp", () => {
  it("matches the threshold table at, just below and above every level", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const xp = xpForLevel(level);
      expect(levelForXp(xp)).toBe(level);
      if (level > 1) expect(levelForXp(xp - 0.5)).toBe(level - 1);
    }
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-10)).toBe(1);
    expect(levelForXp(1e12)).toBe(MAX_LEVEL);
  });
});

describe("validateContent catches mistakes", () => {
  it("reports a zero craft time and an unknown item", async () => {
    const { RECIPE_CATALOG } = await import("../../content/recipes");
    const recipe = RECIPE_CATALOG[0];
    const saved = { time: recipe.timePerItemMs, output: recipe.output };
    recipe.timePerItemMs = 0;
    recipe.output = { resource: "wodo", amount: 1 };
    try {
      const errors = validateContent();
      expect(errors).toContain(`recipe "${recipe.id}": timePerItemMs must be > 0`);
      expect(errors).toContain(`recipe "${recipe.id}": unknown item or currency "wodo"`);
    } finally {
      recipe.timePerItemMs = saved.time;
      recipe.output = saved.output;
    }
  });
});
