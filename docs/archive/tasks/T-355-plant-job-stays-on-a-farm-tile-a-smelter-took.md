# T-355 — A planting job stays blocked as unreachable on a farm plot tile where a smelter stands

**Closed:** 2026-10-16, in aad95d5.

**Source:** the T-331 review run of `test/perf/three_years_seeds.test.ts` (peril 2 and 4), 2026-10-16; the invariant is `job.unreachable-anchor-beside` (T-331 check 2) · **Size:** S · **Needs:** — · **Status:** open

## Why

Seed `three-years-p4-6`, tick 40,800: `plant` job 1329 (`plant:74743`, workTile `at`, zone 16777350 a `farm_plot`, tile (7,21,32)) has been `blocked: unreachable` since tick 39,500. A built `smelter` (building 16777332, footprint including that tile) stands on the plot's tile. The plant producer keeps a job for a tile that nobody can stand on, so it never completes and never goes away, while the open tiles around it are reachable.

## What to do

**Decisions.**
- A farm plot tile that a building covers is not plantable: the plants producer creates no planting job for it and cancels one that exists (a crop never grows under a building).

1. Write the failing stepped test first: a farm plot whose tile is then covered by a workshop: no `plant` job for that tile after the next producer run.
2. Fix in the plants producer; amend 09 § Farming (what makes a plot tile plantable).
3. The sweep seed above no longer reports `job.unreachable-anchor-beside`.

## Done

- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
