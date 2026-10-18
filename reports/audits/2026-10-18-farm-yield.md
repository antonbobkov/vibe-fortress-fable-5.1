# Measurement: farm yield

**Task:** T-364 · **Date:** 2026-10-18 · **Commit examined:** codex-a `2771fe0` (master `cbeb7cd` plus the T-394 change, which moves no world hash) · **Kind:** measurement; no source, test, constant or content value was changed · **Source:** [the spec numbers nobody has measured](2026-10-17-unmeasured-spec-numbers.md) (rank 1)

## The answer

- **The 0.25 plants per tile per day holds for a dimcap tile: 0.247 measured** at farming skill 0 to 4 (3.96 plants per harvest over a 16.04-day cycle, a tile occupied 97 to 100% of the time). A 20-tile cave plot gives 4.9 plants a day (the model needs 4.8) and 13 tiles give 3.2 (the model needs 3.1).
- **A farmer's skill moves it up, not down.** Yields rose from 3.96 to 5.08 plants per harvest once the farmer had worked the plot for about half a year: a skilled farmer's dimcap tile gives 0.32 a day. Cavewheat is slower: a 20.04-day cycle and 4.13 plants, **0.206** a day at skill 0.
- **`BASE_GROWTH` is measured**: at 100% growth a crop takes `4 × stageDays` plus 0.03 to 0.06 days (one hour of the hourly growth step and the planting walk) from sowing to harvest: dimcap 16.04 days (rule: 16), cavewheat 20.04 (rule: 20).
- **The season multipliers are measured** through the cycle of one crop, turnip (20 days at 100%): 20.78 days sown in spring, 17.34 sown in summer, 26.40 sown in autumn. Net of the 0.78-day lag of the spring cycle, summer takes 0.83 (rule: 1/1.2 = 0.83) and autumn 1.28 (rule: 1/0.8 = 1.25) of the spring time. Nothing grows in winter: a crop still in the ground at the end of autumn dies (16 of 16 tiles in every winter of every surface run).
- **`SEEDS_PER_HARVEST` is measured: exactly 1** (208 harvests returned 208 seeds, 16 seeds at the start and 0 at the end after 224 sowings). The model's "seeds are never a bottleneck" holds only while the plot has as many seeds as tiles: seeds do not multiply, so a 16-tile plot given 4 seeds stayed a 4-tile plot for 224 days (0.059 plants per tile per day, a note to the player each season, 8 in all). It is how the rule reads (07 § Seeds), not a fault.
- **Surface crops give a third to a half of a cave tile over a year**: turnip 0.133 plants per tile per day in the first year (0.20 spring, 0.24 summer, 0.15 autumn while growing, none in winter), barley 0.067, cabbage 0.052. The balance model sizes only cave plots from 0.25, so nothing in it is contradicted.
- **No number is out of its band** (below about 80% of 0.25, or seeds running out on the plot sizes the spec gives). No work file follows from this measurement.

## What was measured

A stepped fixture (`2026-10-18-farm-yield.probe.ts.txt`): the 96-by-96 flat test map with its natural wild arrivals turned off, one farmer at farming skill 0 and nobody else, one 16-tile farm plot (4 by 4), seeds of the plot's crop, and a store of drink and meals that is topped up every 14 days so that the farmer needs no other source. The cave plots stand in a dug, dark room two levels below the surface; the surface plots stand in the open, with the map's real seasons and weather. Each plan runs two years (224 days) with the harvest standing order on. Every 10 ticks the probe counts the tiles holding a crop and the farmer's activity; every `CropPlanted`, `CropHarvested`, `CropDied`, `PlotNeedsSeeds` and `CreatureDied` event is recorded with its tick. The figures per plan are in [`../data/2026-10-18-farm-yield.json`](../data/2026-10-18-farm-yield.json) (every plan carries its harvest and planting logs).

