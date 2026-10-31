# T-NEW — A natural slope of several steps loses ramps by scan order

**Source:** T-449, [the drink reach](../../reports/audits/2026-10-30-drink-reach.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

`stageRamps` (03 stage 9) scans columns in ascending order. It makes a floor a ramp only when the neighbour one level up is still a `floor`. If that neighbour has already become a ramp, because it leans on the next step up, the lower floor stays a floor. 22's ramp edge starts from a ramp, so that step cannot be walked up.

So a slope of two or more steps climbing north or west, against the scan, can have steps that cannot be walked up. This contradicts 03's "every one-level step of the surface can be walked". The drinking steps have their own exception for this. Natural ground does not.

## What was measured

T-449 first made the fix for all ground, then took it back to the drinking steps, because it failed the annual instrument:

| | Median/worst/second-worst/sum/wildlife-free/extinct/need deaths | Forest / taiga / grassland sum |
|---|---|---|
| Reference | 11.5/5/5/130/5/0/0 | 45 / 27 / 58 |
| Ramps fixed on all ground | 12.5/0/8/135/7/1/12 | 42 / 35 / 58 |

- The sum of the living rises by 5 and wildlife-free years rise by 2, but `wildlife-taiga-1` dies out. It has 12 starvation deaths on days 108 to 112 and one killed on day 64.
- Its setup that run: cave depth 1, 27 cave tiles, plots of 1 and 8 tiles.
- Why it starves was not traced. The living per seed that run were `9, 12, 13, 8, 0, 11, 13, 11, 15, 14, 15, 14`.

The fix also moves the golden local map `test-1|603`.

## What to do

1. Count the unwalkable steps of natural slopes on real maps, using the game's pathing, to confirm the size of the fault.
2. Fix `stageRamps` for all ground: accept a neighbour that is `floor` or `ramp`.
3. Trace `wildlife-taiga-1`'s starvation with that fix. Decide whether it is the fixture's script or the game, and fix the one at fault.

## Done

- The rule in 03 stage 9 has no exception for drinking steps, with a stepped test of a slope climbing north and west.
- The instrument passes by the T-308 rule, with the golden moved and explained.
