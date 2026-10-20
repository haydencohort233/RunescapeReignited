import type { MapLocation, MapPoint, RoadDefinition } from "./types";

/** A walkable route between two locations: the locations passed through
 *  (both ends included), the roads taken in order, the polyline to draw,
 *  and its length in map units. */
export interface TravelRoute {
  locationIds: string[];
  roads: RoadDefinition[];
  points: MapPoint[];
  distance: number;
}

export interface RouteRules {
  /** Gates the stops in the middle of a route (not the two ends). */
  canPassThrough?: (locationId: string) => boolean;
  /** Gates each road (a shortcut's requirement). */
  canUseRoad?: (road: RoadDefinition) => boolean;
}

export function polylineLength(points: MapPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

interface Edge {
  to: string;
  /** Waypoints strictly between the two ends, in walking order. */
  via: MapPoint[];
  length: number;
  road: RoadDefinition;
}

/**
 * Shortest route from `fromId` to `toId` along `roads` (Dijkstra; the map
 * is small). `rules` keep a trip off roads it can't use yet and out of
 * places the player can't enter; the two ends are not checked here. With
 * no roads at all, the route is a straight line. Returns null when either
 * end is unknown or no usable road connects them.
 */
export function findRoute(
  locations: MapLocation[],
  roads: RoadDefinition[] | undefined,
  fromId: string,
  toId: string,
  rules: RouteRules = {}
): TravelRoute | null {
  const canPassThrough = rules.canPassThrough ?? (() => true);
  const canUseRoad = rules.canUseRoad ?? (() => true);
  const byId = new Map(locations.map((l) => [l.id, l]));
  const from = byId.get(fromId);
  const to = byId.get(toId);
  if (!from || !to) return null;
  if (fromId === toId) return { locationIds: [fromId], roads: [], points: [{ x: from.x, y: from.y }], distance: 0 };

  if (!roads || roads.length === 0) {
    const points = [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
    return { locationIds: [fromId, toId], roads: [], points, distance: polylineLength(points) };
  }

  const edges = new Map<string, Edge[]>();
  const addEdge = (a: MapLocation, b: MapLocation, via: MapPoint[], road: RoadDefinition) => {
    const length = polylineLength([a, ...via, b]);
    const list = edges.get(a.id) ?? [];
    list.push({ to: b.id, via, length, road });
    edges.set(a.id, list);
  };
  for (const road of roads) {
    const a = byId.get(road.from);
    const b = byId.get(road.to);
    if (!a || !b || !canUseRoad(road)) continue;
    const via = road.via ?? [];
    addEdge(a, b, via, road);
    addEdge(b, a, [...via].reverse(), road);
  }

  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, { from: string; edge: Edge }>();
  const done = new Set<string>();
  for (;;) {
    let current: string | null = null;
    for (const [id, d] of dist) {
      if (!done.has(id) && (current === null || d < dist.get(current)!)) current = id;
    }
    if (current === null || current === toId) break;
    done.add(current);
    // Only the start and the destination may be places you can't pass through.
    if (current !== fromId && !canPassThrough(current)) continue;
    for (const edge of edges.get(current) ?? []) {
      const next = dist.get(current)! + edge.length;
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next);
        prev.set(edge.to, { from: current, edge });
      }
    }
  }
  if (!dist.has(toId)) return null;

  const locationIds = [toId];
  const segments: Edge[] = [];
  for (let id = toId; id !== fromId; ) {
    const step = prev.get(id)!;
    segments.unshift(step.edge);
    id = step.from;
    locationIds.unshift(id);
  }
  const points: MapPoint[] = [{ x: from.x, y: from.y }];
  segments.forEach((edge, i) => {
    const end = byId.get(locationIds[i + 1])!;
    points.push(...edge.via, { x: end.x, y: end.y });
  });
  return { locationIds, roads: segments.map((s) => s.road), points, distance: dist.get(toId)! };
}

/** The point `fraction` (0..1) of the way along a polyline, by distance. */
export function pointAlongRoute(points: MapPoint[], fraction: number): MapPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  const total = polylineLength(points);
  let remaining = Math.min(1, Math.max(0, fraction)) * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg && seg > 0) {
      const t = remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

/** Location ids that can't be reached from `startId` by an ordinary road
 *  (shortcuts don't count, since they may never be unlocked), ignoring
 *  location unlocks. Content validation wants this to be empty. */
export function unreachableLocations(locations: MapLocation[], roads: RoadDefinition[], startId: string): string[] {
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const r of roads) {
      if (r.requires) continue;
      const next = r.from === id ? r.to : r.to === id ? r.from : null;
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return locations.filter((l) => !seen.has(l.id)).map((l) => l.id);
}
