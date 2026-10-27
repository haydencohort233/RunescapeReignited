# Idle Engine Roadmap

Local copy of the live doc, which is the source of truth: https://claude.ai/artifact/CisApq9wcjwbQoxmAGThdH (Roadmap tab).

Updated Oct 27, 2026. This page is the plan: what's next, what needs your call, and everything not built yet, grouped by area. The full history (every Decided and Proposed detail, round by round) is in the History and decisions tab, and in docs/ROADMAP-ARCHIVE.md in the repo.

## Up next

Proposed order, for you to confirm or reshuffle. Each line builds on decisions already made.

| # | What | Why now | Size |
| --- | --- | --- | --- |
| 1 | Material tiers | Iron to rune (Mining, Smithing), willow to yew (Woodcutting, Firemaking, Fletching), mahogany planks. Most skills are one or two recipes deep; this is the biggest gap, and it gives the house, servants and shops more to work with. | L |
| 2 | Shops buy their own category | Decided Oct 27: each specialist buys its category (jeweller jewellery, armour shop armour, weapon shop weapons) and pays more than a General Store, which buys anything for less. | M |
| 3 | Cooking burn chance | Decided: burn chance falls with level and stops at a level per food, with the OSRS wiki as a rough guide (values can differ). Fits with the new fish from step 1. | M |
| 4 | Bank and inventory cap | Decided Oct 27: cap the inventory and add a bank; no noted items. Needs your answers on size and where banks are (see Waiting on you). | L |
| 5 | More quests | 3 exist; aim for 5 to 10 on the quest-giver system, with new step types (kill a boss, talk to another NPC). | M |

After that: Herblore with combat potions, then Slayer with weapon-restricted enemies. The guidance system goes near the end, before release (see Before release).

## Waiting on you

Answers here unblock work above or below.

- [ ] Bank: how many inventory slots (OSRS has 28), and does a stack of ore or logs take one slot? What happens when the inventory fills while idle: stop, or keep going?
- [ ] Bank: where are banks (every town, or a few)? Is the bank unlimited, or does it grow?
- [ ] Potions: can they be drunk mid-fight, or only before?
- [ ] Slayer: which town gets the Slayer master?
- [ ] Mid-fight food: keep food usable while weapons and armour lock?
- [ ] Dungeon food: cap equipped food (say 20) or keep it uncapped?
- [ ] Uncharged Glory name: Amulet of Glory (0) (built) or Uncharged Amulet of Glory?
- [ ] Per-skill achievements (about 60 more), or keep the any-skill milestones?
- [ ] Notification duration per type: wanted, or is on/off enough?
- [ ] Review the Proposed values: house (yard, outside looks, paths, servants, Oct 27 room looks), shop and NPC names, rune prices, Glory recharge, tool speeds, gather times, Construction XP, Fishing Hut rate. Each is listed in the History and decisions tab.

Answered Oct 27:

- [x] Shops: specialists buy their category and pay more; the General Store buys anything and pays less. Proposed: specialists pay 60% of an item's value, the General Store 40%. Bob buys tools, the Riverside Armoury armour and weapons until a separate weapon shop exists, Aubury runes and staves, Gerrant fish and fishing gear; a jeweller comes with jewellery Crafting.
- [x] Sound: on by default, with a volume and mute setting. Low priority; far off.
- [x] Bank: yes. Cap the inventory and add a bank, with no noted items.
- [x] Tutorial: yes, a guidance system rather than a tutorial island: the first time you open a skill or feature it highlights what to tap and sets small tasks with counts ("Build a wooden chair 0/1", then "Place the wooden chair"). Proposed: build it near the end, once the screens settle, so the highlights don't break each time a screen changes.
- [x] Cooking burn chance: yes, OSRS wiki as a rough guide; values can change.
- [x] Potions: boosts carry into fights and dungeons.

## Backlog by area

Not built yet. Size: S small, M medium, L large.

### Skills

A skill is done when it levels from 1 to about 99 without a dead stretch, at OSRS levels and XP.

