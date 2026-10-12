# Working on this project

Read [docs/HANDOFF.md](docs/HANDOFF.md) for the current state and [docs/ROADMAP.md](docs/ROADMAP.md) for the plan. The live roadmap doc (https://claude.ai/code/artifact/fb252a61-8b75-4562-b645-755ca5489eae) is the source of truth; keep docs/ROADMAP.md in sync with it.

## How decisions are made

- Design calls come from the owner's friend, relayed as pasted Q&A rounds. Each round: fold answers into the live roadmap doc (mark "Decided:", tick open questions), sync docs/ROADMAP.md, then give the owner a follow-up question list to send.
- Before building a feature, read its roadmap row and follow the decided details. Values nobody decided are marked "Proposed" in the roadmap so the friend can review them.
- Desktop and phone are both first-class: every new screen must work at 375px wide with no sideways scroll.
- The game follows OSRS where it can (formulas, levels, XP, names) unless a decision says otherwise.

## Architecture rules

- **One time path.** `GameEngine.resolveElapsed()` advances everything, live and offline, against one capped window (`offlineCapMs`, 8 hours by default). Every in-progress action stores absolute anchors (`startedAt`, attack counters); `shiftActionAnchors` moves them when time is skipped. A new timer must be added there too.
- **Engine has no content imports.** Content reaches it through `GameContent` (content/index.ts). Static data is never saved; saves hold only player progress, so content edits reach existing saves.
- **The engine enforces rules, not the UI.** Unlocks, tool and station checks, gear lock, shop location checks and dungeon loadout limits all live in the engine.
- **One activity at a time.** `state.activeAction` is a union (craft, gather, travel, combat); `ensureIdle()` gates every start. A dungeon run (`state.dungeonRun`) also blocks other starts.
- **Ledger.** Stackable things (currencies, materials, food, arrows, runes) are counts in `state.resources`; non-stackable items (gear, tools) are instances in `state.inventory`. Worn stacks are `stack:<id>` in `state.equipment` and don't count as spendable.

## Changing the save shape

Any new `GameState` field must go in four places, or it is silently dropped on load:

1. `createInitialState` in engine/state.ts
2. the `withDefaults` object in `migrateSave` (engine/migrations.ts), sanitized
3. a migration entry for the old version in `MIGRATIONS`
4. a bump of `SCHEMA_VERSION` (currently 24)

New fields on `ActiveCombatSession` should be optional, or handled in `sanitizeAction`, so a save made mid-fight still loads. Add a round-trip test (serialize, then deserialize).

## Adding content

- Add to the catalog in `src/content/` and run `npm test`: `validateContent()` checks ids, references (items, enemies, spells, tools, stations, NPCs, dungeons) and numbers.
- Item art goes in `public/assets/items/<assetFolder>/<lowercase_name>.png`; `itemArt.test.ts` checks paths.
- Building requirements (cost, Construction level, XP) live in one entry each in `content/buildings.ts`. `costScalingFactor` scales every cost entry, materials included.

## Checks before calling something done

`npm test`, `npm run lint`, `npm run build`. For UI changes, run the dev server (`.claude/launch.json`, name `dev`) and check desktop and 375px. If the dev server shows a stale module error after many edits, restart it.

## Publishing the test link

`npm run build:single`, copy `dist/idle-engine.html` to the scratchpad, publish it with the Artifact tool using `url: https://claude.ai/artifact/4bFZdWSqX9YqupBp4mekRG`. Only send `files` (art under `assets/...`, mirroring `public/assets`) when art changes. Commit first.

## Writing and commits

- No em dashes in player-facing text, docs or replies; use hyphens, commas or periods.
- Commits are authored by the owner alone: no Co-Authored-By or "Generated with" lines. Commit only when asked.
