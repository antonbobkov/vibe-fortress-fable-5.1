# T-499 — Re-measure the raid arenas now that archers weigh their shots

**Source:** [the careless-shooter arena](../../reports/audits/2026-11-04-t483-careless-shooter-arena.md), [the held-shot arena](../../reports/audits/2026-11-04-t483-held-shot-arena.md) · **Size:** M · **Needs:** — · **Status:** open

The specification is [16 Combat](../02-systems/16-combat.md) § Ranged resolution (Held shot); the figures are in [`balance-status.md`](../balance-status.md).

## What was found

Before the held shot, a raid's archers shot through their own warriors every time. In the combat-pace raid of ten in the open they hit their own party 116 times for 1,229 damage in 24 fights, and the plain raid lost **3.42** of its 11. Now an archer with one of its own on the line holds unless it is careless this time; at peril 2 (skill 6) that is one weighing in five. The same arena now gives 34 hits for 359 on their own party in 18 fights, and the raid loses **2.17** of its 11. Every balance row that measures a raid of ten or an ambush with archers was filed before this: Combat pace (raid of ten in the open, `bd80aaa`), Warded squad (`83f5f311`), Enchanted squad (`5d1681b4`) and Squad draughts (`8e585308`). Their figures may have moved, most likely against the squad. The twenty-seed file was run with the rule (careless-shooter arena report); `defence_year` and the other scripted fortresses were not re-measured.

## What to do

Re-run the arenas of those four rows on master, write a dated report, and overwrite the rows. No rule change is decided here; a figure that misses its model becomes its own row.
