# Handoff

As of Oct 15, 2026. The Oct 15 round (town scenes and shop grid, below) is not committed yet. Tests (128), lint and build pass. The test link (https://claude.ai/artifact/4bFZdWSqX9YqupBp4mekRG) runs this build.

## Where things stand

Combat is complete and most of Phase 1, plus parts of Phases 2 and 3, are built. The roadmap's "Built on Oct 11" section lists every item with what was built; the short version:

| Area | State |
| --- | --- |
| Combat | All OSRS combat styles; Ranged with arrows; Magic with 16 spells and runes; manual special attacks (Dragon Dagger, Dragon Scimitar with Bleed); gear locked in fights; food slot; death takes only GP. Equipment tab is the combat hub. |
| Skills | Woodcutting, Firemaking, Fletching, Crafting (bowstring), Cooking (range only), Fishing, Mining (copper, tin), Smithing (bronze), Prayer (bury), Construction (from buildings), Farming (flax), Agility (travel speed only). Tools required for gathering; up to 10% faster gathering by level. |
| World | 7 locations: Riverside Town, Lumber Camp, Lake Shore, Dark Forest, Hidden Grove, Quarry, Draynor Village. Shops: Bob (tools, repairs), Riverside Armoury, Aubury's Rune Shop, Gerrant's fishing shop. Aggie recharges the Amulet of Glory. |
| Dungeon | Overgrown Den: quest-gated, 3 waves, regear stop, Den Guardian boss, 6-slot loadout. |
| Other | 8-hour offline progress, degrading gear with repairs (Dharok's Greataxe example), Glory charges, dev tools (spawn, levels, teleport, HP, restore all gear). |

## Oct 15 round: town scenes and shop grid

- **Home is a picture now**, Neopets-style: components/scene/TownScene.tsx draws the current location with a name tag on every amenity; clicking one opens it in a modal (HomeView.tsx `AmenityModal`). The place's name is on a sign inside the picture, so Home has no page title. Phones get a taller picture (4:5) using the same numbers.
- **Layouts are data**: content/townScenes.ts holds every location's spots, paths, plaza, water and decor as percentages, with instructions at the top. Drawings are in components/scene/sprites.ts. townScenes.test.ts checks every amenity is placed, every point is on the picture, and copied layouts read back the same.
- **Scene layout editor** (Settings > Dev tools, a preference): drag buildings, decor, path points and the plaza on Home; path ends follow a dragged building or plaza; "Copy layout" gives the block to paste into townScenes.ts (formatted by components/scene/sceneCode.ts).
- **Panel cards**: inside the amenity modal, `CardPanelContext` (components/ui/cardPanel.ts) makes the outer ActionCard an always-open panel; cards nested inside stay normal.
- **Shops** (ShopBrowsePanel.tsx): shopkeeper greeting, GP, Buy / Sell / Repair tabs, ItemTile grid with a price tag (`price`, red when unaffordable), tap for details, right-click for Buy 1/5/10/all.
- **Modal** (ui/Modal.tsx): locks page scroll while open, Escape closes only the topmost one (not while a quick menu or the dialogue box is over it), phones can swipe the sheet down to close.
- **Resources** moved off Home into the sidebar / phone drawer as a labelled section. ResourceList.tsx is gone.
- **Training cards**: every way to train (skill page, Home's crafting list, spot and station popups) is a `TrainingCard` (ui/TrainingCard.tsx): stats and the main button top-right, free-form info lines, extra choices at the bottom, dimmed with the reason when locked. `GatherCard` / `CraftCard` (TrainingCards.tsx) fill it in; RecipeList's old RecipeCard is gone. Starting from a popup closes it (`AmenityEntry`'s `onStarted`).
- **Travel to the closest spot**: components/gatherSpots.ts finds the nearest open place with a resource node for a recipe; away from one, the gather button is "Travel to X". New gathering skills get this by adding nodes in content/amenities.ts.
- **Switch prompt**: starting something while busy shows what's running and what replaces it (`requestSwitch` in lib/dialog.ts, built in engine/actionHelpers.ts).
- **Job boards** (JobBoardBrowsePanel.tsx): a corkboard of pinned notes, two columns (one on phones); each note has frequency and level tags, objective bars once taken, and reward + Accept / Turn in on one footer line. Ready-to-turn-in notes glow green. Colors are `--cork` / `--paper` tokens with dark-mode values. The Quests tab's accepted jobs use the same notes.
- **Tool requirements** on training cards: "✓ Requires Harpoon" in green when you have a usable one, "✗" in red when not (`ToolRequirement` in TrainingCards.tsx).
- **GP icon**: `GpIcon` / `GpAmount` (ui/GameIcons.tsx) put a coins icon next to GP amounts (sidebar, top strip, shop, prices, job rewards). The art goes at public/assets/ui/coins.png (`GP_ICON`); until it's there a drawn gold coin stands in.
- **Opening animations**: popups fade and grow a little on desktop, phone sheets slide up (about 0.2s; off with reduced motion). The modal body never scrolls sideways.
- **Sidebar** Resources and Skills fold (remembered in preferences as `collapsedSections`). Stop / Cancel / Flee are red (`btn-danger`); the right-click menu highlights the hovered item.

## Oct 12 round

The roadmap's "Built on Oct 12" section lists it all. Where things live:

- **Phone shell**: App.tsx renders both the desktop nav and the phone parts; CSS below 1024px hides one or the other. `BottomNav` (NavBar.tsx, tabs in navTabs.ts), `PlayerDrawer` and the tappable `PlayerStrip` (PlayerSidebar.tsx), `CompactActionBar` (ActivityCard.tsx, same data as the desktop card).
- **Preferences** (exact numbers, toast types, ❗ title alert) are per browser in localStorage: lib/preferences.ts. `formatNumber` reads the exact-numbers flag. Tab title: lib/useTabTitle.ts.
- **Inventory**: InventoryPanel.tsx (grid, search, filters, details modal), ItemTile.tsx, content/itemFilters.ts, ui/Modal.tsx. `itemName`/`itemDescription` in content/display.ts give per-copy names ("Amulet of Glory (0)").
- **Dungeons**: food is no longer packed; the food slot's stack comes in free. Loadouts are saved per dungeon in `state.savedLoadouts` (save v24) and picked in LoadoutPicker.tsx from the dungeon card or the Equipment tab.
- **Combat**: out of arrows or runes sets `session.outOfSupplies`; swings do nothing until flee or death. Enemy level is `npcCombatLevel` (combatMath.ts).
- **Prayer**: Bury Bones and Scatter Ashes are recipes (content/recipes.ts) with no output; `extraStatistic` keeps `buried:<id>` counting. `buryItem` and `prayerXp` are gone.
- **Jobs**: `requirement` gates accepting; daily jobs rotate and expire, one-time and repeatable never do (`expiresAtReset` on the accepted record). Boards at town, Lumber Camp, Lake Shore, Quarry.
- **Art**: 168 wiki images under public/assets (items and skills), including armour pieces with no item yet (med helm, chainbody, plateskirt, sq shield, black). The fetch script mapping wiki names to our paths is not in the repo; Karambwan had no wiki file.

## Not built yet

From the roadmap, in rough order:

- Intro and player name (on hold until it's discussed)
- Herblore, Agility course, Runecrafting, Thieving
- Achievement point shop, more quests (5 to 10), building upgrades, more achievements, better job board, poison
- Phase 4: hide dev tools, confirm wasteful actions, PWA, notification durations

## Waiting on the friend

- Tutorial: separate island or hints in the main game (on hold).
- The Oct 12 open questions: mid-fight food lock, dungeon food cap, "(0)" vs "Uncharged" Glory name, per-skill achievements, toast durations.
- Every value marked "Proposed" in the roadmap (shop names, rune prices, Glory recharge cost, tool speeds, gather times, Construction XP, Fishing Hut rate, ashes Prayer XP, Dharok's durability, 6 loadout slots).

## Known gaps and caveats

- **Art**: only generic Raw Fish, Cooked Fish and Pelt still show the placeholder.
- **Dungeon loadout** limits gear only. Worn arrows and equipped food come in as whole stacks and runes are drawn from the whole inventory; tighten this if it gets abused.
- **Dharok's Greataxe** has no drop source; spawn it from the dev tools to test degrading gear.
- **Fishing Hut** still produces the old generic Raw Fish (cooked as Cooked Fish), not shrimps.
- **Starter kit**: every save gets a bronze axe, bronze pickaxe, fishing net and tinderbox once (flag `starterKitGranted`).
- `src/assets/` still holds the Vite template images (hero.png, react.svg, vite.svg); nothing uses them.
- oxlint warns once about `GameEngineContext.tsx` exporting a hook next to a component (fast refresh only).
- The sidebar still says "Adventurer" until the intro adds a name.
- The ❗ tab alert is untested inside the claude.ai artifact iframe, where the browser tab may show the artifact's title instead of the game's.

## Testing tips

- Settings has the dev tools: spawn items, set skill levels, teleport anywhere, heal, restore all gear.
- Tests use `makeEngine()` (engine/__tests__/helpers.ts) on a fake clock; `advance(ms)` runs one tick. roadmap.test.ts covers everything added on Oct 11, including the dungeon.
- The in-app browser's own save (localStorage key `idlegame:save`) is a test save; a few things were done on it (starter kit, a fled Bandit fight, dev teleports).

## Next step

Pick the next roadmap block with the owner: likely Herblore (potions as timed buffs, the buff system already supports it) or Phase 3 depth (achievement shop, quests).
