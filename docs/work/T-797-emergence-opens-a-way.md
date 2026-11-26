# T-797 — The Hollow-born come up where they can walk, and the panel counts them

**Source:** playtest 8 ([report](../../reports/data/2026-11-26-playtest-8.md), finding 2) · **Size:** M · **Needs:** T-796-threat-needs-a-path (for the stalemate's second half) · **Status:** open

## Why

In playtest 8 the player mined five deepsilver tiles at z5 from a tunnel beside cavern 3, and the Deep stirred (level 1, pressure 50). The emergence sent three hollow crawlers. They killed the miner, then stood at (19,22), (19,24) and (20,24), z5, for a whole season. Look read "Open space · hollow crawler · Activity: Attacking". The Gate Guard sat six tiles away under a kill order on them, reading "Now: 4 on the way · 1 asleep".

`triggerDeepEmergence` (`src/systems/threats/deep.ts:169-173`) takes the `EMERGENCE_TILES` nearest walls within ±2 levels of the base and sets them to `TileKind.Open`. Open is air, not floor. The walls chosen were deepsilver and rock inside the vein, so the Hollow-born spawned in sealed air pockets. They could strike a miner beside them but could not leave, and no one could reach them.

Through T-796-threat-needs-a-path they then kept every miner from the rest of the vein: "Dig (22,25,z5) · open 16 days · Nobody takes it yet". So the Deep stopped at level 1. No stalker, wyrm or Maw came, and no more deepsilver could be taken.

The Threats panel also misread it:
- "3: open at (29,20,z7) · no monsters" while "Active: 3 hollow crawlers" stood in that cavern.
- The pressure line was cut: "Pressure … 50 / 150 (lv»" and "noticed the pale metal being ta»".

18 § The Deep says "the rock cracks" and that the emergence point is a mined deepsilver location "so the player can fortify it". The spec meant a breach the Hollow walk out of.

## What to do

Decisions taken here:

- **The rock cracks into floor, joined to the base.** The cracked tiles become what digging makes (03 § Tile transitions: a wall dug to `floor`, with the wall below kept). They are chosen on the base's level first, as a connected run from a tile next to the base (a breadth-first walk through walls from the base's walkable neighbours), then one level up and down. Every spawn tile must share a walker label with the base's open side. Without such a run, the Hollow-born spawn on the base tile itself, or on the nearest walkable tile next to it.
- **The emergence line says where.** "!! The rock cracks at (20,23,z5): 3 hollow crawlers come up." It is a danger line, with [Enter] going there.
- **The Threats panel counts the Hollow-born** in the Deep section ("3 hollow crawlers in the halls" or "… at the vein"), not in a cavern's row. Its lines wrap rather than cut: "Pressure 50 / 150 (level 1)", and the stir quote in full.
- **Test the deep end end to end.** A scenario mines a vein to level 2. It asserts that the Hollow-born reach a dwarf or a squad within a day, and that a squad with a kill order reaches them.

## Decisions taken while doing it

- **The walk.** `findCrackTiles` (`threats/deep.ts`) walks through natural walls only, face step by face step, from the base and its walkable face neighbours (the base's first walkable neighbour on its level when the base is not walkable), and cracks the first `EMERGENCE_TILES` walls it meets. Each cracked tile is joined to the base by the ones before it, so no label check is needed after the fact.
- **Base level only.** A crack one level up or down could not be joined to the base without a stair or ramp, so the walk stays on the base's level. With fewer walls than Hollow-born, they share the cracked tiles in turn, as before.
- **The Hollow do not break the pale metal.** A deepsilver wall is neither cracked nor walked through, so the vein stays mineable after an emergence (the old rule cracked the vein's own tiles to air). A constructed wall is not cracked either. With nothing to crack, the Hollow-born come up on the base itself (fun-features: "Up through the miner's feet").
- **The line** is a new announcement of the existing `MonsterEmerged` event (danger), next to `DeepStirred`'s; it counts by species ("a hollow crawler comes up" / "3 hollow crawlers come up") and its focus is the emergence base.
- **"At the vein" or "in the halls".** The panel says "at the vein" while every Hollow-born in view stands within `HOLLOW_AT_VEIN_RADIUS` (8, 24 § Tuning constants) of the emergence base, on its level or two above or below; otherwise "in the halls". Two new readers: `threats.hollowBorn()` and `threats.emergenceBase()`. A stalker hiding and not yet spotted is not counted.
- **The pressure line** reads "(level 1)" for "(lvl 1)", and it and the quote wrap with `wrapHang`.
- **The level 0-to-2 "scenario"** is a `TestWorld` test (`test/unit/threats/t797-emergence-opens-a-way.test.ts`): pressure comes from `DeepsilverMined` events, a squad of three axedwarves takes kill orders, and a fresh miner digs the vein after the fight (the first miner is usually killed, as in the playtest).
- **The `descent` scenario's squad changed.** Its two unarmoured crossbow soldiers had killed the Deep's first crawlers only because the crawlers were stuck in air pockets. Now the crawlers walk out and up the stair shaft, where no bolt flies between levels, and they killed the squad and most of the fortress. The scenario's soldiers now carry axes and iron armour (fun-features: "No bolt flies up a stair"). The crawlers still kill a few miners on the way, as in the playtest.

## Done

- [x] Floor cracks joined to the base; a unit test on a vein inside rock (the spawn tiles share the base's label) and one on a vein at a cavern floor.
- [x] The emergence line with its place; the Threats panel's Deep count and wrapped lines; UI tests.
- [x] A scenario from level 0 to level 2: the Hollow-born walk out and fight; deepsilver can still be mined after the fight.
- [x] 18 § The Deep and § Player-facing behavior updated (floor, not open; the count; the line).
