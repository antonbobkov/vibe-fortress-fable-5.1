# T-475 — Runecraft 8: Call and the three summons

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** T-473 · **Status:** open

The specification is [25 Runecraft](../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 § Summons, the `call` row of § Spells, the `wisp_loose` row of § The sanctum, the `summon_turned` thought.

## Decisions

- A summon is a war-trained tame animal assigned to its caster. 08's tame brain drives it, and 25 adds no brain.
- A `summoned` species flag leaves no corpse and closes the animal commands.
- Fading is a death with cause `faded`, through 17, so every system's cleanup runs.
- Turning spawns faction `deep`, and 18 attaches `Hostile` on `SummonTurned`.

## Done

- 50 ± 15 turned in 1,000 castings of the deep shade. A turned shade is `deep`, and a squad of three in iron kills it.
- The first summoning answered gives its legend milestone, once.
- Summons fade at the day's end, at 0 hp and when the caster dies, with no corpse. They count toward `MAX_CREATURES`, and do not count as dwarves for morale, grief, the legend or burial. The animals panel does not list them.
