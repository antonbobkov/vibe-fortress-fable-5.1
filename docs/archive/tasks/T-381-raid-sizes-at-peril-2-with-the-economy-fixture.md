# T-381 — Measure raid sizes at peril 2 with the economy fixture

**Closed:** 2026-10-21, in 24aa62d.

**Source:** B-010, re-filed by T-145's peril-0 sweep, [the report](../../../reports/audits/2026-10-17-t145-peril-0-sweep.md) · **Size:** M · **Needs:** T-352, T-353, T-363 · **Status:** open

## Why

`balance.md` § Wealth curve expects a raid of about 10 in year 2 and about 15 in year 3 at peril 2. The last living observations (2026-10-04) were 8–9 in year 2 and none in year 3, because the peril-2 fortresses died or the sweep stopped on invariant findings. Since T-145 the fixture defends itself at default priorities; the peril-2 seeds still stop on findings (T-352, T-353, T-363) before year 3.

## What to do

1. Once the three needed tasks are closed, run the peril-2 seeds of `test/perf/three_years_seeds.test.ts` once (`-t "p2-"`), alone.
2. Read every raid's size and day against the model; write a dated report and update `balance-status.md`.

## Done

- Year-2 and year-3 raid sizes are measured on living peril-2 fortresses, and the verdict (inside 30% of the model, or a model or schedule change filed) is in `balance-status.md`.

## Progress, 2026-10-17

The peril-2/4 sweep was rerun once, alone, at `3b75d98` (T-351 to T-356 and T-363 in): [data](../../../reports/data/2026-10-17-t381-peril-2-4-sweep.json). Nine seeds pass; four stop on a new T-176 finding (T-385-craft-job-unreachable-with-path: `p2-1` day 288, `p2-7` day 280; T-386-wild-animal-on-impassable-floor: `p2-2` day 66, `p4-1` day 256). The two peril-2 seeds that lived longest are the two that stopped, so their raids are not in the output.

Not measurable yet. The four peril-2 seeds that pass all die out (`p2-6` day 104, `p2-4` day 139, `p2-5` day 157, `p2-3` day 236; T-387-peril-2-fortresses-die-out). Raids on a living peril-2 fortress: year 2, 8 (`p2-3` day 120), 9 (`p2-4` day 122) and 7 (`p2-5` day 122), against the model's 11; year 3, 7 (`p2-3` day 225, eleven days before it died), against 15. Raids after a fortress has died (`p2-6` day 133: 7; days 225–246: 6 or 7) are not counted. For comparison, peril 4 sends raids of 11–24 and sieges of 19–30 in years 2–3, and three of its five seeds that pass are alive at the end (`p4-2` 46 dwarves, `p4-3` 37, `p4-6` 10).

Next: rerun `-t "p2-"` once the two invariant findings are fixed, and read the raids of `p2-1` and `p2-7`, which reach year 3 alive.
