// Builds the game as ONE html file (styles and script inlined), the form the
// shared claude.ai link is published in. Images aren't inlined: they're
// published alongside it from public/assets at the same relative paths.
// Usage: npm run build:single  ->  dist/idle-engine.html
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const assets = join("dist", "assets");
const files = readdirSync(assets);
const css = files.find((f) => f.endsWith(".css"));
const js = files.find((f) => f.endsWith(".js"));
if (!css || !js) throw new Error("Run vite build first: no css/js in dist/assets");

const script = readFileSync(join(assets, js), "utf8");
// An inlined script can't contain its own closing tag.
if (script.includes("</script")) throw new Error("Bundle contains </script; can't inline it safely");

const html = [
  "<title>Idle Engine</title>",
  "<style>",
  readFileSync(join(assets, css), "utf8"),
  "</style>",
  '<div id="root"></div>',
  '<script type="module">',
  script,
  "</script>",
  "",
].join("\n");

writeFileSync(join("dist", "idle-engine.html"), html);
console.log(`dist/idle-engine.html (${Math.round(html.length / 1024)} KB)`);
