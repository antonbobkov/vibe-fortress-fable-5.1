# Measurement: beds in a narrow rest band, with thoughts

**Task:** T-572 · **Date:** 2026-11-15 · **Kind:** measurement of a rule change (the floor rests at `FLOOR_REST_PERCENT` 85, a pallet 90, a stone bed 95, a wooden bed 100, a made-up bed 110; the wooden bed takes a pallet's materials beside its log) · **Source:** [the T-551 sleep audit](2026-11-14-beds-rest.md), the owner's decision of 2026-11-15

## What was run

The T-551 method unchanged: `test/perf/sleep_audit.test.ts` through `measure.yml -f suite=sleep_audit` (run 43791200537, commit `5fe81539`), the first 112 days of the three-year economy fixture at peril 0, seeds `three-years`, `three-years-p0-2`, `three-years-p0-3`, played as `three_years_seeds` plays them, plain and with dressed beds. The probe now also counts the wooden beds made, by recipe, and the day of the first. The script orders `make_bed` while the wagon's five linen last (two beds) and `make_bed_straw` after, of the barley's and cavewheat's straw. T-571's dormitories, merged later, start only once the bedroom plans are spent, after these 112 days, so the figures stand for the final code.

## As the fixture plays

| Seed | Working time | Hours a day on the sleep errand (walking / in bed) | Floor sleeps | In bed per sleep, median ticks (floor / bed) | Beds made (linen / straw), first on day |
|---|---:|---|---:|---|---|
| `three-years` | 35.40% | 6.50 (4.50 / 2.00) | 294 of 1,389 | 167 / 91 | 2 / 11, day 22 |
| `three-years-p0-2` | 34.45% | 6.42 (4.30 / 2.12) | 230 of 1,395 | 182 / 90 | 2 / 9, day 9 |
| `three-years-p0-3` | 40.47% | 6.26 (4.00 / 2.25) | 379 of 1,545 | 179 / 99 | 2 / 13, day 7 |

- **The working time comes back above where it was before T-551.** The mean over the three seeds is 36.77%, against 35.57% with the floor at 50 (T-551) and 35.81% before T-551, when every sleep rested at 100. Seeds move with the timeline, so the comparison is the pooled one.
- **The sleep errand is back to its old length.** 6.26 to 6.50 hours a day, against 6.91 to 7.03 with the floor at 50 and 6.22 to 6.45 before. A floor sleep lies a median 167 to 182 ticks: a sixth longer than before T-551 (136 to 140) and half as long as at 50 (341 to 366). A bed's sleep is unchanged (90 to 99).
- **More sleeps are on the floor early, and they cost little.** The wooden bed now waits for its stuffing: the wagon's linen makes two, and the rest wait for straw (9 to 13 by day 112), so 17% to 25% of the sleeps are on the floor, against 12% to 25% with T-551. On the floor a dwarf thinks −2 (`slept_on_floor`), and the standing −3 is gone.

## With dressed beds

Every day a linen bedding and pillow is put in stock for each wooden bed that still wants them, and the haulers make the beds up.

| Seed | Working time | Hours a day on the sleep errand (walking / in bed) | Sleeps at 110 / 100 / floor | In bed per sleep, median ticks (made up / bed / floor) |
|---|---:|---|---|---|
| `three-years` | 36.42% (+1.02) | 6.25 (4.44 / 1.81) | 984 / 125 / 337 | 74 / 74 / 173 |
| `three-years-p0-2` | 32.11% (−2.34) | 6.42 (4.37 / 2.05) | 6 / 1,215 / 190 | 120 / 89 / 180 |
| `three-years-p0-3` | 41.20% (+0.73) | 6.13 (4.12 / 2.01) | 586 / 593 / 384 | 67 / 87 / 176 |

- Dressed beds do little for the working time, as at 125: the mean is 36.58% against 36.77% plain, inside the seeds' movement (on `p0-2` the beds are made up on six sleeps in all, and its timeline moved). Most of the sleep errand is the walk to bed. A dressed bed's worth is now its thought (+3, +5 for feathers) and its room value.

## What this does not measure

- Years 2 and 3 and T-571's dormitories: the sweep and the instrument judge the whole change at the fortress level (T-572's commit names their runs).
