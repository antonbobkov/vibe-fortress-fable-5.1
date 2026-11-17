# T-581 — How many dwarves the defence year ends with, over its seeds

**Closed:** 2026-11-17, in 75742554.

**Source:** [T-578](T-578-defence-smith-at-drill.md) · **Size:** S · **Needs:** — · **Status:** open

T-578 lets the defence year's squad drill without the forge's smith, so the kit is forged and the economy leaves its `arming` phase, as it never did before. T-570's probe of `defence_year` (`-f suite=job_waits -f probe_seeds='"defence"'`) at shift 0 ended with 38 dwarves on master 3e07e437 (run 44091911686) and 32 with only the smith out of the squad (run 44091906458); with T-578's final rule, 17 (run 44097754949), the fortress holding at 11 from day 84 to day 168 with no wave. Earlier probes of the same seed gave 15 and 19 (T-570). One seed on one timeline moves this much, and `defence_seeds` records no population, so nobody knows whether the armed economy (the specialists, the fuel worker and the stone crafts it staffs, the squad refilled to five from immigrants) costs the defence year dwarves.

## Done

`defence_seeds` rows carry the living count and the immigration waves (with the last skip reason); the verdict prints their mean over the cadences; master before T-578 and after are compared. If the armed economy costs dwarves, the cause is found and fixed in the script, or written down as the trade-off it is.

## Found

Over `defence_seeds`' 64 timelines the armed economy costs no dwarves: 29.19 living a seed and 4.97 waves on master before T-578 (run 44105783275), 29.00 and 4.88 after (run 44105791134); `defence-year`'s own mean fell from 27.9 to 21.5 while `-3`'s and `-4`'s rose by 6.5 and 9.6 ([data](../../../reports/data/2026-11-17-t581-defence-population.md)). Missed waves were `luck` or `spirit`, never `wealth` once armed; the spirit follows the deaths, whose bodies the fixture never buries (left to [T-582](../../work/T-582-fixture-buries-its-dead.md)). The carpenter's 87-day wait was the armed squad of five holding every carpentry labor; the script now gives carpentry to a civilian as it does mechanics.

With carpentry given to a civilian (75742554): `defence_seeds` run 44123558423 passes with 30.30 living a seed, 4.92 waves and 2.39 deaths; the job-wait probe of `defence-year` at shift 0 (run 44123570011) has the carpenter's longest open spell at 11.6 days, against 87 (run 44105796691).
