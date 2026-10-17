# T-362 — The three-year fortress's steel job is created and never claimed

**Closed:** 2026-10-17, in 7f14172, c05c2f7.

**Source:** T-145's runs 5 and 6 ([run 5](../../../reports/data/2026-10-16-t145-run5.txt), [run 6](../../../reports/data/2026-10-16-t145-run6.txt)) · **Size:** M · **Needs:** — · **Status:** open

## What was found

T-145 asserts that the three-year fortress makes steel (`alloy_steel` above zero). In runs 4 to 6 it makes none.

- **Run 5** (the alloy order fourth at the smelter): the smelter's first order, `smelt_hematite` maintain 40, is runnable all year because the fortress never holds 40 iron bars (8 to 29 from day 217), and a workshop takes its first runnable order (12 § Operation). So the alloy order was never reached. That part was the script; T-145 moved the alloy order to the front (`92732d1`).
- **Run 6** (the alloy order first, from day 224): the smelter creates the alloy job (`craft:<smelter>:0`) at once, and the job stays `open` from day 224 to day 294, then `blocked` to day 336 (the journal did not record the job's own `blockedReason`). Every week of that time the fortress held 38 to 40 free iron bars, 1 to 4 free flux stones and 39 to 41 free charcoal. The smelter's assigned worker (the script's fuel specialist, `SetWorkshopWorker`, labors `smelting` and hauling) is alive and is seen sleeping, eating, drinking and hauling at the samples. With the alloy job holding the smelter, no iron is smelted either (33 smelts by day 336, 32 by day 224).
- The same recipe passes `test/unit/workshops/recipe-smoke.test.ts` (every smelter recipe through the real loop, with no assigned worker), so the chain works in isolation.

So in the fortress an open craft job with all its inputs free in stock is not claimed for 70 days. Whether that is the game (the claim or fetch for a job with an assigned worker, or for a flux input lying in a deep drift) or the script (the assigned worker's labors, the reachability of the flux the miners dropped) is not established.

## Decision

Diagnose first, then fix where the fault is. The diagnosis plays the T-145 fixture to day 230 (about seven minutes) and records, every 100 ticks, the alloy job's state, `blockedReason` and `failedWalk`, each input's matching items with their tiles and reachability from the smelter, and the assigned worker's labors, current job and the board's answer for it (`hasWork`). A game fault is fixed here with its spec edit and a unit test that reproduces it; a script fault is fixed in `test/scenarios/three_years_economy.ts` under T-145.

## Done

- Steel is made in `three_years_main` (T-145's witness holds), and the cause is written in this file's closing commit.
