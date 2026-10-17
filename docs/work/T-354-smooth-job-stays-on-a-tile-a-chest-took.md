# T-354 — A smoothing job stays blocked as unreachable on a floor tile where a chest has been built

**Source:** the T-331 review run of `test/perf/three_years_seeds.test.ts` (peril 2 and 4), 2026-10-16; the invariant is `job.unreachable-anchor-beside` (T-331 check 2: a job blocked unreachable for over a day, no stand tile can be stood on, a tile beside its anchor is reachable) · **Size:** S · **Needs:** — · **Status:** open

## Why

Seeds `three-years-p2-2` (tick 32,400, job 1021, tile 60,754 = (34,17,26)) and `three-years-p4-1` (tick 37,200, job 1173, tile 60,608 = (32,14,26)) and `three-years-p4-3` (tick 42,000, job 1257, tile 60,850) each hold a `smooth` job (workTile `at`, designation 7) for a floor tile of a hospital zone. A built `chest` (the hospital's) now stands on the tile, so nobody can stand on it; the job stays `blocked: unreachable` for good although the floor around it is open. It is the shape of T-301 (the only stand tile cannot be stood on), here caused by a building built over a designated tile after the designation.

## What to do

**Decisions.**
- A floor-smoothing or engraving designation on a tile where a building (that blocks walking) has been built is dropped with the job, as a designation on a tile that is no longer a floor is. 03 owns the designation; 14 emits `BuildingCompleted`.

1. Write the failing stepped test first: designate smoothing on a floor tile, build a chest on it, step a day: the job and the designation are gone.
2. Fix in the terrain producer (or the designation sweep it runs on `BuildingCompleted`/`TilesChanged`) and amend 03 § Designations and 14 § Placement.
3. The sweep seeds above no longer report `job.unreachable-anchor-beside`.

## Done

- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
