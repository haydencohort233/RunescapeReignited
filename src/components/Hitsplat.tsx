import { hitsplatIconPath } from "../content/assetPaths";
import { isImageLoaded } from "../lib/imagePreloader";

const SPLAT_COLOR: Record<"hit" | "block" | "miss", string> = {
  hit: "#b91c1c", // red — real damage, matches OSRS
  block: "#2563eb", // blue — landed but rolled 0
  miss: "#9ca3af", // gray — didn't land at all
};

/**
 * A single floating combat splat. When splat artwork exists it's used as
 * the background with the number centered on top (OSRS-style); otherwise
 * it falls back to a plain colored circle with the same text. Either way
 * the text layer is identical, so adding art doesn't change the layout.
 */
export default function Hitsplat({
  outcome,
  damage,
  offsetIndex,
}: {
  outcome: "hit" | "block" | "miss";
  damage: number;
  /** Staggers multiple simultaneous splats so they don't fully overlap. */
  offsetIndex: number;
}) {
  const iconSrc = hitsplatIconPath(outcome);
  const useArt = isImageLoaded(iconSrc);
  const text = outcome === "miss" ? "MISS" : String(damage);
  const size = 24;

  return (
    <div
      style={{
        position: "absolute",
        left: `${50 + offsetIndex * 14}%`,
        top: -4,
        transform: "translateX(-50%)",
        width: size,
        height: size,
        animation: "hitsplatFloat 1s ease-out forwards",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {useArt && (
        <img src={iconSrc} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Only the fallback needs its own colored circle — with art, the
          // image provides the shape and this layer is just the number.
          background: useArt ? "transparent" : SPLAT_COLOR[outcome],
          borderRadius: useArt ? 0 : "50%",
          color: "white",
          fontWeight: 700,
          fontSize: outcome === "miss" ? 9 : 12,
          textShadow: "0 1px 2px rgba(0,0,0,0.6)", // keeps the number legible over any art
        }}
      >
        {text}
      </div>
    </div>
  );
}