| Skill | Today | To add |
| --- | --- | --- |
| Woodcutting | Normal, oak | Willow, maple, yew, magic; more locations; rare drops |
| Mining | Copper, tin | Iron, coal, mithril, adamantite, runite; gems; a second mine |
| Smithing | Bronze | Iron to rune bars (with coal) and gear for each |
| Fishing | Shrimps, trout, tuna, shark | Anchovies, salmon, lobster, swordfish; more spots |
| Cooking | Fish at the range | Burn chance; every catch, meat, pies, stews |
| Firemaking | Logs | Higher logs, longer fires, bonfire buffs |
| Fletching | Basic bows and arrows | Oak to magic bows, arrow tips, bolts |
| Crafting | Bowstring | Leather (uses Hunter's Camp pelts), gems and jewellery, pottery |
| Farming | Flax | Allotments, herb patches, growth timers offline; bird's nest seeds |
| Prayer | Bury, scatter, altar | Timed prayers as buffs |
| Agility | Travel speed, one shortcut | A course to run for XP, more shortcuts |
| Herblore | Not started | Herbs and potions; combat boosts (decided), antidotes |
| Slayer | Not started | Tasks from a master, Slayer XP, weapon-restricted enemies (decided) |
| Runecrafting | Not started | Runes at altars to feed Magic; teleports |
| Thieving | Not started | Pickpocketing, stalls, getting caught |
| Construction | Buildings, player house | Building upgrade tiers; more house content (below) |

### Combat and world

- More quests, 5 to 10 (M)
- Shops buy their own category; a General Store buys anything for less (M, decided)
- Bank and inventory cap, no noting (L, decided)
- More enemies, areas and bosses; poison (M)
- More jobs per board, higher-paying ones for higher levels (S)
- Achievement point shop: cosmetics, offline time or small buffs (M)
- More achievements: boss kills, collection goals (S)
- Building upgrade tiers and new buildings (M)

### Player house

- Phase 2, cosmetics: skin unlocks from achievements, drops and shops (waits on cosmetic art)
- 37 furniture images from the Oct 27 art round need catalog entries; most need resizing first (M)
- Bank replacing house storage, and servant delivery into it
- Server: friends and messaging (after the intro adds names), cloud saves, hiscores, visit counts and guestbook, reports and moderation
- Phase 6, microtransactions (later)

### Look, feel and quality of life

- OSRS-style look: icons and section headers, then scroll-style cards (M, in progress)
- Sound: a handful of cues, on by default with volume and mute (S, decided, low priority)
- Equipment presets: save and swap a worn set in one tap (S)
- Save backup reminder before big updates (export and import exist) (S)
- Player name (M, on hold)
- Confirm wasteful actions: eating at full HP, selling something valuable (S)
- Notification duration (S)
- Missing art: generic Raw Fish, Cooked Fish, Pelt (S)

### Before release

- Hide dev tools behind a flag (S)
- Guidance system: first-time highlights and small counted tasks per skill and feature (M, decided Oct 27)
- Installable app (PWA) (M)

### Small fixes

- Fishing Hut still makes generic Raw Fish; switch it to shrimps.

## Built

| When | What |
| --- | --- |
| Oct 11 | All combat styles, Ranged, Magic, special attacks, gear lock, tools, Fishing, Mining, Smithing, Cooking, Prayer, Construction, durability and Glory, the Overgrown Den |
| Oct 12 | Phone layout, grid inventory, metal armour and item art, timed Prayer, settings, achievements, bigger job board |
| Oct 15 | Town scenes, shop grids, training cards, travel to nearest spot, corkboard job boards |
| Oct 17 to 20 | OSRS-style theme, world map overhaul, quest givers and conversations, away summary |
| Oct 20 to 26 | Player house: room and furniture, servants, yard, sharing and online listings, house overhaul (panels, scenery, weather, paths) |
| Oct 27 | Second art drop (new item, skill and room art); fixed a render loop on the house screen |

## Ideas, not scheduled

Random events while idle, skilling pets, a collection log, seasonal events, prestige, avatars, a trade post.
