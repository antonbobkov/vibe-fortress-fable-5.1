# T-NEW — A held shooter waits behind its own line instead of finding a clear one

**Source:** [the held-shot arena](../../reports/audits/2026-11-04-t483-held-shot-arena.md) · **Size:** M · **Needs:** — · **Status:** open

The specification is [16 Combat](../02-systems/16-combat.md) § Ranged resolution (Held shot) and § Targeting (ranged kiting), and [25](../02-systems/25-runecraft.md) § Casting.

## What was found

Since the held-shot rule, a shooter whose ray to every hostile in range crosses one of its own waits where it stands. In the combat-pace ambush arena a Proficient marksdwarf in a ranged squad of its own, at the same station as three Novice soldiers, shoots **0.8** bolts a fight instead of 10.5, and kills 3 raiders in 24 fights instead of 35. It no longer hurts its squad (0 hits on its own side, against 60 for 856 damage), but it adds almost nothing: the squad loses 1.04 soldiers a fight against 0.88 with no marksdwarf. Nothing in 16 moves a held shooter to a tile with a clear line; it only steps away from melee threats (kiting).

## What to decide

Whether a held shooter on duty steps to a nearby legal tile that gives it a clear ray to its target or another hostile (as kiting picks a tile: first legal adjacent tile by index that keeps the keep distance and line of sight), or whether the player is told, in the military panel or a hint, that ranged squads need their own station, a fortification or an overlook. Measure the choice in the same ambush and open arenas, and confirm that hostile archers, which hold the same way, do not become much stronger or weaker.
