# Working on this project

Read [docs/HANDOFF.md](docs/HANDOFF.md) for the current state and [docs/ROADMAP.md](docs/ROADMAP.md) for the plan. The live roadmap doc (https://claude.ai/artifact/CisApq9wcjwbQoxmAGThdH) is the source of truth; keep docs/ROADMAP.md in sync with it.

## How decisions are made

- The owner is the original author and makes all design calls. When they answer open questions, fold the answers into the live roadmap doc (mark "Decided:", tick open questions) and sync docs/ROADMAP.md.
- The live doc's Roadmap tab (docs/ROADMAP.md) stays short: Up next, Waiting on you, the backlog by area, one line per built round. Decided and Proposed details go in its History and decisions tab (docs/ROADMAP-ARCHIVE.md). When something is built, drop it from the backlog and add it to Built.
- Before building a feature, read its roadmap row and its decided details in the archive, and follow them. Values nobody decided are marked "Proposed" in the roadmap so the owner can review them.
- Desktop and phone are both first-class: every new screen must work at 375px wide with no sideways scroll.
- The game follows OSRS where it can (formulas, levels, XP, names) unless a decision says otherwise.

## Architecture rules

- **One time path.** `GameEngine.resolveElapsed()` advances everything, live and offline, against one capped window: `engine.getOfflineCapMs()`, which is the save's `offlineCapMs` (1 hour for new saves since Oct 20; older saves keep theirs) plus the best bed in the player house. Every in-progress action stores absolute anchors (`startedAt`, attack counters); `shiftActionAnchors` moves them when time is skipped. A new timer must be added there too (the house's furniture build and the servant's order are two, and they run beside `activeAction`, not in it).
- **Engine has no content imports.** Content reaches it through `GameContent` (content/index.ts). Static data is never saved; saves hold only player progress, so content edits reach existing saves.
- **The engine enforces rules, not the UI.** Unlocks, tool and station checks, gear lock, shop location checks and dungeon loadout limits all live in the engine.
- **One activity at a time.** `state.activeAction` is a union (craft, gather, travel, combat); `ensureIdle()` gates every start. A dungeon run (`state.dungeonRun`) also blocks other starts.
- **Ledger.** Stackable things (currencies, materials, food, arrows, runes) are counts in `state.resources`; non-stackable items (gear, tools) are instances in `state.inventory`. Worn stacks are `stack:<id>` in `state.equipment` and don't count as spendable.

## Changing the save shape

Any new `GameState` field must go in four places, or it is silently dropped on load:

1. `createInitialState` in engine/state.ts
2. the `withDefaults` object in `migrateSave` (engine/migrations.ts), sanitized
3. a migration entry for the old version in `MIGRATIONS`
4. a bump of `SCHEMA_VERSION` (currently 30)

New fields on `ActiveCombatSession` should be optional, or handled in `sanitizeAction`, so a save made mid-fight still loads. Add a round-trip test (serialize, then deserialize).

## Adding content

- Add to the catalog in `src/content/` and run `npm test`: `validateContent()` checks ids, references (items, enemies, spells, tools, stations, NPCs, dungeons) and numbers.
- Item art goes in `public/assets/items/<assetFolder>/<lowercase_name>.png`; `itemArt.test.ts` checks paths.
- Building requirements (cost, Construction level, XP) live in one entry each in `content/buildings.ts`. `costScalingFactor` scales every cost entry, materials included.
- Asset file names are lowercase with underscores, never hyphens (`bronze_dagger.png`); a test checks every file under `public/assets`. New art from the owner arrives in `art-inbox/` (git-ignored) to be sorted into `public/assets`.
- Player house furniture, skins, walls, floors, rugs and the portal locations live in `content/house.ts`. Furniture art is flat in `public/assets/furniture/`: `<art>.png` (front), `<art>_side.png` (facing left, flipped for right), `<art>_back.png`, where `<art>` is the piece's `art` field; pieces draw at their pixel size (128 px of art = one floor cell). Room art (walls, floors) is in `public/assets/house/` on a 1536 x 1024 canvas that `components/house/roomGeometry.ts` traces. `furnitureArt.test.ts` checks paths. Without art, pieces use the drawings in `components/house/furnitureSprites.ts`.

## Checks before calling something done

`npm test`, `npm run lint`, `npm run build`. For UI changes, run the dev server (`.claude/launch.json`, name `dev`) and check desktop and 375px. If the dev server shows a stale module error after many edits, restart it.

## Publishing the test link

`npm run build:single`, copy `dist/idle-engine.html` to the scratchpad, publish it with the Artifact tool using `url: https://claude.ai/artifact/DCwGp4oX62R6pRdFw1ZkdF`. Only send `files` (art under `assets/...`, mirroring `public/assets`) when art changes. Commit first.

## Writing and commits

- No em dashes in player-facing text, docs or replies; use hyphens, commas or periods.
- Commits are authored by the owner alone: no Co-Authored-By or "Generated with" lines. Commit only when asked.