| Plan | Crops by season | Seeds |
|---|---|---|
| cave-dimcap | dimcap in every season | 40 |
| cave-dimcap-seeds-16 | dimcap | 16 (the plot's size) |
| cave-dimcap-seeds-4 | dimcap | 4 |
| cave-cavewheat | cavewheat | 40 |
| surface-turnip | turnip in spring, summer, autumn | 40 |
| surface-barley | barley in spring and summer | 40 |
| surface-cabbage | cabbage in spring and autumn | 40 |

## Cave plots

| Plan | Cycle, days (median, range) | Plants per harvest, first 56 days / days 169 on | Tile occupied | Plants per tile per day at skill 0 | Over the 224 days | Farmer's work share (plant + harvest) |
|---|---|---|---|---|---|---|
| cave-dimcap | 16.04 (16.00 to 17.01) | 3.96 (48 harvests) / 5.08 (48) | 97 to 100% | **0.247** | 0.265 | 3.3% + 3.7% |
| cave-dimcap-seeds-16 | 16.06 (16.00 to 16.85) | 4.08 / 5.15 | 98 to 100% | 0.254 | 0.269 | 3.3% + 3.9% |
| cave-dimcap-seeds-4 | 16.05 (16.00 to 16.37) | 3.92 / 4.33 | 25% | 0.061 (4 of 16 tiles sown) | 0.059 | 0.9% + 1.0% |
| cave-cavewheat | 20.04 (20.00 to 21.01) | 4.13 / 4.98 | 98 to 100% | **0.206** | 0.225 | 2.6% + 2.9% |

The rate at skill 0 is the plants per harvest of the first 56 days divided by the cycle. The seasons do not touch a cave crop: the cycle of a dimcap sown in spring, summer, autumn or winter is 16.10, 16.04, 16.03 and 16.03 days. A tile stood empty for about one hour between a harvest and the next sowing (the cycle is 0.03 to 0.06 days longer than the rule), and all 16 tiles were sown within the first day. The farmer spent 7% of his time on the 16-tile plot (so 9% for 20 tiles, 14% for 32); 56 to 63% of his time was "no job".

## Surface plots

| Plan | Sown in | Cycle, days | Plants per harvest | Rate while growing | First year, per tile per day |
|---|---|---|---|---|---|
| surface-turnip | spring / summer / autumn | 20.78 / 17.34 / 26.40 | 4.22 / 4.09 / 3.86 (by season of harvest) | 0.20 / 0.24 / 0.15 | **0.133** |
| surface-barley | spring / summer | 30.58 / 23.84 | 3.88 | 0.13 / 0.16 | 0.067 |
| surface-cabbage | spring | 25.07 | 4.13 | 0.16 | 0.052 |

Every winter killed the crop standing on the plot (16 of 16 tiles, in each of the three plans). The farmers of the barley and cabbage plans lived the two years; the turnip plan's farmer starved on day 169 of year 2 (the probe's top-up of his store did not reach him), so the figures of that plan's year 2 stop there. The barley plan's autumn sowings (the plot has no crop set for autumn) stand dormant and die in winter, which is the rule.

## The three-year fortress, in play

The daily journal of the three-year fortress ([the food-chain diagnosis](2026-10-16-t145-food-chain-diagnosis.md), `reports/data/2026-10-16-t145-food-probe.jsonl`, seed `three-years`, 32 cave tiles of dimcap and cavewheat and 31 surface tiles) gives the same quantity in play. Summed per tile and day ([`../data/2026-10-18-farm-yield-three-year-journal.json`](../data/2026-10-18-farm-yield-three-year-journal.json)):

- the cave plot, in the seven full seasons from the second spring on, gave **0.16 to 0.26, mean 0.218** plants per tile per day (0.259, 0.239, 0.160, 0.164, 0.232, 0.233, 0.240): 87% of 0.25, with the lowest season at 64%;
- half dimcap and half cavewheat at skill 0 would give (0.247 + 0.206) / 2 = 0.226 in the stepped fixture, so **the play figure is the crop mix, not delay**: cavewheat is a fifth slower than dimcap and the fortress sowed both;
- the surface plot gave 0.00 to 0.17 (it was extended and re-sown by script during the run, so its tile count in each season is not a fixed plot).

## What this does not measure

- Brewing and cooking: the drinks and meals a harvest becomes follow from the recipes (4 plants to 20 drinks, 1 raw unit to 2 meal units) and were not run here. The brewer's and the cook's time (0.8 brewing jobs a day) stays *unmeasured*.
- More than one farmer, hauling of the produce, or a plot that competes with other work. The farmer here had nothing else to do; in play the three-year fortress's farmers (labors `farming` 2) shared the day.
- Crops other than dimcap, cavewheat, turnip, barley and cabbage; frost kill below the crop's temperature band in autumn; heatwave wilting.
- The farmer's skill at the moment of each harvest: the yield rose from 3.96 to 5.08 over the run, the rule's +1 per 5 levels of farming.

## Reproduce

`FARM_OUT=<dir> npx vitest run --config vitest.perf.config.ts test/perf/<the probe as a .test.ts>` (a quarter of an hour on a quiet machine); the probe is `reports/data/2026-10-18-farm-yield.probe.ts.txt` and the journal sum is `reports/data/2026-10-18-farm-yield-journal.mjs.txt`.
