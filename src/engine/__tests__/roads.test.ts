import { describe, expect, it } from "vitest";
import { makeEngine } from "./helpers";
import { findRoute, pointAlongRoute, polylineLength, unreachableLocations } from "../roads";
import type { MapLocation, RoadDefinition } from "../types";
import { getLocation } from "../../content/mapLocations";
import { getActiveTravel } from "../activeAction";
import { xpForLevel } from "../xpCurve";

const LOCS: MapLocation[] = [
  { id: "a", name: "A", x: 0, y: 0 },
  { id: "b", name: "B", x: 100, y: 0 },
  { id: "c", name: "C", x: 200, y: 0 },
  { id: "d", name: "D", x: 100, y: 500 },
];

describe("road routes", () => {
  it("is a straight line when there are no roads", () => {
    const r = findRoute(LOCS, undefined, "a", "c")!;
    expect(r.locationIds).toEqual(["a", "c"]);
    expect(r.distance).toBe(200);
  });

  it("takes the shortest chain of roads, waypoints included", () => {
    const roads: RoadDefinition[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "a", to: "d" },
      { from: "d", to: "c", via: [{ x: 150, y: 250 }] },
    ];
    const r = findRoute(LOCS, roads, "a", "c")!;
    expect(r.locationIds).toEqual(["a", "b", "c"]);
    expect(r.distance).toBe(200);
    // Walking a road backwards walks its waypoints backwards too.
    const back = findRoute(LOCS, roads, "c", "d")!;
    expect(back.points).toEqual([{ x: 200, y: 0 }, { x: 150, y: 250 }, { x: 100, y: 500 }]);
    expect(back.distance).toBeCloseTo(polylineLength(back.points));
  });

  it("never walks through a place that can't be entered", () => {
    const roads: RoadDefinition[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "a", to: "d" },
      { from: "d", to: "c" },
    ];
    const notB = { canPassThrough: (id: string) => id !== "b" };
    const r = findRoute(LOCS, roads, "a", "c", notB)!;
    expect(r.locationIds).toEqual(["a", "d", "c"]);
    expect(findRoute(LOCS, [{ from: "a", to: "b" }, { from: "b", to: "c" }], "a", "c", notB)).toBeNull();
    // The destination itself isn't gated here (travel checks that separately).
    expect(findRoute(LOCS, roads, "a", "b", notB)?.locationIds).toEqual(["a", "b"]);
  });

  it("takes a shortcut only once it can be used", () => {
    const roads: RoadDefinition[] = [
      { from: "a", to: "d" },
      { from: "d", to: "c" },
      { from: "a", to: "c", name: "Log balance", requires: { kind: "skillLevel", skill: "agility", atLeast: 20 } },
    ];
    expect(findRoute(LOCS, roads, "a", "c", { canUseRoad: (road) => !road.requires })!.locationIds).toEqual(["a", "d", "c"]);
    const short = findRoute(LOCS, roads, "a", "c")!;
    expect(short.locationIds).toEqual(["a", "c"]);
    expect(short.roads[0].name).toBe("Log balance");
  });

  it("finds places no ordinary road reaches", () => {
    expect(unreachableLocations(LOCS, [{ from: "a", to: "b" }], "a")).toEqual(["c", "d"]);
    // A shortcut alone doesn't count: it may never be unlocked.
    const shortcut: RoadDefinition = { from: "b", to: "c", requires: { kind: "flag", flag: "x" } };
    expect(unreachableLocations(LOCS, [{ from: "a", to: "b" }, shortcut], "a")).toEqual(["c", "d"]);
  });

  it("puts a point the right distance along the route, ending on the last point", () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(pointAlongRoute(pts, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlongRoute(pts, 0.25)).toEqual({ x: 50, y: 0 });
    expect(pointAlongRoute(pts, 0.75)).toEqual({ x: 100, y: 50 });
    expect(pointAlongRoute(pts, 1)).toEqual({ x: 100, y: 100 });
    expect(pointAlongRoute(pts, 7)).toEqual({ x: 100, y: 100 });
  });
});

describe("travel along roads", () => {
  it("times a trip by road length and arrives when it's walked", () => {
    const g = makeEngine();
    const town = getLocation("town")!;
    const lake = getLocation("lake-shore")!;
    const route = g.engine.getTravelRoute(town, lake)!;
    expect(route.locationIds[0]).toBe("town");
    expect(route.locationIds.at(-1)).toBe("lake-shore");
    expect(route.distance).toBeGreaterThanOrEqual(Math.hypot(lake.x - town.x, lake.y - town.y));
    expect(g.engine.startTravel(town, lake)).toBe(true);
    const trip = getActiveTravel(g.state())!;
    g.setNow(trip.startedAt + trip.durationMs);
    g.engine.catchUpToNow();
    expect(g.state().currentLocationId).toBe("lake-shore");
  });

  it("uses the Agility shortcut from level 20", () => {
    const g = makeEngine();
    const draynor = getLocation("draynor-village")!;
    const grove = getLocation("hidden-grove")!;
    const before = g.engine.getTravelRoute(draynor, grove)!;
    expect(before.roads.some((r) => r.requires)).toBe(false);
    g.engine.addSkillXp("agility", xpForLevel(20));
    const after = g.engine.getTravelRoute(draynor, grove)!;
    expect(after.roads.some((r) => r.requires)).toBe(true);
    expect(after.distance).toBeLessThan(before.distance);
  });

  it("charges the Al-Kharid toll, gives it back on cancel, and waives it after the quest", () => {
    const g = makeEngine();
    const town = getLocation("town")!;
    const kharid = getLocation("al-kharid")!;
    g.state().resources.gp = { amount: 50, lifetimeEarned: 50 };
    expect(g.engine.startTravel(town, kharid)).toBe(false);
    g.state().resources.gp = { amount: 150, lifetimeEarned: 150 };
    expect(g.engine.startTravel(town, kharid)).toBe(true);
    expect(g.engine.getResourceAmount("gp")).toBe(50);
    g.engine.stopActiveAction();
    expect(g.engine.getResourceAmount("gp")).toBe(150);
    g.engine.setFlag("princeAliRescued", true);
    expect(g.engine.getTravelToll(kharid)).toEqual([]);
    expect(g.engine.startTravel(town, kharid)).toBe(true);
    expect(g.engine.getResourceAmount("gp")).toBe(150);
  });

  it("every location in the content has a route from the start", () => {
    const g = makeEngine();
    const town = getLocation("town")!;
    for (const id of ["lumber-camp", "lake-shore", "dark-forest", "hidden-grove", "quarry", "draynor-village", "al-kharid"]) {
      expect(findRoute(g.engine.content.locations!, g.engine.content.roads, town.id, id)).not.toBeNull();
    }
  });
});
