# T-392 — Haul jobs to the trade depot stay blocked after a failed walk on seed p4-1

**Closed:** 2026-10-18, in 86786d8.

**Source:** T-370 (2026-10-18): the peril-4 sweep seed `three-years-p4-1` stops on `job.unreachable-with-path` at tick 212,400 (day 177): jobs 2214, 2215, 2216 (`haul_to_depot`, targets 16777602 to 16777604, work tile 73982) blocked `unreachable` for about 1,870 ticks with `failedWalk true` while the depot tile is in the label of a worker with the labor. The same finding at the same tick on `master` without T-370 and T-382 (checked after the T-383 merge). The seed played all 403,200 ticks with the code of T-385/T-386, so a later change (T-388's retry rule, T-383's search, or the timeline they moved) brought the run here · **Size:** M · **Needs:** — · **Status:** open

## Why

A real walk failure (the pathfinder found no route, so `failedWalk` is set and only a reachability trigger clears it) while the labels connect the worker and the work tile: the same class as T-385 with another cause. Candidates: the depot's work tile is reachable by label but not by a walk (a drawbridge raised, a door locked by an alert, a forbidden or restricted tile on the only approach, a caravan's wagon on the tile); no trigger fires when the obstacle goes (a drawbridge lever, a traffic setting).

## What to do

1. Diagnosis first: rerun the seed to tick 212,400 with a probe from 3,000 ticks before the block (the same probe as T-385: job state, `failedWalk`, the workers' tiles and labels, the events `BuildingStateChanged` and `TilesChanged`, the alert, the door and bridge states, what stands on tile 73982 and its neighbours).
2. Name the cause: a trigger that is missing for an obstacle that clears (add it to 11's list), a walk that fails for a reason the labels do not model (say so in 22 and make the check agree), or a checker fault (testing-strategy.md).
3. A failing stepped test with the same shape first, the fix, the spec section; the seed passes its daily checks past the tick.

## Done

- `p4-1` plays past tick 212,400 with no `job.unreachable-with-path`; gates as for a behaviour change.
