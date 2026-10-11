# Handoff

As of Oct 11, 2026. Branch `engine-fixes`, all work committed. Tests (120), lint and build pass. The test link (https://claude.ai/artifact/4bFZdWSqX9YqupBp4mekRG) runs this build.

## Where things stand

Combat is complete and most of Phase 1, plus parts of Phases 2 and 3, are built. The roadmap's "Built on Oct 11" section lists every item with what was built; the short version:

| Area | State |
| --- | --- |
| Combat | All OSRS combat styles; Ranged with arrows; Magic with 16 spells and runes; manual special attacks (Dragon Dagger, Dragon Scimitar with Bleed); gear locked in fights; food slot; death takes only GP. Equipment tab is the combat hub. |
| Skills | Woodcutting, Firemaking, Fletching, Crafting (bowstring), Cooking (range only), Fishing, Mining (copper, tin), Smithing (bronze), Prayer (bury), Construction (from buildings), Farming (flax), Agility (travel speed only). Tools required for gathering; up to 10% faster gathering by level. |
| World | 7 locations: Riverside Town, Lumber Camp, Lake Shore, Dark Forest, Hidden Grove, Quarry, Draynor Village. Shops: Bob (tools, repairs), Riverside Armoury, Aubury's Rune Shop, Gerrant's fishing shop. Aggie recharges the Amulet of Glory. |
| Dungeon | Overgrown Den: quest-gated, 3 waves, regear stop, Den Guardian boss, 6-slot loadout. |
| Other | 8-hour offline progress, degrading gear with repairs (Dharok's Greataxe example), Glory charges, dev tools (spawn, levels, teleport, HP, restore all gear). |

## Not built yet

From the roadmap, in rough order:

- Intro and player name (on hold until it's discussed)
- Herblore, Agility course, Runecrafting, Thieving
- Achievement point shop, more quests (5 to 10), building upgrades, more achievements, better job board, poison
- Phase 4: inventory search and filters, hide dev tools, mobile tab bar and drawer, compact action bar, notification settings, PWA, number format

## Waiting on the friend

- Tutorial: separate island or hints in the main game (on hold).
- Every value marked "Proposed" in the roadmap (shop names, rune prices, Glory recharge cost, tool speeds, gather times, Construction XP, Fishing Hut rate, ashes Prayer XP, Dharok's durability, 6 loadout slots).

## Known gaps and caveats

- **No art** for many new items (tools other than net and rod, runes, bars, cooked fish, dragon dagger, Dharok's); they show the placeholder. Prayer, Smithing and Construction have no skill icon.
- **Dungeon loadout** limits food and gear only. Worn arrows come in as a whole stack and runes are drawn from the whole inventory; tighten this if it gets abused.
- **Dharok's Greataxe** has no drop source; spawn it from the dev tools to test degrading gear.
- **Fishing Hut** still produces the old generic Raw Fish (cooked as Cooked Fish), not shrimps.
- **Starter kit**: every save gets a bronze axe, bronze pickaxe, fishing net and tinderbox once (flag `starterKitGranted`).
- `src/assets/` still holds the Vite template images (hero.png, react.svg, vite.svg); nothing uses them.
- oxlint warns once about `GameEngineContext.tsx` exporting a hook next to a component (fast refresh only).
- The sidebar still says "Adventurer" until the intro adds a name.

## Testing tips

- Settings has the dev tools: spawn items, set skill levels, teleport anywhere, heal, restore all gear.
- Tests use `makeEngine()` (engine/__tests__/helpers.ts) on a fake clock; `advance(ms)` runs one tick. roadmap.test.ts covers everything added on Oct 11, including the dungeon.
- The in-app browser's own save (localStorage key `idlegame:save`) is a test save; a few things were done on it (starter kit, a fled Bandit fight, dev teleports).

## Next step

Pick the next roadmap block with the owner: likely Herblore (potions as timed buffs, the buff system already supports it) or Phase 3 depth (achievement shop, quests).
