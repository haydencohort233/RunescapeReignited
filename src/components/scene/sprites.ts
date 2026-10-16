import type { Amenity } from "../../content/amenities";
import type { SceneDecor, SceneSpot, SceneTheme, ScenePoint, SpotSprite, TownScene } from "../../content/townScenes";

// The drawings for town scenes, as SVG markup. Building sprites are drawn
// in a box from x -60 to 60 and y -72 to 40, with the ground at y 34, so
// (0, 34) is the point a spot's x/y refers to. Everything here is static
// markup built from our own content, never from player input.

export const SPRITE_VIEWBOX = "-60 -72 120 112";
/** Where the ground line sits inside the sprite box, as a fraction of its
 *  height (used to anchor sprites on their spot). */
export const SPRITE_GROUND = (34 + 72) / 112;

const INK = "#3b2414";
const shadow = (rx = 50) => `<ellipse cx="0" cy="35" rx="${rx}" ry="9" fill="#00000033"/>`;

export interface SpriteLook {
  roof?: string;
  sign?: string;
}

/** The drawing for an amenity: the spot can choose one, otherwise it's
 *  picked from what the amenity is. */
export function pickSprite(amenity: Amenity, spot?: SceneSpot): { sprite: SpotSprite; look: SpriteLook } {
  const look: SpriteLook = { roof: spot?.roof, sign: spot?.sign };
  if (spot?.sprite) return { sprite: spot.sprite, look: withShopDefaults(amenity, look) };
  switch (amenity.kind) {
    case "shop":
      return { sprite: "shop", look: withShopDefaults(amenity, look) };
    case "jobBoard":
      return { sprite: "board", look };
    case "craftingStation":
      return { sprite: amenity.station === "furnace" ? "furnace" : amenity.station === "anvil" ? "anvil" : "oven", look };
    case "dungeonEntrance":
      return { sprite: "cave", look };
    case "combatEncounter":
      return { sprite: "camp", look: { roof: look.roof ?? (/goblin/.test(amenity.enemyId) ? "#9a7b4f" : "#7b5a8a") } };
    case "npc":
      return { sprite: "cottage", look };
    case "resourceNode": {
      const r = amenity.recipeId;
      if (r.startsWith("fish-")) return { sprite: "fishing", look };
      if (r.includes("oak")) return { sprite: "oaks", look };
      if (r.includes("willow")) return { sprite: "willows", look };
      if (r.startsWith("mine-")) return { sprite: "rocks", look };
      if (r.includes("flax")) return { sprite: "flax", look };
      return { sprite: "trees", look };
    }
  }
}

function withShopDefaults(amenity: Amenity, look: SpriteLook): SpriteLook {
  const id = amenity.kind === "shop" ? amenity.shopId : amenity.id;
  let roof = "#e07a2e";
  let sign = "🛒";
  if (/axe/.test(id)) [roof, sign] = ["#d9473b", "🪓"];
  else if (/armou?r/.test(id)) [roof, sign] = ["#5f7088", "🛡️"];
  else if (/rune|magic/.test(id)) [roof, sign] = ["#7b4fc9", "✨"];
  else if (/fish/.test(id)) [roof, sign] = ["#2f7fc1", "🐟"];
  return { roof: look.roof ?? roof, sign: look.sign ?? sign };
}

/** Extra detail some drawings take from the amenity (which fish, which ore). */
function recipeOf(amenity: Amenity): string {
  return amenity.kind === "resourceNode" ? amenity.recipeId : "";
}

const ORE_COLOURS: Record<string, string> = {
  copper: "#d0743a",
  tin: "#d9dde0",
  iron: "#9c5a3c",
  coal: "#2b2b2b",
  gold: "#f2c230",
  mithril: "#5a6ee0",
  adamantite: "#4f8a5a",
  runite: "#36c2c2",
};

