# Idle Engine Roadmap

Oct 11, 2026. Local copy of the live doc, which is the source of truth: https://claude.ai/code/artifact/fb252a61-8b75-4562-b645-755ca5489eae

Next up: the remaining Phase 2 skills (Herblore, Agility, Runecrafting) and Phase 3 depth. See Built on Oct 11 for what is already in.

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

Still not built: intro (on hold), Herblore, Agility, Runecrafting, Thieving, achievement point shop, more quests, building upgrades, poison, mobile layout and the rest of Phase 4, and item art for the new items.

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
| More achievements | 7 exist. Add per-skill milestones (level 10, 50, 99), kill counts, first boss, collection goals. | S | Medium |
| Better job board | 5 jobs rotate. Add more per location, plus higher-paying jobs that need higher levels. One-time jobs shouldn't expire at midnight. | M | Medium |
| Amulet of Glory charges | Its description promises limited charges; it teleports forever today. Aggie recharges it for gold. | S | Medium |
| Equipment durability | Items already have a durability field. Weapons and armour degrade only on selected items, as with Barrows gear. At 0, some dissolve and others become a broken copy (like "Dharok's greataxe 0") that can't be equipped or used in combat. Bob repairs them for gold, as in OSRS. Jewellery uses charges (Glory first, above) that Aggie recharges for gold. Add a dev tool that restores all wear and charges. | M | Medium |
| Aggie, a witch in Draynor Village | Recharges jewellery for gold for now, with a short dialogue that asks to charge it. Also the first test of NPC dialogue. She lives at a new Draynor Village location, as in RuneScape. | S | Medium |
| Poison | The poisoned HP bar art hook exists. Some enemies poison, antidote potions from Herblore cure it. | S | Low |

## Phase 4: quality of life and release prep

The inventory and menus are built for a few dozen items; with 1,000+ planned, they need search and grouping before content grows much further.

| Item | What to do | Size | Priority |
| --- | --- | --- | --- |
| Inventory at scale | Search, filter by category (the same categories as the art folders), sort by value or name, and a compact grid view with tooltips. | M | High |
| Hide dev tools | The dev section in Settings (spawn items, set levels, teleport) is visible to every player. Put it behind a dev flag before sharing widely. | S | High |
| Mobile layout | A fresh phone layout: a bottom tab bar for the main tabs instead of the wrapping row at the top, player status and the skill list in a drawer that slides out on tap, and Statistics, Settings and Achievements as small icons in the drawer's header. | L | High |
| Compact action bar | On phones, replace the action card at the top with a thin progress bar for the current action (travel, crafting, gathering). Tap it to expand details and a Cancel button. | S | High |
| Notification settings | Per-type on/off and duration (some players want no crafting toasts at all). | S | Medium |
| Confirm wasteful actions | Ask before eating at full HP outside combat, or selling an item worth a lot. | S | Medium |
| Installable app | Make it a PWA so it installs to a phone home screen and opens offline. | M | Low |
| Number format setting | Choose 1.2K or 1,234 style; some players prefer exact numbers. | S | Low |

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
