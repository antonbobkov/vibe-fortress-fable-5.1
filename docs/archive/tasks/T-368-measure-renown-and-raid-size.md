# T-368 — Measure renown and raid size

**Closed:** 2026-10-21, in 24aa62d.

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) (rank 5) · **Size:** M · **Needs:** — · **Status:** open

## Why

`RENOWN_WEALTH_DIVISOR` (2,000 marks a point) and `RENOWN_POP_WEIGHT` (0.2 a dwarf) turn wealth and population into renown (18), and `threat-schedules.md` turns renown into the size of every raid, siege and ambush from year 2 at perils 1 to 4. All of it is marked *unmeasured*, and so are the balance model's renown curve (5 → 15 → 30 → 75) and its raid sizes at peril 2 (10 in year 2, 15 in year 3). Wealth and population are measured (`balance-status.md`), so renown can be computed for a measured fortress; the raids it brings have never been seen on a fortress that lived, because every peril 2 and 4 run of the economy sweep stopped on a game fault (T-302 to T-304, since fixed) and the sweeps have not been run again.

## What to do

1. From the data of the three-year economy fixture at peril 0 (the main seed and the sweep), compute the renown each fortress would have at each season and the raid and ambush sizes that peril 2 and peril 4 would send it. Compare with `balance.md` § Wealth curve.
2. Run the peril 2 and 4 sweeps of the economy fixture (`three-years-p2-1..7`, `three-years-p4-1..6`) and record every encounter: the day, the kind, renown at the roll, the party size and its composition, the warning, and the outcome. Note whether the first raid comes after a gate could be built (§ Year-one expectation, day 56).
3. Write the report, add `balance-status.md` rows (renown by year, raid size by year at peril 2), and replace the marks the measurement covers.

## What would change the number

If the measured fortresses reach renown far from 15 and 30 in years 2 and 3 (wealth is already outside its range), raid sizes miss 10 and 15 whatever the schedule says; then either the renown weights or the schedule's `perRenown` move, with the combat measurement (T-366) saying what size a prepared fortress can meet. The tune is its own task.

## Done

- The report exists; the renown constants, the threat schedule and § Wealth curve's renown and raid figures carry it instead of the mark; `balance-status.md` has renown and raid-size rows.
