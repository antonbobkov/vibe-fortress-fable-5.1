# T-407 — Items left nowhere after a raid leaves (p4-4)

**Closed:** 2026-10-21, in 7dbada9.

**Source:** T-381, [the raid-size measurement](../../../reports/audits/2026-10-21-raid-sizes-and-renown.md) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Why

The T-381 raid probe (`reports/data/2026-10-21-raid-sizes.probe.ts.txt`, which journals the T-176 invariants instead of throwing) met `item.nowhere` at `a5cd51c` in `three-years-p4-4`: from the daily check at tick 261,600 (day 218) to day 258, item 385876811 (a cap) and item 218105102 (a club), both with flags 256, had no position, container, carrier or wearer. The check came 918 ticks after a raid of 21 (party 352323169) ended `looted` and left. T-302 (closed 2026-10-16) fixed items with no place at perils 2 and 4; this is the same invariant after a looting party's exit.

`three_years_seeds.test.ts` asserts the invariant for perils 2 and 4, so the seed fails the perf tier at `a5cd51c`.

## What to do

1. Rerun `three-years-p4-4` to day 219 with the raid probe (`T381_SEEDS=three-years-p4-4 T381_STOP_DAY=219`, about nine minutes), journalling each item the raid picked up, who carried it, and what 13 and 18 did to it when its carrier left the map or died.
2. A game fault gets a failing stepped test, the fix and the rule in 13 or 18 (what happens to loot and kit when a party member leaves or is removed); a checker fault gets the checker's unit test.

## Done

- `p4-4` passes its daily invariant checks past day 218, or this file records why the item is legitimately nowhere and the checker allows it.
