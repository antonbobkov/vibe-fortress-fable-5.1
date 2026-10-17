# T-381 — Measure raid sizes at peril 2 with the economy fixture

**Source:** B-010, re-filed by T-145's peril-0 sweep, [the report](../../reports/audits/2026-10-17-t145-peril-0-sweep.md) · **Size:** M · **Needs:** T-352, T-353, T-363 · **Status:** open

## Why

`balance.md` § Wealth curve expects a raid of about 10 in year 2 and about 15 in year 3 at peril 2. The last living observations (2026-10-04) were 8–9 in year 2 and none in year 3, because the peril-2 fortresses died or the sweep stopped on invariant findings. Since T-145 the fixture defends itself at default priorities; the peril-2 seeds still stop on findings (T-352, T-353, T-363) before year 3.

## What to do

1. Once the three needed tasks are closed, run the peril-2 seeds of `test/perf/three_years_seeds.test.ts` once (`-t "p2-"`), alone.
2. Read every raid's size and day against the model; write a dated report and update `balance-status.md`.

## Done

- Year-2 and year-3 raid sizes are measured on living peril-2 fortresses, and the verdict (inside 30% of the model, or a model or schedule change filed) is in `balance-status.md`.
