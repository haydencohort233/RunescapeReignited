import type { ItemDefinition } from "../engine/types";
import { itemImagePath } from "../content/assetPaths";
import GameImage from "./GameImage";

/** One item's icon, with the emoji/placeholder fallback. Shared by the
 *  Inventory, Equipment and Shop lists so the fallback and sizing rules
 *  live in one place. */
export default function ItemIcon({ def, size = 32 }: { def: ItemDefinition; size?: number }) {
  return (
    <GameImage
      src={itemImagePath(def.name, def.animated, def.assetFolder)}
      alt={def.name}
      style={{ width: size, height: size, verticalAlign: "middle" }}
      fallback={
        <span
          style={{
            width: size,
            height: size,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.6,
          }}
        >
          {def.image ?? "📦"}
        </span>
      }
    />
  );
}