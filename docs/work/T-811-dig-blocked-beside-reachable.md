# T-811 — A dig job blocked as unreachable beside a reachable tile

**Source:** T-798's sweep (run 45928227287, seed `three-years-p2-4`, shift 150, commit `84dfbe37`) · **Size:** S · **Needs:** — · **Status:** open

## Why

The sweep's seed job failed its own invariant: `job.unreachable-anchor-beside (dig) from tick 386400: job 14160 dig blocked unreachable for 1900 ticks (failedWalk false, workTile adjacent), target tile 61110` (`test/scenarios/invariants.ts`). A dig job stood blocked `unreachable` for 1,900 ticks while a tile beside its anchor was reachable, and no walk had failed. The verdict passed and the other 79 seed runs held the invariant; the change on the branch touched only trade and the UI, so this is a jobs or pathing state the new timeline reached, not a trade rule. The seed's log and result file are in the run's `seed-p2-4-shift-150` artifact (kept 14 days).

## What to do

- Replay the seed at shift 150 to tick 386400 (`test/perf/three_years_seeds.test.ts`), find why the job's retry does not see the reachable stand tile (11 § Blocked jobs, the unreachable retry; 22's labels after the tile changes), and fix it.
- A unit test that reproduces the state in a small world.

## Done

- [ ] The cause found and fixed; a test.
- [ ] 11 or 22 updated if a rule changes.
