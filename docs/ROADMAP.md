# Idle Engine Roadmap

Oct 20, 2026. Local copy of the live doc, which is the source of truth: https://claude.ai/artifact/CisApq9wcjwbQoxmAGThdH

Next up: the Oct 17 owner list (look and feel, shops, world map, cooking burns, potions, sound, Slayer), flesh out the skills (see Skills to flesh out below), then the remaining Phase 2 skills (Herblore, Agility course, Runecrafting, Thieving) and Phase 3 depth. See Built on Oct 11, 12 and 15 for what is already in.

## Built on Oct 15

Town scenes and a UI rework (committed). Details and file locations are in HANDOFF.md.

| Item | What was built |
| --- | --- |
| Town scenes | Home is a picture of the current location with a name tag on every amenity; clicking one opens it in a modal. Layouts are data (content/townScenes.ts). A scene layout editor in Dev tools drags buildings, decor and paths and copies the layout. |
| Shops | Shopkeeper greeting, GP, Buy / Sell / Repair tabs, an item grid with price tags, Buy 1/5/10/all on right-click. |
| Training cards | Every way to train (skill page, Home crafting list, spot and station popups) is one card with stats, a main button, info lines, tool requirements ("Requires Harpoon", green or red) and a locked reason. |
| Travel to nearest spot | Away from a resource, the gather button becomes "Travel to X" for the closest open place that has it. |
| Switch prompt | Starting something while busy shows what is running and what replaces it. |
| Job boards | A corkboard of pinned notes with frequency and level tags, objective bars, and a green glow when ready to turn in. |
| Polish | Modals lock page scroll, Escape closes the top one, phone sheets swipe down to close. Resources moved into the sidebar. Collapsible sidebar sections. GP coin icon (art still to drop in at public/assets/ui/coins.png). Red Stop / Cancel / Flee. Opening animations. |

## Owner's list (Oct 17)

The owner makes the design calls now. Items 1 to 8 are the owner's; "Decided" lines are theirs, the rest of each row is a proposal to refine. Items 9 to 14 are suggestions added by Claude, not yet approved.

