# T-539 — Wolves that fight back hold the three-year script's hearth alert for weeks

**Source:** [T-538](../archive/tasks/T-538-aggressive-animal-flees-its-attacker.md) ([the deaths by killer](../../reports/data/2026-11-09-t538-wild-deaths.txt)) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-538 a struck wolf fights the squad instead of fleeing and leaving the map at the first swing. The sweep still passes (run 42661644014: pooled 19.5/7/0.25/918/146 alive/grown/hungry/living/deaths, against 20/7/0.25/982.5/132.75 before), but wolves now cost about nine more dwarves a sweep (114 wolf deaths over its 80 timelines against 78), and two seed jobs failed their own witnesses at shift 150. On `three-years-p2-6` the script raised the hearth alert for wolves 46 times between day 27 and day 70 (once in T-535's sweep): the wolves stayed near the gate, the alert kept the civilians below, and the dining hall was never built. `three-years-p2-5` ended with two dwarves and no gate walls, mostly to raids.

## What to do

Find why a three-soldier armed squad does not clear a wolf pack near the gate in days: whether the wolves flee at their 45% and come back, whether the soldiers go out one at a time, or whether new packs arrive. Then make the script answer wolves as a player would, for example lifting a wild-only alert after a while even with an armed squad (as T-387 does for an unarmed one), without making wolves weaker.

## Done

- The cause is named, the script's answer changed if it is the script, and the sweep's verdict passes with the seed witnesses green at the four shifts, or a dated report says why not.
