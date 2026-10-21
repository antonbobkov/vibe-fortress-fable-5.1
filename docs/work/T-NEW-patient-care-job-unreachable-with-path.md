# T-NEW — A patient-care job stays blocked with a path (p4-1, p4-2)

**Source:** T-381, [the raid-size measurement](../../reports/audits/2026-10-21-raid-sizes-and-renown.md) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Why

The T-381 raid probe (`reports/data/2026-10-21-raid-sizes.probe.ts.txt`, which journals the T-176 invariants instead of throwing) met `job.unreachable-with-path` at `a5cd51c` in two peril-4 seeds:

- `three-years-p4-1`, from tick 333,600 (day 278) to the end: job 7677 `water_patient` blocked `unreachable` for 1,785 ticks after a failed walk, its work tile adjacent to patient 251659059. This is the finding T-401 closed on 2026-10-20 (`ba93799`), back in the same seed later in its timeline.
- `three-years-p4-2`, from tick 48,000 (day 40) until the fortress died on day 67: job 1794 `feed_patient` blocked `unreachable` for 1,300 ticks with no failed walk (`failedWalk false`), work tile adjacent, patient 16777285.

`three_years_seeds.test.ts` asserts these invariants for perils 2 and 4, so both seeds fail the perf tier at `a5cd51c`.

## What to do

1. Rerun each seed to the finding with the raid probe (`T381_SEEDS=three-years-p4-2 T381_STOP_DAY=41`, about two minutes; `p4-1` to day 279, about eleven) and journal the job, its claims, its worker's walks and the patient's tile and state (carried, unconscious, in bed, in a shelter under the hearth alert).
2. Decide from the journal: a game fault (the job's reachability test, 17's patient jobs, or 11's blocking) gets a failing stepped test, the fix and the rule in 11 or 17; a checker fault gets the checker's unit test and the rule in testing-strategy.md. T-401's fix is the first place to look.

## Done

- Both seeds pass their daily invariant checks past the ticks above, or this file records why the job stays blocked and the checker allows it.
