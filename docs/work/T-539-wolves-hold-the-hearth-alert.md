# T-539 — Wolves that fight back hold the three-year script's hearth alert for weeks

**Source:** [T-538](../archive/tasks/T-538-aggressive-animal-flees-its-attacker.md) ([the deaths by killer](../../reports/data/2026-11-09-t538-wild-deaths.txt)) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-538 a struck wolf fights the squad instead of fleeing and leaving the map at the first swing. The sweep still passes (run 42661644014: pooled 19.5/7/0.25/918/146 alive/grown/hungry/living/deaths, against 20/7/0.25/982.5/132.75 before), but wolves now cost about nine more dwarves a sweep (114 wolf deaths over its 80 timelines against 78), and two seed jobs failed their own witnesses at shift 150. On `three-years-p2-6` the script raised the hearth alert for wolves 46 times between day 27 and day 70 (once in T-535's sweep): the wolves stayed near the gate, the alert kept the civilians below, and the dining hall was never built. `three-years-p2-5` ended with two dwarves and no gate walls, mostly to raids.

## What to do

Find why a three-soldier armed squad does not clear a wolf pack near the gate in days: whether the wolves flee at their 45% and come back, whether the soldiers go out one at a time, or whether new packs arrive. Then make the script answer wolves as a player would, for example lifting a wild-only alert after a while even with an armed squad (as T-387 does for an unarmed one), without making wolves weaker.

## Done

- The cause is named, the script's answer changed if it is the script, and the sweep's verdict passes with the seed witnesses green at the four shifts, or a dated report says why not.

## Outcome

The cause was the script, not a rule: soldiers sent at once fought the pack one at a time (three dead on p2-6 at shift 150, one unarmed), and an unarmed squad's short wolf alerts each ended before T-387's half day, so it never applied. The script now counts the half day over an episode of alerts, musters an armed squad before a hunt and leaves its unarmed members behind, shelters from an aggressive animal instead of hunting it, and answers at once an animal attacking a dwarf, quiet day or not. Sweep run 42782003867 passes (pooled 19.75/7/0.25/936.75/150.75) with the seed witnesses green at the four shifts; deaths to wild animals fell from 162 to 131 over its 80 timelines, but pooled deaths did not return to 132.75 ([the report](../../reports/audits/2026-11-10-t539-wolves-and-the-hearth-alert.md)).
