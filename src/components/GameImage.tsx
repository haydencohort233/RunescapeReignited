import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { isImageLoaded, didImageFail, preloadImage } from "../lib/imagePreloader";

/**
 * Renders an image with a graceful fallback (emoji, colored box, whatever)
 * shown until the image is actually loaded — or permanently, if `src` is
 * unset or the image 404s. No real art exists yet for most content, so
 * this component is what makes that invisible: everything just shows its
 * fallback today, and upgrades to the real image the moment a matching
 * file exists at that path, with no code changes anywhere.
 */
export default function GameImage({
  src,
  alt,
  fallback,
  style,
}: {
  src: string | undefined;
  alt: string;
  fallback: ReactNode;
  style?: CSSProperties;
}) {
  // Status is read from the shared preload cache on every render, keyed by
  // the CURRENT src. Holding it in component state went stale when src
  // changed (an enemy's hurt art, a map pin's selected state): one failed
  // image kept the fallback showing even after a later src loaded.
  const status = !src ? "failed" : isImageLoaded(src) ? "loaded" : didImageFail(src) ? "failed" : "pending";
  const [, rerender] = useState(0);
  // Nearest-neighbour ("pixelated") scaling keeps sprites crisp when
  // they're drawn LARGER than their file, but when shrinking it drops whole
  // rows and columns of pixels — a 25px skill icon in a 16px slot loses 9
  // of every 25, so thin lines like arrows break apart. Decided per image
  // once its real size is known.
  const [downscaled, setDownscaled] = useState(false);

  useEffect(() => {
    if (!src || status !== "pending") return;
    let cancelled = false;
    preloadImage(src).then(() => {
      if (!cancelled) rerender((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [src, status]);

  if (status !== "loaded") return <>{fallback}</>;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        // contain + max sizing: a sprite fits its slot without being
        // stretched, whatever its native dimensions are. Avoids hardcoding
        // an assumed sprite size and distorting anything that differs.
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          display: "block",
          margin: "0 auto",
          imageRendering: downscaled ? "auto" : "pixelated",
          // Lifts black-outlined sprites (e.g. Agility) off a dark background.
          filter: "var(--icon-outline)",
        }}
        onLoad={(e) => {
          const img = e.currentTarget;
          setDownscaled(img.naturalWidth > img.clientWidth || img.naturalHeight > img.clientHeight);
        }}
      />
    </div>
  );
}