| # | Item | What to do | Size | Priority |
| --- | --- | --- | --- | --- |
| 1 | OSRS-style look | Decided: a colour scheme close to OSRS without copying it: brown, rustic, medieval, with cream "scroll" panels. Proposed: new `--` tokens (parchment cream, leather and wood browns, dark stone, gold trim) with matching dark-mode values; scroll-like cards, wood-framed panels and a stone sidebar; more images and icons across the UI (skill, tab and resource icons, section headers). Original art and colours only, no copied assets. Must work at 375px. In progress Oct 17: palette done (light = OSRS Wiki parchment, a touch greyer; dark = OSRS interface stone browns with yellow headings; serif headings). Light parchment darkened. Bevelled stone cards and buttons, wood primary buttons and wood trim on the nav, sidebar and dialogs done. Next: icons and section headers, then scroll-style cards. | L | High |
| 2 | Shops buy only relevant items | Decided: a shop only buys what suits it, except a general store, which buys everything (a fisherman won't buy a Dragon Scimitar). Proposed: each shop gets a buy list of item types or ids in content/shops.ts, enforced in the engine; the Sell tab shows only what the shop takes, with a "does not buy this" message. Add a General Store to town. | M | High |
| 3 | World map overhaul | Decided (Oct 18): pan and zoom (drag, pinch, wheel); roads, so travel follows the shortest road route; a tap or click shows the highlighted path and time before committing; a player marker that walks the route; a place panel beside the map on wide screens and a sheet over it on phones; a Places list to jump to any location; a green ✓ badge on towns with a job ready to hand in (nothing for newly posted jobs, so it isn't mistaken for a quest); a blue Q marker where a quest can be started. No fog of war: the whole map is visible, and tapping a locked place says how to get there. No Key: tapping a place lists everything there, in a compact 2 to 3 column grid. Where you are is a green diamond (shape and colour). No page title; "You're at X" (or the trip and a Stop button) sits at the top centre of the map. Agility shortcuts: roads with a requirement, used by routing once met. Town names and amenity icons always show, at every zoom. Zooming out is limited, so the world never shrinks to a stamp. Al-Kharid: a 100 GP gate toll each trip, made free by a quest reward. Places sit where OSRS has them on the art, not spread across the whole map. Desktop: the map fills the page (landscape once the right sidebar is hidden) and the place panel floats over it. Not wanted: region names or zoom levels of detail. Built Oct 18, not committed. Proposed: map coordinates are now the art's pixels (2560x1440); travel pace 150 ms per pixel of road (Riverside Town to Draynor about 14s, to Al-Kharid about 19s, to Hidden Grove about 1 min); placements: Riverside Town = Lumbridge, Lake Shore = Port Sarim, Dark Forest = Draynor Manor's woods, Quarry = Lumbridge Swamp mine, Lumber Camp = woods east of Varrock, Hidden Grove = forest north of Falador; max zoom 3x; the road network in content/roads.ts (straight roads, no bends yet); pin positions kept where they showed before and still need placing on the art; player marker art can go at worldmap/icons/ui/player.png; quests have a display-only locationId (starting still works from anywhere); test quest The Quarry Master's Order at Quarry (smelt 5 bronze bars, hand them in; 250 GP, 150 Mining and 150 Smithing XP); The Overgrown Den placed at Riverside Town; Stepping stones shortcut Draynor Village to Hidden Grove at Agility 20; zoom-out limit 0.3x and the art always fills the frame; Al-Kharid in the desert east of Quarry, reached only through Quarry, with a furnace and a desert town scene; the toll is paid when the trip starts and given back if it's cancelled; Prince Ali Rescue at Draynor Village (travel to Al-Kharid, hand in 3 bronze bars; 300 GP, toll waived). | L | High |
| 4 | Cooking burn chance | Decided: a chance to burn that falls with Cooking level, and past a certain level each food stops burning, as in OSRS. Proposed: use the OSRS burn-stop levels per food (shrimps 34, trout 49, tuna 63, shark 94), a burnt version of each food, and a Cooking-gauntlets style bonus later. Show the burn chance on the cooking card. | M | High |
| 5 | Weapon-restricted enemies | Decided: some enemies can only be hurt by a specific weapon, as turoths and kurasks in OSRS, as part of Slayer. Proposed: an enemy field for the required weapon or damage type, checked by the engine (other weapons deal 0 and the fight card says why), plus a hint on the enemy card. | M | Medium |
| 6 | Slayer skill | Decided as the home of item 5. Proposed: a Slayer master gives tasks (enemy and count) by combat level; task points; Slayer XP per kill; some enemies need Slayer level to attack; Slayer-only gear and rewards. Needs more enemies first. | L | Medium |
| 7 | Sound | Decided: sound effects, but few, since most players keep sound off. Proposed: off by default with a volume and mute setting; a handful of cues (level up, quest done, rare drop, special attack, death, button click); small files, loaded lazily; nothing on repeated idle actions. | S | Low |
| 8 | Potions | Decided: potions that boost combat stats. Proposed: timed boosts on Attack, Strength, Defence, Ranged and Magic with the OSRS formula (level percent plus a flat amount), made by Herblore, drunk from the Equipment tab or food slot, shown as active buffs, allowed in dungeon loadouts, lost on death. Builds on the buff system. | M | High |
| 9 | Bird's nests and seeds | Decided: search a bird's nest for seeds, to feed Farming later. Proposed: a "Search" action on the nest in the inventory, OSRS seed drop table by rarity; Farming grows them into herbs and crops. | S | Medium |
| 10 | Bank or storage | Suggested: the inventory has no cap, so storage only matters if a cap is added. Decide first whether to cap it (Melvor has bank slots). | M | Low |
| 11 | Equipment sets and presets | Suggested: save a worn set (melee, ranged, magic) and swap it before a fight in one tap. | S | Medium |
| 12 | Offline summary | Suggested: a "While you were away" popup with XP, items and levels gained, since offline time is now 8 hours. Decided (Oct 20): don't show it for short absences. Built Oct 20, not committed: a parchment popup on return (after closing the game, or after the tab was hidden) with time away, the offline limit if it applied, XP and level-ups per skill, items gained and used up, enemies defeated, deaths, and a note if the activity finished or stopped; it replaces the summary toast. Proposed: shown only after 5 minutes or more away (shorter breaks and tab switches get nothing), and only if something changed. | S | High |
| 13 | Tutorial and hints | Suggested: first-run hints tied to the highlighted amenity on the town scene, replacing the on-hold intro until it is decided. | M | Medium |
| 14 | Save backup | Suggested: export and import a save file, with a reminder to export before big updates, since saves are in the browser only. | S | Medium |
| 15 | Quest givers and NPC conversations | Decided (Oct 19): quests aren't started from the map; you talk to the person who gives them, in their town. The map shows each quest with its giver as a hint. The NPC talk UI gets an overhaul. Hand-ins happen back at the giver, not from the Quests tab. A quest ready to hand in is marked on the map. Quest completion is its own popup, not a dialogue line, and each quest has an achievement. Dev tool to reset quest progress. Built Oct 19, not committed: quests have a giver NPC and start only at the giver's location (engine-enforced); talking opens an OSRS-style chatbox (chat head, name and title, the conversation so far, lines that type out and can be skipped, numbered replies with keys 1 to 9) where quests are offered, steps are reminded and items handed over; NPC cards show the chat head, a greeting and the quests they give; the Quests tab shows each quest as a parchment scroll (giver, steps done and current with progress, "Talk to X in Y" or "Return to X", rewards), grouped In progress, Available, Completed; a gold ! on the map pin and panel marks a quest ready to hand in; a "Quest complete!" scroll with the rewards shows after the conversation closes; Settings > Dev tools > Reset all quests. Proposed: new NPCs Hans (Riverside Town, gives The Overgrown Den), Doric (Quarry, The Quarry Master's Order) and Leela (Draynor Village, Prince Ali Rescue), their lines and emoji chat heads (art can go at assets/npcs/<name>/<name>.png); quest lines rewritten in a plainer OSRS tone, Leela's offer has four questions adapted from OSRS's Prince Ali Rescue; quest achievements Into the Den, Bronze for Doric and Royal Rescue at 10 points each. Also built Oct 19, not committed: quest and job progress never reads past what's needed (3/3, not 1,000,000,000/3); saying goodbye to an NPC, or finishing a quest, closes the open building back to the town picture; givers greet you differently while their quest is on (per step where set) and once it's done, each list cycling through every line before repeating, set in content/quests.ts; taken jobs show above quests on the Quests tab. Proposed: five greeting lines per quest (in progress and done) for Hans, Doric and Leela, with Leela's in-progress lines split by step. Also built Oct 20, not committed: job notes sit two to a row on phones; the Daily, Once or Repeat tag sits beside the title; taken jobs drop the description (their progress bars say it), the "In progress" label and the met level tag; completed quests fold down to their name and giver; "Your jobs" uses the same group header as the quests. | M | High |

## Player House (Construction)

Decided (Oct 20): Construction gets a player house, one big room like a Club Penguin igloo, built in six phases. Phase 1 (inside room and furniture, local only) was built Oct 20 and is on the test link; the rest follow in order. Also built with it: a Sawmill and Sawmill Operator at Lumber Camp, dev tools to finish a build and unlock skins, and drawn stand-ins for every piece until art exists.

| Phase | Scope | State |
| --- | --- | --- |
| 1. Room and furniture | Side-view room with floor, wall and surface slots and depth sorting; Build and Default modes; move, rotate, store; furniture limit and house storage; time-gated furniture building resolved offline; crafting stations as placeable facilities; beds and the new 1 hour default offline cap; cosmetic data model, serializable layout, stubbed yard | Built Oct 20 |
| 2. Cosmetics | Skin unlocks and the Cosmetics button on selected furniture; wallpaper and rug selection; skins from achievements, drops and shops; no payments | Next |
| 3. Outside and yard | Exterior view with its own cosmetics; 20 decor slots (plants, fences, fountains); facilities placeable outside; yard in the layout data | Later |
| 4. Servants | Servants' Guild in Draynor Village (100 GP); Butler, Servant, Demon Butler; background work at facilities placed in the house; wages from a coin pouch only while working, in real time and offline; an order only starts when the pouch covers it; a facility in use is occupied; one facility of each kind per house | Built Oct 22 (Phases 2 and 3 skipped for now) |
| 5. Sharing and online | Share code export and import; read-only visits; likes and a most-popular leaderboard. Needs a backend: hosting decision first | Later |
| 6. Microtransactions | Purchasable wallpaper, rug and furniture skins via a payment provider and accounts, plugged into the Phase 2 unlock system | Later |

Later, outside this feature: a bank replacing house storage, and servant delivery into it.

Decided details:

- View: side-view room (back wall plus a floor grid in light perspective), not top-down or a dollhouse. Works at 375px with no sideways scroll. Tap to select, never drag-only.
- Slots: floor (no overlap), wall (no overlap), surface (sits on a host's surface slot, like a lamp on a table; storing the host stores its items, moving it moves them). Draw order sorts by floor row.
- Rotation: 4 facings from up to 3 textures (front, side, back; right is the side sprite flipped). Each piece lists the facings it supports and falls back to front. Side facings swap the footprint and re-check the grid. Wall pieces don't rotate.
- Terms: facilities are things you use (crafting stations, trophy case); furniture is chairs, beds, dressers. Both are placeable. Buildings (Lumbermill and so on) stay separate passive producers.
- Modes: Default (tap a facility to use it, later a servant to manage them) and Build (tap a piece, then Move, Rotate, Store, or Cosmetics when unlocked skins exist).
- Limits: inside furniture limit 5, plus 1 per 2 Construction levels. House storage 10 slots, plus 5 per 5 levels, max 100. Yard (later) 20 decor slots.
- Building is time-gated, finishes offline and does not block other activities.
- Default offline cap becomes 1 hour (existing saves keep theirs). Beds raise it: plank bed (10 min build) +30 min, mahogany bed (2 h build) +2 h. Only the best bed counts.
- Cosmetics: each piece has an optional list of skin ids; a skin is content (id, name, furniture, art, unlock source); unlocked skins are a set in the save, never tied to payments. Room cosmetics: wallpaper id and rug id.
- Share code (later) is plain layout data: pieces (furniture, skin, x, y, facing, host), wallpaper, rug, yard.
- Servants: rate is a share of the player's own rate, for speed and XP alike: Basic Male Butler 20% at 1 GP/s, Female Servant 30% at 3 GP/s, Demon Butler 50% at 5 GP/s. Upkeep is meant to be steep. They work in the background, outside the one-activity rule.
- Planks: players can saw their own at a sawmill at Lumber Camp (an idle method), or pay the sawmill operator a fee.
- Decided Oct 21: beds are 1 wide and 2 deep, tables 1 by 1.
- Decided Oct 21: a selected piece can be dragged to move it (Move still works); R rotates on a keyboard.
- Decided Oct 21: a speed-up that skips time for everything (builds, crafting, fights), to become a paid option later. For now it's a dev tool: "Finish now" on the build in progress and Skip time (+10 min, +1 hour) in Settings, capped by the offline cap.
- Decided Oct 21: Build and Storage are small buttons in the bottom corners of the house screen; storage opens as a panel.
- Decided Oct 21: in Use mode only things with a use (facilities) react to taps; furniture shows no description.
- Decided Oct 21: pieces stand centred on their tile, not on its front edge.
- Decided Oct 21: only a placed bed raises the offline cap; a bed in storage does nothing.
- Decided Oct 21 (bug): storing a facility that's in use stops the craft and refunds what's left.
- Decided Oct 22: every asset file name uses underscores, never hyphens (bronze_dagger.png). A test checks all of public/assets.
- Decided Oct 22: rotated art is named <art>_side.png (drawn facing left, flipped for right) and <art>_back.png; no suffix is the front. A missing view uses the front.
- Decided Oct 22: the room's default look is the owner's art, house_wall_wood and house_floor_wood, kept separate for future wall and floor cosmetics (the save now has a floor id; save v26).

Decided Oct 22 (Servants, built the same day):

- Servants only work facilities placed in the house (Workbench for planks, Range for cooking, and so on), so getting the most from one means building the facilities. Errands to the Sawmill and other places may come later.
- No bell pull: a Servant button in the house, next to Build and Storage. Its panel shows the servant, their task, start and cancel, progress and time left.
- A servant costs nothing while idle. Wages come out of a coin pouch only while they work; the panel has Deposit GP.
- No bed needed for a servant (house space is tight).
- Construction levels to hire: Butler 20, Servant 40, Demon Butler 60. One servant at a time.
- The hiring place is not in Riverside Town (it's full): the Servants' Guild is in Draynor Village.
- Order limits: Butler 500, Servant 1,000, Demon Butler 1,500. Materials for the whole order come from your stock when it starts.
- Notifications: order started, order finished.

Decided Oct 23 (Servants, built the same day):

- A house facility a servant is working is occupied: the player can't use it until the order ends or is cancelled, and a servant can't start on a facility the player is using.
- A house holds one facility of each kind (one Workbench, one Range, and so on). A second can't be built or placed; extras standing from before the rule go to storage on load.
- Idle stays free. Wages and the hiring fee will be raised later, once there's more content to balance against.
- No quitting. An order only starts when the coin pouch covers its whole wages, so a servant never runs dry mid-order. The order picker offers "Add N GP and start" when the pouch is short.

Note: the house portal is in Riverside Town, which has its own public Range, Furnace and Anvil. Those stay free while the servant works the house ones, so today the occupied rule mostly bites on the Workbench and the Altar.

Proposed (Servants, for review):

- Speed is the servant's share of your own time per item; each item gives your full XP, so XP per hour is the same share (Butler 20%, Servant 30%, Demon Butler 50%).
- They can work any recipe at a placed facility you could make yourself (level, tool): Construction, Cooking, Smithing and Prayer today. Crafting has no house facility yet.
- Dismissing gives back the pouch and unused materials. Cancelling gives back unused materials, and unused wages stay in the pouch. Putting away the last facility an order needs cancels it with a refund.
- The guild is run by Mistress Wren (NPC, emoji portrait until art). Servants show as emoji until art.
- Deposit buttons: +1,000, +10,000, +100,000 and any amount. There's no way to take GP back out except dismissing.
- Dev tool: Settings > Dev tools > Servant hires any tier on the spot.

Proposed (Phase 1, for review):

- The house portal is in Riverside Town, entered from the town picture. Building, arranging and using house facilities need you to be at the portal (engine-checked), so the house works like a place.
- Room size: floor 8 wide by 4 deep, wall 8 wide by 2 high. The furniture limit counts every placed piece, wall and surface pieces included. One furniture build at a time; finished pieces go to storage, and a build can't start without a free storage slot.
- Phones open the room zoomed to 1.5x so pieces are a usable size; the room scrolls sideways inside its frame, and a zoom button switches between 1x, 1.5x and 2x. The room is drawn 800 by 600 with a deeper floor.
- Planks: a Sawmill at Lumber Camp saws Logs into Planks (3 s, 3 Construction XP) and Oak Logs into Oak Planks (4 s, 6 XP). The sawmill operator, a shop at Lumber Camp, converts Logs plus 100 GP into a Plank and Oak Logs plus 250 GP into an Oak Plank (OSRS fees), and sells Mahogany Planks for 1,500 GP until mahogany trees exist. No quest gate yet. No nails.
- Furniture: chairs (crude, wooden, oak), tables (wooden holds 1, oak holds 2), bookcase, beds (plank, oak +1 h, mahogany), wall torch, shelves (wall, surface slots), painting, potted plant and candlestick (surface). Facilities: range, small anvil, small furnace, sawhorse (saws planks at home). Levels, costs, times and XP follow OSRS where a match exists (content/house.ts).
- One example skin (Gilded Plank Bed) and two wallpapers and rugs, to exercise the data model; a dev tool unlocks every skin until Phase 2.
- Furniture art goes at assets/furniture/<piece>/<piece>_front.png (_side, _back); skins at assets/furniture/<piece>/<skin>_front.png. Until art exists, pieces draw as an emoji on a footprint.

Proposed (Oct 22, with the owner's art):

- Furniture art is drawn at its pixel size: 128 pixels of art is one floor cell wide, scaled by the row's perspective, so a 64-pixel chair takes half a cell. The room's grid traces the floor art (1536 x 1024 canvas, cropped to the band with art).
- New pieces from the art, with proposed levels and costs: Oak Stool, Oak Bench, Nightstand (holds 1), Writing Desk, Barrel, Washbasin, Wooden Chest, Cupboard, Wardrobe, Floor Candelabrum, Armour Stand, Weapon Rack, Stone Window, Red Banner, Shield Display. The dining table art is the Oak Dining Table, the wooden bed art the Plank Bed, wall_lantern the Wall Lantern, wall_shelf the Wall Shelf (holds 1), potted_fern the Potted Fern, painting the Landscape Painting (now 1 wide).
- Rugs (blue, red) are placeable pieces on their own layer under furniture; they only block other rugs. The drawn room-wide rug is gone (the rug cosmetic stays in the save for Phase 2, set to none).
- The workbench art replaces the Sawhorse: the Workbench saws planks at home.
- Stone Altar: a facility (level 30) where Offer Bones and Offer Ashes give twice the Prayer XP of burying, 2 seconds each.
- small_fountain is kept in assets/yard for the yard (Phase 3).
- Pieces still without art keep the drawn stand-ins: crude and wooden chairs, wooden table, oak and mahogany beds, bronze candlestick, small furnace.
- Phones still open at 1.5x zoom; the art room is wider than before, so 2x may suit better.

## Skills to flesh out

Today most skills are one or two recipes deep. Proposed order and scope, all open for review (nothing here is decided):

| Skill | Today | To add |
| --- | --- | --- |
| Woodcutting | Normal, oak | Willow, maple, yew, magic trees at OSRS levels; more locations; bird's nest and other rare drops |
| Mining | Copper, tin | Iron, coal, mithril, adamantite, runite; gems; more rocks and a second mine |
| Smithing | Bronze bars and gear | Iron, steel, mithril, adamant, rune bars (needs coal) and gear for each; cannonball-style extras later |
| Fishing | Shrimps, trout, tuna, shark | Anchovies, salmon, lobster, swordfish, more spots; the Fishing Hut makes real shrimps |
| Cooking | Shrimps and fish at the range | Burn chance by level (owner's list, item 4); cook every catch, meat, pies, stews |
| Slayer | Not started | Tasks, weapon-restricted enemies, Slayer XP (owner's list, items 5 and 6) |
| Firemaking | Logs and ashes | Higher logs (willow to magic), longer-lasting fires, bonfire buffs |
| Fletching | Bows and arrows from basic logs | Oak to magic bows, arrow tips and heads, bolts, shafts |
| Crafting | Bowstring, leather plan | Leather items, gems and jewellery (feeds Glory and other amulets), pottery |
| Farming | Flax | Allotments, herb patches (feeds Herblore), growth timers that run offline |
| Prayer | Bury, scatter | Timed prayers as buffs, an altar |
| Agility | Travel speed only | A course to run for XP, shortcuts, run energy |
| Herblore, Runecrafting, Thieving | Not started | See Phase 2 |
| Construction | Four buildings | The player house (see Player House), more buildings and upgrade tiers (see Building upgrades) |
| Combat skills | Complete | More enemies, areas and bosses; poison |

Each skill passes when it has content to level from 1 to about 99 without a dead stretch, with OSRS levels and XP.

## Built on Oct 12

The Oct 12 round is in: the phone layout and compact action bar (Phase 4, now built alongside desktop), a grid inventory, combat polish, timed Prayer, more achievements and a bigger job board.

| Item | What was built |
| --- | --- |
| Smooth progress bars | Fixed a bug, not styling: the per-item bar re-read its start point every second and ran at double speed, jumping to the end. It now fills smoothly for gathering and crafting. |
| Item art | 168 images from the OSRS wiki: every metal armour tier (bronze to rune, 8 pieces each), all axes and pickaxes, other tools, bird's nest, cooked and raw fish, arrows, all 15 runes, bars, and the Prayer, Smithing and Construction skill icons. Most placeholders are gone. |
| Metal armour and arrows | Decided with the art: iron to rune full helm, platebody, platelegs and kiteshield, plus iron to rune arrows, sold at the Riverside Armoury. OSRS levels and prices. |
| Mobile layout | Decided: built alongside desktop, not last. Below 1024px: a bottom tab bar (Home, Map, Quests, Buildings, Skills, Inventory, Equipment), the player strip at the top opens a drawer with status and skills, and Statistics, Achievements and Settings are icons in the drawer's header. Dialogs open as bottom sheets. |
| Compact action bar | On phones a thin bar under the player strip shows the current action on every tab (skill, count, progress; enemy HP in a fight). Tap for details, Stop and Open fight. |
| Combat opens Equipment | Starting a fight, or a dungeon wave, switches to the Equipment tab. A dungeon run shows its card there too (waves, what's next, the regear stop). |
| Gear lock shown | Mid-fight, worn weapons and armour are greyed out with a lock note, and the spell picker is locked. Food stays usable. |
| Enemy info | Fights and enemy cards show "Goblin (Level 6)" (OSRS combat level from its stats), max HP, weakness and No fleeing. |
| Dungeon loadout | "Select loadout" opens a picker of your gear only (unworn equipment and arrows, never food) to pick 6. Equipped food comes in free. Saved per dungeon, and also set from the Equipment tab. |
| Dungeon waves | The run shows "Now: Goblin (Level 6)" and "Next: Bandit (Level 19)", and the plan before entering. |
| Out of arrows or runes | The fight goes on but you can't attack: flee, or eat until you die. Keep fighting stops instead of starting the next enemy without supplies. |
| Inventory | Square OSRS-style slots with stack counts, a green outline on worn items, search, filter chips, and Type, Name or Value sort. Typing a filter name ("armor", "armour", "food") finds that type. Tap a slot for details and actions; right-click on desktop. Examine is gone (the details panel shows it). |
| Uncharged Glory | Shows its charges in the name, "Amulet of Glory (4)" down to "(0)". At 0 the description points to Aggie and Teleport is greyed out. |
| Prayer | Burying is a skill action now: Prayer's page lists Bury Bones and Scatter Ashes, 1 second each. |
| Settings | Notifications on or off, per type (warnings and errors always show). Exact numbers (1,234,567 GP). A ❗ in the tab title toggle. |
| Tab title | Shows what you're doing ("Burning Oak Logs - Idle Engine"), with ❗ in front when a level up, quest step or achievement arrives while you're away. |
| Achievements | 12 more: first building, first level 10, 20, 50 and 99 in any skill (Hitpoints doesn't count), total level 250, first kill, 100 kills, clearing the Den, equipping a Dragon Scimitar, a full bronze set, 100 shrimps cooked. |
| Job board | Boards at Lumber Camp, Lake Shore and the Quarry too (4 in all, 20 jobs). Better-paying jobs need a level. One-time and repeatable jobs never rotate off or expire at midnight. Jobs are grouped In progress, Available, Needs a higher level, with progress bars and reward icons. The Quests tab lists every job you've taken. |

### Proposed values to review (Oct 12)

- Burying and scattering take 1 second each.
- Worn items are outlined in green; stack counts are OSRS yellow.
- Uncharged jewellery is named with "(0)", OSRS-style, not "Uncharged Amulet of Glory".
- Weaknesses: Goblin stab, Bandit crush, Den Guardian slash.
- Equipped food comes into a dungeon whole, with no cap.
- New job rewards (120 to 2,500 GP) and level gates; achievement point rewards (5 to 100).
- Armour and arrow prices at the Armoury are their OSRS values.

## Built on Oct 11

Most of Phase 1, parts of Phases 2 and 3, and the Den dungeon are now in the game (branch engine-fixes).

| Roadmap item | What was built |
| --- | --- |
| All combat styles | Melee Accurate, Aggressive, Defensive, Controlled; Ranged Accurate, Rapid, Longrange; Magic Standard and Defensive. Each adds its OSRS invisible levels; a kill's XP goes 3/4 to the style's skills, 1/4 to Hitpoints. Style can change mid-fight. |
| Ranged combat | Bows fight with Ranged level and accuracy, use the arrows' ranged strength, and use up one arrow per shot. The fight ends when arrows run out. The Wooden Bow is now a Ranged weapon. |
| Magic combat | All 16 standard combat spells (strikes to waves) with OSRS levels, max hits, XP and rune costs. Runes are used per cast; an Air Staff covers air runes. Spell is picked in the Equipment tab. |
| Special attacks | Energy bar regenerates 10% per 30s (also offline). Manual only. Dragon Dagger (new item): Puncture, 2 hits, 25%. Dragon Scimitar: Sever, 55%, +25% accuracy, 25% chance of Bleed (5% of max HP every 3s, 4 hits, no stacking, logged). |
| Combat equipment tab | Melvor-style hub: style, spell, special bar, max hit and bonuses, all worn slots including a new Food slot. Clicking Attack, Strength, Defence, Ranged or Magic opens it. Food is preloaded by equipping it. |
| Gear lock | Gear can't change mid-fight (food can). The fight card says so. |
| Death | Takes only GP (10%). |
| Tools and skill speed | Axes, pickaxes (bronze to rune), net, rod, harpoon, tinderbox. Gathering needs the tool; the best usable one speeds it up. Level gives up to 10% faster gathering at 99. Every save gets a starter kit once (bronze axe and pickaxe, net, tinderbox). |
| Fishing | Lake Shore: shrimps (net), trout (rod), tuna and sharks (harpoon), with Gerrant's fishing shop. |
| Mining + Smithing | Quarry location with Copper and Tin rocks. Smelt bronze bars at the Furnace, smith daggers, axes, pickaxes, armour and arrows at a new Anvil. |
| Cooking at a range | New Range in town; all cooking needs it. |
| Prayer | Bury bones (4.5 XP) and scatter ashes. |
| Place the Bandit, fill places | Bandit and trees at Lumber Camp; oak trees at Hidden Grove; new Quarry and Draynor Village (7 locations). |
| Construction | New skill. Buildings give Construction XP. Fishing Hut and Hunter's Camp have the decided requirements; requirements live in one entry per building in content/buildings.ts. |
| Durability, Glory, Aggie | Degrading gear (Dharok's Greataxe as the example, dev spawn only) breaks into an unusable 0 copy that Bob repairs. Glory has 4 charges; Aggie in Draynor recharges them, with a short dialogue. Dev tool restores all wear, charges and special energy. |
| Longer offline time | 8 hours, raised on existing saves too. |
| Overgrown Den dungeon | Unlocked by the quest The Overgrown Den. Waves of Goblin, Goblin and Bandit run back to back, then a regear stop with "Continue to Den Guardian", then the boss (no fleeing). Only a 6-slot loadout comes in (proposed, within the decided 4 to 8; one number in content/dungeons.ts): each piece of gear or food takes a slot, a stack of runes one slot, worn gear is free. Inside, only loadout food is eaten and only loadout gear equipped. Fleeing, dying or running out of arrows or runes ends the run. Beating the boss sets denCleared, which the job "Something's Living in the Den" now waits on. |
| Other | Bob and every shopkeeper have dialogue; Bob sells axes and pickaxes; the dagger moved to a new Riverside Armoury; Aubury's Rune Shop sells runes and the Air Staff; 3 new achievements. |

Still not built: intro (on hold), Herblore, Agility, Runecrafting, Thieving, achievement point shop, more quests, building upgrades, poison, hide dev tools, confirm wasteful actions and the PWA (Phase 4), and art for the few items still without it (Oct 12 covered most).

### Proposed values to review

These weren't decided, so they were picked to be changed freely:

- Shops and NPC names: Riverside Armoury, Aubury's Rune Shop, Gerrant's Fishy Business.
- Rune prices: 3 to 4 GP for elemental and mind runes, 90 chaos, 180 death, 400 blood. Air Staff 1,500 GP.
- Glory recharge: 500 GP per charge.
- Tool speeds: each metal tier 5% faster (bronze 100% down to rune 75%).
- Fishing and mining base times (3 to 7 seconds); smithing 1 bar makes 15 arrows.
- Construction XP per building: Lumbermill 30, Coal Mine 50, Fishing Hut 150, Hunter's Camp 400. Lumbermill and Coal Mine now also cost 5 and 10 logs. Level 15 takes about 32 of each (about 35,000 GP).
- Fishing Hut makes 0.1 raw fish per second (was 0.4), slower than shrimps by hand.
- Scattering ashes gives 2 Prayer XP (OSRS gives none).
- Dharok's Greataxe lasts 10,000 attacks and costs 100,000 GP to repair.

## At a glance

| Phase | Focus | Highlights | Gate to the next phase |
| --- | --- | --- | --- |
| 1 | Finish half-built | All combat styles, Special attacks, Ranged + Magic, Fishing + tools | Combat is complete |
| 2 | New skills | Mining + Smithing, Cooking at a range, Prayer, Leather Crafting | Ore-to-gear loop works |
| 3 | Depth | Den dungeon + boss, Construction skill, 5 to 10 quests, Longer offline time | Gold has sinks |
| 4 | Polish + release | Mobile layout, Compact action bar, Inventory search, Hide dev tools | |

Each phase starts once the one before meets its gate; the tables below hold every item with its size and priority.

## Phase 1: finish what's half-built

Several things already exist in code but players can't reach them, or they look finished but do nothing. Closing these gaps makes the current map feel complete before adding more of it.

| Item | What to do | Size | Priority |
| --- | --- | --- | --- |
| Fishing skill | Fishing spots at Lake Shore as gathering: shrimps, trout, tuna, shark (their art is already in `items/Fish/`). Fishing is in the skill list but can't be trained. The Fishing Hut can stay as passive income. | M | High |
| Skill level matters | Higher level should give a small, capped speed bonus to gathering (decided: up to 10% faster at 99 for now, so better tools and buffs can stack on top without actions dropping to fractions of a second), not a large one. Woodcutting 15 chops exactly as fast as level 1 today. | M | High |
| Ranged combat | Fight with a bow and arrows, using the Ranged level and the arrows' ranged strength, using up arrows per shot, with the OSRS accuracy and max-hit formulas. Today the bow fights as a melee weapon at unarmed speed. | M | High |
| Magic combat | The standard combat spells (strikes first, then bolts, blasts and waves) using the Magic level and OSRS magic accuracy and max hit, using up runes per cast. Runes come from a shop until Runecrafting exists. Magic is in the skill list but combat ignores it. | M | High |
| Place the Bandit | The Bandit enemy is defined but no location has it. Put it at Lumber Camp. | S | High |
| Tools | Axes at Bob's Famous Axes (it only sells a dagger), a tinderbox for Firemaking, a rod or net for Fishing (art exists in `items/Tools/`). Each gathering skill requires its tool to start: an axe for Woodcutting, a tinderbox for Firemaking, a net or rod for Fishing, a pickaxe for Mining. A better tool works faster. | M | High |
| Fill the empty places | Lumber Camp and Hidden Grove have nothing to do. Add a 5th location so the Explorer achievement can be earned (Quarry and Draynor Village are both planned). | M | Medium |
| All combat styles | Every OSRS style per weapon type: melee Accurate, Aggressive, Defensive and Controlled; Ranged Accurate, Rapid and Longrange; Magic standard and defensive casting. Each picks the skill that gets XP and gives its OSRS bonus (+3 effective level, or 1 tick faster for Rapid). Today every kill splits XP evenly four ways. | M | High |
| Special attacks | A special attack energy bar (100%, regenerating 10% every 30 seconds as in OSRS) and a spec on each weapon that has one in OSRS, following the OSRS wiki list. First the Dragon Dagger, a double hit as in OSRS (the item needs adding), and the Dragon Scimitar: +25% accuracy and a 25% chance to inflict Bleed, costing 55% energy. Bleed deals 5% of the target's max HP every 3 seconds for 4 hits (20% in total), doesn't stack (a new bleed restarts the timer), and each hit is recorded in the combat log; tune these numbers in testing if it's too strong. Specs are triggered manually; automatic use unlocks later. | M | High |
| Combat equipment tab | Melvor-style: clicking Attack, Strength, Defence, Ranged or Magic opens the Equipment tab, which holds worn gear, food, spells, ammo and the fight's info. Food is preloaded by equipping it from the inventory like other items; with none equipped, the existing pre-fight prompt still offers a chance. | M | High |
| Missing item art | Wood, Ashes, Coal, Bird's Nest, Shark, Cooked Fish and the bows still show the box placeholder. | S | Medium |
| Intro and player name | A short guided intro, tutorial-island style: name your adventurer, then one step each for gathering, crafting, combat and the main UI. Today the sidebar says "Adventurer" for everyone. On hold: needs more discussion first. | M | Medium |

## Phase 2: new skills

Add skills in the order that reuses the most of what exists: Mining with Smithing first, since ore art and the Furnace placeholder are already in. Every new skill gets the same skill page, icons, yields and chance drops as Firemaking, so most of the work is content.

| Skill | How it plays | Reuses | Size | Priority |
| --- | --- | --- | --- | --- |
| Mining + Smithing | Mine copper, tin, iron, mithril, runite as gathering at the new Quarry location, starting with Copper and Tin rocks. Smelt bars and smith bronze gear at the Furnace. | Ore art in `items/Ores/`, the Furnace placeholder in town, the bronze armour art | L | High |
| Cooking at a range | Cook raw fish and meat, only at a range (one in town, later a Kitchen building). Cooking on a fire from Firemaking can come later, since each fire needs its own timer. | The Cooking skill and a Cook Fish recipe exist, but the recipe runs anywhere; recipes have no station requirement yet | S | High |
| Prayer | Bury bones and scatter ashes for XP. Later, prayers as timed buffs. | Bones (from every kill) and Ashes (from Firemaking) have no use yet; the buff system already supports timed bonuses | S | High |
| Crafting (leather) | Tan pelts into leather, make boots, gloves and body armour. | Pelts from the Hunter's Camp have no use; leather boots and gloves art exists | M | Medium |
| Herblore | Pick herbs, brew potions that act as timed buffs (more XP, faster gathering, HP regen). | The buff system targets XP, production, travel and regen already | M | Medium |
| Agility | A course you run for XP; level already makes travel up to 50% faster. | The travel-speed formula already reads Agility | M | Medium |
| Runecrafting | Craft runes at altars to feed Magic combat (Phase 1) and add teleport spells. | Staff of Air art; the teleport system from the Amulet of Glory | M | Low |
| Thieving | Pickpocket townsfolk and steal from stalls, with a chance to get caught and take damage. | HP and damage already exist outside combat | M | Low |

## Phase 3: depth and progression

Give players reasons to keep earning: things to spend gold and achievement points on, longer quest chains, and upgrades that make idle time worth more. Several hooks for this are already in the engine but unused.

| Item | What to do | Size | Priority |
| --- | --- | --- | --- |
| Longer offline time | Raise offline progress from 1 hour to 8 hours. The cap is stored per save so it can grow. | S | High |
| Achievement point shop | Achievement Points are earned but can't be spent. A shop for cosmetics, offline-time upgrades or permanent small buffs. | M | High |
| More quests | One quest exists. Aim for 5 to 10, chained, each unlocking a place, a skill method or a shop. | M | High |
| Overgrown Den dungeon | Not until combat is finished (all styles, special attacks, Ranged, Magic). Then turn the "Enter" placeholder into a real run: a few waves of goblins and bandits, then the Den Guardian boss. The boss, its loot table (Dragon Scimitar, Glory) and the `denCleared` flag all exist but nothing uses them. Before the boss, a "Continue to Den Guardian" step lets you regear from a small loadout (4 to 8 items to start, as a test of whether it stays), not your whole inventory. | L | High |
| Building upgrades | Buildings only scale by count. Add upgrade tiers (Lumbermill II) and buildings for new resources (a mine, a herb garden). | M | Medium |
| Construction skill | Buildings cost gold plus materials (logs, ore, bars), most need a Construction level, and buying one gives Construction XP. Decided: Fishing Hut needs Construction 5, 10,000 gold, 100 raw shrimps and 100 logs; Hunter's Camp needs Construction 15, 100,000 gold and 100 bones. Proposed: Lumbermill and Coal Mine stay early (gold plus logs, no level). The Quarry building is renamed Coal Mine, since it makes coal and Quarry is now the Mining location; its id stays "quarry" so saves still load. Keep each building's requirements in one entry in the buildings content file so they are easy to edit. Building costs already take a list of resources; today each lists only GP. | M | High |
| More achievements | Partly built Oct 12 (12 more, any-skill milestones; about 22 now). Add per-skill milestones (level 10, 50, 99), kill counts, first boss, collection goals. | S | Medium |
| Better job board | Built Oct 12 and 15 (4 boards, 20 jobs, level gates, corkboard look; one-time jobs never expire). Add more jobs per location and higher-paying ones for higher levels. | S | Low |
| Amulet of Glory charges | Its description promises limited charges; it teleports forever today. Aggie recharges it for gold. | S | Medium |
| Equipment durability | Items already have a durability field. Weapons and armour degrade only on selected items, as with Barrows gear. At 0, some dissolve and others become a broken copy (like "Dharok's greataxe 0") that can't be equipped or used in combat. Bob repairs them for gold, as in OSRS. Jewellery uses charges (Glory first, above) that Aggie recharges for gold. Add a dev tool that restores all wear and charges. | M | Medium |
| Aggie, a witch in Draynor Village | Recharges jewellery for gold for now, with a short dialogue that asks to charge it. Also the first test of NPC dialogue. She lives at a new Draynor Village location, as in RuneScape. | S | Medium |
| Poison | The poisoned HP bar art hook exists. Some enemies poison, antidote potions from Herblore cure it. | S | Low |

## Phase 4: quality of life and release prep

The inventory and menus are built for a few dozen items; with 1,000+ planned, they need search and grouping before content grows much further.

| Item | What to do | Size | Priority |
| --- | --- | --- | --- |
| Inventory at scale | Built Oct 12. Search, filter by category (the same categories as the art folders), sort by value or name, and a compact grid view with tooltips. | M | High |
| Hide dev tools | The dev section in Settings (spawn items, set levels, teleport) is visible to every player. Put it behind a dev flag before sharing widely. | S | High |
| Mobile layout | Built Oct 12, alongside desktop (decided: not last). A fresh phone layout: a bottom tab bar for the main tabs instead of the wrapping row at the top, player status and the skill list in a drawer that slides out on tap, and Statistics, Settings and Achievements as small icons in the drawer's header. | L | High |
| Compact action bar | Built Oct 12. On phones, replace the action card at the top with a thin progress bar for the current action (travel, crafting, gathering). Tap it to expand details and a Cancel button. | S | High |
| Notification settings | Built Oct 12 (on/off, per type; duration not yet). Per-type on/off and duration (some players want no crafting toasts at all). | S | Medium |
| Confirm wasteful actions | Ask before eating at full HP outside combat, or selling an item worth a lot. | S | Medium |
| Installable app | Make it a PWA so it installs to a phone home screen and opens offline. | M | Low |
| Number format setting | Built Oct 12 (Exact numbers toggle). Choose 1.2K or 1,234 style; some players prefer exact numbers. | S | Low |

## Change or remove

These work as built but cut against the game; each is a quick decision more than a project.

| Today | Suggested change |
| --- | --- |
| Dying takes 5% of every stack, including worn arrows and food | Decided: take only GP, if any is left. |
| Fishing Hut makes raw fish with no Fishing skill involved | Decided: keep it as passive income once Fishing exists, but make it slower than fishing by hand. |
| Hunter's Camp makes pelts nothing uses | Decided: leave it as is for now. |
| "Bob's Famous Axes" sells a dagger and no axes | Sell axes once tools exist, and move the dagger to a weapon shop. |
| The Furnace says "Nothing usable here yet" | Becomes the Smithing station (Phase 2). |
| "Talk to Bob" does nothing | Decided: keep it, and use it for quest dialogue, lore and hints. |
| Every fight's gear is locked in when it starts | Decided: keep gear locked and say so in the fight card. Dungeons get a "Continue to <boss>" step to regear from a small loadout, not the full inventory. |
| The Wooden Bow gives melee Attack +8 | Move it to Ranged once Ranged combat exists. |

## Idea backlog

Bigger or riskier ideas worth keeping in view, not scheduled:

- **Random events while idle**: a lost traveller, a lucky tree, a mugger, each with a small choice and reward.
- **Pets**: rare drops from skilling (a beaver from Woodcutting) that give a small bonus, like RuneScape skilling pets.
- **Collection log**: a page of every item, drop and boss, filled as you find them; a long-term goal for completionists.
- **Seasonal or weekly events**: a double-XP weekend or a holiday boss, using the buff system that already exists.
- **Prestige**: reset buildings or a skill at 99 for a permanent multiplier, a classic idle-game loop.
- **Cloud saves**: sign in to sync between phone and desktop. Needs a server; export and import cover it until then.
- **Shared world**: leaderboards, a social system or a trade post; wanted at some point. Needs a server and anti-cheat, since the game runs in the browser today.
- **Avatars**: six starter portraits, or one that shows your helmet, as discussed earlier.

## Open questions

- [x] How long should offline progress last: 1 hour today, 8 to 12 is common for idle games? Decided: 8 hours.
- [x] Should anything be lost on death beyond GP? Decided: GP only.
- [x] Is this always single-player, or is trading or a leaderboard ever planned? That decides whether a server comes early. Decided: leaderboards and a social system at some point.
- [x] Phone first or desktop first when a design only fits one? Decided: both. Every new screen is built for desktop and phone together.
- [x] Should skill level speed up actions, raise success chance, or both? Decided: speed, up to 10% faster for now.
- [x] Dragon Scimitar special attack: what does it do instead of disabling prayers? Decided: +25% accuracy, 25% chance to inflict Bleed.
- [x] Jewellery: how are charges restored, if not for gold? Decided: Aggie, a witch in Draynor Village, recharges it for gold for now.
- [x] Broken armour and weapons: do they disappear, or stop working until repaired? Decided: only selected items degrade; some dissolve, some become an unusable "0" copy.
- [x] Dungeon regear: how many items fit in the small loadout? Decided: 4 to 8, as a test.
- [ ] Tutorial: a separate tutorial island you leave once, or hints in the main game? To discuss later.
- [x] Mining location: the Quarry building already uses the name "Quarry". Rename one? Decided: mining goes at the Quarry location.
- [x] Special attacks: manual only, automatic, or a checkbox? Decided: manual only for now, with automatic use unlocked later.
- [x] Bleed: what % of HP per hit, and for how long? What does the Dragon Scimitar spec cost (55% in OSRS)? Decided: 55%; 5% of max HP every 3 seconds for 4 hits, not stacking, tuned in testing.
- [x] Where does Betty stand? Decided: a new Draynor Village location, and she is renamed Aggie.
- [x] Should the Quarry building be renamed now that Quarry is also a location? Decided: renamed Coal Mine, since it makes coal.
- [x] Build the phone layout last, or alongside desktop? Decided: alongside desktop.
- [ ] Mid-fight food: locking food too was suggested, but swapping food mid-fight was decided earlier. Keep food usable while weapons and armour lock?
- [ ] Dungeon food: equipped food now comes in whole. Cap it (say 20), or keep it uncapped?
- [ ] Uncharged Glory: "Amulet of Glory (0)" (OSRS style, built) or "Uncharged Amulet of Glory"?
- [ ] Per-skill achievements (level 10, 50, 99 for every skill) would add about 60. Want them, or keep the any-skill milestones?
- [ ] Notification duration per type: wanted, or is on/off enough?
- [ ] Look and feel: should dark mode stay (a darker brown palette), or go light parchment only?
- [ ] Shops: which shops buy what? Proposed: Bob takes tools and metal gear, the Armoury takes armour and weapons, Aubury runes and staves, Gerrant fish and fishing gear, the General Store anything.
- [ ] Should a General Store pay less than a specialist (OSRS pays about 40% base)?
- [ ] Sound: off by default, or on with a first-run prompt?
- [ ] Potions: do boosts carry into dungeons and can they be taken mid-fight?
- [ ] Slayer: needs a Slayer master NPC and location; which town?
- [ ] Add a bank or storage cap, or leave the inventory unlimited?
