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
  const [loaded, setLoaded] = useState(() => (src ? isImageLoaded(src) : false));
  const [failed, setFailed] = useState(() => (src ? didImageFail(src) : true));

  useEffect(() => {
    if (!src) {
      setFailed(true);
      return;
    }
    if (isImageLoaded(src)) {
      setLoaded(true);
      return;
    }
    if (didImageFail(src)) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    preloadImage(src).then((ok) => {
      if (cancelled) return;
      if (ok) setLoaded(true);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src || failed) return <>{fallback}</>;

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
      {!loaded && <div style={{ position: "absolute", inset: 0 }}>{fallback}</div>}
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
          imageRendering: "pixelated", // keeps small sprites crisp when upscaled
          opacity: loaded ? 1 : 0,
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}