export function spriteMarkup(sprite: SpotSprite, look: SpriteLook, amenity: Amenity): string {
  const recipe = recipeOf(amenity);
  switch (sprite) {
    case "shop": {
      const roof = look.roof ?? "#e07a2e";
      let awning = "";
      for (let i = 0; i < 6; i++)
        awning += `<path d="M${-40 + i * 13.33} -14 h13.33 v9 a6.67 5.5 0 0 1 -13.33 0z" fill="${i % 2 ? "#fff" : roof}" stroke="${INK}" stroke-width="1.6"/>`;
      return `${shadow(52)}<rect x="22" y="-56" width="10" height="22" fill="#a0603c" stroke="${INK}" stroke-width="2.5"/><rect x="-38" y="-16" width="76" height="50" rx="3" fill="#f6e7c6" stroke="${INK}" stroke-width="3"/><path d="M-48 -14 L0 -58 L48 -14 Z" fill="${roof}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-32 -22 L-4 -48" stroke="#ffffff55" stroke-width="3" stroke-linecap="round"/>${awning}<rect x="-32" y="6" width="16" height="14" rx="2" fill="#bfe6ff" stroke="${INK}" stroke-width="2"/><rect x="16" y="6" width="16" height="14" rx="2" fill="#bfe6ff" stroke="${INK}" stroke-width="2"/><path d="M-9 34 V14 a9 9 0 0 1 18 0 V34z" fill="#8a5530" stroke="${INK}" stroke-width="2"/><circle cx="5" cy="24" r="1.6" fill="#ffd84d"/><circle cx="0" cy="-32" r="11.5" fill="#fffbe8" stroke="${INK}" stroke-width="2"/><text x="0" y="-31" text-anchor="middle" dominant-baseline="central" font-size="13">${look.sign ?? "🛒"}</text>`;
    }
    case "board":
      return `${shadow(44)}<rect x="-31" y="-22" width="7" height="57" fill="#7a4a26" stroke="${INK}" stroke-width="2"/><rect x="24" y="-22" width="7" height="57" fill="#7a4a26" stroke="${INK}" stroke-width="2"/><rect x="-42" y="-44" width="84" height="46" rx="3" fill="#b9824b" stroke="${INK}" stroke-width="3"/><path d="M-48 -44 L0 -60 L48 -44Z" fill="#8a5530" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><rect x="-34" y="-37" width="20" height="24" fill="#fffdf2" stroke="#8a7a5a" stroke-width="1" transform="rotate(-6 -24 -25)"/><rect x="-9" y="-39" width="18" height="21" fill="#fff4a8" stroke="#8a7a5a" stroke-width="1" transform="rotate(4 0 -28)"/><rect x="14" y="-35" width="20" height="25" fill="#fffdf2" stroke="#8a7a5a" stroke-width="1" transform="rotate(-3 24 -22)"/><path d="M-30 -30h12M-30 -25h10M-30 -20h12M18 -28h12M18 -23h9M18 -18h12M-5 -32h10M-5 -27h8" stroke="#9a9184" stroke-width="1.2"/><circle cx="-24" cy="-37" r="2" fill="#d23b3b"/><circle cx="0" cy="-38" r="2" fill="#2f7fc1"/><circle cx="24" cy="-35" r="2" fill="#d23b3b"/>`;
    case "oven":
      return `${shadow(46)}<g class="sc-smoke"><circle cx="20" cy="-62" r="6" fill="#ffffffaa"/><circle cx="26" cy="-72" r="8" fill="#ffffff88"/><circle cx="20" cy="-84" r="9" fill="#ffffff55"/></g><rect x="13" y="-58" width="13" height="30" fill="#b3aba1" stroke="#3b2c22" stroke-width="2.5"/><path d="M-40 34 V-2 a40 34 0 0 1 80 0 V34Z" fill="#cfc4b5" stroke="#3b2c22" stroke-width="3"/><path d="M-28 -16h14M-6 -24h14M14 -14h14M-34 2h12M-12 -4h16M18 4h14M-30 20h10M24 22h10" stroke="#a49888" stroke-width="2" stroke-linecap="round"/><path d="M-17 34 V14 a17 15 0 0 1 34 0 V34Z" fill="#3a2016" stroke="#3b2c22" stroke-width="2"/><path d="M-9 34 q-2 -12 5 -18 q-1 8 5 10 q2 -8 7 -10 q3 10 -2 18Z" fill="#ff9a2e"/><path d="M-3 34 q0 -7 4 -10 q2 6 4 10Z" fill="#ffe066"/>`;
    case "furnace":
      return `${shadow(50)}<g class="sc-smoke"><circle cx="0" cy="-72" r="7" fill="#d8d8d8aa"/><circle cx="7" cy="-83" r="9" fill="#c8c8c888"/><circle cx="0" cy="-96" r="10" fill="#bbbbbb55"/></g><path d="M-24 -22 L-13 -64 H13 L24 -22Z" fill="#8f8a84" stroke="#2c2a28" stroke-width="3" stroke-linejoin="round"/><rect x="-42" y="-24" width="84" height="58" rx="4" fill="#9d978f" stroke="#2c2a28" stroke-width="3"/><path d="M-34 -12h18M-8 -14h20M20 -10h14M-36 8h10M26 6h10M-4 -64v40" stroke="#7d7770" stroke-width="2" stroke-linecap="round"/><path d="M-20 34 V8 a20 18 0 0 1 40 0 V34Z" fill="#ff7a1a" stroke="#2c2a28" stroke-width="2.5"/><path d="M-13 34 V12 a13 12 0 0 1 26 0 V34Z" fill="#ffcf4a"/><path d="M-6 34 V18 a6 6 0 0 1 12 0 V34Z" fill="#fff4b0"/>`;
    case "anvil":
      return `${shadow(44)}<rect x="-22" y="6" width="44" height="28" fill="#8a5530" stroke="${INK}" stroke-width="2.5"/><path d="M-22 14h44M-22 24h44" stroke="#6b3f22" stroke-width="1.5"/><path d="M-36 -18 H28 Q42 -18 46 -10 H22 V-4 H10 V6 H-10 V-4 H-24 Q-36 -8 -36 -18Z" fill="#4b5058" stroke="#1d1f22" stroke-width="2.5" stroke-linejoin="round"/><path d="M-30 -15 H24" stroke="#8a929c" stroke-width="2" stroke-linecap="round"/><g transform="rotate(-28 30 10)"><rect x="27" y="-10" width="5" height="36" rx="2" fill="#a0703c" stroke="${INK}" stroke-width="1.5"/><rect x="20" y="-18" width="19" height="10" rx="2" fill="#6b7078" stroke="#1d1f22" stroke-width="1.8"/></g><path d="M-10 -32 l3 6 l6 1 l-6 2 l-3 6 l-3 -6 l-6 -2 l6 -1z" fill="#ffd84d"/><path d="M8 -38 l2 4 l4 1 l-4 1 l-2 4 l-2 -4 l-4 -1 l4 -1z" fill="#ffb02e"/>`;
    case "trees":
      return `${shadow(52)}${tree(-24, 30, 0.9, "#2f7a2e")}${tree(24, 32, 0.95, "#2f7a2e")}${tree(0, 36, 1.1, "#3f9a3a")}`;
    case "oaks":
      return `${shadow(52)}${tree(-24, 30, 1.05, "#4a8f37")}${tree(24, 32, 1.05, "#4a8f37")}${tree(0, 36, 1.25, "#3d7d2e")}`;
    case "willows":
      return `${shadow(52)}${willow(-22, 30, 0.9, "#6fa84a")}${willow(24, 32, 0.9, "#6fa84a")}${willow(0, 38, 1.1, "#7cb854")}`;
    case "fishing":
      return fishingSpot(recipe);
    case "rocks": {
      const ore = ORE_COLOURS[recipe.replace(/^mine-/, "")] ?? "#c9a24a";
      const fleck = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${ore}" stroke="#2f3135" stroke-width="1.2"/>`;
      return `${shadow(50)}<path d="M-46 34 L-40 4 L-22 -10 L-6 2 L-2 34Z" fill="#8d8f93" stroke="#2f3135" stroke-width="2.5" stroke-linejoin="round"/><path d="M8 34 L12 -2 L30 -14 L46 2 L48 34Z" fill="#7f8186" stroke="#2f3135" stroke-width="2.5" stroke-linejoin="round"/><path d="M-22 34 L-16 -14 L2 -32 L20 -16 L24 34Z" fill="#9ea0a5" stroke="#2f3135" stroke-width="2.5" stroke-linejoin="round"/><path d="M-12 -14 L2 -26" stroke="#ffffff55" stroke-width="3" stroke-linecap="round"/>${fleck(-6, 0, 4)}${fleck(8, 12, 3)}${fleck(-2, 20, 3.5)}${fleck(-30, 16, 3)}${fleck(30, 8, 3.5)}${fleck(36, 22, 2.5)}`;
    }
    case "flax": {
      let stalks = "";
      for (let r = 0; r < 3; r++)
        for (let i = 0; i < 7; i++) {
          const x = -42 + i * 14 + (r % 2) * 6;
          const y = 4 + r * 12;
          stalks += `<path d="M${x} ${y + 12} q${i % 2 ? 2 : -2} -14 0 -24" stroke="#4f8f2f" stroke-width="2" fill="none"/><circle cx="${x}" cy="${y - 12}" r="3" fill="#6aa8ff" stroke="#2f5fa8" stroke-width="1"/>`;
        }
      return `<ellipse cx="0" cy="26" rx="56" ry="16" fill="#8b6a3e" stroke="#5a4222" stroke-width="2"/><path d="M-48 22h96M-44 32h88" stroke="#6e5230" stroke-width="2"/>${stalks}`;
    }
    case "cave":
      return `<ellipse cx="0" cy="35" rx="54" ry="9" fill="#00000040"/><path d="M-54 34 Q-52 -26 -6 -46 Q40 -40 54 34Z" fill="#7d7368" stroke="#2e2924" stroke-width="3" stroke-linejoin="round"/><path d="M-30 -20 q10 -12 24 -16" stroke="#ffffff40" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-21 34 V6 a21 24 0 0 1 42 0 V34Z" fill="#1b1512" stroke="#2e2924" stroke-width="2.5"/><circle cx="-6" cy="12" r="2" fill="#ffd84d"/><circle cx="5" cy="12" r="2" fill="#ffd84d"/><path d="M-24 -6 q-4 14 2 26 M26 -4 q6 12 0 24 M-40 6 q-6 10 -2 20" stroke="#3f8f3a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="-22" cy="20" r="3" fill="#4fa245"/><circle cx="26" cy="20" r="3" fill="#4fa245"/>`;
    case "camp": {
      const tent = look.roof ?? "#7b5a8a";
      const flag = amenity.kind === "combatEncounter" && /goblin/.test(amenity.enemyId) ? "#4caf50" : "#d23b3b";
      return `${shadow(54)}<path d="M-44 34 L-12 -36 L22 34Z" fill="${tent}" stroke="#2e2318" stroke-width="3" stroke-linejoin="round"/><path d="M-12 -36 L-12 34" stroke="#00000033" stroke-width="2"/><path d="M-20 34 L-12 12 L-4 34Z" fill="#2a1c12"/><path d="M-12 -36 V-58" stroke="${INK}" stroke-width="2.5"/><path d="M-12 -58 L10 -52 L-12 -45Z" fill="${flag}" stroke="${INK}" stroke-width="1.5"/><path d="M26 32 l20 -8 M26 24 l20 8" stroke="#6b3f22" stroke-width="5" stroke-linecap="round"/><path d="M30 26 q-2 -16 6 -24 q0 10 6 12 q2 -6 0 -10 q8 8 2 22Z" fill="#ff8a1e"/><path d="M33 26 q0 -8 4 -12 q2 6 4 12Z" fill="#ffe066"/><circle cx="34" cy="-22" r="11" fill="#fffbe8" stroke="${INK}" stroke-width="2"/><text x="34" y="-21" text-anchor="middle" dominant-baseline="central" font-size="12">⚔️</text>`;
    }
    case "cottage":
      return `${shadow(54)}<g class="sc-smoke"><circle cx="-22" cy="-62" r="6" fill="#9be07aaa"/><circle cx="-28" cy="-74" r="8" fill="#9be07a77"/><circle cx="-22" cy="-88" r="9" fill="#9be07a44"/></g><rect x="-30" y="-58" width="10" height="24" fill="#6d5a4a" stroke="#2a2018" stroke-width="2.5" transform="rotate(-6 -25 -46)"/><path d="M-34 34 L-36 -8 L32 -12 L34 34Z" fill="#dcc59c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-46 -6 Q-12 -26 4 -70 Q14 -40 44 -12Z" fill="${look.roof ?? "#5b3c7a"}" stroke="#2a1838" stroke-width="3" stroke-linejoin="round"/><path d="M-30 -14 Q-10 -30 0 -56" stroke="#ffffff40" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="18" cy="8" r="8" fill="#ffe9a8" stroke="${INK}" stroke-width="2"/><path d="M10 8h16M18 0v16" stroke="${INK}" stroke-width="1.5"/><path d="M-22 34 V10 a8 8 0 0 1 16 0 V34Z" fill="#5a3a22" stroke="${INK}" stroke-width="2"/><ellipse cx="44" cy="28" rx="13" ry="8" fill="#2a2a2a" stroke="#111" stroke-width="2"/><ellipse cx="44" cy="22" rx="11" ry="3.5" fill="#7be05a"/><circle cx="40" cy="17" r="2.5" fill="#9bf07a"/><circle cx="48" cy="14" r="2" fill="#9bf07a"/>`;
  }
}

