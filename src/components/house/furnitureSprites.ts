import type { Facing, FurnitureDefinition } from "../../engine/types";

// Stand-in drawings for house furniture until real art exists, in the
// same hand-drawn style as the town scenes. Each is SVG markup in a
// 100 x 100 box with the floor (or the wall bracket) along the bottom,
// stretched to the piece's box. Static markup from our own content only.

export interface FurnitureDrawing {
  svg: string;
  /** How tall it stands, in front-row cell widths (floor pieces). */
  height: number;
  /** Where things on its surface sit, from the top (0 to 1). */
  surfaceAt?: number;
}

const INK = "#3b2414";

/** Wood colour by the piece's material. */
function wood(id: string): { main: string; dark: string } {
  if (id.startsWith("mahogany")) return { main: "#6e2f22", dark: "#4a1c14" };
  if (id.startsWith("oak")) return { main: "#9a6233", dark: "#6b4220" };
  if (id.startsWith("crude")) return { main: "#b08a5a", dark: "#7a5a36" };
  return { main: "#b97d45", dark: "#7f5129" };
}

const s = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;

/** The stand-in for a piece facing a given way. Most have one drawing for
 *  every facing; beds have a side view when turned. */
export function furnitureDrawing(def: FurnitureDefinition, facing: Facing = "front"): FurnitureDrawing {
  const id = def.id;
  const { main, dark } = wood(id);
  const sideways = facing === "left" || facing === "right";

  if (id.includes("chair"))
    return {
      height: 1.15,
      svg: `<rect x="26" y="6" width="9" height="92" fill="${dark}" ${s()}/><rect x="65" y="6" width="9" height="92" fill="${dark}" ${s()}/><rect x="30" y="14" width="40" height="8" fill="${main}" ${s(2)}/><rect x="30" y="30" width="40" height="8" fill="${main}" ${s(2)}/><rect x="18" y="54" width="64" height="11" rx="2" fill="${main}" ${s()}/><rect x="20" y="65" width="8" height="33" fill="${dark}" ${s(2.5)}/><rect x="72" y="65" width="8" height="33" fill="${dark}" ${s(2.5)}/>`,
    };
  if (id.includes("table"))
    return {
      height: 0.8,
      surfaceAt: 0.3,
      svg: `<rect x="2" y="26" width="96" height="12" rx="2" fill="${main}" ${s()}/><rect x="6" y="38" width="88" height="8" fill="${dark}" ${s(2)}/><rect x="8" y="46" width="8" height="52" fill="${dark}" ${s(2.5)}/><rect x="84" y="46" width="8" height="52" fill="${dark}" ${s(2.5)}/><path d="M8 30h80" stroke="#ffffff44" stroke-width="2"/>`,
    };
  if (id.includes("bookcase")) {
    const books = (y: number) =>
      [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${16 + i * 11}" y="${y}" width="9" height="20" fill="${["#b23a3a", "#2f6fb0", "#3f8a3a", "#c9a23a", "#7b4fc9", "#a85a2a"][(i + y) % 6]}" stroke="${INK}" stroke-width="1.2"/>`).join("");
    return {
      height: 1.7,
      svg: `<rect x="8" y="2" width="84" height="96" fill="${main}" ${s()}/><rect x="14" y="8" width="72" height="84" fill="${dark}"/>${books(10)}${books(38)}${books(66)}<path d="M14 31h72M14 59h72M14 87h72" stroke="${INK}" stroke-width="3"/>`,
    };
  }
  if (id.includes("bed")) {
    const blanket = id.startsWith("mahogany") ? "#6b3fa0" : id.startsWith("oak") ? "#2f6fb0" : "#b23a3a";
    const fourPoster = id.startsWith("mahogany");
    if (sideways) {
      // Side on: headboard at the left (flipped for "right").
      const posts = fourPoster
        ? `<rect x="2" y="2" width="7" height="96" fill="${dark}" ${s(2)}/><rect x="91" y="2" width="7" height="96" fill="${dark}" ${s(2)}/><rect x="2" y="2" width="96" height="7" fill="${main}" ${s(2)}/>`
        : "";
      return {
        height: 0.95,
        svg: `${posts}<rect x="4" y="22" width="14" height="76" rx="3" fill="${main}" ${s()}/><rect x="6" y="66" width="88" height="18" fill="${main}" ${s()}/><rect x="16" y="52" width="78" height="15" rx="4" fill="#f4efe2" ${s(2)}/><rect x="40" y="49" width="54" height="19" rx="4" fill="${blanket}" ${s(2)}/><rect x="20" y="44" width="18" height="11" rx="5" fill="#ffffff" ${s(2)}/><rect x="8" y="84" width="7" height="14" fill="${dark}" ${s(2)}/><rect x="85" y="84" width="7" height="14" fill="${dark}" ${s(2)}/>`,
      };
    }
    // Foot first: headboard at the back (top), the bed coming toward you.
    const posts = fourPoster
      ? `<rect x="4" y="0" width="8" height="98" fill="${dark}" ${s(2)}/><rect x="88" y="0" width="8" height="98" fill="${dark}" ${s(2)}/><rect x="4" y="0" width="92" height="7" fill="${main}" ${s(2)}/>`
      : "";
    return {
      height: 1.45,
      svg: `${posts}<rect x="12" y="6" width="76" height="30" rx="6" fill="${main}" ${s()}/><path d="M16 30 H84 L90 80 H10Z" fill="#f4efe2" ${s(2.5)}/><rect x="28" y="28" width="44" height="12" rx="6" fill="#ffffff" ${s(2)}/><path d="M12 46 H88 L91 80 H9Z" fill="${blanket}" ${s(2.5)}/><path d="M12 52 H88" stroke="#ffffff55" stroke-width="3"/><rect x="6" y="78" width="88" height="12" rx="2" fill="${main}" ${s()}/><rect x="8" y="90" width="8" height="9" fill="${dark}" ${s(2)}/><rect x="84" y="90" width="8" height="9" fill="${dark}" ${s(2)}/>`,
    };
  }
  if (id.includes("torch"))
    return {
      height: 1,
      svg: `<g class="house-flicker"><path d="M50 8 C36 26 40 40 50 46 C60 40 64 26 50 8Z" fill="#ff8a1e" stroke="#7a3a10" stroke-width="2"/><path d="M50 22 C44 32 46 40 50 43 C54 40 56 32 50 22Z" fill="#ffe066"/></g><rect x="44" y="44" width="12" height="40" rx="2" fill="#6b4226" ${s(2.5)}/><rect x="34" y="80" width="32" height="10" rx="2" fill="#555b63" ${s(2.5)}/>`,
    };
  if (id.includes("shelves"))
    return {
      height: 1,
      surfaceAt: 0.72,
      svg: `<rect x="0" y="70" width="100" height="10" rx="2" fill="${main}" ${s()}/><path d="M12 80 L12 96 L26 80Z M88 80 L88 96 L74 80Z" fill="${dark}" ${s(2)}/>`,
    };
  if (id.includes("painting"))
    return {
      height: 1,
      svg: `<rect x="4" y="8" width="92" height="84" rx="2" fill="#b8892e" ${s()}/><rect x="12" y="16" width="76" height="68" fill="#9fd3f0"/><path d="M12 64 Q32 44 52 60 T88 54 V84 H12Z" fill="#5f9f3f"/><path d="M12 74 Q40 60 88 72 V84 H12Z" fill="#4a8a32"/><circle cx="70" cy="32" r="7" fill="#ffe066"/><rect x="12" y="16" width="76" height="68" fill="none" stroke="${INK}" stroke-width="2"/>`,
    };
  if (id.includes("plant"))
    return {
      height: 1,
      svg: `<circle cx="38" cy="40" r="16" fill="#4f9a3f" ${s(2)}/><circle cx="62" cy="38" r="16" fill="#5aa84a" ${s(2)}/><circle cx="50" cy="24" r="17" fill="#66b455" ${s(2)}/><path d="M28 60 H72 L64 98 H36Z" fill="#c8663a" ${s()}/><rect x="25" y="56" width="50" height="9" rx="2" fill="#d97a4a" ${s(2.5)}/>`,
    };
  if (id.includes("candlestick"))
    return {
      height: 1,
      svg: `<g class="house-flicker"><path d="M50 4 C42 16 44 24 50 28 C56 24 58 16 50 4Z" fill="#ff9a2e" stroke="#7a3a10" stroke-width="1.5"/></g><rect x="42" y="28" width="16" height="36" rx="2" fill="#fbf4dc" ${s(2)}/><rect x="45" y="62" width="10" height="22" fill="#b07a3a" ${s(2)}/><ellipse cx="50" cy="90" rx="26" ry="8" fill="#c98a3a" ${s(2.5)}/>`,
    };
  if (id.includes("sawhorse"))
    return {
      height: 0.9,
      svg: `<path d="M18 98 L34 40 M40 98 L30 40 M60 98 L70 40 M82 98 L66 40" stroke="${dark}" stroke-width="7" stroke-linecap="round"/><rect x="8" y="34" width="84" height="12" rx="2" fill="${main}" ${s()}/><rect x="14" y="18" width="62" height="16" rx="8" fill="#a0683a" stroke="#4a2c14" stroke-width="2.5"/><ellipse cx="14" cy="26" rx="4" ry="8" fill="#d9a86a" stroke="#4a2c14" stroke-width="2"/><path d="M64 4 L88 30" stroke="#6b7078" stroke-width="6" stroke-linecap="round"/><path d="M60 0 l8 8" stroke="#8a5530" stroke-width="7" stroke-linecap="round"/>`,
    };
  if (id.includes("range"))
    return {
      height: 1.1,
      surfaceAt: undefined,
      svg: `<rect x="70" y="2" width="12" height="30" fill="#4b5058" ${s(2.5)}/><rect x="6" y="30" width="88" height="68" rx="3" fill="#3f4349" ${s()}/><rect x="6" y="30" width="88" height="10" fill="#5a6068" ${s(2)}/><circle cx="28" cy="35" r="5" fill="#2a2d31"/><circle cx="56" cy="35" r="5" fill="#2a2d31"/><rect x="18" y="50" width="40" height="34" rx="3" fill="#2a1c12" ${s(2)}/><path d="M26 84 q4 -14 12 -18 q2 10 8 12 q2 -6 0 -10 q8 8 2 16Z" fill="#ff8a1e"/><rect x="66" y="52" width="20" height="8" rx="2" fill="#8a929c"/>`,
    };
  if (id.includes("anvil"))
    return {
      height: 0.85,
      svg: `<rect x="28" y="62" width="44" height="36" fill="#8a5530" ${s()}/><path d="M6 30 H74 Q92 30 96 42 H70 V50 H58 V62 H40 V50 H26 Q8 46 6 30Z" fill="#4b5058" stroke="#1d1f22" stroke-width="3" stroke-linejoin="round"/><path d="M12 34 H70" stroke="#8a929c" stroke-width="3" stroke-linecap="round"/>`,
    };
  if (id.includes("furnace"))
    return {
      height: 1.3,
      svg: `<path d="M34 30 L40 2 H60 L66 30Z" fill="#8f8a84" stroke="#2c2a28" stroke-width="3" stroke-linejoin="round"/><rect x="6" y="28" width="88" height="70" rx="4" fill="#9d978f" stroke="#2c2a28" stroke-width="3"/><path d="M14 42h20M44 40h22M74 44h14M14 70h12M78 72h10" stroke="#7d7770" stroke-width="2.5" stroke-linecap="round"/><path d="M30 98 V70 a20 18 0 0 1 40 0 V98Z" fill="#ff7a1a" stroke="#2c2a28" stroke-width="2.5"/><path d="M38 98 V74 a12 11 0 0 1 24 0 V98Z" fill="#ffcf4a"/>`,
    };
  return { height: 1, svg: "" };
}
