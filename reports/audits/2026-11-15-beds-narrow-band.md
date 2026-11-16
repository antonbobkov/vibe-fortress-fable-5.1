# Measurement: beds in a narrow rest band, with thoughts

**Task:** T-572 · **Date:** 2026-11-15 · **Kind:** measurement of a rule change (the floor rests at `FLOOR_REST_PERCENT` 85, a pallet 90, a stone bed 95, a wooden bed 100, a made-up bed 110; the wooden bed takes a pallet's materials beside its log) · **Source:** [the T-551 sleep audit](2026-11-14-beds-rest.md), the owner's decision of 2026-11-15

## What was run

The method is T-551's, unchanged. `test/perf/sleep_audit.test.ts` runs through `measure.yml -f suite=sleep_audit` (run 43809716956, commit `424378bc`, on top of T-571). It plays the first 112 days of the three-year economy fixture at peril 0 on seeds `three-years`, `three-years-p0-2` and `three-years-p0-3`, as `three_years_seeds` plays them, once plain and once with dressed beds. The probe now also counts the wooden beds made, by recipe, and the day of the first.

The script stuffs its beds with the barley's and the cavewheat's straw (`make_bed_straw`). It keeps the wagon's five linen for the hospital's bandages, because a first run that spent the linen on beds cost the peril-2 fortresses lives (T-572's commit has the figures). T-571's dormitories start only once the bedroom plans are spent, after these 112 days.

## As the fixture plays

| Seed | Working time | Hours a day on the sleep errand (walking / in bed) | Floor sleeps | In bed per sleep, median ticks (floor / bed) | Straw beds made, first on day |
|---|---:|---|---:|---|---|
| `three-years` | 36.95% | 6.40 (3.75 / 2.65) | 532 of 1,390 | 177 / 93 | 12, day 36 |
| `three-years-p0-2` | 37.00% | 6.49 (3.98 / 2.51) | 425 of 1,380 | 178 / 96 | 11, day 16 |
| `three-years-p0-3` | 41.44% | 6.23 (3.74 / 2.49) | 544 of 1,579 | 170 / 107 | 16, day 59 |

- **The working time comes back above where it was before T-551.** The mean over the three seeds is 38.46%. With the floor at 50 (T-551) it was 35.57%, and before T-551, when every sleep rested at 100, it was 35.81%. Seeds move with the timeline, so the pooled figure is the comparison.
- **The sleep errand is back to its old length.** It takes 6.23 to 6.49 hours a day. With the floor at 50 it took 6.91 to 7.03, and before T-551 6.22 to 6.45.
- **A floor sleep is short again.** It lies a median 170 to 178 ticks: about a quarter longer than before T-551 (136 to 140) and half as long as at 50 (341 to 366). A bed's sleep is unchanged (93 to 107). The longest sleep is 399 ticks, under the cap of `SLEEP_HOURS` × 100 / 85 hours.
- **A third of the early sleeps are on the floor, and they cost little.** A wooden bed now waits for its straw. The first comes on day 16 to 59, after the first grain harvest, so 31% to 38% of the sleeps are on the floor. Before, the beds came from logs, and 12% to 25% were. A floor sleeper thinks −2 (`slept_on_floor`); the standing −3 is gone. The working time is higher all the same.

## With dressed beds

Every day a linen bedding and pillow is put in stock for each wooden bed that still wants them, and the haulers make the beds up.

| Seed | Working time | Hours a day on the sleep errand (walking / in bed) | Sleeps at 110 / 100 / floor | In bed per sleep, median ticks (made up / bed / floor) |
|---|---:|---|---|---|
| `three-years` | 36.03% (−0.92) | 6.33 (4.48 / 1.85) | 997 / 88 / 364 | 74 / 75 / 171 |
| `three-years-p0-2` | 37.89% (+0.89) | 6.36 (3.95 / 2.41) | 510 / 437 / 444 | 69 / 92 / 182 |
| `three-years-p0-3` | 42.46% (+1.02) | 6.11 (3.54 / 2.57) | 482 / 482 / 594 | 90 / 103 / 166 |

- Dressed beds add about a third of a point of working time: a mean of 38.79% against 38.46% plain. That is inside how far the seeds move. Most of the sleep errand is the walk to bed, which a softer bed does not shorten. A dressed bed's worth is now mostly its thought (+3, or +5 with feathers) and its room value.

## What this does not measure

- Years 2 and 3, and T-571's dormitories. The sweep and the instrument judge the whole change at the fortress level; T-572's commit names their runs.
