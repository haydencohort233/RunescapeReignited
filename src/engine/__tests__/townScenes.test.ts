import { describe, expect, it } from "vitest";
import { TOWN_SCENES, SCENE_THEMES } from "../../content/townScenes";
import { AMENITY_CATALOG } from "../../content/amenities";
import { MAP_LOCATIONS } from "../../content/mapLocations";
import { sceneToCode } from "../../components/scene/sceneCode";

const inRange = (n: number) => n >= 0 && n <= 100;

describe("town scenes", () => {
  it("has a scene for every location", () => {
    const missing = MAP_LOCATIONS.filter((l) => !TOWN_SCENES[l.id]).map((l) => l.id);
    expect(missing).toEqual([]);
  });

  it("places every amenity, and only real ones at that location", () => {
    for (const [locationId, scene] of Object.entries(TOWN_SCENES)) {
      const here = AMENITY_CATALOG.filter((a) => a.locationId === locationId).map((a) => a.id);
      expect(Object.keys(scene.spots).sort(), locationId).toEqual([...here].sort());
    }
  });

  it("keeps every position on the picture and uses a known theme", () => {
    for (const [id, scene] of Object.entries(TOWN_SCENES)) {
      expect(SCENE_THEMES[scene.theme], id).toBeDefined();
      const points = [...Object.values(scene.spots), ...scene.decor, ...scene.paths.flat(), ...(scene.plaza ? [scene.plaza] : [])];
      for (const p of points) expect(inRange(p.x) && inRange(p.y), `${id} (${p.x}, ${p.y})`).toBe(true);
      for (const path of scene.paths) expect(path.length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it("copies a layout as code that reads back the same", () => {
    for (const [id, scene] of Object.entries(TOWN_SCENES)) {
      const code = sceneToCode(id, scene);
      const parsed = new Function(`return {${code}}`)()[id];
      expect(parsed, id).toEqual(JSON.parse(JSON.stringify(scene)));
    }
  });
});
