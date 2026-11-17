# T-581: how many dwarves the defence year ends with, before and after T-578

`defence_seeds` (`gh workflow run measure.yml -f suite=defence_seeds`, eight seeds at cadences 20 to 55 by fives, 64 timelines) with T-581's report columns: a seed's living dwarves at the end, its immigrant waves and its dwarf deaths, each the mean of a seed over the 64 rows.

- **Before**: master 3e07e437 (the squad drills with the smith, and the economy never leaves its `arming` phase) with only the reporting change, branch `t581-before` at cce0018c, run 44105783275.
- **After**: master 938dee60 (T-578 merged) with the same reporting change, f7bc6383, run 44105791134.

| | Raids turned back (of 8) | A soldier killed (of 8) | A raider died (of 8) | Dwarves killed by raids | Living at the end (a seed) | Immigrant waves (a seed) | Dwarf deaths (a seed) |
|---|---|---|---|---|---|---|---|
| Before | **6.63** | **6.38** | 0.50 | 0.75 | 29.19 | 4.97 | 3.05 |
| After | **7.38** | **5.38** | 0.00 | 0.25 | 29.00 | 4.88 | 2.50 |

(Both rows copied from the verdict jobs' logs; both verdicts pass.)

Living at the end, by seed: the mean over the eight cadences, then each cadence from 20 to 55.

| Seed | Before | After |
|---|---|---|
| defence-year | 27.9 (38, 15, 19, 18, 42, 36, 22, 33) | 21.5 (17, 32, 27, 15, 18, 18, 26, 19) |
| defence-year-2 | 36.6 (32, 46, 45, 39, 38, 31, 27, 35) | 37.1 (47, 45, 50, 34, 26, 28, 27, 40) |
| defence-year-3 | 31.3 (22, 13, 33, 38, 31, 37, 39, 37) | 37.8 (10, 46, 51, 41, 39, 46, 33, 36) |
| defence-year-4 | 27.5 (32, 22, 23, 19, 19, 33, 38, 34) | 37.1 (43, 36, 32, 34, 43, 34, 41, 34) |
| defence-year-5 | 20.9 (24, 24, 24, 25, 12, 26, 11, 21) | 20.8 (26, 12, 11, 20, 26, 22, 20, 29) |
| defence-year-6 | 32.3 (40, 36, 39, 26, 28, 34, 25, 30) | 31.3 (38, 32, 19, 40, 25, 28, 37, 31) |
| defence-year-7 | 23.0 (32, 0, 26, 33, 29, 19, 16, 29) | 21.1 (17, 20, 17, 19, 12, 28, 22, 34) |
| defence-year-8 | 34.1 (45, 42, 31, 32, 26, 28, 42, 27) | 25.4 (34, 30, 25, 17, 22, 34, 22, 19) |

The armed economy costs the defence year no dwarves over its set: 29.19 living before and 29.00 after, with as many waves. One seed's figure runs over 15 to 42 across the cadences of one commit, so T-578's probe of `defence-year` at cadence 20 (17 living, against 38 before) was one timeline of that range; the seed's mean fell by 6.4 and those of `defence-year-3` and `-4` rose by 6.5 and 9.6.

## Why a wave did not come

Seasonal skips (21's `ImmigrationSkipped`) over the 64 rows: before, `luck` 81, `spirit` 46, `wealth` 1; after, `luck` 90, `spirit` 46. A wave is never skipped for want of wealth once the kit is forged; when one is missed beyond the roll, the hall spirit stands under 55.

The hall spirit follows the dead. Rows by their dwarf deaths:

| Deaths | Before: rows, living, waves, spirit skips (a row) | After: rows, living, waves, spirit skips (a row) |
|---|---|---|
| 0 | 3, 32.3, 4.33, 0.00 | 18, 37.7, 5.50, 0.06 |
| 1 or 2 | 32, 29.1, 4.75, 0.66 | 23, 26.8, 4.61, 0.74 |
| 3 or more | 29, 29.0, 5.28, 0.86 | 23, 24.4, 4.65, 1.22 |

On `defence-year` at cadence 20 after T-578 (a local run of the same commit; 17 living, waves on days 29, 57 and 169): one dwarf died before day 84, and from then to day 140 every adult held `unburied_dead` (the adults' sum −46.8) and the spirit stood at 50 to 54 at the evaluations of days 85 and 113. The fixture's script never makes a coffin, so a dwarf's body lies unburied to the end of the run and the thought never leaves (15 § Grief); left to [T-NEW](../../docs/work/T-NEW-fixture-buries-its-dead.md). Before T-578 the same seed and cadence had no death to day 140, and from day 56 its spirit stood at 56 to 64.

## The carpenter's 87 days

On the same run, every dwarf with the carpentry labor from day 63 on was a soldier at drill: the founding woodcutter and two immigrants. The founders' labors follow their professions, and the economy keeps its specialists, brewer and builder on their own crafts, so once the armed squad stood at five nobody outside it could take the carpenter's jobs. T-578's job-wait probe of this seed and cadence (run 44097754949) found a carpenter's job open from day 82 for 87 days, with three dwarves holding carpentry, all of them, in this local run, at drill from day 63. T-581 gives carpentry, as T-578 gave mechanics, to a dwarf outside the squad whom the economy does not dedicate whenever none there has it. With it, a dwarf outside the squad held carpentry from day 28, but in a local run the fortress still had its three beds on day 119 with 28 to 40 straw in stock (before T-578, three to day 98); why the beds wait was not looked into.
