import { useSyncExternalStore } from "react";
import type { Facing, FurnitureDefinition } from "../../engine/types";
import { furnitureImagePath } from "../../content/assetPaths";

// Natural sizes of house art, loaded once per file. Pieces are drawn at
// their pixel size, so the room needs each image's width and height
// before it can place it; until then (or if the file is missing) the
// drawn stand-in shows.

export interface ArtSize {
  w: number;
  h: number;
}

/** null: the file failed to load (missing). */
const sizes = new Map<string, ArtSize | null>();
const loading = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version++;
  listeners.forEach((l) => l());
}

/** The image's size, null if it's missing, undefined while it loads
 *  (loading starts on the first ask). */
export function artSize(src: string): ArtSize | null | undefined {
  if (sizes.has(src)) return sizes.get(src);
  if (!loading.has(src) && typeof Image !== "undefined") {
    loading.add(src);
    const img = new Image();
    img.onload = () => {
      sizes.set(src, { w: img.naturalWidth, h: img.naturalHeight });
      notify();
    };
    img.onerror = () => {
      sizes.set(src, null);
      notify();
    };
    img.src = src;
  }
  return undefined;
}

/** Re-renders the caller whenever another image finishes loading. */
export function useArtVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version
  );
}

export interface PieceArt {
  src: string;
  size: ArtSize;
  /** Facing right uses the side image mirrored. */
  flip: boolean;
}

/** The image for a piece facing a way: its side or back image when one
 *  exists, else the front; a skin's art first, then the piece's own.
 *  null when it has no art at all, undefined while still loading. */
export function pieceArt(def: FurnitureDefinition, facing: Facing, skinArt?: string): PieceArt | null | undefined {
  const stems = [skinArt, def.art].filter((s): s is string => !!s);
  const candidates: { texture: "front" | "side" | "back"; flip: boolean }[] =
    facing === "left" || facing === "right"
      ? [
          { texture: "side", flip: facing === "right" },
          { texture: "front", flip: false },
        ]
      : facing === "back"
        ? [
            { texture: "back", flip: false },
            { texture: "front", flip: false },
          ]
        : [{ texture: "front", flip: false }];
  for (const stem of stems) {
    for (const c of candidates) {
      const src = furnitureImagePath(stem, c.texture);
      const size = artSize(src);
      if (size === undefined) return undefined;
      if (size) return { src, size, flip: c.flip };
    }
  }
  return null;
}
