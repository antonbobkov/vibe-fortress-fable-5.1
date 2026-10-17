# T-353 — Ten bolts lie inside a wall tile (peril 4 sweep seed)

**Closed:** 2026-10-17, in 2344a14.

**Source:** the T-331 review run of `test/perf/three_years_seeds.test.ts` (peril 2 and 4), 2026-10-16; the invariant is `item.inside-wall` of the T-176 checker (the shape of [T-216](T-216-three-years-log-inside-a-wall.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

Seed `three-years-p4-5` fails the sweep's daily invariant check at tick 372,000 (day 310 of year 3): ten `bolt` items (ids 150995072, 150995110, 83887498, 83887499 and six more) lie at (18, 41, 31), a wall tile, with `flags 0`: they belong to nobody and no hauler can reach them. Bolts are ranged ammunition that falls where a shot lands (16 § Ranged attacks); a shot that ends in a tile that has meanwhile become wall (a dig refilled, a construction, a cave-in) leaves the ammunition inside it.

## What to do

**Decisions.**
- Ammunition that lands on a tile that is not open is placed on the nearest open tile to it on the same level, as T-216 decided for a felled log.

1. Find which shot or drop placed the bolts: trace the seed to tick 372,000 and look for the `Ammo`/`ItemDropped` events at (18, 41, 31).
2. Write the failing stepped test first, then fix; amend 16 § Ranged attacks if it does not say where ammunition lands.

## Done

- The seed passes its daily invariant check past day 310, or the work file records the measured reason.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