function fishingSpot(recipe: string): string {
  let top: string;
  if (/shark/.test(recipe)) top = `<path d="M-8 18 Q2 -14 20 16Z" fill="#6b7b8c" stroke="#2a3540" stroke-width="2.5" stroke-linejoin="round"/>`;
  else if (/tuna|sword/.test(recipe))
    top = `<path d="M-28 10 q20 -50 52 -8" stroke="#ffffffaa" stroke-width="2" fill="none" stroke-dasharray="3 4"/><g transform="rotate(-28 6 -18)"><ellipse cx="6" cy="-18" rx="16" ry="7" fill="#3a6fb0" stroke="#1d3350" stroke-width="2"/><path d="M-10 -18 l-9 -7 v14z" fill="#3a6fb0" stroke="#1d3350" stroke-width="2"/><circle cx="16" cy="-20" r="1.6" fill="#fff"/></g>`;
  else if (/trout|salmon|pike/.test(recipe))
    top = `<path d="M-44 -40 Q-10 -46 6 10" stroke="${INK}" stroke-width="1.2" fill="none"/><rect x="-50" y="-44" width="40" height="4" rx="2" fill="#8a5530" transform="rotate(14 -50 -44)"/><circle cx="6" cy="12" r="5" fill="#fff" stroke="${INK}" stroke-width="1.5"/><path d="M1 12 a5 5 0 0 1 10 0z" fill="#e53935"/><path d="M14 -4 q6 -10 14 -4 q-6 8 -14 4z" fill="#e88a4a" stroke="#7a3d1a" stroke-width="1.5"/>`;
  else
    top = `<rect x="-30" y="-24" width="5" height="46" fill="#7a4a26" stroke="${INK}" stroke-width="1.5"/><path d="M-27 -20 q20 10 34 32" stroke="#e8e0c8" stroke-width="1.6" fill="none"/><path d="M-20 -10 l10 8 M-16 -14 l12 14 M-10 -6 l8 8" stroke="#e8e0c8" stroke-width="1.2"/><circle cx="12" cy="12" r="6" fill="#ff5a3c" stroke="#7a2010" stroke-width="1.5"/><path d="M6 12 h12" stroke="#fff" stroke-width="2"/>`;
  return `<ellipse cx="0" cy="22" rx="54" ry="20" fill="#4aa3df" stroke="#2a6f9e" stroke-width="2.5"/><ellipse cx="0" cy="22" rx="36" ry="11" fill="none" stroke="#ffffff99" stroke-width="2"/><ellipse cx="0" cy="22" rx="18" ry="5" fill="none" stroke="#ffffffcc" stroke-width="2"/><circle cx="-34" cy="14" r="2.5" fill="#ffffffcc"/><circle cx="36" cy="26" r="2" fill="#ffffffcc"/><circle cx="30" cy="16" r="1.5" fill="#ffffffcc"/>${top}`;
}

