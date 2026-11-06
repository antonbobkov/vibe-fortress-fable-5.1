# T-NEW — The three-year script sows surface crops that cannot ripen before the frost

**Source:** T-507's food journal of `three-years-p0-3` ([report](../../reports/audits/2026-11-05-t507-three-years-food.md#the-second-fault-crops-sown-too-late), [journal](../../reports/data/2026-11-05-t507-food-journal-p0-3.txt)) · **Size:** S · **Needs:** — · **Status:** open (a fix is written and measured once, not merged)

## Why

`checkCrops` in `test/scenarios/three_years_economy.ts` gives each surface plot, for each season, the first crop of `SURFACE_CROPS` whose seed covers half the plot. It does not ask whether a crop sown today can ripen. A surface crop needs four stages of `stageDays` (strawberry and barley 28 days, turnip 20, cabbage 24, pumpkin 32) and grows only in its `seasons`; outside them it lies dormant, and winter's frost kills it with its seed (07 § Growth). On `p0-3` (master `d96cfc9c`) the script sowed turnips, cabbage and strawberries in the last days of autumn in year 2, and strawberries and barley in the second half of summer and in autumn in year 3: the frost killed **101 crops in the first week of year 2's winter and 165 in the first week of year 3's**, none harvested. One harvest returns one seed, so each frost also emptied the seed stock; from day 231 the surface plots wait on 21 `plant` jobs blocked for `missing_input`. A player reads the days left and leaves the plot fallow.

## What to do

1. In the season under way, sow only a crop with days enough left in its growing seasons, with a margin of a few days for the sowing; otherwise set the plot fallow (`SetPlotCrop` with `speciesId: 0`) for the rest of that season.
2. A unit test of the rule (strawberry: only in the first weeks of spring; turnip: through summer and the first days of autumn; pumpkin: not in autumn).
3. Measure it on the twenty-seed file over several timeline samples (T-507: one sample moves every seed's timeline, and the set rule's margins are within that noise).

A version is on branch `t507-food-b`, commit `292af817` (`ripensInTime` and its test; a three-day margin). Measured once on T-482's master with T-507's cave-strip fix under it (run 42143696598): 170 deaths, 855 living, peril-0 need deaths 0, frost losses on `p0-3` 6 and 45 instead of 101 and 165. It moves every seed's timeline, so it was left out of T-507.

## Done

- No surface crop is sown that cannot ripen in its seasons; the test passes; the sweep's set rule holds over the samples.
