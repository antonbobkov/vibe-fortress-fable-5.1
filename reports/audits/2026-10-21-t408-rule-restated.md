# Decision: rest on the walk to bed (T-408), rule restated

**Task:** T-408 · **Date:** 2026-10-21 · **Commit examined:** master `c3e76ce` (the runs; T-411, merged after them at `ff757b8`, is not in them) · **Kind:** measurement of two rejected code changes and a restated rule; no source, constant or test changed · **Sources:** [the sleep measurement](2026-10-21-sleep-hours.md), [the first attempt](2026-10-21-rest-on-the-walk-to-bed.md), [after T-410](2026-10-21-rest-on-the-walk-to-bed-after-t410.md)

## The answer

- **The rule is restated, not changed: rest falls at the sleeping rate from the moment a dwarf sets off for its bed, the walk included, and a sleep can end the moment the dwarf lies down.** That is what the game has done all along; 10 § Needs and § Sleeping, `creature-brains.md` and `balance.md` § Needs and consumption now say it plainly. The orchestrator's decision (option B), taken when option A failed at both rates it allowed.
- **Why the alternative was rejected.** Rest held on the walk and falling only in bed (branch `t408-wip3`) ends the lie-down-and-get-up sleeps and meets the work-share band, but it keeps a dwarf tired for its whole walk: the time with rest at or above its want threshold rises from 18–19% to 31–35% of dwarf-time in every seed.
  - At `REST_ASLEEP_PER_HOUR` −45 the main economy-fixture seed loses population (`three-years` 13 at day 224 against 33; the other two hold) and the annual instrument falls to median 11.5, worst 5, second-worst 7, sum **139**, 6 wildlife-free (before: 13 / 2 / 8 / 140 / 8).
  - At −40 the fixture's population holds (34, 16, 57 against 33, 12, 45) but the instrument fails: sum **122**, one extinct fortress (`temperate_forest-3`, to boars and wolves), 5 wildlife-free.
  - **Option A** (no `tired` thought while the dwarf is on its sleep errand, on top of the held rest; `e0ec9f7`) leaves the instrument where it was: 11.5 / 5 / 7 / 139 / 6 / 0 / 0 at −45 and 11.5 / 0 / 2 / 122 / 5 / 1 / 0 at −40. The acceptance condition (sum at least the before row's, or at worst not lower together with two other figures; no extinction; no hunger death; population holding on all three seeds) fails at both.
- **No constant, rule of the code or guard moves.** `REST_ASLEEP_PER_HOUR` stays −15, the median guard stays 13. The measured time budget stays: a dwarf spends about 4 hours a day walking to its bed and 2 in it, and a quarter of its sleep errands end on arrival.

## What was run

All on `c3e76ce`, one heavy run at a time. The instrument's before row is the T-405 row (`reports/data/2026-10-21-t405-wildlife.json`, the same code). The population check is the T-140 share probe (`reports/data/2026-10-18-t140-share-probe.ts.txt`) with the share of time at or above the rest and social want thresholds and the immigration evaluations added, 224 days, seeds `three-years`, `three-years-p0-2`, `three-years-p0-3`.

| Run | Instrument (median / worst / 2nd / sum / wildlife-free / extinct / hunger) | Fixture population at days 112 / 224 (three seeds) | Tired share, year 1 |
|---|---|---|---|
| Before (master) | 13 / 2 / 8 / 140 / 8 / 0 / 0 | 14 / 33, 12 / 12, 16 / 45 | 18–19% |
| Held rest, −45 | 11.5 / 5 / 7 / 139 / 6 / 0 / 0 | 10 / 13, 12 / 12, 17 / 44 | 31–34% |
| Held rest, −40 | 11.5 / 0 / 2 / 122 / 5 / 1 / 0 | 15 / 34, 13 / 16, 17 / 57 | 31–32% |
| Option A, −45 | 11.5 / 5 / 7 / 139 / 6 / 0 / 0 | not run (the instrument failed first) | — |
| Option A, −40 | 11.5 / 0 / 2 / 122 / 5 / 1 / 0 | not run | — |

Data: `reports/data/2026-10-21-t408-population-check.json` (the held-rest runs and their instrument rows) and `reports/data/2026-10-21-t408-option-a.json` (option A's instrument rows).
