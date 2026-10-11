# T-221 — The browser year gives a different year on every run of the same code

**Source:** T-212 and [`2026-10-11-full-year-with-t212.md`](../../reports/audits/2026-10-11-full-year-with-t212.md) · **Size:** S · **Needs:** — · **Status:** open; local side; decided 2026-10-11, see Decision

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

## Decision (2026-10-11, local orchestrator, under the owner's standing instruction to use judgement; the owner was told and may overrule)

1. **Determinism first.** The playthrough gives all its UI commands with the clock paused (a command given while paused applies at once, U-02), and advances time only by `step`. The check that a day runs through the real frame loop at 4× moves out of this spec into a short spec of its own that asserts the calendar advances and nothing else, so that real time can no longer change the year.
2. **Then prove it:** the spec's end state (living dwarves, deaths, stocks, world hash) is equal across five consecutive runs of the same commit. Record the five in the commit body.
3. **Then remove the conditional `test.fixme`** at the survival check. A dead or halved fortress must fail the suite. T-212 has landed, so the reason for the guard is gone.
4. **What the spec asserts about survival:** no dwarf starves or dies of thirst all year; at least 11 of the fortress's dwarves are alive on the last day; and every death is listed with its cause in the output. If the one deterministic year has a death to wildlife, the playthrough answers as a player would (the alert, haulers kept in, the squad sent) through the UI; if a dwarf still dies with that response, the death stays in the output and the count assertion stands at 11.

One run of this spec was never a measurement while it varied; treat earlier "24 passed" results accordingly.
