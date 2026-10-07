# T-112 — Two tests that fail under load

**Source:** agent reports during U-03, U-04/U-05, U-06 and T-101 (2026-10-05 and 2026-10-06), each run on a machine shared with another agent's test runs · **Size:** S · **Needs:** — · **Status:** open

**Closed:** implemented by commit `1de5f41` and the closing commit on branch `t-112`.

## Why

Two tests have failed intermittently when the machine was busy, and passed when rerun alone. Nobody found the cause, and a test that fails by timing hides real failures.

- `test/unit/save-game.test.ts` › "F5 saves, F9 asks and restores the saved hash". It failed with a hash mismatch inside a 2,000 ms `vi.waitFor`. It was seen at least three times across three different branches, including an unchanged baseline.
- `test/e2e/farm-plot-and-orders.spec.ts`, around line 327. It failed once in four full runs with `masonry: child_labor`.

## What to do

1. Reproduce each under load. Run the full suite in two worktrees at once, or throttle the CPU.
2. Find the cause. For the save test, look for a wait on wall-clock time where the test should wait on the save or load completing. For the e2e spec, find why a child is picked for a masonry job only sometimes: a race in setup, or a real rule being hit.
3. Fix the test so it waits on the event it depends on. If the cause is a real defect in the game, fix the defect, with a regression test.
4. Do not raise a timeout as the fix.

## Done

- Each test passes 20 runs in a row under load.
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green.
