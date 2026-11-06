# Measurement: the annual instrument's noise, and a verdict over eight shifted samples

**Task:** T-509 · **Date:** 2026-11-05 · **Commits examined:** master `d8efa6db` (T-482, T-486) with only a shift input added (`fc46b32a`), twelve shifts; master `d2f68294` (T-508) with the first fix (`960d4aac`, the player digs for raw stone only) and with the fix as kept (`de028566`, stone or blocks), sixteen shifts each · **Kind:** a measurement, a fault of the instrument's opening fixed, a rule redesigned · **Source:** [the T-509 work file](../../docs/archive/tasks/T-509-instrument-bounds-inside-timeline-noise.md), [T-508's instrument samples](2026-11-05-t508-idle-dwarves-by-the-hearth.md#the-annual-instrument)

## The answer

- **One sample is noise.** The same code shifted a few ticks before the opening plays a different year. On master before this task, twelve shifts gave a sum of the living from 118 to 157, a median from 10.5 to 13, wildlife-free years from 6 to 10, a worst seed from 0 to 11; 4 of the 12 failed the bounds a single sample was held to. Single seeds move by up to 13 living (forest 2 between 0 and 13). The grassland seeds barely move; forest and taiga, where wolves and boars decide who lives, move every time.
- **The new rule: eight samples, one verdict, one command.** `gh workflow run measure.yml --ref <branch> -f suite=instrument` plays the instrument for shifts 0 to 7 in parallel and a verdict job pools them: means of the median, the sum, wildlife-free years, the worst and the second-worst; counts of extinct and starved years over the 96 years. The bounds keep their old shape (best pooled figure minus a tolerance; three figures falling together by more than half a tolerance also block) with tolerances wider than the measured spread of an eight-sample mean: median 1.25, sum 13, wildlife-free 2.5, extinct years 2, starved years 2. Over all 25,740 ways of splitting two commits' sixteen shifts into two sets of eight, the two means never differed by more than 1.06, 12.5 and 2.25. The second set of eight shifts of the reference code passes against the first. A regression the size T-481 fixed (a fortress starved to extinction) is blocked when it happens in three or more of the eight timelines.
- **The 11 starved on `wildlife-taiga-3` were a fault of the instrument's opening, now fixed.** In that timeline the rock the opening digs dropped 6 stones (30% of rock tiles drop one) where it drops 9 unshifted; the mason's blocks and the first workshops took all six, and the kitchen, placed on day 3, waited for one stone all year. No meal was ever cooked; the fortress ate raw dimcap, the still brewed the rest, and when taiga's winter stopped the cave plot on day 85 the food was gone by day 89; eleven dwarves starved on days 110 to 112. The same shortage left grassland seeds 3 and 4 without a hearth in 7 of 16 timelines each and forest seed 2 without one in 2. The fix: a player whose building has waited two days for stone or blocks, with no raw stone about and nothing left to dig, digs the next 5 by 5 room of rock beside the lower room. With it, that timeline ends with 13 living and no death, every building of the opening stands in all sixteen shifts, and the unshifted sample is unchanged (13/6/11/148/7/0/0, T-508's row).
- **The new reference** is the pooled row of shifts 0 to 7 of `de028566`: **12.63 / 6 / 8.88 / 143 / 6.63 / 0 / 0** (median / worst / second-worst / sum / wildlife-free / extinct years / starved years), the best figures the same. Bounds: median at least 11.38, sum at least 130, wildlife-free at least 4.13, at most 2 extinct and 2 starved years of 96.
- **A food margin for the owner (not a fault):** the taiga seeds go into winter on their autumn store (T-484 kept the cold). After the fix no taiga seed starves in sixteen shifts, but taiga seed 3 ends the year with under one meal or plant per dwarf in 8 of 16 shifts (none at all in 5) and taiga seed 2 in 5 of 16; see [The taiga winter store](#the-taiga-winter-store).

## What was run

| Run | What | Data |
|---|---|---|
| Measure 42144879074 | `instrument`, shifts 0 to 11, master `d8efa6db` with the shift input (`fc46b32a`) | [twelve shifts before](../data/2026-11-05-t509-noise-before.json) |
| Measure 42146812479 | shifts 0 to 15, T-508's master with the first fix (`960d4aac`) | [sixteen shifts, first fix](../data/2026-11-05-t509-noise-first-fix.json) |
| Measure 42151935437 | shifts 0 to 15, T-508's master with the fix as kept (`de028566`); its verdict job printed the sixteen-row table and, as designed, refused to judge sixteen shifts | [sixteen shifts after](../data/2026-11-05-t509-noise-after.json) |
| Measure 42155581368 | the one command, `-f suite=instrument` with the default shifts, on the final commit `348c5cf8`: eight sample jobs and the verdict, **pass**, pooled 12.63/6/8.88/143/6.63/0/0 (the reference exactly) | the run's page |
| Local journals | `wildlife-taiga-3` at shifts 0 and 2, before and after the fix, a day's stocks, crops, meals and Starving notes from day 20; the opening's buildings, build jobs and stone day by day | [journal](../data/2026-11-05-t509-taiga3-journal.txt), [stone](../data/2026-11-05-t509-taiga3-stone.txt), probes [journal](../data/2026-11-05-t509-journal.probe.ts.txt) and [kitchen](../data/2026-11-05-t509-kitchen.probe.ts.txt) |
| Test | `test/perf/t509-opening-stone.test.ts`: `wildlife-taiga-3` two ticks later and `wildlife-temperate_grassland-3` unshifted have every opening building standing at day 20; both fail before the fix (the kitchen, the hearth "planned") | — |

The shift is `game.step(shift)` before the opening's first command (`WILDLIFE_YEAR_SHIFT`), the same as the hand-made shift branches of T-481, T-482 and T-508: shifts 0 to 3 of run 42144879074 reproduce their rows exactly.

## The noise

Median / worst / second-worst / sum / wildlife-free / extinct / need deaths, one row per shift.

| Shift | Before (`fc46b32a`) | After (`de028566`) |
|---|---|---|
| 0 | 12.5/9/10/149/7/0/0 | 13/6/11/148/7/0/0 |
| 1 | 12.5/3/9/139/7/0/0 | 12.5/7/9/145/6/0/0 |
| 2 | 10.5/2/3/118/7/0/**11** | 12/10/11/150/6/0/0 |
| 3 | 12/3/8/136/6/0/0 | 13/7/10/148/8/0/0 |
| 4 | 12.5/3/9/141/7/0/0 | 12/5/10/142/5/0/0 |
| 5 | 12.5/8/9/145/7/0/0 | 13/4/7/138/8/0/0 |
| 6 | 12.5/8/11/149/6/0/0 | 13/4/5/133/7/0/0 |
| 7 | 12.5/9/9/144/8/0/0 | 12.5/5/8/140/6/0/0 |
| 8 | 12.5/3/6/130/6/0/0 | 12/5/5/137/6/0/0 |
| 9 | 12.5/0/7/137/7/**1**/0 | 11/1/2/120/5/0/0 |
| 10 | 13/11/12/157/10/0/0 | 12.5/7/9/145/8/0/0 |
| 11 | 12/8/8/142/8/0/0 | 11/4/7/134/6/0/0 |
| 12 | | 13/6/7/144/9/0/0 |
| 13 | | 13/7/10/151/9/0/0 |
| 14 | | 13/9/9/146/7/0/0 |
| 15 | | 13/11/11/155/9/0/0 |

The spread of one sample:

| Figure | Before: median of the shifts, range, standard deviation | After |
|---|---|---|
| Median | 12.5; 10.5 to 13; 0.62 | 12.75; 11 to 13; 0.69 |
| Worst | 5.5; 0 to 11; 3.6 | 6; 1 to 11; 2.5 |
| Second-worst | 9; 3 to 12; 2.4 | 9; 2 to 11; 2.6 |
| Sum of the living | 141.5; 118 to 157; 10.0 | 144.5; 120 to 155; 8.6 |
| Wildlife-free years | 7; 6 to 10; 1.1 | 7; 5 to 9; 1.4 |
| Extinct | 1 sample of 12 (forest 2 at shift 9, boars and wolves) | 0 of 16 |
| Need deaths | 1 sample of 12 (taiga 3 at shift 2, 11 dwarves) | 0 of 16 |

So the worst sample is far worse than the second-worst: the sum's worst and second-worst are 118 and 130 before, 120 and 133 after. Under the old single-sample bounds (median 12, sum 137, wildlife-free 7, extinct 1, need deaths 1) master fails 4 of 12 shifts before (2, 3, 6, 8) and 8 of 16 after. Per seed, forest 1 ranges 2 to 13 living, forest 2 1 to 13 (0 to 13 before), taiga 1 4 to 13; the grassland seeds 14 to 15.

The spread of an eight-sample mean, over every split of the sixteen shifts into two sets of eight (12,870 splits a commit):

| Pooled figure | First fix: largest difference, s.d. | After: largest difference, s.d. | Tolerance |
|---|---|---|---|
| Median | 0.94, 0.35 | 1.06, 0.35 | 1.25 |
| Sum of the living | 11.75, 4.28 | 12.5, 4.28 | 13 |
| Wildlife-free years | 1.88, 0.61 | 2.25, 0.68 | 2.5 |
| Extinct years of 96 | 1 | 0 | 2 |
| Starved years of 96 | 0 | 0 | 2 |
| Worst, second-worst (reported) | 4, 3.13 | 3.75, 3.88 | — |

Before the fix (twelve shifts, splits into six and six) extinct and starved years each differed by one.

## The rule

What it judges, in `test/perf/wildlife_year_verdict.test.ts` with `wildlife_year_measurements.ts` and `wildlife_year_constants.ts`:

- **Samples.** Shifts 0 to 7 of one commit (`WILDLIFE_SAMPLES` = 8). Any other set prints its table and fails, so two verdicts always compare like with like.
- **Pooled figures.** The median, worst, second-worst, sum of the living and wildlife-free years are means over the eight; extinct years, starved years (a year with a dwarf dead of hunger or thirst) and need deaths are counted over the 96 years. Starved years replace need deaths as the guard: a starving fortress loses its dwarves ten at a time, so a count of dwarves is one event's size, not how often it happens.
- **Bounds.** From the best accepted pooled figures: median minus 1.25, sum minus 13, wildlife-free minus 2.5, extinct years plus 2, starved years plus 2. Three or more of the five falling together by more than half their tolerance against the latest accepted pooled row also block (with means, "worse at all" is a coin toss; half a tolerance is not).
- **Output.** The verdict job's summary on the run's page: each shift's row, its living by seed and the days it dug for stone, the pooled row, the reference, the bounds and the verdict, and the reference and best rows to paste into `wildlife_year_constants.ts` when the change is accepted. Sample jobs fail only on their own invariants.
- **Cost.** Eight jobs of about twelve minutes each in parallel. With free runners it takes about the time of one sample; today, with other tasks' runs queued, a sixteen-shift run took about an hour and a half.

What it catches, taken out of the second set of eight shifts after the fix, judged against the first:

| Change | Pooled row | Verdict |
|---|---|---|
| None (shifts 8 to 15) | 12.31/6.25/7.5/141.5/7.38/0/0 | pass |
| `wildlife-taiga-1` starved out in 8 of 8 timelines | 12.25/0/6.5/130.5/7.38/8/8 | blocked: extinct and starved years |
| … in 4 of 8 | 12.31/4.13/7/136.88/7.38/4/4 | blocked: extinct and starved years |
| … in 2 of 8 | 12.31/5.5/7.38/139.13/7.38/2/2 | pass (two worsened together) |
| `wildlife-taiga-3` starved out in 4 of 8 | 12.06/4.13/6.75/135.5/7.38/4/4 | blocked |
| Every sample's sum 6 lower | sum 135.5 | pass (the sum worsened) |
| Every sample's sum 12 lower (a whole fortress) | sum 129.5 | blocked: the sum |

The old rule gave T-481's regression (taiga seed 1 starved out: −12 on the sum, 10 to 11 need deaths) a blocked verdict on one sample too, but it also blocked master itself on a third to a half of samples. The new rule cannot see a loss smaller than about a dozen dwarves on the sum unless it starves or wipes out a fortress; one sample never could either, it only seemed to.

## Taiga seed 3, two ticks later

At shift 2 on master (`d8efa6db`, the T-482 row reproduces exactly), `wildlife-taiga-3`:

| | Shift 0 | Shift 2, before the fix | Shift 2, the fix |
|---|---|---|---|
| Raw stone dug in days 1 to 3 | 9 | 6 | 6, then a second room of rock dug from day 6 |
| Kitchen | built day 4 | **planned all year**: the build job waits for one raw stone (`missing_input`) | built after the dig, with 8 meals in store by day 20 |
| Meals in store at day 21, 63, 85 | 13, 59, 63 | 0, 0, 0 | — |
| Plant food at day 85 (winter starts) | 80 | 20 | — |
| First Starving note | none | day 78; all 13 starving from day 93 | 16 notes in the year |
| Year end | 10 living (3 bled out on days 54 to 55), 83 drinks, 52 meals | **2 living, 11 starved on days 110 to 112**, nothing left | **13 living**, no death, 7 drinks, no food |

The digging is all done by day 2 (55 dig jobs and the stair). The mason took two stones for itself, the still one, and the "4 stone blocks" order three more (six blocks; the hearth used three); the kitchen came on day 3 and found none. Nothing in the opening digs again, so the kitchen stayed planned for 109 days. Without a kitchen nothing is cooked (an easy meal is two ingredients into four meals), so the fortress ate dimcap raw and brewed the rest into drink (the still keeps 100 in store); in winter the cave plot one level down stops at −7 °C (T-484), and the 20 plants of day 85 lasted four days. The hearth alerts the work file mentions were not there in this timeline: the alert never reached hearth all year (calm and watchful only), so nobody was held from food.

It is the opening's fault, not the game's: a building's job waits for its inputs until they exist, as it should, and a player would have dug another tile. The rock's 30% drop rate makes the stone count a lottery of the timeline: with the fix, forest seed 2 digs one more room in 14 of 16 shifts, grassland seeds 3 and 4 in 8 and 9 (their hearths waited for a third block), taiga seed 3, grassland seed 1 and forest seed 1 in one each; none needed a second extra room.

## The taiga winter store

Meals and plant food at the year's end (day 112, the last day of winter), sixteen shifts after the fix:

| Seed | Starving notes in the year | Meals and plants at the end | Shifts with under one per dwarf |
|---|---|---|---|
| Taiga 1 | 9 to 29 | 63 to 153 | 0 |
| Taiga 2 | 3 to 26 | 0 to 68 (none in 3) | 5 |
| Taiga 3 | 0 to 18 | 0 to 59 (none in 5) | 8 |
| Taiga 4 | 0 to 25 | 58 to 171 | 0 |
| Forest 1, for scale | 0 to 20 | 35 to 174 | 0 |

No taiga seed starves to death in sixteen shifts, but two of the four end the instrument's year with an empty larder in a third of the timelines; the year stops on the last day of winter, so the instrument never sees whether they reach the spring harvest. T-484's decision kept the cold and left "whether a cold-biome player should store more before winter" to the owner; these are the figures for it. Nothing was changed.

## Fun behaviour noticed

- A kitchen that waits for a stone it will never get is a quiet disaster: the fortress looks busy all year, brews well, and starves in the last three days of winter. With the fix the player notices on day 5 and sends the miners back down; it costs a day's digging and a room nobody uses.
- Forest seed 2 is the instrument's gambler: from 1 to 13 living over sixteen shifts, the only seed to be wiped out (by boars and wolves, before the fix, in a timeline where its hearth was never built).
