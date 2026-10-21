# Measurement: raid sizes and renown at perils 2 and 4

**Tasks:** T-381 and T-368 · **Date:** 2026-10-21 · **Commit examined:** master `a5cd51c` · **Kind:** measurement; no constant, formula or content value was changed · **Sources:** B-010 as re-filed by [the peril-0 sweep](2026-10-17-t145-peril-0-sweep.md) (T-381); [unmeasured spec numbers](2026-10-17-unmeasured-spec-numbers.md), rank 5 (T-368)

## The answer

- **Raid sizes at peril 2 are the model's, on fortresses that live.** Six of the seven peril-2 fortresses of the economy fixture are alive at day 336 (42 to 54 dwarves, and one of 24; `p2-6` died on day 197). Each gets one raid a year. The year-2 raid comes on days 119 to 132 with **8 to 11** raiders, median **10** (model 11); the year-3 raid on days 224 to 266 with **12 to 16**, median **14** (model 15). Both are within 30% of the model in every seed; the cap of 16 is reached in two of six year-3 raids. A captain comes on top of each.
- **Renown is not the model's: it runs one year ahead.** At the ends of years 1, 2 and 3 the peril-2 fortresses hold renown **12.8 / 24.4 / 41.7** (median; 7.5–13.4 / 21–37.6 / 24.7–45.4), against the model's 5 → 15 → 30. The peril-0 sweep of 2026-10-17, read through the same formula, gives 13 / 29 / 36. Wealth makes the difference: 17,500 to 21,100 marks at the end of year 1 (`p2-6` 11,076), three times the model's 6,000 ([T-380](../../docs/work/T-380-year-one-wealth-above-the-model.md)), while population is near it (10 to 18 against 13).
- **The two errors cancel for the raids.** The model sizes the year-2 raid from the renown at the end of year 2 (15) and the year-3 raid from the end of year 3 (30). A raid at peril 2 comes in spring at the earliest, and is never in winter, so the year-2 raid sees the renown of the start of year 2 (11 to 16 at the roll) and the year-3 raid the renown of spring and summer of year 3 (19 to 38). With renown a year ahead of the model, those rolls give the model's sizes. `RENOWN_WEALTH_DIVISOR`, `RENOWN_POP_WEIGHT` and the schedule's `base` and `perRenown` need not move for the raids; the balance model's renown curve and its reasoning do, and are restated.
- **Ambushes and bandits at peril 2:** ambushes of 4 in year 1 (days 57 to 69, the first hostile party of every seed with the bandits), 4 to 6 in year 2 and 5 to 6 in year 3 (the cap); bandits of 3 to 5. Thieves come 4 to 8 times in the three years.
- **Peril 4 alongside:** the first raid on days 59 to 76 (13 raiders), after the day-56 window of the year-one table, as are the first ambushes (days 58 to 71, 5 or 6). Year 2: raids of 14 to 21, sieges of 22 to 34 (27 to 41 with captains), ambushes of 6 to 9. Year 3: raids of 17 to 24 (the cap), ambushes of 8 to 10 (the cap). Only three of six fortresses live: `p4-2` and `p4-6` die on day 67 (the year-1 ambush of 6 kills 12 of `p4-6`'s dwarves; `p4-2` had lost 13 to boars and infection before its ambush), `p4-3` on day 188 to an ambush, a siege and a raid within 18 days.
- **No raid is fought; it is shut out.** Every party but five ends `looted` (96 of 101 that ended): the fixture locks its gate under the alert, the raid takes what lies outside and leaves. At peril 2 the 13 raids killed **8** dwarves in all and lost 5 of their 167 members; the 22 ambushes, which come without warning, killed **31**. Of the 66 dwarf deaths at peril 2, 42 are to parties and 23 to wild animals; at peril 4, 88 of 115 are to parties and 16 to infection (`p4-1` 10, `p4-2` 5). [The combat measurement](2026-10-21-combat-pace.md) says why a squad does not meet a raid in the open.
- **Faults met:** the probe journals the T-176 invariants instead of failing on them. `p4-1` (day 278 on) and `p4-2` (day 40 on) hold a `water_patient` and a `feed_patient` job blocked `unreachable` with a path, the finding T-401 closed, back; `p4-4` (days 218 to 258) holds a cap and a club with no place, 918 ticks after a raid left with its loot. Each has a work file (diagnosis first). The peril-2 seeds are clean.
- **The marks of the numbers measured are replaced by this report:** `RENOWN_WEALTH_DIVISOR`, `RENOWN_POP_WEIGHT` and `WARNING_DAYS` in 18; the schedule's rows for perils 2 and 4 in `threat-schedules.md` and 18 § Schedule; the balance model's renown curve and raid sizes at peril 2, and the day-56 warning of the year-one table. The rows of perils 1 and 3, the trait modifiers, the year-5 figures, `LOITER_DAYS_*`, `RETREAT_LOSS_PERCENT` (no raid lost half its members) and `DOOR_BREAK_TICKS` stay *unmeasured*.
- **What should change:** no constant. The balance model's renown curve is restated from this measurement (13 → 24 → 42 at peril 2), with the reason the raid sizes still hold. Whether year-1 wealth should be lower is T-380's question; if it were brought to the model's band, renown would fall to it and the raids of years 2 and 3 would shrink to about 8 and 11, below the model, so the schedule would then need its `perRenown` raised. The two tasks are read together.

## What was run

`reports/data/2026-10-21-raid-sizes.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test), at `a5cd51c`, once, alone on the machine for its fortress runs: the seven peril-2 and six peril-4 seeds of `three_years_seeds.test.ts`, played exactly as that file plays them (`threeYearsWorld`, `setupThreeYearsFortress`, `playThreeYears` with the four checks every 100 then 300 ticks, 336 days or until no dwarf is left), with the T-176 invariants journalled instead of asserted. It journals each party (kind, size, renown, wealth and population at the spawn, members with their gear and skills, the outcome), each warning, every attack and wound with both sides described, hospital events, deaths with their killer, renown each season and the economy instrument's year snapshots. Two hours of wall time; the journals (1.7 MB) stay out of git and are reproduced by `T381_SEEDS=three-years-p2-1,…,three-years-p4-6 T381_OUT=<dir> npx vitest run -c vitest.perf.config.ts <the probe>`. `…-raid-sizes.json` holds the per-seed summary made by `…-raid-sizes-summary.mjs.txt`.

## Peril 2, seed by seed

| Seed | Renown at year ends 1 / 2 / 3 | Year-2 raid: day, size, renown at roll | Year-3 raid: day, size, renown at roll | Ambushes (size) | Dwarves at day 336 | Dwarf deaths (to parties) |
|---|---|---|---|---|---|---|
| p2-1 | 11.0 / 21.0 / 24.7 | 125, 11, 16.0 | 250, 12, 19.6 | 4, 5, 5, 5 | 24 | 21 (15) |
| p2-2 | 12.8 / 23.0 / 39.1 | 123, 10, 13.2 | 251, 14, 27.9 | 4, 5, 6 | 52 | 5 (3) |
| p2-3 | 12.9 / 37.6 / 45.4 | 119, 10, 14.1 | 224, 16, 37.5 | 4, 4, 6 | 51 | 9 (7) |
| p2-4 | 13.4 / 25.2 / 36.3 | 121, 11, 16.3 | 242, 12, 19.0 | 4, 5, 6, 6 | 42 | 5 (4) |
| p2-5 | 11.3 / 23.6 / 44.3 | 121, 9, 11.1 | 237, 14, 26.3 | 4, 4, 6 | 52 | 4 (1) |
| p2-6 | 7.5 / — / — | 132, 8, 5.9 | — (dead day 197) | 4, 4 | 0 | 13 (5) |
| p2-7 | 12.9 / 36.3 / 45.2 | 132, 11, 16.1 | 266, 16, 34.7 | 4, 5, 6 | 54 | 9 (7) |
| **Model** | **5 / 15 / 30** | **11** | **15** | | | |

Every raid was announced one day ahead (`ThreatWarning` 1,200 ticks before its party), as `WARNING_DAYS` says.

## Peril 4, seed by seed

| Seed | Renown at year ends | Raids (day: size) | Sieges (day: size) | Dwarves at day 336 | Dwarf deaths (to parties) |
|---|---|---|---|---|---|
| p4-1 | 11.4 / 24.3 / 18.1 | 61: 13, 117: 16, 167: 18, 231: 21, 277: 21, 330: 18 | 189: 27 | 23 | 43 (32) |
| p4-2 | — | — | — | 0 (day 67) | 15 (2) |
| p4-3 | 14.0 / — | 76: 13, 138: 15, 186: 16 | 185: 25 | 0 (day 188) | 24 (23) |
| p4-4 | 13.2 / 24.7 / 53.0 | 72: 13, 134: 16, 215: 21, 262: 24 | 183: 34 | 45 | 13 (13) |
| p4-5 | 12.3 / 17.6 / 24.9 | 59: 13, 112: 15, 159: 14, 225: 17, 292: 17 | 174: 22 | 32 | 6 (6) |
| p4-6 | — | — | — | 0 (day 67) | 14 (12) |

## What this does not measure

- A fortress that fights its raids: the fixture's answer is the gate, and the combat measurement shows why.
- Perils 1 and 3, the trait modifiers, the restless dead and the Deep.
- The value of what a raid loots.
- One run per seed; the seeds are chaotic samples, and the change that moved the job timeline between 2026-10-20 and this run (T-399) turned `p2-1` from 6 deaths to 21 and `p2-6` from alive to dead on day 197.
