# Measurement: beds in a narrow rest band, with thoughts

**Task:** T-572 · **Date:** 2026-11-15 · **Kind:** measurement of a rule change (the floor rests at `FLOOR_REST_PERCENT` 85, a pallet 90, a stone bed 95, a wooden bed 100, a made-up bed 110; the wooden bed takes a pallet's materials beside its log) · **Source:** [the T-551 sleep audit](2026-11-14-beds-rest.md), the owner's decision of 2026-11-15

## What was run

The T-551 method unchanged: `test/perf/sleep_audit.test.ts` through `measure.yml -f suite=sleep_audit`, the first 112 days of the three-year economy fixture at peril 0, seeds `three-years`, `three-years-p0-2`, `three-years-p0-3`, played as `three_years_seeds` plays them, plain and with dressed beds. The probe now also counts the wooden beds made, by recipe, and the day of the first.

Figures to follow from the run.
