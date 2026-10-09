export type ResourceCategory = "currency" | "material" | "item";

export interface ResourceMeta {
  name: string;
  category: ResourceCategory;
}

// Display metadata for every resource ID the engine can hold. This is the
// single place that decides "currency vs. raw material vs. crafted item" —
// UI components read this to decide WHERE to show a resource instead of
// hardcoding a resource list (that hardcoding is what caused coal to
// silently not appear anywhere despite the engine tracking it correctly).
export const RESOURCE_META: Record<string, ResourceMeta> = {
  gp: { name: "GP", category: "currency" },
  "achievement-points": { name: "Achievement Points", category: "currency" },
  wood: { name: "Wood", category: "material" },
  coal: { name: "Coal", category: "material" },
  "raw-fish": { name: "Raw Fish", category: "material" },
  pelt: { name: "Pelt", category: "material" },
  flax: { name: "Flax", category: "material" },
  "willow-logs": { name: "Willow Logs", category: "material" },
};

/** Falls back to a reasonable default for any resource ID not yet cataloged
 *  above, so a forgotten entry degrades gracefully instead of vanishing. */
export function getResourceMeta(resourceId: string): ResourceMeta {
  return RESOURCE_META[resourceId] ?? { name: capitalize(resourceId), category: "material" };
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}