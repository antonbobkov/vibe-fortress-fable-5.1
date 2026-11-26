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

## Done

- [ ] Floor cracks joined to the base; a unit test on a vein inside rock (the spawn tiles share the base's label) and one on a vein at a cavern floor.
- [ ] The emergence line with its place; the Threats panel's Deep count and wrapped lines; UI tests.
- [ ] A scenario from level 0 to level 2: the Hollow-born walk out and fight; deepsilver can still be mined after the fight.
- [ ] 18 § The Deep and § Player-facing behavior updated (floor, not open; the count; the line).
