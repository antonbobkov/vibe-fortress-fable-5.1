# T-365 — Measure the work pace

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) (rank 2) · **Size:** M · **Needs:** — · **Status:** open

## Why

Every job time in the game is a base time divided by the skill factor `100 + SKILL_TIME_BONUS_PERCENT × level` (03, 11), times mood's productivity factor (15). The share of a dwarf's time spent working is measured (about 28% in year 1, `balance-status.md`), but not how much that work buys. The balance model's year-1 fortress digs about 400 tiles, builds 6 workshops, 10 bedrooms and a dining hall, and turns a 25-tile vein into six iron suits in about 100 minutes of a smith's work; all of it, and `SKILL_TIME_BONUS_PERCENT`, `DIG_BASE_TICKS`, `BUILD_BASE_TICKS`, the other base times and the productivity factors, are marked *unmeasured*.

## What to do

1. From the three-year economy fixture's first year (seed `three-years`, default priorities, its own wild animals), count the work done: tiles dug, smoothed and engraved, buildings and furniture built, workshop jobs completed by kind, and the skill levels of the workers as the year goes; and the ticks of each job against its spec time at the worker's level.
2. In a stepped fixture, time a novice and a Proficient miner on a 3×3 room in granite and a ten-tile corridor, and a smelter and smith through `balance.md` § Mining and metal, to check the arithmetic in the game, walking included.
3. Compare with `balance.md` § Time and pace and § Mining and metal. Write the report, add a `balance-status.md` row, and replace the marks the measurement covers.

## What would change the number

If the year-1 fortress digs and builds well under the model (say under 70% of 400 tiles and 6 workshops) while its dwarves work their measured share, the base times or the skill bonus are too slow for the pace the vision describes; if the work runs out, as the fixture's years 2–3 already suggest, they may be too fast. Either is a tune of its own task; the measurement first says which.

## Done

- The report exists; the marks of the work-pace constants and of § Time and pace and § Mining and metal are replaced by it or kept with the measured figure beside them; `balance-status.md` has a work-pace row.
