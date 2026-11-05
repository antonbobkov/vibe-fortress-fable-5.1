# T-498 — A careful shooter waits behind its own line instead of finding a clear one

**Source:** [the careless-shooter arena](../../reports/audits/2026-11-04-t483-careless-shooter-arena.md), [the held-shot arena](../../reports/audits/2026-11-04-t483-held-shot-arena.md) · **Size:** M · **Needs:** — · **Status:** open

The specification is [16 Combat](../02-systems/16-combat.md) § Ranged resolution (Held shot) and § Targeting (ranged kiting), and [25](../02-systems/25-runecraft.md) § Casting.

## What was found

A shooter whose ray to every hostile in range crosses one of its own holds, unless it is careless this time; from Proficient (`CARELESS_SAFE_SKILL`) it is never careless, so it waits where it stands. In the combat-pace ambush arena a Proficient marksdwarf in a ranged squad of its own, at the same station as three Novice soldiers, shoots **0.8** bolts a fight (10.5 before any held shot) and kills 4 raiders in 24 fights (35 before). It no longer hurts its squad, but it adds almost nothing: the squad loses 1.04 soldiers a fight against 0.88 with no marksdwarf. A Novice marksdwarf at the same post shoots 7.3 bolts a fight, mostly by carelessness, and hits its own side 26 times (squad loses 1.46). So the better the shooter, the less it does behind a melee line. Nothing in 16 moves a held shooter to a tile with a clear line; it only steps away from melee threats (kiting).

## What to decide

Whether a careful shooter on duty steps to a nearby legal tile that gives it a clear ray to its target or another hostile (as kiting picks a tile: first legal adjacent tile by index that keeps the keep distance and line of sight), or whether the player is told, in the military panel or a hint, that ranged squads need their own station, a fortification or an overlook. Measure the choice in the same ambush and open arenas at Novice and Proficient, and confirm that hostile archers, which weigh their shots the same way, do not become much stronger or weaker.
