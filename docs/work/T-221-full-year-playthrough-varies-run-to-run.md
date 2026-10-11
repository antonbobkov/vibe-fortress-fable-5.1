# T-221 — The browser year gives a different year on every run of the same code

**Source:** T-212 and [`2026-10-11-full-year-with-t212.md`](../../reports/audits/2026-10-11-full-year-with-t212.md) · **Size:** S · **Needs:** — · **Status:** open; local side (the spec is T-150's)

## Why

`test/e2e/full-year.spec.ts` sets the speed to 4× through the UI and places its workshops and work orders while the frame loop runs, so its commands land on different ticks from run to run. Ten runs of the same commit (`cloud/main` at `61c95c1`) ended with 7, 2, 3, 10, 0, 0, 7, 11, 10 and 12 living dwarves, and twelve runs of `cloud/T-212` with between 1 and 12. Wild arrivals differ in every run. The pass condition (`livingCount > 7`) fails in 6 of 10 runs on `cloud/main`, and its `test.fixme` turns those failures into skips. A single run therefore cannot compare two versions of the game, and the gate's balance rows from it are one sample of a wide distribution.

## Reproduction

Run `CI=1 npx playwright test full-year.spec.ts` several times on one commit and compare the printed `full-year end state` and `T-192 full-year wildlife` lines. The per-run data of the report: [`2026-10-11-full-year-repeat-runs.json`](../../reports/data/2026-10-11-full-year-repeat-runs.json).

## What the spec says

`process/testing-strategy.md` § E2E harness (`full-year` plays a scripted first year at 4× and asserts the `year_one` rule rows); `process/agent-workflow.md` § Working ("Determinism always").

## What to do

Make the year deterministic for a given commit: pause the clock while the UI commands are given, or drive the first day by `step` after the commands, so the same commit gives the same end state. Then decide what the spec asserts about survival with wildlife (the `fixme` at `livingCount <= 7`).

## Done

- Two runs of the spec on one commit print the same end state.
- The survival check is a rule-based assertion or a reported row, not a skip.
