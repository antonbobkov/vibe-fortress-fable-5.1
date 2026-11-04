# T-NEW — Re-measure the raid arenas now that archers hold their shots

**Source:** [the held-shot arena](../../reports/audits/2026-11-04-t483-held-shot-arena.md) · **Size:** M · **Needs:** — · **Status:** open

The specification is [16 Combat](../02-systems/16-combat.md) § Ranged resolution (Held shot); the figures are in [`balance-status.md`](../balance-status.md).

## What was found

Before the held shot, a raid's archers shot through their own warriors. In the combat-pace raid of ten in the open they hit their own party 116 times for 1,229 damage in 24 fights. Now they hold, and the plain raid loses **1.50** of its 11 instead of **3.42**. Every balance row that measures a raid of ten or an ambush with archers was filed before this: Combat pace (raid of ten in the open, `bd80aaa`), Warded squad (`83f5f311`), Enchanted squad (`5d1681b4`) and Squad draughts (`8e585308`). Their figures may have moved, most likely against the squad. The scripted fortresses (`defence_year`, the three-year and twenty-seed runs) also meet raids with archers.

## What to do

Re-run the arenas of those four rows on master with the held shot, write a dated report, and overwrite the rows. Run the twenty-seed survival sweep once, against its current reference, and say whether the held shot moves it. No rule change is decided here; a figure that misses its model becomes its own row.
