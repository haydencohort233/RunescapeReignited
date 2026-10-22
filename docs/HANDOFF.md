# Handoff

As of Oct 20, 2026 (evening). Player House Phase 1 (below) is built on top of the Oct 18 to 20 round. Tests (186), lint and build pass, apart from the flaky "keep fighting doesn't respawn the enemy once the arrows are gone" (one random arrow can miss) and the one oxlint warning listed under Known gaps. The test link (https://claude.ai/artifact/DCwGp4oX62R6pRdFw1ZkdF) runs this build.

## Where things stand

Combat is complete and most of Phase 1, plus parts of Phases 2 and 3, are built. The roadmap's "Built on Oct 11" section lists every item with what was built; the short version:

| Area | State |
| --- | --- |
| Combat | All OSRS combat styles; Ranged with arrows; Magic with 16 spells and runes; manual special attacks (Dragon Dagger, Dragon Scimitar with Bleed); gear locked in fights; food slot; death takes only GP. Equipment tab is the combat hub. |
| Skills | Woodcutting, Firemaking, Fletching, Crafting (bowstring), Cooking (range only), Fishing, Mining (copper, tin), Smithing (bronze), Prayer (bury), Construction (from buildings), Farming (flax), Agility (travel speed only). Tools required for gathering; up to 10% faster gathering by level. |
| World | 7 locations: Riverside Town, Lumber Camp, Lake Shore, Dark Forest, Hidden Grove, Quarry, Draynor Village. Shops: Bob (tools, repairs), Riverside Armoury, Aubury's Rune Shop, Gerrant's fishing shop. Aggie recharges the Amulet of Glory. |
| Dungeon | Overgrown Den: quest-gated, 3 waves, regear stop, Den Guardian boss, 6-slot loadout. |
| House | Player House Phase 1: one side-view room with floor, wall and surface slots, Use and Build modes, time-gated furniture building, facilities that work as crafting stations, beds that raise the offline cap, skins data model. Portal in Riverside Town. Planks from the Sawmill and Sawmill Operator at Lumber Camp. |
| Other | Offline progress (1 hour for new saves, plus the best bed; older saves keep 8 hours), degrading gear with repairs (Dharok's Greataxe example), Glory charges, dev tools (spawn, levels, teleport, HP, restore all gear). |

## Oct 20 round: Player House, Phase 1

The roadmap's Player House section has the six phases, the decided details and the proposed numbers. Where things live:

- **Content**: content/house.ts holds furniture (size in cells, slot, facings, textures, surface slots, station, bed bonus, level, cost, build time, XP), the example skin, wallpapers, rugs and `HOUSE_PORTAL_LOCATIONS`. `validateContent()` checks it. Room size and the limits are in engine/tuning.ts (`HOUSE_*`, `YARD_DECOR_SLOTS`).
- **Engine**: engine/systems/house.ts (`HouseSystem`). Building runs beside `activeAction` (it never blocks) and is resolved in `resolveElapsed`; its `startedAt` is moved in `shiftActionAnchors`. Placement rules (grid bounds, overlaps per slot type, surface hosts, rotation footprint swap, furniture limit, storage space, being at the portal) are all here. `getOfflineCapMs()` adds the best bed (placed or stored). Crafting's station check also accepts a placed facility while at the house (`hasHouseStation`).
- **Save**: `state.house` (v25): `layout` (inside, yard, wallpaperId, rugId: plain data, share-code ready), `storage`, `build`, `unlockedSkins`. Sanitized in migrations.ts (`sanitizeHouse`); content clean-up on load (unknown pieces dropped, orphaned surface pieces back to storage, default wallpaper and rug) is `HouseSystem.normalize`.
- **UI**: components/house/HouseView.tsx, opened from the House Portal on Riverside Town's picture (Home shows it in place of the town; `openHouse()` in lib/dialog.ts opens it from elsewhere). roomGeometry.ts places things on the 800 x 540 picture; furnitureSprites.ts has a drawn stand-in for every piece until art exists. Build mode: tap a piece for Move / Rotate / Store / Cosmetics, tap a stored piece then a square to place it, "Build furniture" lists everything.
- **Dev tools**: Settings > Dev tools > Skip time (+10 min, +1 hour: `engine.devSkipTime`, moves everything forward, capped by the offline cap; the future paid speed-up) and House (Finish build, Unlock skins). The build card has "Finish now (dev)".
- **Oct 22 art**: the owner's art is in. Items (104 files) replaced the wiki images at the same paths; NPC portraits are in assets/npcs/<name>/ (shopkeepers use them too; `ShopDefinition.artName` when the file isn't the npcName, e.g. Armourer uses blacksmith); the player avatar is assets/npcs/adventurer. Furniture art is flat in assets/furniture/ (`art` field in content/house.ts), the room's floor and walls in assets/house/ (wall and floor cosmetics, save v26 `floorId`). components/house/artCache.ts loads each image once to learn its size; roomGeometry.ts draws art at its pixel size (ART_PX_PER_CELL 128) on the floor art's canvas. Rugs are a fourth slot ("rug"). New owner art arrives in art-inbox/ (git-ignored); sort it into public/assets with underscores.
- **Oct 21 changes**: beds 1x2, tables 1x1; drag a selected piece to move it, R rotates; Build and Storage buttons under the room (storage is a panel); phones start zoomed to 1.5x with a zoom button; Use mode ignores taps on furniture without a use; pieces stand centred on their tile; only placed beds count; storing a facility in use stops the craft (`ActiveCraftJob.station`, optional).
- **Planks**: Sawmill (station `sawmill`) and Sawmill Operator (shop: logs plus GP, mahogany planks for GP) at Lumber Camp; a Sawhorse in the house works as a sawmill.
- **Not in Phase 1**: skin unlock sources (Phase 2, a dev tool unlocks them), wallpaper and rug pickers (Phase 2), the yard (stubbed in the save), servants (Phase 4), sharing.

## Oct 18 to 20 round: world map, quest givers, away summary

Roadmap rows 3, 12 and 15 have the full list. How to do the common things by hand:

- **Add a quest**: one entry in content/quests.ts (the note at the top explains the fields). Give it a `giverNpcId` and the same `locationId` as that NPC. Each stage has an `objective` (the UnlockCondition language); add `consumes` when the player hands items over, which happens only by talking to the giver back at their town. Lines: `startLine`, optional `questions`, `acceptLine`, `completeLine`, then the greetings `inProgressLines`, `completedLines` and per stage `lines`. Rewards that aren't GP, XP or items go in `rewardNotes` as words; `setFlags` is how a quest unlocks things. Add its achievement in content/achivements.ts. `npm test` checks the references.
- **Change what an NPC says**: everyday greetings are `dialogue` in content/npcs.ts; quest greetings are in content/quests.ts as above. Each list shows every line once, in a random order, before repeating (`nextLine` in components/npcTalk.ts), so any number of lines works.
- **Add an NPC**: an entry in content/npcs.ts, an `npc` amenity in content/amenities.ts, and a spot in content/townScenes.ts. Portrait art goes at public/assets/npcs/<name>/<name>.png; without it the `portrait` emoji shows.
- **Conversations** are in components/npcTalk.ts (`talkTo`): greeting, then the reply menu (quest offers, reminders, hand-ins, services). Saying goodbye calls `backToTown()` (lib/dialog.ts), which closes the open building; the "Quest complete!" scroll (QuestCompleteWatcher.tsx) does the same.
- **Away summary**: engine/awaySummary.ts snapshots progress and diffs it; engine/useGameEngine.ts takes the snapshot from the save on load and when the tab hides, and shows the popup (components/AwaySummaryView.tsx) on return. `AWAY_SUMMARY_MIN_MS` (5 minutes) is the cutoff. Under it, the old one-line toast still shows from 1 minute (`MIN_AWAY_MS_FOR_SUMMARY` in gameEngine.ts). To test: wind `state.lastTickTimestamp` back in the save and reload.
- **Map and roads**: places are in content/mapLocations.ts in map-art pixels (2560x1440); roads in content/roads.ts, with `via` points to bend them and `requires` for Agility shortcuts. The camera math is lib/mapCamera.ts.
- **Job notes**: the frequency tags (Daily, Once, Repeat) are `FREQUENCY` in JobBoardBrowsePanel.tsx. Phones get two notes a row from the `@media (max-width: 480px)` block after the job styles in index.css.
- **Progress text** ("Bronze Bar: 3/3") never reads past what's needed: `conditionProgress` and `describeConditionProgress` in engine/unlockConditions.ts cap it, for quests and jobs alike.
- **Replaying quests**: Settings > Dev tools > Reset all quests.

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
- **Job boards** (JobBoardBrowsePanel.tsx): a corkboard of pinned notes, two columns (two on phones too since Oct 20); each note has a frequency tag beside the title, objective bars once taken, and reward + Accept / Turn in on one footer line. Ready-to-turn-in notes glow green. Colors are `--cork` / `--paper` tokens with dark-mode values. The Quests tab's accepted jobs use the same notes.
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

## Open decisions

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

Recommended now: the owner reviews Player House Phase 1 on the test link and the Proposed values in the roadmap's Player House section, then Phase 2 (cosmetics) or Servants (the owner's prompt calls them the next separate step).

Earlier recommendation, still open:

Recommended: more quests (5 to 10) on the new quest system, with new step types such as "kill a boss" and "talk to another NPC". After that, Slayer with weapon-restricted enemies (rows 5 and 6), then potions (row 8). Confirm the order with the owner.
