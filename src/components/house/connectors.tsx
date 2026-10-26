import type { FurnitureDefinition, PlacedFurniture } from "../../engine/types";
import type { AreaGeometry } from "./roomGeometry";
import { layoutOf } from "./connectorGeometry";

// Pieces that join up with their neighbours (fences now; hedges and walls
// later, decided Oct 25). Each one draws its own post plus half a rail
// toward every neighbour of the same kind, so two neighbours' halves meet
// and runs, corners and T-joins form on their own. A piece with no
// neighbours draws a short panel so it still reads as a fence. Drawn in
// picture units; art (a post and a rail image) can replace this later.

const INK = "#3b2414";

/** A fence post and its rails, drawn to fill its box. */
export function ConnectorSprite({ def, geo, piece, pieces }: { def: FurnitureDefinition; geo: AreaGeometry; piece: PlacedFurniture; pieces: PlacedFurniture[] }) {
  const { box, base, height, ends, post } = layoutOf(geo, piece, pieces);
  const main = def.id.startsWith("oak") ? "#9a6233" : "#b97d45";
  const dark = def.id.startsWith("oak") ? "#6b4220" : "#7f5129";
  const rail = (at: number, thick: number) =>
    ends.map((e, i) => {
      const y1 = base.y - height * at;
      const y2 = e.y - height * at;
      return <polygon key={`${at}-${i}`} points={`${base.x},${y1 - thick} ${e.x},${y2 - thick} ${e.x},${y2 + thick} ${base.x},${y1 + thick}`} fill={dark} stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
    });
  return (
    <svg className="house-drawing" viewBox={`${box.left} ${box.top} ${box.width} ${box.height}`} preserveAspectRatio="none" aria-hidden="true">
      {rail(0.72, post * 0.38)}
      {rail(0.34, post * 0.38)}
      <path
        d={`M${base.x - post / 2} ${base.y} V${base.y - height} L${base.x} ${base.y - height - post} L${base.x + post / 2} ${base.y - height} V${base.y} Z`}
        fill={main}
        stroke={INK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
