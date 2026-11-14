# T-554: how much spirits slow a fortress

The three-year fixture, eight seeds (four peril 0, four peril 2), each played twice: as it is (`base`) and with a standing `distill` order keeping 40 deepfire at the first still (`spirits`). `test/perf/t554_spirits_probe.test.ts`, run on GitHub as `measure.yml -f suite=spirits` (run 43595823897). Tipsy time is sampled at the script's watch cadence (20 ticks); the slowdown is `TIPSY_SLOW_PERCENT` (10) × the tipsy share of dwarf-time, for walking and work alike.

| seed | mode | tipsyPercent | slowdownPercent | drinksAlcohol | drinksSpirits | deepfireMade | jobsCompleted | y3Pop | y3Wealth | dwarfDeaths |
|---|---|---|---|---|---|---|---|---|---|---|
| three-years-p0-1 | base | 0 | 0 | 6045 | 0 | 0 | 17005 | 74 | 30735 | 0 |
| three-years-p0-1 | spirits | 0.41 | 0.041 | 5724 | 490 | 500 | 18130 | 63 | 38230 | 0 |
| three-years-p0-2 | base | 0 | 0 | 3354 | 0 | 0 | 9222 | 27 | 28498 | 0 |
| three-years-p0-2 | spirits | 0.22 | 0.022 | 4915 | 229 | 240 | 15755 | 52 | 50734 | 0 |
| three-years-p0-3 | base | 0 | 0 | 7011 | 0 | 0 | 20543 | 74 | 55363 | 0 |
| three-years-p0-3 | spirits | 0.4 | 0.04 | 4394 | 363 | 400 | 13882 | 47 | 64456 | 0 |
| three-years-p0-4 | base | 0 | 0 | 6501 | 0 | 0 | 8206 | 66 | 37159 | 5 |
| three-years-p0-4 | spirits | 0.65 | 0.065 | 7273 | 980 | 990 | 9998 | 67 | 46971 | 0 |
| three-years-p2-1 | base | 0 | 0 | 5443 | 0 | 0 | 15305 | 54 | 75916 | 5 |
| three-years-p2-1 | spirits | 0.36 | 0.036 | 7103 | 550 | 580 | 20918 | 73 | 52873 | 2 |
| three-years-p2-2 | base | 0 | 0 | 4272 | 0 | 0 | 10737 | 40 | 24120 | 5 |
| three-years-p2-2 | spirits | 1.11 | 0.111 | 3437 | 832 | 910 | 10140 | 32 | 41983 | 5 |
| three-years-p2-5 | base | 0 | 0 | 4076 | 0 | 0 | 11242 | 50 | 60659 | 2 |
| three-years-p2-5 | spirits | 0.53 | 0.053 | 5118 | 579 | 640 | 14734 | 51 | 66142 | 8 |
| three-years-p2-6 | base | 0 | 0 | 4466 | 0 | 0 | 12610 | 23 | 47838 | 20 |
| three-years-p2-6 | spirits | 0.27 | 0.027 | 4647 | 270 | 300 | 12964 | 53 | 49803 | 6 |
| mean | base | 0.0 | 0.0 | 5146.0 | 0.0 | 0.0 | 13108.8 | 51.0 | 45036.0 | 4.6 |
| mean | spirits | 0.494 | 0.049 | 5326.4 | 536.6 | 570.0 | 14565.1 | 54.8 | 51399.0 | 2.6 |


Pooled over the eight spirits runs: tipsy 0.48% of dwarf-time, a mean slowdown of 0.048%.

**Reading.** Dwarves drink the nearest drink, so about one drink in ten is spirits once a still keeps them, and a dwarf is tipsy about 0.5% of its time (0.2% to 1.1% by seed). A fortress that drinks spirits is slowed by about 0.05% on average: two hours of a 10% slowdown per spirits drink, and a few spirits drinks per dwarf a season. The outcomes (population, wealth, jobs done, deaths) move with the timeline seed by seed and show no loss from spirits. Even a fortress that drank nothing but spirits, at these drinking rates (0.58 drinks a dwarf a day, two hours tipsy each), would be tipsy about 4.8% of its time: a slowdown of about 0.5%.
