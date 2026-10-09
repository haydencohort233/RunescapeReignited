// Every asset path in the game is built here, so folder conventions live
// in exactly one place. Files go under /public/assets/, which Vite serves
// from the site root.
//
//   /assets/items/<Category/Sub>/<slug>.png     (.gif when animated)
//        e.g. /assets/items/Armor/Bronze/bronze_full_helm.png
//        Category comes from ItemDefinition.assetFolder — category folders
//        keep this browsable at 1,000+ items, but each item is a single
//        FILE, not its own folder (a per-item folder doubles the directory
//        count for no gain when there's only ever one file in it).
//   /assets/npcs/<slug>/<slug>.png              base art
//   /assets/npcs/<slug>/<slug>_<pct>_hurt.png   optional degrade stages
//        (npcs DO get a folder each, because they legitimately have
//        multiple files — base plus degrade stages.)
//   /assets/skills/<slug>.png
//   /assets/buildings/<slug>.png
//   /assets/achievements/<slug>.png
//   /assets/statistics/<slug>.png
//   /assets/worldmap/worldmap.png
//   /assets/worldmap/icons/locations/<slug>.png
//   /assets/worldmap/icons/locations/<slug>_selected.png
//   /assets/worldmap/icons/locations/<slug>_current.png
//   /assets/worldmap/icons/ui/<slug>.png        travel_here, currently_here, etc.
//   /assets/ui/hpbar/background.png | bar.png | poisoned_bar.png
//   /assets/ui/hitsplats/hit.png | block.png | miss.png
//
// Nothing here checks whether a file EXISTS — GameImage falls back
// gracefully, so adding art is purely "drop the file in," no code change.

/** "Abyssal Whip" -> "abyssal_whip" */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const ASSET_ROOT = "/assets";

/** Encodes each path segment separately so "Armor/Bronze" stays a real
 *  folder path rather than becoming one escaped string. */
function encodeFolder(folder: string): string {
  return folder
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function itemImagePath(displayName: string, animated = false, assetFolder?: string): string {
  const ext = animated ? "gif" : "png";
  const folder = assetFolder ? `${encodeFolder(assetFolder)}/` : "";
  return `${ASSET_ROOT}/items/${folder}${slugify(displayName)}.${ext}`;
}

/**
 * Enemy art, optionally degraded by damage taken. `degradeStages` comes
 * from the enemy's content definition — e.g. [50, 25] means there's a
 * `_50_hurt` and a `_25_hurt` variant. Picks the most-damaged stage whose
 * threshold the enemy has dropped to or below; above all thresholds (or
 * when an enemy defines no stages, the default) returns the base image.
 */
export function enemyImagePath(
  enemyName: string,
  hpPercent: number,
  degradeStages: number[] = []
): string {
  const slug = slugify(enemyName);
  const base = `${ASSET_ROOT}/npcs/${slug}/${slug}`;
  const applicable = [...degradeStages].sort((a, b) => b - a).filter((stage) => hpPercent <= stage);
  const stage = applicable.length > 0 ? applicable[applicable.length - 1] : undefined;
  return stage === undefined ? `${base}.png` : `${base}_${stage}_hurt.png`;
}

export function skillIconPath(skillId: string): string {
  return `${ASSET_ROOT}/skills/${slugify(skillId)}.png`;
}

export function buildingIconPath(buildingId: string): string {
  return `${ASSET_ROOT}/buildings/${slugify(buildingId)}.png`;
}

export function achievementIconPath(achievementId: string): string {
  return `${ASSET_ROOT}/achievements/${slugify(achievementId)}.png`;
}

export function statisticIconPath(statKey: string): string {
  return `${ASSET_ROOT}/statistics/${slugify(statKey)}.png`;
}

export function worldMapPath(): string {
  return `${ASSET_ROOT}/worldmap/worldmap.png`;
}

/** Location pins support per-state art: the normal pin, the one for the
 *  location you've got selected, and the one you're currently standing in.
 *  Each state falls back independently, so shipping only the base pin is
 *  fine — the others just won't differ until their files exist. */
export function locationIconPath(
  locationName: string,
  state: "default" | "selected" | "current" = "default"
): string {
  const slug = slugify(locationName);
  const suffix = state === "default" ? "" : `_${state}`;
  return `${ASSET_ROOT}/worldmap/icons/locations/${slug}${suffix}.png`;
}

/** Generic map-UI icons — "travel_here", "currently_here", resource
 *  indicators shown on the map, etc. */
export function mapUiIconPath(name: string): string {
  return `${ASSET_ROOT}/worldmap/icons/ui/${slugify(name)}.png`;
}

export const HP_BAR_BACKGROUND = `${ASSET_ROOT}/ui/hpbar/background.png`;
export const HP_BAR_FILL = `${ASSET_ROOT}/ui/hpbar/bar.png`;
export const HP_BAR_POISONED_FILL = `${ASSET_ROOT}/ui/hpbar/poisoned_bar.png`;

export function hitsplatIconPath(outcome: "hit" | "block" | "miss"): string {
  return `${ASSET_ROOT}/ui/hitsplats/${outcome}.png`;
}