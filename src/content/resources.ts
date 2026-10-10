import { getItemDef } from "./items";

export type ResourceCategory = "currency" | "material" | "item";

export interface ResourceMeta {
  name: string;
  category: ResourceCategory;
}

// Display metadata for ledger ids that AREN'T items — currencies. Every
// item (wood, bones, a dagger) takes its name and category from its
// ItemDefinition instead, so there's exactly one place each id is described.
// UI components read getResourceMeta() to decide WHERE to show an entry
// instead of hardcoding a list.
const CURRENCY_META: Record<string, ResourceMeta> = {
  gp: { name: "GP", category: "currency" },
  "achievement-points": { name: "Achievement Points", category: "currency" },
};

/** Falls back to a reasonable default for any id not cataloged anywhere,
 *  so a forgotten entry degrades gracefully instead of vanishing. */
export function getResourceMeta(resourceId: string): ResourceMeta {
  const currency = CURRENCY_META[resourceId];
  if (currency) return currency;
  const item = getItemDef(resourceId);
  if (item) return { name: item.name, category: item.category === "material" ? "material" : "item" };
  return { name: capitalize(resourceId), category: "material" };
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