// ── Decor ────────────────────────────────────────────────────────────────

function tree(x: number, y: number, s: number, c: string, dark = false): string {
  const st = dark ? "#0e2410" : "#1d3a18";
  return `<g><rect x="${x - 3 * s}" y="${y - 14 * s}" width="${6 * s}" height="${16 * s}" rx="${1.5 * s}" fill="#7a4a26" stroke="${INK}" stroke-width="${1.5 * s}"/><circle cx="${x - 11 * s}" cy="${y - 22 * s}" r="${13 * s}" fill="${c}" stroke="${st}" stroke-width="${2 * s}"/><circle cx="${x + 11 * s}" cy="${y - 22 * s}" r="${13 * s}" fill="${c}" stroke="${st}" stroke-width="${2 * s}"/><circle cx="${x}" cy="${y - 34 * s}" r="${15 * s}" fill="${c}" stroke="${st}" stroke-width="${2 * s}"/><circle cx="${x - 5 * s}" cy="${y - 39 * s}" r="${5 * s}" fill="#ffffff2e"/></g>`;
}

function pine(x: number, y: number, s: number, c: string): string {
  return `<g><rect x="${x - 3 * s}" y="${y - 10 * s}" width="${6 * s}" height="${12 * s}" fill="#6b4226" stroke="${INK}" stroke-width="${1.5 * s}"/><path d="M${x} ${y - 62 * s} L${x + 22 * s} ${y - 8 * s} H${x - 22 * s}Z" fill="${c}" stroke="#14301a" stroke-width="${2 * s}" stroke-linejoin="round"/><path d="M${x} ${y - 62 * s} L${x - 8 * s} ${y - 40 * s}" stroke="#ffffff30" stroke-width="${3 * s}" stroke-linecap="round"/></g>`;
}

