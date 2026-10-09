import { HP_BAR_BACKGROUND, HP_BAR_FILL, HP_BAR_POISONED_FILL } from "../content/assetPaths";
import { isImageLoaded } from "../lib/imagePreloader";

/**
 * Layered HP bar: a background image, with the fill image clipped to the
 * current HP percentage on top — exactly the Background.png / Bar.png /
 * Poisoned_Bar.png split described. The fill is clipped via width +
 * overflow rather than scaled, so the artwork isn't squashed as HP drops
 * (a scaled bar would distort any texture/bevel in the image).
 *
 * `poisoned` swaps the fill art. Nothing sets it yet — poison isn't a
 * mechanic — but the plumbing is here so adding it later is content-only.
 *
 * Falls back to the plain colored CSS bar whenever the art isn't present,
 * which is currently always. Checked via isImageLoaded (not a hook) so
 * this component stays cheap — it re-renders constantly during combat.
 */
export default function HpBar({
  current,
  max,
  label,
  poisoned = false,
}: {
  current: number;
  max: number;
  label: string;
  poisoned?: boolean;
}) {
  const percent = max <= 0 ? 0 : Math.max(0, Math.min(100, (current / max) * 100));
  const fallbackColor = percent > 50 ? "#4b8" : percent > 20 ? "#e0a020" : "#c0392b";
  const fillSrc = poisoned ? HP_BAR_POISONED_FILL : HP_BAR_FILL;
  const useArt = isImageLoaded(HP_BAR_BACKGROUND) && isImageLoaded(fillSrc);

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span>
          {Math.ceil(current)}/{max} HP
        </span>
      </div>

      {useArt ? (
        <div style={{ position: "relative", height: 12 }}>
          <img
            src={HP_BAR_BACKGROUND}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${percent}%`,
              overflow: "hidden", // clip, don't scale — keeps the art undistorted
            }}
          >
            <img
              src={fillSrc}
              alt=""
              style={{
                height: "100%",
                width: percent > 0 ? `${(100 / percent) * 100}%` : "100%",
                maxWidth: "none",
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ background: "#eee", borderRadius: 4, height: 8, overflow: "hidden" }}>
          <div style={{ width: `${percent}%`, background: fallbackColor, height: "100%" }} />
        </div>
      )}
    </div>
  );
}