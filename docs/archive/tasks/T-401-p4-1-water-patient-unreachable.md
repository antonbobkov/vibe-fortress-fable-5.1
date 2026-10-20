# T-401 — A water_patient job stays blocked with a path (p4-1)

**Closed:** 2026-10-20, in ba93799.

**Source:** T-400's after-sweep, 2026-10-18 at `6af2414` ([audit](../../../reports/audits/2026-10-18-hostiles-open-doors.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

`three-years-p4-1` stops at tick 228,000 on the T-176 invariant `job.unreachable-with-path`: job 5224, `water_patient` for patient 318767710, blocked `unreachable` for 1,930 ticks after a failed walk, with its work tile beside the patient. The seed passed its three years at `06ba90b`, before the doors fix; the fix moved its timeline.

## What to do

1. Rerun `p4-1` to the finding (`test/perf/t389-party-probe.test.ts`-style probe, `T389_SEED=three-years-p4-1 T389_PERIL=4`, about six minutes) and journal the job, its worker's walks and the patient's tile.
2. A game fault: a failing stepped test, the fix, the rule in 11 or 17. A checker fault: the checker's unit test and testing-strategy.md.

## Done

- `p4-1` passes its daily checks past tick 228,000, or this file records why the job stays blocked.