function willow(x: number, y: number, s: number, c: string): string {
  let strands = "";
  for (let i = -3; i <= 3; i++)
    strands += `<path d="M${x + i * 6 * s} ${y - 30 * s} q${2 * s} ${14 * s} ${-1 * s} ${26 * s}" stroke="#a7cf6a" stroke-width="${2.2 * s}" fill="none" stroke-linecap="round"/>`;
  return `<g><rect x="${x - 3 * s}" y="${y - 18 * s}" width="${6 * s}" height="${20 * s}" fill="#6b4a2c" stroke="${INK}" stroke-width="${1.5 * s}"/><ellipse cx="${x}" cy="${y - 34 * s}" rx="${26 * s}" ry="${17 * s}" fill="${c}" stroke="#1d3a18" stroke-width="${2 * s}"/>${strands}</g>`;
}

/** Picks the same colour for the same tree every time (by position). */
function pick<T>(list: T[], x: number, y: number): T {
  return list[Math.abs(Math.round(x * 7 + y * 13)) % list.length];
}

/** One decor piece, at a point already converted to picture units. */
export function decorMarkup(d: SceneDecor, x: number, y: number, theme: SceneTheme): string {
  const s = d.size ?? 1;
  switch (d.kind) {
    case "tree":
      return tree(x, y, s, pick(theme.trees, d.x, d.y), theme.dark);
    case "pine":
      return pine(x, y, s, pick(theme.trees, d.x, d.y));
    case "willow":
      return willow(x, y, s, pick(theme.trees, d.x, d.y));
    case "bush":
      return `<g><circle cx="${x - 9 * s}" cy="${y - 7 * s}" r="${9 * s}" fill="${pick(theme.trees, d.x, d.y)}" stroke="#1d3a18" stroke-width="${2 * s}"/><circle cx="${x + 9 * s}" cy="${y - 7 * s}" r="${9 * s}" fill="${pick(theme.trees, d.x, d.y)}" stroke="#1d3a18" stroke-width="${2 * s}"/><circle cx="${x}" cy="${y - 13 * s}" r="${11 * s}" fill="${pick(theme.trees, d.x, d.y)}" stroke="#1d3a18" stroke-width="${2 * s}"/></g>`;
    case "rock": {
      const r = 12 * s;
      return `<path d="M${x - r} ${y} L${x - r * 0.6} ${y - r * 0.8} L${x + r * 0.3} ${y - r} L${x + r} ${y - r * 0.2} L${x + r * 0.8} ${y}Z" fill="#9a9488" stroke="#4e4a42" stroke-width="2" stroke-linejoin="round"/>`;
    }
    case "stump":
      return `<g><path d="M${x - 11 * s} ${y - 8 * s} v8 a${11 * s} ${5 * s} 0 0 0 ${22 * s} 0 v-8" fill="#8a5a30" stroke="#5a3a1e" stroke-width="2"/><ellipse cx="${x}" cy="${y - 8 * s}" rx="${11 * s}" ry="${5 * s}" fill="#c99a62" stroke="#5a3a1e" stroke-width="2"/></g>`;
    case "logs":
      return `<g><rect x="${x - 30 * s}" y="${y - 10 * s}" width="${60 * s}" height="${10 * s}" rx="${5 * s}" fill="#a0683a" stroke="#4a2c14" stroke-width="2"/><rect x="${x - 26 * s}" y="${y - 20 * s}" width="${52 * s}" height="${10 * s}" rx="${5 * s}" fill="#b07a45" stroke="#4a2c14" stroke-width="2"/><rect x="${x - 18 * s}" y="${y - 30 * s}" width="${36 * s}" height="${10 * s}" rx="${5 * s}" fill="#a0683a" stroke="#4a2c14" stroke-width="2"/></g>`;
    case "pond": {
      const rx = 60 * s;
      const ry = 25 * s;
      return `<g><ellipse cx="${x}" cy="${y}" rx="${rx + 6}" ry="${ry + 5}" fill="#6b7a4a"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#4f8f8a" stroke="#2f5a55" stroke-width="2.5"/><path d="M${x - rx * 0.5} ${y - 4} q8 -4 16 0" stroke="#ffffff77" stroke-width="2" fill="none"/><path d="M${x - rx - 4} ${y} q-4 -18 0 -26 M${x - rx + 4} ${y + 4} q2 -20 6 -24" stroke="#5a7a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`;
    }
  }
}

