# T-811 — A dig job blocked as unreachable beside a reachable tile

**Source:** T-798's sweep (run 45928227287, seed `three-years-p2-4`, shift 150, commit `84dfbe37`) · **Size:** S · **Needs:** — · **Status:** open

## Why

The sweep's seed job failed its own invariant: `job.unreachable-anchor-beside (dig) from tick 386400: job 14160 dig blocked unreachable for 1900 ticks (failedWalk false, workTile adjacent), target tile 61110` (`test/scenarios/invariants.ts`). A dig job stood blocked `unreachable` for 1,900 ticks while a tile beside its anchor was reachable, and no walk had failed. The verdict passed and the other 79 seed runs held the invariant; the change on the branch touched only trade and the UI, so this is a jobs or pathing state the new timeline reached, not a trade rule. The seed's log and result file are in the run's `seed-p2-4-shift-150` artifact (kept 14 days).

## What to do

- Replay the seed at shift 150 to tick 386400 (`test/perf/three_years_seeds.test.ts`), find why the job's retry does not see the reachable stand tile (11 § Blocked jobs, the unreachable retry; 22's labels after the tile changes), and fix it.
- A unit test that reproduces the state in a small world.

## What was found

Replayed at `84dfbe37`, shift 150, the finding came again at tick 386400 (the probe saved the game there). The dig at (6,25,z26) was designated on day 321 (tick 384000) and blocked `unreachable` the same tick. Its one stand tile, (6,24,z26), is a dug dead end south of a grown work-hall site (6..8, 21..23, T-642) whose four corners the script forbids (T-451). The tile was cut diagonally from the site's edge at (7,23); a walker cannot go back that way past the wall corner at (7,24), so its only way in is the forbidden corner (6,23). The labels (22) know the terrain only and join it to every dwarf (label 98); the board's pocket of the forbidden set (T-530) puts it in pocket 1 and every dwarf in pocket 0, so `hasReachableStand` and the retry's `openProblem` say no worker reaches it, as 11 § The job record says. The job is right to wait: it is a player's forbid that shuts it off, and the retry reopens it once the corner is lifted.

The fault was the invariant's: its "a tile beside the anchor is passable and reachable" (`test/scenarios/invariants.ts`, the anchor branch) compared labels alone, without the pocket that the board and its own "path" branch read.

## Decisions

- The invariant joins a tile beside the anchor to a worker as the board does, by label and pocket. A dig whose only stand tile lies in a pocket that only forbidden traffic opens waits for the player, as a forbidden stand tile already did (T-489). No game rule changes; 11 already says it. `testing-strategy.md` § the scenario invariants says it for invariant (2).
- The script's forbidden corner sealing a dig of its own is a player choice the game honours; it is left as it is (it cost this seed one dig at the end of year 3). No follow-up.
- No sweep: the change is in the test harness only and moves no timeline.

## Done

- [x] The cause found and fixed; a test (`test/unit/jobs/t811-dig-behind-forbidden-tile.test.ts`, which fails on the old invariant).
- [x] 11 or 22 updated if a rule changes: no rule changes; `testing-strategy.md` updated.
