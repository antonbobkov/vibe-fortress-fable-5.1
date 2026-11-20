# T-652: the immigration roll on a stream of its own

**Task:** T-652 · **Date:** 2026-11-20 · **Code:** branch `t652-immigration-stream`, sweep on `271443f4` (T-652 on master `199a30ad`) · **Source:** [the T-652 work file](../../docs/work/T-652-immigration-roll-own-stream.md), [T-650's measurement](2026-11-20-t650-peril-4-immigration.md)

## The change

A season's roll (21 § Evaluation, step 4) is the first draw of the stream `21.roll.<year>.<season>`, seeded from the world seed, the year and the season alone (`seasonRoll`). 21's own stream plans the waves and no longer rolls them. Nothing new is saved: the roll is derived, so 21's state and the save format are unchanged, and an older save loads as before and meets the derived roll from its next season. No golden file moved: the world-hash goldens stop at 5,000 ticks, before the first rolled evaluation (winter of year 1).

A derived roll was chosen over a second saved stream (`rngFor('21.roll')`). A saved stream draws once per rolled evaluation, so a season one code skips (for hall spirit, wealth or a pending wave) and the other rolls would still shift every later roll. A roll fixed by the season is the same however many seasons came before it.

## The sweep

Run `44716548319` (four shifts, 80 seed jobs): 79 seed jobs green. `sweep (p4-4, 150)` is red with `SquadOrder rejected (bad_placement)` (a station order), the known failure from T-653's script that master's own sweep of `199a30ad` (`44715696949`) has too. It is being fixed on `t653b-all-clear-fixes`. With that seed missing, the verdict was not judged:

| | Alive y1 | P0 grown | P0 need deaths | Living y3 | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| T-652 (`44716548319`, 79 of 80) | 19.25 | 7 | 0 | 1050.25 | 105.5 | 0.75 | 7.25 |
| Master `199a30ad` (`44715696949`, 79 of 80) | 19.25 | 7 | 0 | 1018.75 | 116.5 | 1 | 7.5 |
| Bounds | ≥ 18 | ≥ 6 | ≤ 1 | ≥ 887.75 | ≤ 161.88 | | |

The verdict line reads: "not judged (… missing: shift 150: 19 of 20). Bounds exceeded: none."

## The rolls against their chance

Read from the seed jobs' `[three_years_economy]` immigration records, in the same way as T-650: every eligible, non-guaranteed evaluation that was rolled, with the rebuilt wave size (it matches every recorded wave in both runs). Both runs have 79 seed jobs.

| Year 3 | Run | Rolls | Waves | Waves / rolls | Mean chance | Immigrants expected | Came | Came − expected |
|---|---|---|---|---|---|---|---|---|
| Peril 4 | T-652 | 58 | 45 | 78% | 70.3% | 340 | 391 | +51 |
| Peril 4 | Master | 58 | 45 | 78% | 70.3% | 364 | 389 | +25 |
| Peril 2 | T-652 | 94 | 62 | 66% | 70.2% | 639 | 637 | −2 |
| Peril 2 | Master | 103 | 75 | 73% | 70.2% | 709 | 721 | +12 |
| Peril 0 | T-652 | 106 | 76 | 72% | 70.2% | 768 | 778 | +10 |
| Peril 0 | Master | 111 | 65 | 59% | 70.2% | 800 | 653 | −147 |

At peril 4 in year 3, 45 waves from 58 rolls at a 70.3% chance (40.8 waves expected) is about 1.2 standard deviations high. On master that is luck that a different timeline redraws. On T-652 it belongs to the seed set: every timeline of a seed, in every code, meets the same rolls. The years before tell the same story: T-652's peril-4 year 1 rolled 7 waves in 18 (39%) where master rolled 15. Master's peril 0 rolled 147 immigrants below its expectation in year 3. That is the kind of swing that T-650 found and that T-652 removes from comparisons between codes.

**The rolls are shared.** Of 169 seasons rolled in two or more of a seed's four shifts on T-652, all 169 rolled the same number in every shift. On master, 33 of 173 did: the seasons before the timelines' first wave of a different size.

## What this changes for the sweep

Two codes are now compared on the same rolls, so a change that resizes one wave no longer moves a living figure through the rolls. The four shifts also share the rolls, though. They still differ in the timeline, but no longer in the immigration luck, so the pooled figure carries the luck of these twenty seeds' fixed rolls. The tolerances (`SWEEP_TOLERANCE`) and the best figures were measured when each shift drew its own rolls. A follow-up re-measures the spread under the fixed rolls: [the sweep's noise under fixed immigration rolls](../../docs/work/T-NEW-sweep-noise-fixed-rolls.md).

The script used for these figures (it reads the downloaded seed logs only) rebuilds the wave size from 21 § Wave size. It can be rerun on the two runs' `seed-*` artifacts while GitHub keeps them (14 days).