// ── Background ───────────────────────────────────────────────────────────

/** A small seeded random, so the scattered flowers stay put between
 *  renders and visits. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h | 0;
  return () => {
    a = (a + 1831565813) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth curve through the points (Catmull-Rom as cubic Beziers). */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** A wavy edge across the full width at height `y` (picture units). */
function wavyEdge(y: number, width: number, amp: number, seed: number): string {
  let d = `M0 ${y}`;
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const x = (width * i) / steps;
    const cy = y + (i % 2 ? amp : -amp) * (0.6 + ((seed * i) % 5) / 10);
    d += ` Q${x - width / steps / 2} ${cy} ${x} ${y + (i === steps ? 0 : ((i * seed) % 3) - 1) * amp * 0.4}`;
  }
  return d;
}

/**
 * Everything behind the clickable spots: ground, water, cliff, paths,
 * scattered flowers and decor. `w`/`h` are the picture's units (800 wide,
 * 600 tall on desktop, taller on phones); scene numbers are percentages.
 */
export function backgroundMarkup(locationId: string, scene: TownScene, theme: SceneTheme, w: number, h: number): string {
  const px = (p: ScenePoint) => ({ x: (p.x / 100) * w, y: (p.y / 100) * h });
  const rnd = seeded(locationId);
  const out: string[] = [];
  out.push(
    `<defs><radialGradient id="scg-${locationId}" cx="50%" cy="55%" r="75%"><stop offset="0" stop-color="${theme.ground[0]}"/><stop offset="1" stop-color="${theme.ground[1]}"/></radialGradient><linearGradient id="scw-${locationId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5bb8ef"/><stop offset="1" stop-color="#2f86c6"/></linearGradient><radialGradient id="scv-${locationId}" cx="50%" cy="50%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${theme.dark ? 0.55 : 0.16}"/></radialGradient></defs>`,
    `<rect width="${w}" height="${h}" fill="url(#scg-${locationId})"/>`
  );

  // Areas where flowers and grass shouldn't land.
  const wet: ((y: number) => boolean)[] = [];

  if (scene.cliff !== undefined) {
    const cy = (scene.cliff / 100) * h;
    // A band across the top with a wavy bottom edge, then a lighter ledge.
    out.push(`<path d="${wavyEdge(cy, w, 14, 3)} V0 H0Z" fill="#9c8462" stroke="#5e4a30" stroke-width="4"/>`);
    out.push(`<path d="${wavyEdge(cy * 0.65, w, 10, 2)} V0 H0Z" fill="#b39a74"/>`);
    for (let i = 0; i < 8; i++) {
      const x = rnd() * w;
      const y = rnd() * cy * 0.8;
      out.push(`<path d="M${x} ${y} l${14 + rnd() * 16} ${8 + rnd() * 10}" stroke="#7a6446" stroke-width="3" stroke-linecap="round"/>`);
    }
    wet.push((y) => y < cy + 20);
  }

  if (scene.lake !== undefined) {
    const ly = (scene.lake / 100) * h;
    out.push(`<path d="${wavyEdge(ly + 16, w, 12, 4)} V0 H0Z" fill="#f1dc9f"/>`);
    out.push(`<path d="${wavyEdge(ly, w, 12, 4)} V0 H0Z" fill="url(#scw-${locationId})" stroke="#2a6f9e" stroke-width="3"/>`);
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w;
      const y = 14 + rnd() * (ly - 40);
      out.push(`<path d="M${x} ${y} q8 -5 16 0 q8 5 16 0" stroke="#ffffff88" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    }
    wet.push((y) => y < ly + 30);
  }

  if (scene.river !== undefined) {
    const ry = (scene.river / 100) * h;
    out.push(`<path d="${wavyEdge(ry - 12, w, 10, 5)} V${h} H0Z" fill="#f1dc9f"/>`);
    out.push(`<path d="${wavyEdge(ry, w, 10, 5)} V${h} H0Z" fill="url(#scw-${locationId})" stroke="#2a6f9e" stroke-width="3"/>`);
    for (let i = 0; i < 8; i++) {
      const x = rnd() * w;
      const y = ry + 12 + rnd() * Math.max(4, h - ry - 20);
      out.push(`<path d="M${x} ${y} q8 -4 16 0 q8 4 16 0" stroke="#ffffff88" stroke-width="2" fill="none"/>`);
    }
    wet.push((y) => y > ry - 20);
  }

  // Ponds sit under the paths.
  for (const d of scene.decor) if (d.kind === "pond") {
    const p = px(d);
    out.push(decorMarkup(d, p.x, p.y, theme));
  }

  // Paths: a darker edge under a lighter top, then the plaza.
  const paths = scene.paths.map((pts) => smoothPath(pts.map(px)));
  out.push(
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths.map((d) => `<path d="${d}" stroke="${theme.pathEdge}" stroke-width="30"/>`).join("")}${paths.map((d) => `<path d="${d}" stroke="${theme.path}" stroke-width="22"/>`).join("")}</g>`
  );
  if (scene.plaza) {
    const p = px(scene.plaza);
    out.push(
      `<ellipse cx="${p.x}" cy="${p.y}" rx="70" ry="30" fill="${theme.path}" stroke="${theme.pathEdge}" stroke-width="4"/><ellipse cx="${p.x}" cy="${p.y}" rx="44" ry="17" fill="none" stroke="${theme.pathEdge}" stroke-width="2" stroke-dasharray="6 6" opacity=".6"/>`
    );
  }
  if (scene.bridge && scene.river !== undefined && scene.paths[0]?.length) {
    // Where the first path crosses the river.
    const ry = (scene.river / 100) * h;
    const first = scene.paths[0].map(px);
    const near = first.reduce((a, b) => (Math.abs(b.y - ry) < Math.abs(a.y - ry) ? b : a));
    const bx = near.x;
    const top = ry - 18;
    const bh = h - top;
    out.push(
      `<g><rect x="${bx - 30}" y="${top}" width="60" height="${bh}" rx="4" fill="#a8743e" stroke="#4a2c14" stroke-width="3"/>${[0.25, 0.5, 0.75].map((f) => `<path d="M${bx - 30} ${top + bh * f}h60" stroke="#7a4f26" stroke-width="2"/>`).join("")}<path d="M${bx - 34} ${top - 2} v${bh + 2} M${bx + 34} ${top - 2} v${bh + 2}" stroke="#4a2c14" stroke-width="5" stroke-linecap="round"/></g>`
    );
  }

  // Grass tufts and flowers, kept off spots, water and paths' ends.
  const spotPts = Object.values(scene.spots).map(px);
  const clear = (x: number, y: number) => !wet.some((f) => f(y)) && !spotPts.some((s) => Math.hypot(s.x - x, s.y - 20 - y) < 70);
  const tufts = Math.round(40 * theme.scatter);
  for (let i = 0, tries = 0; i < tufts && tries < 400; tries++) {
    const x = rnd() * w;
    const y = rnd() * h;
    if (!clear(x, y)) continue;
    i++;
    out.push(`<path d="M${x - 4} ${y} l-2 -7 M${x} ${y} l0 -9 M${x + 4} ${y} l2 -7" stroke="${theme.dark ? "#24401f" : "#4f8a35"}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`);
  }
  if (theme.flowers.length) {
    const flowers = Math.round(18 * theme.scatter);
    for (let i = 0, tries = 0; i < flowers && tries < 400; tries++) {
      const x = rnd() * w;
      const y = rnd() * h;
      if (!clear(x, y)) continue;
      i++;
      const c = theme.flowers[Math.floor(rnd() * theme.flowers.length)];
      out.push(`<g fill="${c}"><circle cx="${x - 3}" cy="${y}" r="3"/><circle cx="${x + 3}" cy="${y}" r="3"/><circle cx="${x}" cy="${y - 3}" r="3"/><circle cx="${x}" cy="${y + 3}" r="3"/><circle cx="${x}" cy="${y}" r="2" fill="#f5b800"/></g>`);
    }
  }

  // Decor, back to front.
  const pieces = scene.decor.filter((d) => d.kind !== "pond").sort((a, b) => a.y - b.y);
  for (const d of pieces) {
    const p = px(d);
    out.push(decorMarkup(d, p.x, p.y, theme));
  }

  if (theme.sunbeams)
    out.push(`<g opacity=".18" fill="#fffbe0"><path d="M${w * 0.15} 0 L${w * 0.27} 0 L${w * 0.52} ${h} L${w * 0.37} ${h}Z"/><path d="M${w * 0.52} 0 L${w * 0.6} 0 L${w * 0.8} ${h} L${w * 0.7} ${h}Z"/></g>`);
  if (theme.dark)
    for (let i = 0; i < 14; i++)
      out.push(`<circle class="sc-firefly" style="animation-delay:${(rnd() * 3).toFixed(2)}s" cx="${rnd() * w}" cy="${rnd() * h}" r="2.4" fill="#e9ff8a"/>`);
  out.push(`<rect width="${w}" height="${h}" fill="url(#scv-${locationId})"/>`);
  return out.join("");
}
