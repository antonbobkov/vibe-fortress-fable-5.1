# T-581 — How many dwarves the defence year ends with, over its seeds

**Source:** [T-578](T-578-defence-smith-at-drill.md) · **Size:** S · **Needs:** — · **Status:** open

T-578 lets the defence year's squad drill without the forge's smith, so the kit is forged and the economy leaves its `arming` phase, as it never did before. T-570's probe of `defence_year` (`-f suite=job_waits -f probe_seeds='"defence"'`) at shift 0 ended with 38 dwarves on master 3e07e437 (run 44091911686) and 32 with only the smith out of the squad (run 44091906458); with T-578's final rule, 17 (run 44097754949), the fortress holding at 11 from day 84 to day 168 with no wave. Earlier probes of the same seed gave 15 and 19 (T-570). One seed on one timeline moves this much, and `defence_seeds` records no population, so nobody knows whether the armed economy (the specialists, the fuel worker and the stone crafts it staffs, the squad refilled to five from immigrants) costs the defence year dwarves.

## Done

`defence_seeds` rows carry the living count and the immigration waves (with the last skip reason); the verdict prints their mean over the cadences; master before T-578 and after are compared. If the armed economy costs dwarves, the cause is found and fixed in the script, or written down as the trade-off it is.
