/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FLOOR_CATALOG, FURNITURE_CATALOG, RUG_CATALOG, SKIN_CATALOG, WALLPAPER_CATALOG } from "../../content/house";
import { furnitureImagePath, houseImagePath } from "../../content/assetPaths";

const ASSETS = fileURLToPath(new URL("../../../public/assets/", import.meta.url));
const files = (folder: string) => (existsSync(ASSETS + folder) ? readdirSync(ASSETS + folder) : []);

/** The file name a path points at. */
const fileOf = (path: string) => decodeURIComponent(path).split("/").pop()!;

describe("furniture art", () => {
  const stems = [...FURNITURE_CATALOG.map((f) => f.art), ...SKIN_CATALOG.map((s) => s.art)].filter((a): a is string => !!a);

  it("paths are flat: <art>.png, <art>_side.png, <art>_back.png", () => {
    expect(fileOf(furnitureImagePath("wooden_bed", "front"))).toBe("wooden_bed.png");
    expect(fileOf(furnitureImagePath("wooden_bed", "side"))).toBe("wooden_bed_side.png");
    expect(fileOf(furnitureImagePath("wooden_bed", "back"))).toBe("wooden_bed_back.png");
  });

  it("every piece that names art has its front image", () => {
    const have = new Set(files("furniture"));
    const missing = FURNITURE_CATALOG.filter((f) => f.art && !have.has(fileOf(furnitureImagePath(f.art, "front")))).map((f) => f.id);
    expect(missing).toEqual([]);
  });

  // Art dropped in under a name nothing uses never shows. Catch that here.
  it("every furniture image belongs to a piece or skin", () => {
    const expected = new Set(stems.flatMap((s) => (["front", "side", "back"] as const).map((t) => fileOf(furnitureImagePath(s, t)))));
    expect(files("furniture").filter((f) => !expected.has(f))).toEqual([]);
  });

  // Decided Oct 22: every asset file uses underscores, never hyphens.
  it("no asset file anywhere has a hyphen in its name", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [e.name]));
    expect(walk(ASSETS).filter((f) => f.includes("-"))).toEqual([]);
  });

  it("file names are lowercase with underscores", () => {
    for (const folder of ["furniture", "house", "yard"]) {
      expect(files(folder).filter((f) => f !== f.toLowerCase() || f.includes("-"))).toEqual([]);
    }
  });

  it("room looks with art have their file", () => {
    const have = new Set(files("house"));
    const looks = [...WALLPAPER_CATALOG, ...FLOOR_CATALOG, ...RUG_CATALOG].filter((c) => c.art);
    expect(looks.filter((c) => !have.has(fileOf(houseImagePath(c.art!)))).map((c) => c.id)).toEqual([]);
  });
});
