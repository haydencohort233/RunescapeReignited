# Idle Engine (RunescapeReignited)

A browser idle game in the style of Old School RuneScape and Melvor Idle: skills, gathering, crafting, buildings, quests, OSRS-style combat and a first dungeon. Single player, runs entirely in the browser, saves to localStorage.

- Test link (shared build): https://claude.ai/artifact/4bFZdWSqX9YqupBp4mekRG
- Roadmap (live doc, source of truth): https://claude.ai/code/artifact/fb252a61-8b75-4562-b645-755ca5489eae
- Local roadmap copy: [docs/ROADMAP.md](docs/ROADMAP.md)
- Handoff and current state: [docs/HANDOFF.md](docs/HANDOFF.md)
- Working on the code: [CLAUDE.md](CLAUDE.md)

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm test` | Vitest, all engine and content tests |
| `npm run lint` | oxlint |
| `npm run build` | Type check (`tsc -b`) and Vite build to `dist/` |
| `npm run build:single` | Build, then inline CSS and JS into one file, `dist/idle-engine.html` (the form the test link is published in) |

## Layout

| Path | What lives there |
| --- | --- |
| `src/engine/` | The simulation. Plain TypeScript, no React, no content imports. `gameEngine.ts` is the public API; each system is in `engine/systems/` (buildings, crafting and gathering, travel, combat, dungeons, jobs, quests). |
| `src/engine/tuning.ts` | Balance numbers in one place (offline cap, death penalty, regen, gather speed bonus). |
| `src/engine/types.ts` | Every engine and content type, including `GameState` (the save). |
| `src/engine/migrations.ts`, `state.ts` | Save versioning (`SCHEMA_VERSION`) and the migration chain. |
| `src/content/` | Game data: items, recipes, enemies, spells, shops, NPCs, locations, amenities, buildings, dungeons, quests, jobs, achievements. `content/index.ts` bundles it for the engine; `content/validate.ts` cross-checks it. |
| `src/components/` | React UI. `components/ui/` holds the shared pieces (ActionCard, dialogs, quick menu). |
| `src/lib/` | Framework-free helpers (in-page dialogs, theme, sidebar state, image preloading). |
| `public/assets/` | Art: items in category folders, skills, hitsplats, the world map. |
| `scripts/build-single-file.mjs` | The single-file build used for the test link. |
| `docs/` | Roadmap copy and handoff notes. |
| `.claude/launch.json` | Dev server config for the Claude desktop app's preview pane. |
