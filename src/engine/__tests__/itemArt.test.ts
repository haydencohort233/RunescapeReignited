/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ITEM_CATALOG } from "../../content/items";
import { itemImagePath } from "../../content/assetPaths";

const ITEMS_DIR = fileURLToPath(new URL("../../../public/assets/items", import.meta.url));

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [relative(ITEMS_DIR, join(dir, e.name))]
  );
}

describe("item art", () => {
  const files = listFiles(ITEMS_DIR);

  it("every catalog item names its art folder", () => {
    expect(ITEM_CATALOG.filter((i) => !i.assetFolder).map((i) => i.id)).toEqual([]);
  });

  // Catches art that exists but sits somewhere the game never looks: the
  // reason bones, the bronze set and the Glory all showed a 📦 placeholder.
  it("any art that exists for an item is where the item looks for it", () => {
    const misplaced: string[] = [];
    for (const def of ITEM_CATALOG) {
      const expected = decodeURIComponent(itemImagePath(def.name, def.animated, def.assetFolder)).replace(/^.*?assets\/items\//, "");
      const fileName = expected.split("/").pop()!;
      const found = files.filter((f) => f.split("/").pop() === fileName);
      if (found.length > 0 && !found.includes(expected)) misplaced.push(`${def.id}: expected ${expected}, found ${found.join(", ")}`);
    }
    expect(misplaced).toEqual([]);
  });

  it("file names are lowercase, since paths are built from lowercased names", () => {
    expect(files.filter((f) => f.split("/").pop() !== f.split("/").pop()!.toLowerCase())).toEqual([]);
  });
});
