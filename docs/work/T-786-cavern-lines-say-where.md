# T-786 — The cavern lines say which cavern, where, and what lives there

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 3) · **Size:** M · **Needs:** — · **Status:** open

## Why

Breaching cavern 2 in Year 4 was the playtest's first deep event. The log said "! A cavern has been breached." and "A cavern monster has appeared.", in that order, and a hint: "☼ A cavern lies open to the fortress, and what lives there can walk in. Wall the opening off …". `[Enter]` on the breach line said "No place to go to.". The Threats panel then read "2: breached at (2,14,z13) · monsters 5". From then on, "A cavern monster has appeared." came every few days (cavern 2's respawns, `MonsterSpawned`, a note), with no species and no place. Twenty days after the breach, one of those monsters, a blind stalker, was fighting seventeen dwarves in the hall (finding 3 and T-787-monster-in-the-hall-is-danger).

The cave map makes this harder to read. Cavern 2 on this map is five pockets of rock-sealed open space (877, 684, 674, 130 and 86 tiles over its four levels). My corridor opened one of the small ones: about ten tiles on z13 were discovered (13-cavern2-z13.png), and the five monsters were elsewhere. Cavern 1 was opened by the three-year script's stair on day 21. Its row read "1: breached · monsters 13" for six years, while its spiders spun webs every day (1,008 `WebSpun` events), and none of the 13 ever reached a dwarf. The player cannot tell a cavern whose monsters can walk in from one whose monsters cannot.

`announce.cavern_breached` takes no parameters (`ui/strings.ts`); `CavernBreached { cavern, tile }` carries both. `announce.monster_spawned` likewise drops `{ id, cavern }`.

## What to do

Decisions taken here:

- **The breach line names the cavern and the place, and focuses there:** "! Cavern 2 is open at (2,14,z13). What lives there can walk in." The focus is the event's tile, so `[Enter]` goes there. The hint stays as it is.
- **The respawn note names the species and the cavern, and folds:** "A blind stalker has appeared in cavern 2." Respawns of one cavern in a day are one line ("2 cave crawlers and a giant cave spider have appeared in cavern 1."). Respawns in a cavern with no path to any fortress creature are not announced at all; the Threats row counts them.
- **The Threats row says whether the cavern's monsters can reach the fortress:** "2: open at (2,14,z13) · 5 monsters, 1 can reach the halls" or "… none can reach the halls". Reach is by 22's walker label of each monster against the fortress dwarves' labels, read when the panel draws. The panel already does a similar reach count for the shelter line.

## Decisions made while implementing

- **The breach line already had its focus.** `CavernBreached` carries its tile and the line's focus was that tile; the playtest's "No place to go to." was the action row of the hint selected above it (12-log-cavern.png). The line now names the cavern and the place. A breach event without a cavern or tile (only a test emits one) keeps the plain "A cavern has been breached." (`announce.cavern_breached_unplaced`), so no line prints a raw placeholder.
- **The reach filter covers the wakes too.** A sleeper woken by the breach is a `MonsterSpawned` like a respawn, and the playtest's five woken monsters were in other pockets, so every `MonsterSpawned` whose monster cannot walk to a fortress dwarf is silent.
- **Reach** is 22's walker label of the monster's tile against the labels of the fortress dwarves' tiles (`src/ui/cavern-reach.ts`), shared by the note and the Threats row. The labels know terrain only, so a door does not count as a wall (a monster behind a closed door "can reach").
- **The fold** is per cavern and day, as the starving line is per need and day: the first monster's focus and subject stay; later monsters change the text and time in place (presentation state, not saved).
- **The Threats row keeps two rows** (the panel is 36 cells wide): "2: open at (2,14,z13)" and under it "5 monsters, 1 can reach the halls", "13 monsters, none can reach the halls" or "no monsters". An older save without the breach record reads "2: open" with the same second row. 18's reader gains `threats.cavernMonsters(n)` (the ids `monstersInCavern` counted).
- UI only, and one reader: no world hash moves.

## Done

- [x] The breach line with cavern, tile and focus; a UI test.
- [x] The respawn note with species and cavern, folded per cavern and day, and silent for monsters that cannot reach; a test.
- [x] The Threats row's reach count; a test with a sealed pocket and an open one.
- [x] 18 § Player-facing behavior and 24's announcement table updated.
