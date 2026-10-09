import type { ReactNode } from "react";
import { skillIconPath, mapUiIconPath, itemImagePath } from "../content/assetPaths";
import { getItemDefByName, getItemDef } from "../content/items";
import GameImage from "./GameImage";

/**
 * Renders text with inline icon tags — write `<Herblore> Total Potions
 * Made` and the client swaps the tag for the real Herblore icon.
 *
 * Tag resolution, in order:
 *   <Herblore>            -> /assets/skills/herblore.png       (known skill)
 *   <Abyssal Whip>         -> looked up BY NAME in ITEM_CATALOG (an
 *                             in-memory array scan, not a folder scan —
 *                             the catalog already knows the item's
 *                             assetFolder/animated flag, so the tag never
 *                             needs to spell out the category itself)
 *   <Skull>                -> /assets/worldmap/icons/ui/skull.png (UI icon)
 *   </assets/foo/bar.png>  -> that literal path, escape hatch for anything
 *                             not covered by the shorthands above
 *
 * An unknown tag renders as its plain text (minus the brackets) rather
 * than vanishing or showing a broken image, so a typo degrades to
 * readable words instead of breaking the sentence.
 */

const KNOWN_SKILLS = new Set([
  "attack",
  "strength",
  "defence",
  "hitpoints",
  "ranged",
  "magic",
  "fishing",
  "woodcutting",
  "firemaking",
  "fletching",
  "agility",
  "farming",
  "herblore",
]);

function resolveTag(tag: string): { src: string; alt: string } | null {
  // Literal path escape hatch: </assets/...>
  if (tag.startsWith("/")) return { src: tag, alt: "" };

  const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (KNOWN_SKILLS.has(slug)) return { src: skillIconPath(slug), alt: tag };

  // Try by display name first (<Abyssal Whip>, what a person would write),
  // then by raw id (<bronze-dagger>, what the content-agnostic engine emits
  // — it knows item ids, never display names, so this is how ITS
  // notification strings get working icons without importing content/).
  const itemDef = getItemDefByName(tag) ?? getItemDef(tag);
  if (itemDef) {
    return { src: itemImagePath(itemDef.name, itemDef.animated, itemDef.assetFolder), alt: itemDef.name };
  }

  return { src: mapUiIconPath(slug), alt: tag };
}

export default function RichText({ text, iconSize = 16 }: { text: string; iconSize?: number }) {
  // Split on <...> while keeping the delimiters.
  const parts = text.split(/(<[^>]+>)/g).filter((p) => p !== "");

  const nodes: ReactNode[] = parts.map((part, i) => {
    const match = part.match(/^<([^>]+)>$/);
    if (!match) return <span key={i}>{part}</span>;

    const tag = match[1];
    const resolved = resolveTag(tag);
    if (!resolved) return <span key={i}>{tag}</span>;

    return (
      <GameImage
        key={i}
        src={resolved.src}
        alt={resolved.alt}
        style={{
          width: iconSize,
          height: iconSize,
          verticalAlign: "text-bottom",
          margin: "0 2px",
        }}
        // Unknown/missing icon degrades to the tag's words, not a gap.
        fallback={<span>{tag.startsWith("/") ? "" : tag}</span>}
      />
    );
  });

  return <>{nodes}</>;
}