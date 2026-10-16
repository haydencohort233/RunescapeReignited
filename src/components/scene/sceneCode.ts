import type { SceneDecor, SceneSpot, TownScene } from "../../content/townScenes";

// Turns a scene back into the exact text used in content/townScenes.ts, so
// the scene editor's "Copy layout" can be pasted straight over a block.

const round = (n: number) => Math.round(n * 10) / 10;
const point = (p: { x: number; y: number }) => `{ x: ${round(p.x)}, y: ${round(p.y)} }`;
const str = (s: string) => JSON.stringify(s);

function spotCode(id: string, s: SceneSpot): string {
  const extras: string[] = [];
  if (s.sprite) extras.push(`sprite: ${str(s.sprite)}`);
  if (s.label) extras.push(`label: ${str(s.label)}`);
  if (s.roof) extras.push(`roof: ${str(s.roof)}`);
  if (s.sign) extras.push(`sign: ${str(s.sign)}`);
  if (s.size !== undefined && s.size !== 1) extras.push(`size: ${round(s.size)}`);
  return `${str(id)}: { x: ${round(s.x)}, y: ${round(s.y)}${extras.map((e) => `, ${e}`).join("")} },`;
}

function decorCode(d: SceneDecor): string {
  const size = d.size !== undefined && d.size !== 1 ? `, size: ${round(d.size)}` : "";
  return `{ kind: ${str(d.kind)}, x: ${round(d.x)}, y: ${round(d.y)}${size} },`;
}

/** One location's block, indented to sit inside TOWN_SCENES. */
export function sceneToCode(locationId: string, scene: TownScene): string {
  const key = /^[a-zA-Z_$][\w$]*$/.test(locationId) ? locationId : str(locationId);
  const lines: string[] = [`  ${key}: {`, `    theme: ${str(scene.theme)},`];
  if (scene.river !== undefined) lines.push(`    river: ${round(scene.river)},`);
  if (scene.bridge) lines.push(`    bridge: true,`);
  if (scene.lake !== undefined) lines.push(`    lake: ${round(scene.lake)},`);
  if (scene.cliff !== undefined) lines.push(`    cliff: ${round(scene.cliff)},`);
  lines.push(`    plaza: ${scene.plaza ? point(scene.plaza) : "null"},`);
  lines.push(`    spots: {`, ...Object.entries(scene.spots).map(([id, s]) => `      ${spotCode(id, s)}`), `    },`);
  lines.push(`    paths: [`, ...scene.paths.map((p) => `      [${p.map(point).join(", ")}],`), `    ],`);
  lines.push(`    decor: [`, ...scene.decor.map((d) => `      ${decorCode(d)}`), `    ],`);
  lines.push(`  },`);
  return lines.join("\n");
}
