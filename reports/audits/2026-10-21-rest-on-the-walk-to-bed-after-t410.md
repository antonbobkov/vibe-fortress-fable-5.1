# Measurement: rest on the walk to bed after T-410 (T-408, still parked)

**Task:** T-408 · **Date:** 2026-10-21 · **Commit examined:** `510eacf` (T-404 and T-410) with the T-408 change applied (branch `t408-wip2`, `1c2e351`) · **Kind:** re-measurement of a parked change · **Source:** [rest on the walk to bed](2026-10-21-rest-on-the-walk-to-bed.md), [the hearth hold](2026-10-21-instrument-hearth-hold.md)

## The answer

- **With the alert held at most three days, nobody starves any more.** The annual instrument with T-408's rule (rest held on the walk to bed, `REST_ASLEEP_PER_HOUR` −45) on top of T-410: no extinction and no hunger or thirst death (against 1 and 10 under the old policy); the longest hearth alert is 4,100 ticks.
- **The sum of the living rises; the median falls half a dwarf below its bound.** Before (`510eacf`, the T-410 row): median 12.5, worst 2, second-worst 8, sum 139, 7 of 12 years without a wildlife dwarf death. After: median **11.5**, worst **5**, second-worst **11**, sum **143**, **6** of 12, 0 extinct, 0 hunger deaths. The median bound (12) fails, so by testing-strategy.md § Annual wildlife survival the change is blocked; every other bound holds and the sum, the worst and the second-worst improve.
- **Per seed** (forest 1–4, taiga 1–4, grassland 1–4): before `12, 13, 12, 10, 13, 8, 2, 11, 15, 14, 15, 14`; after `11, 11, 12, 5, 13, 11, 11, 11, 15, 14, 15, 14`. Forest 4 falls by five (eight wolf, bear and badger deaths, no starvation) and taiga 3 rises by nine: both unstable seeds of the record.
- The change stays parked on `t408-wip2`; whether to accept it against the median bound is the owner's call. The work-share figures of [the first measurement](2026-10-21-rest-on-the-walk-to-bed.md) (year 1 35.9%, sleep in use 8.3%) were taken without T-404's clotting change and were not re-run.

Data: `reports/data/2026-10-21-t408-on-t410-wildlife.json`.
