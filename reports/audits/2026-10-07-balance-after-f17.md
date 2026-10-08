# M8 balance after F-17

> **Filing note, orchestrator, 2026-10-07.** Written by Codex on the branch `f-17` (`ffbc723`) and filed here unchanged apart from two link targets. Read it with three facts in mind:
>
> - **The "after" fortress is the rewritten fixture, and that rewrite is not merged.** Master keeps the old fixture.
> - **The runtime fixes did not cause the fall in wealth.** With the runtime fixes applied and the old fixture unchanged, the main seed reaches 15,107 / 18,638 / 23,698 marks with every recipe chain and 8 of 8 trades complete. The rewrite at default priorities is what produces 3,423 / 4,338 / 4,950.
> - **No balance constant should move on this evidence.** [T-123](../../docs/archive/tasks/T-123-economy-fortress-at-default-priority.md) diagnoses why a fortress at default priorities does not run its economy.
>
> The simulation bugs it found are T-122, T-124 and T-125 in [the backlog](../../docs/backlog.md).

Owner work item dated 2026-10-06; measurements executed on the resumed run, 2026-10-07. This is a new audit; the earlier [economy report](M8-balance-economy.md) is frozen. Fixture commit: `bdfee61f47893d3859fd099bf2d9b3236f7cb76c`. No simulation constant, content row or runtime dependency changed in tasks 3–4.

The comparison combines tasks 1-2 runtime corrections (input ownership, craft quality, dwarf renown and winter wave sizing) with the player-fixture changes. It does not isolate the effect of priorities alone.

## Before → after

| Metric | Before | After | Comparison |
| --- | --- | --- | --- |
| Wealth Y1 / Y2 / Y3 | 10,740 / 23,687 / 31,808 | 3,423 / 4,338 / 4,950 | 4–8k / 15–25k / 35–60k |
| Population Y1 / Y2 / Y3 | 12 / 12 / 12 | 12 / 12 / 14 | living dwarves |
| Food / living dwarf-day | 0.246065 | 0.325318 | 0.48 |
| Drink / living dwarf-day | 0.407308 | 0.497941 | 0.77 |
| Mood: daily time mean | 34.65 | 50.53 | 55–60 steady; ~70 peak |
| Mood: endpoint mean | 38.0 | 51.4 | snapshot, not time mean |
| Main dwarf deaths | 0 | 0 | 0 |
| Main trades / arrivals | 8/8 | 4/8 | all visiting caravans |
| Peril 0: surviving seeds | 7/7 | 3/7 | end of day 336 |
| Peril 2: surviving seeds | 0/7 | 0/7 | end of day 336 |
| Peril 4: surviving seeds | 0/6 | 0/6 | end of day 336 |
| Peril 0: zero-death seeds | 7/7 | 2/7 | original sweep guarantee |

## Time-boxed fixture attempts

| Resumed run | Fixture choice | Final population | Dwarf deaths | Wealth Y1 / Y2 / Y3 | Outcome |
| --- | --- | --- | --- | --- | --- |
| 1 | public connectivity reader; snapshot fixture | 14 | 0 | 3,423 / 4,338 / 4,950 | survives; missing recipe witness fails |
| 2 | beds ordered before spare barrels | 11 | 1 | 3,455 / 3,919 / 4,212 | starvation day 195, entity 16777294; rejected and reverted |
| 3 | restore snapshot ordering; pin explicit known gaps | 14 | 0 | 3,423 / 4,338 / 4,950 | 1710 tests pass with explicitly recorded gap signatures |

Only these three further full main runs were used. The sweep and mood instrument are separate once-only measurement runs, not further fixture tuning. Raw JSON retains the abandoned experiment and its death rather than hiding it.

## What the player fixture now does

Workshop footprints and forbidden corners avoid the entrance stair, gate approaches and mine shafts. The depot standing ring avoids workshops and its trees are felled. Ordinary orders/designations/stockpiles use 5; food and hauling labors get one step for their bottlenecks; construction also uses 5. One miner stays on mining; the second supports initial masonry and then returns to mining; the stone crafter keeps stone crafts, and a gem-skilled miner changes profession only once rough gems supply the bench. Existing export-hauling jobs receive the visiting-caravan deadline as well as new ones. Furnace/smelter/forge workers and orders start first on dangerous sites, above the need-deferral cutoff. General metal production follows the kit. The peaceful metal worker retains support labors until an anvil is available. Years 2/3 open deeper dry-rock drifts; export crafts and steel batches continue. The existing ten skill points per founder are redistributed through the real embark session; supplies stay within its budget. The cave plots use the existing dimcap and cavewheat seeds. Any time-boxed production witness left incomplete is explicitly recorded below; survival and mood assertions remain active.

## Wealth by driver and year

| Driver | Y1 before → after | Y2 before → after | Y3 before → after |
| --- | --- | --- | --- |
| embark goods | 1,319 → 1,311 | 1,244 → 1,299 | 1,242 → 1,269 |
| blocks | 78 → 87 | 76 → 87 | 76 → 84 |
| furniture | 350 → 175 | 350 → 191 | 350 → 212 |
| crafts | 198 → 150 | 228 → 372 | 126 → 349 |
| meals/drink | 6,295 → 30 | 14,530 → 35 | 16,537 → 75 |
| iron goods | 0 → 0 | 2,293 → 0 | 4,950 → 0 |
| steel goods | 0 → 0 | 0 → 0 | 720 → 0 |
| iron bars | 360 → 0 | 615 → 300 | 585 → 495 |
| steel bars | 0 → 0 | 0 → 0 | 0 → 120 |
| gems | 90 → 0 | 78 → 0 | 78 → 0 |
| smoothing/engraving | 0 → 0 | 0 → 0 | 0 → 0 |
| other building value | 169 → 150 | 184 → 153 | 184 → 173 |
| trade purchases | 1 → 1 | 838 → 0 | 3,326 → 125 |
| barrels | 147 → 141 | 438 → 408 | 873 → 513 |
| other | 1,733 → 1,378 | 2,813 → 1,493 | 2,761 → 1,535 |
| **Total** | 10,740 → 3,423 | 23,687 → 4,338 | 31,808 → 4,950 |

Unapplied craft quality adjustment is counterfactual quality-enabled value minus the actual value: zero means the F-17a quality adjustment is already included. The disjoint driver ledger sums to the wealth reader in every annual snapshot; smoothing/engraving contributes room score, zero wealth. Abandoned stock on extinct sites is not a living wealth-model observation.

| Year | Craft qualities (count by index) | Unapplied craft quality adjustment before → after | Max crafting / gem / metal skill | Smoothed / engraved |
| --- | --- | --- | --- | --- |
| 1 | {"0": 6, "1": 36, "2": 9} | -86 → 0 | 5 / 5 / 4 | 99 / 0 |
| 2 | {"0": 15, "1": 81, "2": 27} | -74 → 0 | 5 / 5 / 4 | 227 / 0 |
| 3 | {"0": 12, "1": 39, "2": 30} | -860 → 0 | 6 / 5 / 4 | 310 / 65 |

| Recipe witness | Before: completed jobs | After: completed jobs |
| --- | --- | --- |
| make_bed | 19 | 2 |
| make_barrel | 98 | 59 |
| cook_easy_meal | 122 | 218 |
| cook_fine_meal | 46 | 2 |
| cook_lavish_meal | 187 | 0 |
| craft_stone | 121 | 60 |
| make_charcoal | 186 | 60 |
| smelt_hematite | 58 | 17 |
| smelt_limonite | 7 | 1 |
| cut_gem | 9 | 0 |
| forge_pick | 2 | 0 |
| forge_mail_shirt | 6 | 0 |
| forge_crafts | 24 | 0 |
| alloy_steel | 7 | 3 |

## Survival and outcomes, every seed

| Seed | Peril | Wealth Y1 / Y2 / Y3 | Population Y1 / Y2 / Y3 | Dwarf / tame deaths | Extinction day before → after | Kit day | Other waves | Trades / arrivals | Food / drink per dwarf-day | Endpoint mood |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| three-years-p0-1 | 0 | 3,895 / 5,401 / 5,505 | 14 / 16 / 16 | 0 / 0 | — → — | not tracked (peaceful) | 1 | 7/8 | 0.352 / 0.544 | 50.6 |
| three-years-p0-2 | 0 | 3,593 / 2,873 / 2,849 | 0 / 0 / 0 | 13 / 0 | — → 74 | not tracked (peaceful) | 0 | 1/8 | 0.359 / 0.293 | extinct |
| three-years-p0-3 | 0 | 3,804 / 7,217 / 4,366 | 14 / 0 / 0 | 17 / 0 | — → 205 | not tracked (peaceful) | 1 | 5/8 | 0.337 / 0.478 | extinct |
| three-years-p0-4 | 0 | 6,433 / 5,101 / 9,156 | 12 / 20 / 14 | 6 / 0 | — → — | not tracked (peaceful) | 2 | 6/8 | 0.349 / 0.512 | 40.6 |
| three-years-p0-5 | 0 | 3,431 / 4,383 / 4,970 | 13 / 15 / 15 | 0 / 0 | — → — | not tracked (peaceful) | 1 | 8/8 | 0.327 / 0.527 | 58.2 |
| three-years-p0-6 | 0 | 2,734 / 2,686 / 2,671 | 0 / 0 / 0 | 9 / 0 | — → 56 | not tracked (peaceful) | 0 | 0/8 | 0.374 / 0.371 | extinct |
| three-years-p0-7 | 0 | 3,837 / 4,920 / 5,439 | 14 / 14 / 0 | 14 / 0 | — → 251 | not tracked (peaceful) | 0 | 6/8 | 0.350 / 0.449 | extinct |
| three-years-p2-1 | 2 | 3,897 / 3,214 / 2,844 | 0 / 0 / 0 | 13 / 8 | 46 → 80 | unfinished | 0 | 0/8 | 0.318 / 0.475 | extinct |
| three-years-p2-2 | 2 | 4,198 / 3,787 / 3,281 | 0 / 0 / 0 | 11 / 4 | 46 → 86 | unfinished | 0 | 0/8 | 0.290 / 0.488 | extinct |
| three-years-p2-3 | 2 | 3,443 / 3,043 / 2,969 | 12 / 0 / 0 | 15 / 2 | 121 → 173 | unfinished | 0 | 0/8 | 0.334 / 0.430 | extinct |
| three-years-p2-4 | 2 | 3,772 / 3,107 / 2,966 | 0 / 0 / 0 | 13 / 6 | 123 → 86 | unfinished | 0 | 0/8 | 0.308 / 0.488 | extinct |
| three-years-p2-5 | 2 | 4,444 / 3,516 / 2,935 | 3 / 0 / 0 | 14 / 7 | 46 → 166 | unfinished | 0 | 1/8 | 0.300 / 0.507 | extinct |
| three-years-p2-6 | 2 | 3,103 / 2,844 / 2,676 | 0 / 0 / 0 | 13 / 7 | 134 → 68 | unfinished | 0 | 0/8 | 0.355 / 0.531 | extinct |
| three-years-p2-7 | 2 | 3,583 / 3,288 / 3,228 | 0 / 0 / 0 | 14 / 8 | 46 → 78 | unfinished | 0 | 0/8 | 0.304 / 0.416 | extinct |
| three-years-p4-1 | 4 | 2,520 / 2,386 / 1,980 | 0 / 0 / 0 | 11 / 3 | 52 → 34 | unfinished | 0 | 0/8 | 0.352 / 0.551 | extinct |
| three-years-p4-2 | 4 | 3,528 / 3,228 / 3,069 | 0 / 0 / 0 | 11 / 3 | 56 → 47 | unfinished | 0 | 0/8 | 0.357 / 0.539 | extinct |
| three-years-p4-3 | 4 | 2,898 / 2,709 / 2,541 | 0 / 0 / 0 | 9 / 7 | 32 → 34 | unfinished | 0 | 0/8 | 0.368 / 0.570 | extinct |
| three-years-p4-4 | 4 | 2,937 / 2,023 / 1,683 | 0 / 0 / 0 | 11 / 6 | 35 → 47 | unfinished | 0 | 0/8 | 0.376 / 0.562 | extinct |
| three-years-p4-5 | 4 | 2,798 / 2,165 / 2,066 | 0 / 0 / 0 | 9 / 7 | 45 → 32 | unfinished | 0 | 0/8 | 0.386 / 0.575 | extinct |
| three-years-p4-6 | 4 | 3,202 / 2,863 / 2,713 | 0 / 0 / 0 | 10 / 3 | 43 → 39 | unfinished | 0 | 0/8 | 0.365 / 0.566 | extinct |

Peril 0: 3/7 survivors; dwarf death causes bled_out: 5, killed: 1, starvation: 53. Peaceful kit deadlines are not tracked.

Peril 2: 0/7 survivors; dwarf death causes bled_out: 43, killed: 16, starvation: 34. Completed kits: none; unfinished: 7.

Peril 4: 0/6 survivors; dwarf death causes bled_out: 44, killed: 17. Completed kits: none; unfinished: 6.

### Every fortress death

These are event causes, including deaths before the old 20-day bootstrap listener. `starvation` is the engine label for lethal starvation/dehydration damage; this instrument does not distinguish the two need counters. IDs distinguish every individual; killer 0 means no killer ID was supplied. An extinction follows the last living dwarf death, except where a later immigration wave repopulates a site; the sweep separately records the first observed empty population.

| Seed | Day | Entity | Species | Cause | Killer |
| --- | --- | --- | --- | --- | --- |
| three-years-p0-2 | 58 | 16777290 | dwarf | starvation | 0 |
| three-years-p0-2 | 58 | 117440944 | dwarf | starvation | 0 |
| three-years-p0-2 | 59 | 16777291 | dwarf | starvation | 0 |
| three-years-p0-2 | 59 | 16777293 | dwarf | starvation | 0 |
| three-years-p0-2 | 59 | 16777295 | dwarf | starvation | 0 |
| three-years-p0-2 | 62 | 16777292 | dwarf | starvation | 0 |
| three-years-p0-2 | 62 | 16777657 | dwarf | starvation | 0 |
| three-years-p0-2 | 63 | 16777289 | dwarf | starvation | 0 |
| three-years-p0-2 | 63 | 16777294 | dwarf | starvation | 0 |
| three-years-p0-2 | 74 | 50332161 | dwarf | starvation | 0 |
| three-years-p0-2 | 74 | 50332272 | dwarf | starvation | 0 |
| three-years-p0-2 | 74 | 50332276 | dwarf | starvation | 0 |
| three-years-p0-2 | 74 | 50332282 | dwarf | starvation | 0 |
| three-years-p0-3 | 203 | 150995169 | dwarf | starvation | 0 |
| three-years-p0-3 | 204 | 16777289 | dwarf | starvation | 0 |
| three-years-p0-3 | 204 | 16777292 | dwarf | starvation | 0 |
| three-years-p0-3 | 204 | 16777294 | dwarf | starvation | 0 |
| three-years-p0-3 | 204 | 16777669 | dwarf | starvation | 0 |
| three-years-p0-3 | 204 | 16777677 | dwarf | starvation | 0 |
| three-years-p0-3 | 204 | 117441045 | dwarf | starvation | 0 |
| three-years-p0-3 | 204 | 117441048 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 16777290 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 16777291 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 16777293 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 16777295 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 251658449 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 50332095 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 16777673 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 218104274 | dwarf | starvation | 0 |
| three-years-p0-3 | 205 | 218104456 | dwarf | starvation | 0 |
| three-years-p0-4 | 330 | 16777290 | dwarf | bled_out | 1426063988 |
| three-years-p0-4 | 333 | 83886506 | dwarf | bled_out | 1426063988 |
| three-years-p0-4 | 333 | 721420793 | dwarf | bled_out | 1426063988 |
| three-years-p0-4 | 334 | 285213324 | dwarf | killed | 1426063988 |
| three-years-p0-4 | 335 | 251658757 | dwarf | bled_out | 1426063988 |
| three-years-p0-4 | 335 | 285212848 | dwarf | bled_out | 1426063988 |
| three-years-p0-6 | 54 | 16777639 | dwarf | starvation | 0 |
| three-years-p0-6 | 55 | 16777292 | dwarf | starvation | 0 |
| three-years-p0-6 | 55 | 16777293 | dwarf | starvation | 0 |
| three-years-p0-6 | 55 | 16777294 | dwarf | starvation | 0 |
| three-years-p0-6 | 55 | 16777295 | dwarf | starvation | 0 |
| three-years-p0-6 | 55 | 16777296 | dwarf | starvation | 0 |
| three-years-p0-6 | 55 | 16777297 | dwarf | starvation | 0 |
| three-years-p0-6 | 56 | 16777291 | dwarf | starvation | 0 |
| three-years-p0-6 | 56 | 50332066 | dwarf | starvation | 0 |
| three-years-p0-7 | 247 | 50332237 | dwarf | starvation | 0 |
| three-years-p0-7 | 248 | 16777290 | dwarf | starvation | 0 |
| three-years-p0-7 | 248 | 16777294 | dwarf | starvation | 0 |
| three-years-p0-7 | 248 | 150995346 | dwarf | starvation | 0 |
| three-years-p0-7 | 248 | 50332233 | dwarf | starvation | 0 |
| three-years-p0-7 | 249 | 16777291 | dwarf | starvation | 0 |
| three-years-p0-7 | 249 | 16777293 | dwarf | starvation | 0 |
| three-years-p0-7 | 249 | 50331896 | dwarf | starvation | 0 |
| three-years-p0-7 | 250 | 16777289 | dwarf | starvation | 0 |
| three-years-p0-7 | 250 | 16777292 | dwarf | starvation | 0 |
| three-years-p0-7 | 250 | 16777634 | dwarf | starvation | 0 |
| three-years-p0-7 | 250 | 50332228 | dwarf | starvation | 0 |
| three-years-p0-7 | 251 | 16777288 | dwarf | starvation | 0 |
| three-years-p0-7 | 251 | 50331886 | dwarf | starvation | 0 |
| three-years-p2-1 | 62 | 16777285 | cat | killed | 50332098 |
| three-years-p2-1 | 62 | 16777283 | dog | bled_out | 50332098 |
| three-years-p2-1 | 62 | 50332142 | cat | bled_out | 150995412 |
| three-years-p2-1 | 62 | 16777290 | dwarf | killed | 150995412 |
| three-years-p2-1 | 63 | 184549709 | dog | bled_out | 50332098 |
| three-years-p2-1 | 63 | 16777556 | dog | bled_out | 50332098 |
| three-years-p2-1 | 63 | 16777284 | dog | bled_out | 150995412 |
| three-years-p2-1 | 63 | 117440844 | dog | bled_out | 50332098 |
| three-years-p2-1 | 63 | 83886232 | dog | bled_out | 50332098 |
| three-years-p2-1 | 67 | 16777292 | dwarf | killed | 50332092 |
| three-years-p2-1 | 68 | 50332015 | dwarf | killed | 352321665 |
| three-years-p2-1 | 68 | 16777289 | dwarf | bled_out | 352321665 |
| three-years-p2-1 | 68 | 16777588 | dwarf | bled_out | 218104174 |
| three-years-p2-1 | 69 | 16777286 | dwarf | bled_out | 218104174 |
| three-years-p2-1 | 69 | 251658279 | dwarf | bled_out | 352321665 |
| three-years-p2-1 | 69 | 50332141 | dwarf | bled_out | 352321665 |
| three-years-p2-1 | 69 | 16777592 | dwarf | bled_out | 352321665 |
| three-years-p2-1 | 70 | 50332146 | dwarf | killed | 16777974 |
| three-years-p2-1 | 73 | 16777288 | dwarf | bled_out | 352321665 |
| three-years-p2-1 | 79 | 16777291 | dwarf | starvation | 0 |
| three-years-p2-1 | 80 | 16777287 | dwarf | starvation | 0 |
| three-years-p2-2 | 61 | 16777284 | dog | killed | 83886544 |
| three-years-p2-2 | 61 | 150995356 | dog | killed | 83886544 |
| three-years-p2-2 | 61 | 16777286 | cat | killed | 50332325 |
| three-years-p2-2 | 61 | 16777285 | dog | bled_out | 83886749 |
| three-years-p2-2 | 61 | 16777292 | dwarf | bled_out | 83886749 |
| three-years-p2-2 | 61 | 50332340 | dwarf | bled_out | 83886544 |
| three-years-p2-2 | 61 | 16777291 | dwarf | bled_out | 83886749 |
| three-years-p2-2 | 62 | 16777290 | dwarf | bled_out | 83886749 |
| three-years-p2-2 | 62 | 16777293 | dwarf | killed | 83886749 |
| three-years-p2-2 | 62 | 16777650 | dwarf | bled_out | 83886544 |
| three-years-p2-2 | 62 | 83886657 | dwarf | bled_out | 83886749 |
| three-years-p2-2 | 85 | 16777287 | dwarf | starvation | 0 |
| three-years-p2-2 | 85 | 16777288 | dwarf | starvation | 0 |
| three-years-p2-2 | 85 | 184549804 | dwarf | starvation | 0 |
| three-years-p2-2 | 86 | 16777289 | dwarf | starvation | 0 |
| three-years-p2-3 | 60 | 16777289 | dwarf | bled_out | 83886722 |
| three-years-p2-3 | 70 | 16777283 | cat | killed | 285212830 |
| three-years-p2-3 | 70 | 50332145 | cat | bled_out | 83886722 |
| three-years-p2-3 | 70 | 150995191 | dwarf | bled_out | 83886722 |
| three-years-p2-3 | 70 | 50332144 | dwarf | bled_out | 285212830 |
| three-years-p2-3 | 120 | 16777658 | dwarf | bled_out | 83886611 |
| three-years-p2-3 | 120 | 50331907 | dwarf | bled_out | 83886611 |
| three-years-p2-3 | 171 | 16777284 | dwarf | starvation | 0 |
| three-years-p2-3 | 171 | 16777652 | dwarf | starvation | 0 |
| three-years-p2-3 | 172 | 16777285 | dwarf | starvation | 0 |
| three-years-p2-3 | 172 | 16777286 | dwarf | starvation | 0 |
| three-years-p2-3 | 172 | 16777288 | dwarf | starvation | 0 |
| three-years-p2-3 | 172 | 16777290 | dwarf | starvation | 0 |
| three-years-p2-3 | 172 | 251658463 | dwarf | starvation | 0 |
| three-years-p2-3 | 173 | 16777287 | dwarf | starvation | 0 |
| three-years-p2-3 | 173 | 184549858 | dwarf | starvation | 0 |
| three-years-p2-3 | 173 | 50332148 | dwarf | starvation | 0 |
| three-years-p2-4 | 63 | 16777600 | dog | bled_out | 50332155 |
| three-years-p2-4 | 63 | 16777283 | dog | killed | 50332155 |
| three-years-p2-4 | 63 | 16777599 | dog | bled_out | 83886570 |
| three-years-p2-4 | 63 | 16777291 | dwarf | bled_out | 83886570 |
| three-years-p2-4 | 63 | 16777601 | dog | killed | 83886570 |
| three-years-p2-4 | 63 | 16777637 | dwarf | bled_out | 50332162 |
| three-years-p2-4 | 63 | 16777282 | dog | killed | 83886570 |
| three-years-p2-4 | 63 | 50332202 | dwarf | bled_out | 251658785 |
| three-years-p2-4 | 64 | 16777287 | dwarf | bled_out | 50332162 |
| three-years-p2-4 | 64 | 16777285 | dwarf | bled_out | 50332155 |
| three-years-p2-4 | 65 | 16777284 | cat | killed | 50332155 |
| three-years-p2-4 | 66 | 117440995 | dwarf | bled_out | 83886570 |
| three-years-p2-4 | 66 | 50332062 | dwarf | bled_out | 83886570 |
| three-years-p2-4 | 67 | 50332198 | dwarf | bled_out | 50332162 |
| three-years-p2-4 | 79 | 16777289 | dwarf | killed | 251658650 |
| three-years-p2-4 | 79 | 16777290 | dwarf | killed | 251658650 |
| three-years-p2-4 | 85 | 184549785 | dwarf | starvation | 0 |
| three-years-p2-4 | 86 | 16777286 | dwarf | starvation | 0 |
| three-years-p2-4 | 86 | 16777288 | dwarf | starvation | 0 |
| three-years-p2-5 | 58 | 16777281 | dog | killed | 50332229 |
| three-years-p2-5 | 58 | 16777290 | dwarf | bled_out | 83886677 |
| three-years-p2-5 | 58 | 184549608 | dog | killed | 83886677 |
| three-years-p2-5 | 58 | 16777282 | dog | killed | 50332237 |
| three-years-p2-5 | 58 | 117440825 | dog | killed | 50332229 |
| three-years-p2-5 | 58 | 83886512 | dog | killed | 50332229 |
| three-years-p2-5 | 58 | 251658573 | dog | bled_out | 50332229 |
| three-years-p2-5 | 58 | 16777283 | cat | killed | 50332229 |
| three-years-p2-5 | 58 | 16777288 | dwarf | bled_out | 50332251 |
| three-years-p2-5 | 58 | 16777289 | dwarf | bled_out | 50332237 |
| three-years-p2-5 | 74 | 16777284 | dwarf | bled_out | 251658604 |
| three-years-p2-5 | 89 | 16777590 | dwarf | starvation | 0 |
| three-years-p2-5 | 90 | 150995312 | dwarf | starvation | 0 |
| three-years-p2-5 | 91 | 419430679 | dwarf | starvation | 0 |
| three-years-p2-5 | 92 | 83886317 | dwarf | starvation | 0 |
| three-years-p2-5 | 94 | 16777287 | dwarf | killed | 251658604 |
| three-years-p2-5 | 96 | 83886563 | dwarf | bled_out | 16778028 |
| three-years-p2-5 | 98 | 16777286 | dwarf | bled_out | 251658604 |
| three-years-p2-5 | 123 | 16777586 | dwarf | bled_out | 50332436 |
| three-years-p2-5 | 165 | 83886572 | dwarf | starvation | 0 |
| three-years-p2-5 | 166 | 16777285 | dwarf | starvation | 0 |
| three-years-p2-6 | 61 | 16777283 | dog | bled_out | 218104122 |
| three-years-p2-6 | 61 | 16777574 | dwarf | bled_out | 218104122 |
| three-years-p2-6 | 61 | 16777292 | dwarf | bled_out | 218104122 |
| three-years-p2-6 | 61 | 16777285 | cat | killed | 218104122 |
| three-years-p2-6 | 61 | 16777291 | dwarf | killed | 50332215 |
| three-years-p2-6 | 61 | 16777286 | dwarf | bled_out | 218104122 |
| three-years-p2-6 | 61 | 16777284 | dog | bled_out | 218104122 |
| three-years-p2-6 | 62 | 50332111 | dwarf | bled_out | 218104122 |
| three-years-p2-6 | 62 | 16777288 | dwarf | bled_out | 218104122 |
| three-years-p2-6 | 62 | 184549666 | dog | bled_out | 218104122 |
| three-years-p2-6 | 62 | 50332109 | dwarf | bled_out | 50332215 |
| three-years-p2-6 | 62 | 218104156 | dog | bled_out | 218104122 |
| three-years-p2-6 | 62 | 16777648 | dog | bled_out | 218104122 |
| three-years-p2-6 | 62 | 16777649 | dog | bled_out | 218104122 |
| three-years-p2-6 | 62 | 16777287 | dwarf | killed | 50332215 |
| three-years-p2-6 | 66 | 16777569 | dwarf | bled_out | 50332205 |
| three-years-p2-6 | 66 | 16777289 | dwarf | killed | 218104122 |
| three-years-p2-6 | 67 | 83886544 | dwarf | bled_out | 50332215 |
| three-years-p2-6 | 68 | 285212996 | dwarf | killed | 50332215 |
| three-years-p2-6 | 68 | 16777290 | dwarf | killed | 251658366 |
| three-years-p2-7 | 60 | 16777600 | dog | killed | 251658576 |
| three-years-p2-7 | 60 | 16777282 | dog | killed | 50332210 |
| three-years-p2-7 | 60 | 16777598 | dog | bled_out | 50332216 |
| three-years-p2-7 | 60 | 83886344 | dog | killed | 251658576 |
| three-years-p2-7 | 60 | 50332239 | cat | killed | 50332210 |
| three-years-p2-7 | 60 | 16777281 | dog | bled_out | 251658576 |
| three-years-p2-7 | 60 | 16777599 | dog | bled_out | 50332216 |
| three-years-p2-7 | 61 | 16777283 | cat | killed | 83886637 |
| three-years-p2-7 | 61 | 16777285 | dwarf | bled_out | 83886637 |
| three-years-p2-7 | 61 | 117441116 | dwarf | bled_out | 83886637 |
| three-years-p2-7 | 74 | 16777286 | dwarf | killed | 251658576 |
| three-years-p2-7 | 74 | 16777287 | dwarf | killed | 50332076 |
| three-years-p2-7 | 74 | 184549830 | dwarf | killed | 50332210 |
| three-years-p2-7 | 77 | 16777288 | dwarf | starvation | 0 |
| three-years-p2-7 | 77 | 117440918 | dwarf | starvation | 0 |
| three-years-p2-7 | 77 | 16777623 | dwarf | starvation | 0 |
| three-years-p2-7 | 78 | 16777284 | dwarf | starvation | 0 |
| three-years-p2-7 | 78 | 16777289 | dwarf | starvation | 0 |
| three-years-p2-7 | 78 | 16777290 | dwarf | starvation | 0 |
| three-years-p2-7 | 78 | 16777627 | dwarf | starvation | 0 |
| three-years-p2-7 | 78 | 50332245 | dwarf | starvation | 0 |
| three-years-p2-7 | 78 | 50332249 | dwarf | starvation | 0 |
| three-years-p4-1 | 31 | 16777592 | dwarf | bled_out | 16777606 |
| three-years-p4-1 | 31 | 16777596 | dwarf | bled_out | 16777612 |
| three-years-p4-1 | 31 | 16777588 | dwarf | bled_out | 16777612 |
| three-years-p4-1 | 31 | 16777290 | dwarf | bled_out | 16777612 |
| three-years-p4-1 | 31 | 16777286 | dog | killed | 16777606 |
| three-years-p4-1 | 31 | 16777288 | cat | bled_out | 50332073 |
| three-years-p4-1 | 31 | 16777287 | dog | killed | 16777628 |
| three-years-p4-1 | 31 | 16777291 | dwarf | bled_out | 16777606 |
| three-years-p4-1 | 31 | 16777294 | dwarf | killed | 50332073 |
| three-years-p4-1 | 31 | 16777293 | dwarf | bled_out | 50332073 |
| three-years-p4-1 | 31 | 16777295 | dwarf | bled_out | 50332059 |
| three-years-p4-1 | 32 | 16777289 | dwarf | killed | 50332059 |
| three-years-p4-1 | 33 | 16777292 | dwarf | killed | 16777612 |
| three-years-p4-1 | 34 | 251658493 | dwarf | bled_out | 16777721 |
| three-years-p4-2 | 39 | 16777289 | dog | killed | 50332247 |
| three-years-p4-2 | 39 | 16777290 | dog | killed | 16777816 |
| three-years-p4-2 | 39 | 16777291 | cat | bled_out | 50332247 |
| three-years-p4-2 | 39 | 16777298 | dwarf | killed | 50332247 |
| three-years-p4-2 | 39 | 16777297 | dwarf | bled_out | 16777791 |
| three-years-p4-2 | 39 | 16777296 | dwarf | bled_out | 16777808 |
| three-years-p4-2 | 39 | 16777703 | dwarf | bled_out | 16777797 |
| three-years-p4-2 | 39 | 16777698 | dwarf | bled_out | 16777797 |
| three-years-p4-2 | 39 | 16777292 | dwarf | bled_out | 16777797 |
| three-years-p4-2 | 39 | 16777294 | dwarf | bled_out | 50332247 |
| three-years-p4-2 | 40 | 16777295 | dwarf | bled_out | 16777808 |
| three-years-p4-2 | 40 | 16777293 | dwarf | bled_out | 16777797 |
| three-years-p4-2 | 47 | 16777694 | dwarf | bled_out | 16778051 |
| three-years-p4-2 | 47 | 184549839 | dwarf | bled_out | 16777797 |
| three-years-p4-3 | 31 | 16777290 | cat | killed | 16777742 |
| three-years-p4-3 | 31 | 16777288 | dog | bled_out | 16777742 |
| three-years-p4-3 | 31 | 16777704 | dog | killed | 16777753 |
| three-years-p4-3 | 31 | 16777289 | dog | killed | 16777753 |
| three-years-p4-3 | 31 | 83886564 | dog | killed | 16777759 |
| three-years-p4-3 | 31 | 16777705 | dog | killed | 16777763 |
| three-years-p4-3 | 31 | 16777706 | dog | killed | 16777753 |
| three-years-p4-3 | 31 | 16777296 | dwarf | bled_out | 16777763 |
| three-years-p4-3 | 31 | 16777297 | dwarf | killed | 16777768 |
| three-years-p4-3 | 31 | 16777292 | dwarf | killed | 16777759 |
| three-years-p4-3 | 31 | 16777295 | dwarf | bled_out | 16777742 |
| three-years-p4-3 | 31 | 83886586 | dwarf | bled_out | 16777742 |
| three-years-p4-3 | 31 | 16777294 | dwarf | bled_out | 16777742 |
| three-years-p4-3 | 32 | 16777291 | dwarf | bled_out | 16777747 |
| three-years-p4-3 | 32 | 16777293 | dwarf | killed | 16777763 |
| three-years-p4-3 | 33 | 16777727 | dwarf | killed | 16777753 |
| three-years-p4-4 | 33 | 16777676 | dwarf | bled_out | 352322007 |
| three-years-p4-4 | 33 | 50332061 | dog | killed | 16777709 |
| three-years-p4-4 | 33 | 16777288 | dog | killed | 16777715 |
| three-years-p4-4 | 33 | 16777672 | dwarf | bled_out | 352322007 |
| three-years-p4-4 | 33 | 50332060 | dog | killed | 16777709 |
| three-years-p4-4 | 33 | 16777295 | dwarf | killed | 16777715 |
| three-years-p4-4 | 33 | 16777292 | dwarf | bled_out | 352322007 |
| three-years-p4-4 | 33 | 16777289 | cat | killed | 16777709 |
| three-years-p4-4 | 33 | 16777630 | dog | bled_out | 16777728 |
| three-years-p4-4 | 33 | 16777287 | dog | killed | 16777721 |
| three-years-p4-4 | 33 | 16777291 | dwarf | bled_out | 16777704 |
| three-years-p4-4 | 33 | 16777296 | dwarf | killed | 16777721 |
| three-years-p4-4 | 33 | 16777293 | dwarf | bled_out | 16777704 |
| three-years-p4-4 | 33 | 16777661 | dwarf | bled_out | 16777704 |
| three-years-p4-4 | 34 | 16777666 | dwarf | killed | 16777715 |
| three-years-p4-4 | 46 | 16777294 | dwarf | bled_out | 50332345 |
| three-years-p4-4 | 47 | 16777290 | dwarf | killed | 50332322 |
| three-years-p4-5 | 32 | 16777654 | dwarf | killed | 16777689 |
| three-years-p4-5 | 32 | 16777288 | dog | killed | 50332133 |
| three-years-p4-5 | 32 | 16777636 | dog | killed | 50332133 |
| three-years-p4-5 | 32 | 16777289 | dog | killed | 16777713 |
| three-years-p4-5 | 32 | 16777637 | dog | bled_out | 16777721 |
| three-years-p4-5 | 32 | 50331894 | dog | killed | 16777713 |
| three-years-p4-5 | 32 | 16777638 | dog | killed | 16777726 |
| three-years-p4-5 | 32 | 16777292 | dwarf | killed | 16777684 |
| three-years-p4-5 | 32 | 16777297 | dwarf | bled_out | 50332173 |
| three-years-p4-5 | 32 | 150995217 | dwarf | bled_out | 50332127 |
| three-years-p4-5 | 32 | 16777294 | dwarf | bled_out | 16777689 |
| three-years-p4-5 | 32 | 16777293 | dwarf | bled_out | 50332127 |
| three-years-p4-5 | 32 | 16777290 | cat | killed | 16777706 |
| three-years-p4-5 | 32 | 16777291 | dwarf | bled_out | 16777689 |
| three-years-p4-5 | 32 | 16777295 | dwarf | bled_out | 16777684 |
| three-years-p4-5 | 32 | 16777296 | dwarf | killed | 16777721 |
| three-years-p4-6 | 37 | 16777291 | dwarf | bled_out | 16777710 |
| three-years-p4-6 | 37 | 16777287 | dog | bled_out | 16777744 |
| three-years-p4-6 | 37 | 16777288 | cat | killed | 83886570 |
| three-years-p4-6 | 37 | 16777286 | dog | killed | 16777744 |
| three-years-p4-6 | 37 | 16777632 | dwarf | bled_out | 50332148 |
| three-years-p4-6 | 37 | 16777293 | dwarf | killed | 16777744 |
| three-years-p4-6 | 37 | 16777295 | dwarf | killed | 50332168 |
| three-years-p4-6 | 37 | 16777294 | dwarf | bled_out | 83886570 |
| three-years-p4-6 | 37 | 16777290 | dwarf | bled_out | 50332148 |
| three-years-p4-6 | 38 | 16777292 | dwarf | bled_out | 83886570 |
| three-years-p4-6 | 39 | 16777289 | dwarf | bled_out | 50332148 |
| three-years-p4-6 | 39 | 251658585 | dwarf | bled_out | 50332148 |
| three-years-p4-6 | 39 | 16777638 | dwarf | bled_out | 50332148 |

### Every encounter

| Seed | Day | Kind | Size | Party | Outcome |
| --- | --- | --- | --- | --- | --- |
| three-years | 125 | thief | 1 | 419430838 | withdrew |
| three-years | 207 | thief | 1 | 218104582 | looted |
| three-years | 298 | thief | 1 | 1224737010 | withdrew |
| three-years-p0-1 | 115 | thief | 1 | 922746910 | looted |
| three-years-p0-1 | 201 | thief | 1 | 520094411 | looted |
| three-years-p0-1 | 264 | thief | 1 | 419431021 | withdrew |
| three-years-p0-2 | 126 | thief | 1 | 184549845 | looted |
| three-years-p0-2 | 205 | thief | 1 | 251658671 | looted |
| three-years-p0-2 | 288 | thief | 1 | 50332322 | looted |
| three-years-p0-3 | 117 | thief | 1 | 318767671 | withdrew |
| three-years-p0-3 | 225 | thief | 1 | 419431036 | looted |
| three-years-p0-3 | 302 | thief | 1 | 150995715 | looted |
| three-years-p0-4 | 123 | thief | 1 | 285213336 | withdrew |
| three-years-p0-4 | 242 | thief | 1 | 285213449 | withdrew |
| three-years-p0-5 | 116 | thief | 1 | 50332300 | looted |
| three-years-p0-5 | 228 | thief | 1 | 1157628050 | withdrew |
| three-years-p0-5 | 315 | thief | 1 | 922747540 | looted |
| three-years-p0-6 | 126 | thief | 1 | 50331708 | looted |
| three-years-p0-6 | 204 | thief | 1 | 218104212 | looted |
| three-years-p0-6 | 293 | thief | 1 | 83886663 | looted |
| three-years-p0-7 | 131 | thief | 1 | 721420832 | looted |
| three-years-p0-7 | 221 | thief | 1 | 83886898 | looted |
| three-years-p0-7 | 308 | thief | 1 | 654312209 | looted |
| three-years-p2-1 | 42 | thief | 1 | 117441042 | withdrew |
| three-years-p2-1 | 62 | bandits | 3 | 83886547 | looted |
| three-years-p2-1 | 68 | ambush | 4 | 117440850 | looted |
| three-years-p2-1 | 75 | thief | 1 | 318767158 | looted |
| three-years-p2-1 | 112 | thief | 1 | 83886530 | looted |
| three-years-p2-1 | 126 | raid | 7 | 251658774 | looted |
| three-years-p2-1 | 161 | thief | 1 | 150995057 | looted |
| three-years-p2-1 | 171 | ambush | 3 | 184550194 | looted |
| three-years-p2-1 | 197 | thief | 1 | 184550119 | looted |
| three-years-p2-1 | 236 | bandits | 3 | 150995552 | looted |
| three-years-p2-1 | 249 | thief | 1 | 218103827 | looted |
| three-years-p2-1 | 251 | raid | 6 | 117440837 | looted |
| three-years-p2-1 | 280 | thief | 1 | 117440576 | looted |
| three-years-p2-1 | 282 | ambush | 3 | 117440655 | looted |
| three-years-p2-1 | 315 | thief | 1 | 251658888 | looted |
| three-years-p2-2 | 33 | thief | 1 | 117440980 | withdrew |
| three-years-p2-2 | 61 | ambush | 3 | 117441209 | looted |
| three-years-p2-2 | 68 | bandits | 3 | 117440653 | looted |
| three-years-p2-2 | 93 | thief | 1 | 352321915 | looted |
| three-years-p2-2 | 124 | raid | 7 | 218104490 | looted |
| three-years-p2-2 | 146 | ambush | 3 | 83886115 | looted |
| three-years-p2-2 | 151 | thief | 1 | 150995045 | looted |
| three-years-p2-2 | 201 | bandits | 3 | 218103920 | looted |
| three-years-p2-2 | 202 | thief | 1 | 50331733 | looted |
| three-years-p2-2 | 239 | thief | 1 | 150995532 | looted |
| three-years-p2-2 | 246 | ambush | 3 | 117441262 | looted |
| three-years-p2-2 | 257 | raid | 7 | 50332080 | looted |
| three-years-p2-2 | 282 | thief | 1 | 83886166 | looted |
| three-years-p2-2 | 333 | thief | 1 | 117441184 | looted |
| three-years-p2-3 | 40 | thief | 1 | 150995335 | looted |
| three-years-p2-3 | 59 | bandits | 3 | 83886700 | looted |
| three-years-p2-3 | 70 | ambush | 3 | 218104294 | looted |
| three-years-p2-3 | 74 | thief | 1 | 50332307 | looted |
| three-years-p2-3 | 111 | thief | 1 | 285213091 | withdrew |
| three-years-p2-3 | 120 | raid | 7 | 889193115 | looted |
| three-years-p2-3 | 164 | thief | 1 | 318767827 | looted |
| three-years-p2-3 | 165 | ambush | 3 | 83886877 | looted |
| three-years-p2-3 | 200 | thief | 1 | 352322295 | looted |
| three-years-p2-3 | 232 | ambush | 3 | 318767904 | looted |
| three-years-p2-3 | 242 | thief | 1 | 117440620 | looted |
| three-years-p2-3 | 249 | bandits | 3 | 452985487 | looted |
| three-years-p2-3 | 253 | raid | 6 | 117441091 | looted |
| three-years-p2-3 | 289 | thief | 1 | 520094325 | active |
| three-years-p2-3 | 330 | thief | 1 | 117441331 | active |
| three-years-p2-4 | 36 | thief | 1 | 117440654 | withdrew |
| three-years-p2-4 | 63 | ambush | 4 | 50332163 | looted |
| three-years-p2-4 | 76 | bandits | 3 | 318767671 | looted |
| three-years-p2-4 | 80 | thief | 1 | 150995580 | looted |
| three-years-p2-4 | 115 | thief | 1 | 285213076 | looted |
| three-years-p2-4 | 122 | raid | 7 | 184549483 | active |
| three-years-p2-4 | 171 | ambush | 3 | 251658700 | active |
| three-years-p2-4 | 172 | thief | 1 | 117441168 | looted |
| three-years-p2-4 | 208 | thief | 1 | 150995510 | looted |
| three-years-p2-4 | 225 | raid | 6 | 150995636 | active |
| three-years-p2-4 | 241 | ambush | 3 | 352322076 | active |
| three-years-p2-4 | 258 | bandits | 3 | 419430838 | looted |
| three-years-p2-4 | 259 | thief | 1 | 83886574 | looted |
| three-years-p2-4 | 293 | thief | 1 | 218104542 | looted |
| three-years-p2-4 | 322 | ambush | 3 | 50332507 | active |
| three-years-p2-5 | 36 | thief | 1 | 83886500 | looted |
| three-years-p2-5 | 58 | ambush | 4 | 50332254 | repelled |
| three-years-p2-5 | 72 | bandits | 3 | 117440963 | looted |
| three-years-p2-5 | 90 | thief | 1 | 150995237 | withdrew |
| three-years-p2-5 | 120 | thief | 1 | 218104370 | looted |
| three-years-p2-5 | 122 | raid | 7 | 83886881 | looted |
| three-years-p2-5 | 126 | ambush | 3 | 285213253 | looted |
| three-years-p2-5 | 170 | thief | 1 | 318767634 | looted |
| three-years-p2-5 | 194 | ambush | 3 | 117441161 | looted |
| three-years-p2-5 | 202 | thief | 1 | 50331736 | looted |
| three-years-p2-5 | 250 | raid | 6 | 83886405 | looted |
| three-years-p2-5 | 257 | thief | 1 | 50331705 | looted |
| three-years-p2-5 | 258 | ambush | 3 | 83886660 | looted |
| three-years-p2-5 | 296 | thief | 1 | 251658961 | active |
| three-years-p2-5 | 304 | bandits | 3 | 352322300 | looted |
| three-years-p2-5 | 335 | thief | 1 | 83886968 | active |
| three-years-p2-6 | 39 | thief | 1 | 117440828 | withdrew |
| three-years-p2-6 | 61 | ambush | 3 | 520093735 | active |
| three-years-p2-6 | 68 | bandits | 3 | 452985095 | looted |
| three-years-p2-6 | 92 | thief | 1 | 83886655 | looted |
| three-years-p2-6 | 133 | raid | 6 | 150995516 | active |
| three-years-p2-6 | 137 | thief | 1 | 150995398 | looted |
| three-years-p2-6 | 166 | ambush | 3 | 117440697 | active |
| three-years-p2-6 | 191 | thief | 1 | 16777923 | looted |
| three-years-p2-6 | 222 | bandits | 3 | 251658637 | looted |
| three-years-p2-6 | 242 | thief | 1 | 50331707 | looted |
| three-years-p2-6 | 267 | raid | 6 | 83886437 | active |
| three-years-p2-6 | 270 | ambush | 3 | 184550060 | active |
| three-years-p2-6 | 300 | thief | 1 | 218104473 | active |
| three-years-p2-6 | 331 | thief | 1 | 318767544 | looted |
| three-years-p2-7 | 49 | thief | 1 | 83886542 | withdrew |
| three-years-p2-7 | 60 | bandits | 3 | 83886650 | looted |
| three-years-p2-7 | 61 | ambush | 4 | 117440577 | active |
| three-years-p2-7 | 87 | thief | 1 | 184549817 | looted |
| three-years-p2-7 | 132 | ambush | 3 | 150995461 | active |
| three-years-p2-7 | 133 | raid | 7 | 117441089 | active |
| three-years-p2-7 | 136 | thief | 1 | 184549809 | looted |
| three-years-p2-7 | 167 | thief | 1 | 117441010 | looted |
| three-years-p2-7 | 186 | bandits | 3 | 117441071 | looted |
| three-years-p2-7 | 218 | thief | 1 | 218104315 | looted |
| three-years-p2-7 | 226 | raid | 6 | 218104334 | active |
| three-years-p2-7 | 227 | ambush | 3 | 352321975 | active |
| three-years-p2-7 | 273 | thief | 1 | 16778018 | active |
| three-years-p2-7 | 331 | thief | 1 | 251658943 | looted |
| three-years-p2-7 | 331 | ambush | 3 | 184549868 | active |
| three-years-p4-1 | 22 | thief | 1 | 50331986 | withdrew |
| three-years-p4-1 | 31 | ambush | 6 | 150995306 | active |
| three-years-p4-1 | 34 | raid | 11 | 50332128 | active |
| three-years-p4-1 | 48 | thief | 1 | 83886574 | looted |
| three-years-p4-1 | 58 | bandits | 3 | 251658592 | looted |
| three-years-p4-1 | 62 | thief | 1 | 184549479 | looted |
| three-years-p4-1 | 78 | ambush | 5 | 184549669 | active |
| three-years-p4-1 | 82 | thief | 1 | 83886687 | looted |
| three-years-p4-1 | 104 | raid | 11 | 50331789 | active |
| three-years-p4-1 | 110 | thief | 1 | 83886749 | looted |
| three-years-p4-1 | 111 | ambush | 5 | 50332018 | active |
| three-years-p4-1 | 130 | thief | 1 | 50331705 | looted |
| three-years-p4-1 | 147 | thief | 1 | 16778073 | looted |
| three-years-p4-1 | 167 | ambush | 5 | 150995048 | active |
| three-years-p4-1 | 170 | thief | 1 | 83886810 | looted |
| three-years-p4-1 | 184 | thief | 1 | 83886457 | looted |
| three-years-p4-1 | 187 | raid | 10 | 50332026 | active |
| three-years-p4-1 | 190 | siege | 19 | 117441257 | active |
| three-years-p4-1 | 203 | bandits | 3 | 16778208 | looted |
| three-years-p4-1 | 204 | thief | 1 | 117440947 | looted |
| three-years-p4-1 | 211 | ambush | 5 | 50332021 | active |
| three-years-p4-1 | 226 | thief | 1 | 16778245 | looted |
| three-years-p4-1 | 235 | raid | 10 | 50332022 | active |
| three-years-p4-1 | 248 | thief | 1 | 50332742 | looted |
| three-years-p4-1 | 264 | ambush | 5 | 117440990 | active |
| three-years-p4-1 | 276 | thief | 1 | 83886106 | looted |
| three-years-p4-1 | 295 | ambush | 5 | 16778464 | active |
| three-years-p4-1 | 301 | thief | 1 | 285212900 | looted |
| three-years-p4-1 | 317 | raid | 10 | 218104167 | active |
| three-years-p4-1 | 318 | thief | 1 | 117441617 | looted |
| three-years-p4-1 | 332 | thief | 1 | 50332030 | looted |
| three-years-p4-1 | 335 | ambush | 5 | 50331731 | active |
| three-years-p4-2 | 23 | thief | 1 | 50332051 | withdrew |
| three-years-p4-2 | 39 | ambush | 6 | 16777790 | active |
| three-years-p4-2 | 40 | raid | 12 | 16778034 | active |
| three-years-p4-2 | 41 | thief | 1 | 50332548 | looted |
| three-years-p4-2 | 64 | thief | 1 | 50332167 | looted |
| three-years-p4-2 | 69 | bandits | 3 | 117441046 | looted |
| three-years-p4-2 | 85 | ambush | 5 | 83886603 | active |
| three-years-p4-2 | 85 | raid | 11 | 150995609 | active |
| three-years-p4-2 | 91 | thief | 1 | 83886851 | looted |
| three-years-p4-2 | 110 | thief | 1 | 117440622 | looted |
| three-years-p4-2 | 129 | thief | 1 | 16778136 | looted |
| three-years-p4-2 | 135 | ambush | 5 | 83886140 | active |
| three-years-p4-2 | 149 | thief | 1 | 50332084 | looted |
| three-years-p4-2 | 163 | ambush | 5 | 83886676 | active |
| three-years-p4-2 | 165 | raid | 11 | 83886994 | active |
| three-years-p4-2 | 171 | thief | 1 | 50332617 | looted |
| three-years-p4-2 | 174 | siege | 19 | 16778323 | active |
| three-years-p4-2 | 186 | thief | 1 | 218103957 | looted |
| three-years-p4-2 | 198 | ambush | 5 | 50332528 | active |
| three-years-p4-2 | 204 | bandits | 3 | 50332747 | looted |
| three-years-p4-2 | 214 | thief | 1 | 50332245 | looted |
| three-years-p4-2 | 215 | raid | 11 | 50332124 | active |
| three-years-p4-2 | 240 | thief | 1 | 16778541 | looted |
| three-years-p4-2 | 240 | ambush | 5 | 16778549 | active |
| three-years-p4-2 | 257 | thief | 1 | 218104463 | looted |
| three-years-p4-2 | 276 | thief | 1 | 150995057 | looted |
| three-years-p4-2 | 296 | thief | 1 | 16778693 | looted |
| three-years-p4-2 | 296 | ambush | 5 | 16778698 | active |
| three-years-p4-2 | 299 | raid | 11 | 83886571 | active |
| three-years-p4-2 | 322 | thief | 1 | 83887438 | looted |
| three-years-p4-2 | 332 | ambush | 5 | 50331743 | active |
| three-years-p4-3 | 20 | thief | 1 | 117440902 | withdrew |
| three-years-p4-3 | 31 | ambush | 6 | 16777741 | active |
| three-years-p4-3 | 40 | thief | 1 | 251658401 | looted |
| three-years-p4-3 | 49 | raid | 11 | 251658380 | active |
| three-years-p4-3 | 67 | thief | 1 | 83886154 | looted |
| three-years-p4-3 | 71 | bandits | 3 | 16778012 | looted |
| three-years-p4-3 | 72 | ambush | 5 | 50331667 | active |
| three-years-p4-3 | 92 | thief | 1 | 50331798 | looted |
| three-years-p4-3 | 104 | raid | 11 | 117440629 | active |
| three-years-p4-3 | 109 | ambush | 5 | 50332407 | active |
| three-years-p4-3 | 114 | thief | 1 | 50332381 | looted |
| three-years-p4-3 | 137 | thief | 1 | 150994998 | looted |
| three-years-p4-3 | 147 | ambush | 5 | 218104159 | active |
| three-years-p4-3 | 151 | thief | 1 | 83886801 | looted |
| three-years-p4-3 | 175 | thief | 1 | 150995172 | looted |
| three-years-p4-3 | 180 | raid | 11 | 117440741 | active |
| three-years-p4-3 | 186 | siege | 19 | 83886949 | active |
| three-years-p4-3 | 199 | ambush | 5 | 16778311 | active |
| three-years-p4-3 | 203 | thief | 1 | 16778338 | looted |
| three-years-p4-3 | 225 | bandits | 3 | 50331742 | looted |
| three-years-p4-3 | 226 | thief | 1 | 50331669 | looted |
| three-years-p4-3 | 228 | ambush | 5 | 50331743 | active |
| three-years-p4-3 | 248 | thief | 1 | 50332807 | looted |
| three-years-p4-3 | 258 | raid | 11 | 50331733 | active |
| three-years-p4-3 | 265 | thief | 1 | 83887298 | looted |
| three-years-p4-3 | 273 | ambush | 5 | 50331734 | active |
| three-years-p4-3 | 291 | thief | 1 | 117441723 | looted |
| three-years-p4-3 | 310 | thief | 1 | 50331745 | looted |
| three-years-p4-3 | 324 | ambush | 5 | 50331746 | active |
| three-years-p4-3 | 330 | raid | 11 | 50333035 | active |
| three-years-p4-3 | 334 | thief | 1 | 83887415 | looted |
| three-years-p4-4 | 20 | thief | 1 | 83886475 | withdrew |
| three-years-p4-4 | 33 | ambush | 6 | 50331974 | looted |
| three-years-p4-4 | 44 | thief | 1 | 117440790 | withdrew |
| three-years-p4-4 | 46 | raid | 11 | 50332241 | looted |
| three-years-p4-4 | 65 | bandits | 3 | 83886602 | looted |
| three-years-p4-4 | 71 | thief | 1 | 50332365 | looted |
| three-years-p4-4 | 84 | ambush | 5 | 218104286 | looted |
| three-years-p4-4 | 89 | thief | 1 | 83886609 | looted |
| three-years-p4-4 | 110 | thief | 1 | 117440625 | looted |
| three-years-p4-4 | 127 | ambush | 5 | 50331706 | looted |
| three-years-p4-4 | 128 | raid | 11 | 50332463 | looted |
| three-years-p4-4 | 133 | thief | 1 | 50331736 | looted |
| three-years-p4-4 | 159 | thief | 1 | 16778047 | looted |
| three-years-p4-4 | 166 | ambush | 5 | 83886534 | looted |
| three-years-p4-4 | 182 | thief | 1 | 83886174 | looted |
| three-years-p4-4 | 184 | siege | 19 | 50331730 | looted |
| three-years-p4-4 | 199 | thief | 1 | 50332111 | looted |
| three-years-p4-4 | 209 | ambush | 5 | 83886956 | looted |
| three-years-p4-4 | 211 | raid | 10 | 50332110 | looted |
| three-years-p4-4 | 219 | thief | 1 | 83886317 | looted |
| three-years-p4-4 | 239 | bandits | 3 | 117440748 | looted |
| three-years-p4-4 | 239 | ambush | 5 | 50332637 | looted |
| three-years-p4-4 | 242 | thief | 1 | 83887072 | looted |
| three-years-p4-4 | 266 | thief | 1 | 16778332 | looted |
| three-years-p4-4 | 269 | raid | 10 | 83886163 | looted |
| three-years-p4-4 | 279 | ambush | 5 | 50332101 | looted |
| three-years-p4-4 | 281 | thief | 1 | 50332735 | looted |
| three-years-p4-4 | 300 | thief | 1 | 184549541 | looted |
| three-years-p4-4 | 318 | thief | 1 | 50332103 | looted |
| three-years-p4-4 | 319 | ambush | 5 | 83886220 | looted |
| three-years-p4-4 | 323 | raid | 10 | 83886374 | looted |
| three-years-p4-5 | 27 | thief | 1 | 50332071 | withdrew |
| three-years-p4-5 | 32 | raid | 11 | 83886537 | active |
| three-years-p4-5 | 44 | ambush | 5 | 285213240 | active |
| three-years-p4-5 | 45 | thief | 1 | 184549778 | looted |
| three-years-p4-5 | 64 | thief | 1 | 83886523 | looted |
| three-years-p4-5 | 74 | raid | 11 | 83886686 | active |
| three-years-p4-5 | 75 | bandits | 3 | 83886723 | looted |
| three-years-p4-5 | 79 | thief | 1 | 83886736 | looted |
| three-years-p4-5 | 91 | ambush | 5 | 50331785 | active |
| three-years-p4-5 | 103 | thief | 1 | 117441222 | looted |
| three-years-p4-5 | 125 | thief | 1 | 117441195 | looted |
| three-years-p4-5 | 138 | raid | 11 | 83886817 | active |
| three-years-p4-5 | 140 | ambush | 5 | 16778004 | active |
| three-years-p4-5 | 149 | thief | 1 | 16778184 | looted |
| three-years-p4-5 | 170 | ambush | 5 | 50332435 | active |
| three-years-p4-5 | 174 | thief | 1 | 50332466 | looted |
| three-years-p4-5 | 175 | siege | 19 | 50332117 | active |
| three-years-p4-5 | 193 | thief | 1 | 184550082 | looted |
| three-years-p4-5 | 200 | ambush | 5 | 150995099 | active |
| three-years-p4-5 | 216 | thief | 1 | 83886921 | looted |
| three-years-p4-5 | 217 | raid | 10 | 50332088 | active |
| three-years-p4-5 | 233 | ambush | 5 | 16778363 | active |
| three-years-p4-5 | 240 | thief | 1 | 184549537 | looted |
| three-years-p4-5 | 262 | thief | 1 | 50332794 | looted |
| three-years-p4-5 | 264 | bandits | 3 | 50332825 | looted |
| three-years-p4-5 | 283 | thief | 1 | 117441652 | looted |
| three-years-p4-5 | 285 | ambush | 5 | 150995969 | active |
| three-years-p4-5 | 299 | raid | 10 | 218104064 | active |
| three-years-p4-5 | 304 | thief | 1 | 50332904 | looted |
| three-years-p4-5 | 320 | ambush | 5 | 83887327 | active |
| three-years-p4-5 | 329 | thief | 1 | 117441626 | looted |
| three-years-p4-6 | 24 | thief | 1 | 150995104 | withdrew |
| three-years-p4-6 | 37 | ambush | 6 | 50332137 | active |
| three-years-p4-6 | 43 | raid | 11 | 184549530 | active |
| three-years-p4-6 | 47 | thief | 1 | 184549578 | looted |
| three-years-p4-6 | 73 | bandits | 3 | 117441088 | looted |
| three-years-p4-6 | 75 | thief | 1 | 251658443 | looted |
| three-years-p4-6 | 81 | ambush | 5 | 83886381 | active |
| three-years-p4-6 | 95 | thief | 1 | 184549836 | looted |
| three-years-p4-6 | 109 | ambush | 5 | 117441020 | active |
| three-years-p4-6 | 112 | raid | 11 | 83886771 | active |
| three-years-p4-6 | 117 | thief | 1 | 50332292 | looted |
| three-years-p4-6 | 131 | thief | 1 | 83886137 | looted |
| three-years-p4-6 | 138 | ambush | 5 | 83886284 | active |
| three-years-p4-6 | 147 | thief | 1 | 50331974 | looted |
| three-years-p4-6 | 166 | thief | 1 | 150995771 | looted |
| three-years-p4-6 | 183 | thief | 1 | 16778171 | looted |
| three-years-p4-6 | 187 | siege | 19 | 150995782 | active |
| three-years-p4-6 | 189 | raid | 11 | 16778204 | active |
| three-years-p4-6 | 190 | ambush | 5 | 16778276 | active |
| three-years-p4-6 | 206 | thief | 1 | 117441346 | looted |
| three-years-p4-6 | 230 | thief | 1 | 50332744 | looted |
| three-years-p4-6 | 231 | ambush | 5 | 16778316 | active |
| three-years-p4-6 | 244 | thief | 1 | 50332743 | looted |
| three-years-p4-6 | 250 | raid | 11 | 50332158 | active |
| three-years-p4-6 | 259 | bandits | 3 | 50332855 | looted |
| three-years-p4-6 | 261 | thief | 1 | 117441718 | looted |
| three-years-p4-6 | 274 | ambush | 5 | 150994967 | active |
| three-years-p4-6 | 286 | thief | 1 | 50332853 | looted |
| three-years-p4-6 | 300 | raid | 11 | 50332983 | active |
| three-years-p4-6 | 314 | thief | 1 | 50333025 | looted |
| three-years-p4-6 | 318 | ambush | 5 | 50333073 | active |
| three-years-p4-6 | 332 | thief | 1 | 50332991 | looted |

Renown now counts dwarves: W/2,000 + 0.2P. The peril-2 raid row is round(min(16, 6 + 0.30R)); size 10 needs approximately R=13.33, size 15 approximately R=30 (rounding admits 28.33≤R<31.67). With P=25, exact R=30 requires W=2,000×(30−5)=50,000. Small living raids must be read against their actual wealth/population and arrival year; an extinct site does not test the model raid faced by a thriving fortress.

## Consumption

| Seed | Integrated living dwarf-days | Food | Alcohol | Water | Food / dwarf-day | Drink / dwarf-day | Food / drink deviation from model |
| --- | --- | --- | --- | --- | --- | --- | --- |
| three-years | 3863.91 | 1257 | 1924 | 0 | 0.325318 | 0.497941 | -32.2% / -35.3% |
| three-years-p0-1 | 4703.83 | 1655 | 2561 | 0 | 0.351841 | 0.544450 | -26.7% / -29.3% |
| three-years-p0-2 | 545.90 | 196 | 160 | 0 | 0.359038 | 0.293092 | -25.2% / -61.9% |
| three-years-p0-3 | 2758.83 | 929 | 1320 | 0 | 0.336737 | 0.478464 | -29.8% / -37.9% |
| three-years-p0-4 | 5467.37 | 1910 | 2802 | 0 | 0.349345 | 0.512495 | -27.2% / -33.4% |
| three-years-p0-5 | 4395.88 | 1437 | 2316 | 0 | 0.326897 | 0.526857 | -31.9% / -31.6% |
| three-years-p0-6 | 431.00 | 161 | 160 | 0 | 0.373552 | 0.371232 | -22.2% / -51.8% |
| three-years-p0-7 | 3165.87 | 1109 | 1420 | 0 | 0.350298 | 0.448534 | -27.0% / -41.7% |
| three-years-p2-1 | 650.72 | 207 | 309 | 0 | 0.318110 | 0.474859 | -33.7% / -38.3% |
| three-years-p2-2 | 596.68 | 173 | 291 | 0 | 0.289937 | 0.487697 | -39.6% / -36.7% |
| three-years-p2-3 | 1812.67 | 605 | 779 | 0 | 0.333762 | 0.429753 | -30.5% / -44.2% |
| three-years-p2-4 | 672.15 | 207 | 328 | 0 | 0.307965 | 0.487984 | -35.8% / -36.6% |
| three-years-p2-5 | 1062.05 | 319 | 538 | 0 | 0.300364 | 0.506570 | -37.4% / -34.2% |
| three-years-p2-6 | 566.63 | 201 | 301 | 0 | 0.354727 | 0.531208 | -26.1% / -31.0% |
| three-years-p2-7 | 723.56 | 220 | 301 | 0 | 0.304051 | 0.415997 | -36.7% / -46.0% |
| three-years-p4-1 | 230.32 | 81 | 127 | 0 | 0.351677 | 0.551395 | -26.7% / -28.4% |
| three-years-p4-2 | 330.45 | 118 | 178 | 0 | 0.357086 | 0.538655 | -25.6% / -30.0% |
| three-years-p4-3 | 222.80 | 82 | 127 | 0 | 0.368040 | 0.570014 | -23.3% / -26.0% |
| three-years-p4-4 | 274.08 | 103 | 154 | 0 | 0.375808 | 0.561888 | -21.7% / -27.0% |
| three-years-p4-5 | 227.88 | 88 | 131 | 0 | 0.386168 | 0.574864 | -19.5% / -25.3% |
| three-years-p4-6 | 287.93 | 105 | 163 | 0 | 0.364669 | 0.566105 | -24.0% / -26.5% |

Counts cover the entire run and divide by event-integrated living dwarf-time, including bootstrap and population changes. The daily mood instrument samples living dwarves at day boundaries after the day-20 bootstrap (days 21-336); this is not an all-tick mean and it has a different dwarf-day denominator. Before and after use the same sampling convention. Endurance modifies hunger by (150−Endurance)/100; main annual Endurance means are 53.33, 54.17, 54.50.
Applying those annual Endurance snapshots to the 0.48 benchmark gives 0.4640 / 0.4600 / 0.4584 food units/day. The measured lifetime rate is -29.9% / -29.3% / -29.0% relative to those conditional year-specific benchmarks, near the 30% tolerance. These snapshots are not an exact lifetime Endurance integral. Thirst is not Endurance-scaled, so this adjustment does not explain the drink deficit.

## Mood: time mean, endpoint and decomposition

| Seed / layout | Final population | Sampled dwarf-days | Time mean before → after | Hunger / thirst want % | Social / comfort / joy want % | Frozen baseline for mean 55 / 70 |
| --- | --- | --- | --- | --- | --- | --- |
| three-years / economy | 14 | 3,724 | 34.65 → 50.53 | 31.5 / 35.9 | 33.0 / 46.3 / 44.1 | 59.500 / 74.501 |
| three-years / historical bare control | 0 | 554 | 23.12 → 23.12 | 81.6 / 13.2 | 15.9 / 99.1 / 99.1 | 87.345 / 102.415 |
| three-years-p0-1 / economy | 16 | 4,564 | 43.64 → 55.42 | 29.3 / 28.9 | 31.1 / 44.4 / 43.1 | 54.615 / 69.619 |
| three-years-p0-2 / economy | 0 | 406 | 36.90 → 39.36 | 26.6 / 75.1 | 26.4 / 57.1 / 38.4 | 70.721 / 85.825 |

| Thought | Dwarf-time active % | Mean contribution |
| --- | --- | --- |
| thirsty | 38.0 | -2.822 |
| slept_on_floor_last_night | 66.9 | -2.198 |
| hungry | 32.5 | -1.876 |
| restless | 42.0 | -1.685 |
| lonely | 33.2 | -1.662 |
| no_bedroom | 67.3 | -1.477 |
| slept_on_floor | 61.5 | -1.428 |
| tired | 22.6 | -1.418 |
| bored | 46.1 | -0.809 |
| uncomfortable | 47.8 | -0.635 |
| thane_hall_bare | 27.9 | -0.268 |
| in_miasma | 3.6 | -0.162 |
| caught_in_rain | 5.9 | -0.102 |
| snowed_on | 2.1 | -0.038 |
| slept_outdoors | 1.5 | -0.036 |
| ate_raw_food | 4.6 | -0.022 |
| raid_arrived | 0.7 | -0.015 |
| ate_stale_food | 0.6 | -0.010 |
| slept_in_shared_bed_room | 0.4 | -0.002 |
| skill_milestone | 0.2 | 0.005 |
| first_vein | 0.3 | 0.007 |
| ate_fine_meal | 0.6 | 0.015 |
| immigrants_arrived | 1.9 | 0.020 |
| slept_in_modest_room | 5.8 | 0.023 |
| caravan_arrived | 5.0 | 0.029 |
| saw_sunlight | 3.3 | 0.035 |
| new_hearth_hall_tier | 1.5 | 0.047 |
| drank_fine_drink | 1.6 | 0.049 |
| hearth_lit | 1.3 | 0.082 |
| ate_in_fine_hall | 6.1 | 0.129 |
| ate_in_decent_hall | 19.9 | 0.209 |
| harvest_in | 12.5 | 0.235 |
| ate_easy_meal | 22.4 | 0.259 |
| slept_in_decent_room | 21.0 | 0.293 |
| sat_in_fine_room | 20.9 | 0.332 |
| talked_with_someone | 16.8 | 0.377 |
| hearth_visit | 27.7 | 0.463 |
| well_rested | 41.6 | 0.494 |
| drank_ale | 48.3 | 0.805 |
| talked_with_friend | 88.8 | 2.950 |

Main: baseline 55.000, hearth +5.559, personality -0.744, cap effect +0.490, floor effect +0.001.
The bare control and p0-2 have no final living cohort; their instrument means cover living samples before extinction, not a surviving three-year steady state. The bare layout is the historical control, not another tuned F-17 fixture.

| Main need | Time above want: before / after % | Mean need: before / after |
| --- | --- | --- |
| hunger | 46.51 / 31.50 | 47.01 / 37.26 |
| thirst | 45.75 / 35.90 | 46.52 / 40.20 |
| rest | 39.07 / 22.64 | 46.67 / 35.42 |
| social | 92.83 / 32.98 | 90.60 / 39.04 |
| comfort | 98.39 / 46.27 | 96.04 / 53.78 |
| purpose | 3.46 / 44.01 | 12.64 / 52.89 |
| joy | 98.83 / 44.07 | 97.77 / 59.83 |

Endpoint distribution: {"Fine": 8, "Content": 4, "Happy": 0, "Unhappy": 1, "Miserable": 1, "Ecstatic": 0}. Normal mood floor/cap and sweep mood-floor assertions remain active.

## Immigration evaluations

| Group | All checks: outcome counts | Seasonal eligibility failures | Non-guaranteed eligible seasonal rolls |
| --- | --- | --- | --- |
| main | spirit: 8, wave: 3 | spirit: 8, wealth: 4 | 1 |
| peril 0 | luck: 3, no_population: 26, spirit: 13, wave: 18, wealth: 17 | no_population: 25, spirit: 13, wealth: 24 | 8 |
| peril 2 | deferred:raid: 6, no_population: 54, spirit: 9, wave: 14 | no_population: 54, raid: 1, spirit: 8, wealth: 5 | 0 |
| peril 4 | no_population: 60, wave: 6 | no_population: 54 | 0 |

| Main year / season | Trigger | Population | Wealth | Spirit | Eligibility / reason | Roll / probability | Outcome / wave size |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 / summer | SeasonChanged | 7 | 2,621 | 57.91 | True:  | None / 700 | wave / 2 |
| 1 / autumn | SeasonChanged | 9 | 2,851 | 50.48 | True:  | None / 700 | wave / 3 |
| 1 / winter | SeasonChanged | 12 | 3,310 | 46.83 | False: spirit, wealth | None / 700 | spirit / None |
| 2 / spring | SeasonChanged | 12 | 3,423 | 50.89 | False: spirit, wealth | None / 700 | spirit / None |
| 2 / summer | SeasonChanged | 12 | 3,540 | 51.24 | False: spirit, wealth | None / 700 | spirit / None |
| 2 / autumn | SeasonChanged | 12 | 3,839 | 44.39 | False: spirit, wealth | None / 700 | spirit / None |
| 2 / winter | SeasonChanged | 12 | 4,027 | 48.94 | False: spirit | None / 700 | spirit / None |
| 3 / spring | SeasonChanged | 12 | 4,338 | 50.04 | False: spirit | None / 700 | spirit / None |
| 3 / summer | SeasonChanged | 12 | 4,399 | 51.29 | False: spirit | None / 702 | spirit / None |
| 3 / autumn | SeasonChanged | 12 | 4,613 | 47.12 | False: spirit | None / 702 | spirit / None |
| 3 / winter | SeasonChanged | 12 | 4,687 | 55.26 | True:  | 145 / 702 | wave / 2 |

The actual spirit threshold is IMMIGRATION_SPIRIT_MIN=55 (older B-009 prose naming 65 is historical). IMMIGRATION_PERMILLE=700 only acts after eligibility; lowering the chance cannot explain failed spirit/wealth predicates. Winter now clamps the computed wave to WAVE_MAX=12 and available population slots before halving, rounding up. At wealth 39,000, Content and reputation 0: raw 2+13+2=17, clamp to 12, then winter gives 6, rather than the previous 9.

## Remaining findings: FIXTURE / BUG / MODEL GAP

| Class | Finding | Evidence / limit |
| --- | --- | --- |
| FIXTURE | Incomplete original production witnesses | Main cut_gem, forge_pick, forge_mail_shirt and forge_crafts: 0 completed jobs each. Stone crafts, charcoal, smelting and steel alloying do complete. F17_KNOWN_GAPS pins each absent witness to zero; any improvement requires restoring its >0 assertion. |
| FIXTURE | Missed caravan guarantee | Main 4/8 trades; original target is every arrival. The expected-gap signature pins completed=4 and arrivals=8; it is not an all-visits pass. |
| FIXTURE | Amenities and surplus production | Only 2 beds and 0 lavish-meal jobs completed. A beds-first experiment killed a dwarf and was reverted. These bottlenecks remain; ordinary priorities alone do not make the script a competent wealth-model player. |
| FIXTURE | Immigration below the model | Main has one non-guaranteed Y2/Y3 wave, adding two dwarves in year-3 winter. Most main seasonal checks fail spirit; early ones also wealth. Missing amenities/surplus remain, so an immigration chance or wave-size tune is not justified. Every evaluation is retained above. |
| FIXTURE | Need service / consumption comparison | Main food 0.325318, drink 0.497941 per living dwarf-day. Supply, travel and competing wants remain; snapshot Endurance correction brings food near the 30% tolerance, but cannot explain thirst. No rate BUG is established. Conditional sensitivities below are not tested replacement constants. |
| FIXTURE | Deeper gem band and masterworks | Main safe shaft bottoms at z=20; intended year-3 bottom is 15. Conservative avoidance of the unfixed stair threat prevents full deep-gem access. Keep the cap and report the missing chain; do not infer a material-value tuning from absent production. |
| FIXTURE | Squad deadline | Dangerous sites with a recorded kit day <=56: 0/13. Dedicated workers and first orders are implemented, but this count is the actual completion evidence; failed deadlines remain fixture gaps. |
| BUG | Civilian stair fleeing | Observed seed three-years, days 270-288; same-level escape rays cannot use the reachable stair to the hearth. Detailed trace below. Unfixed. |
| BUG | High-quality meal overwrites hunger relief | activities.ts:415/426 reuse the old Needs snapshot for two writes. Source counterexample below; not attributed to measured deaths. Unfixed. |
| MODEL GAP | Peril-4 first raid calendar | threatSchedules.json ambush/peril=4 and raid/peril=4 rows use earliest.year=1, season=1 (summer boundary, elapsed day 28; event lists use one-based days), while balance.md and F-17h use day 56. Changing earliest.season from 1 to 2 in both rows shifts the earliest elapsed boundary by 28 days to 56: 2*28=56 instead of 1*28=28. It closes the calendar disagreement only, not combat survival. No content change made. |

The wealth model is explicitly for a competent wealth-2, peril-2 player. Missing forge/gem chains, missed trades and starvation/extinction prevent treating the low inventories as evidence that material values are wrong. Every surviving snapshot is compared below; abandoned stocks are excluded.

| Group | Year | Model marks | Living observed range | Living snapshots | More than 30% outside range |
| --- | --- | --- | --- | --- | --- |
| main | 1 | 4,000-8,000 | 3,423-3,423 | 1 | 0 |
| main | 2 | 15,000-25,000 | 4,338-4,338 | 1 | 1 |
| main | 3 | 35,000-60,000 | 4,950-4,950 | 1 | 1 |
| peril 0 | 1 | 4,000-8,000 | 3,431-6,433 | 5 | 0 |
| peril 0 | 2 | 15,000-25,000 | 4,383-5,401 | 4 | 4 |
| peril 0 | 3 | 35,000-60,000 | 4,970-9,156 | 3 | 3 |
| peril 2 | 1 | 4,000-8,000 | 3,443-4,444 | 2 | 0 |
| peril 2 | 2 | 15,000-25,000 | no living observations | 0 | 0 |
| peril 2 | 3 | 35,000-60,000 | no living observations | 0 | 0 |
| peril 4 | 1 | 4,000-8,000 | no living observations | 0 | 0 |
| peril 4 | 2 | 15,000-25,000 | no living observations | 0 | 0 |
| peril 4 | 3 | 35,000-60,000 | no living observations | 0 | 0 |

Consumption remains a combined fixture/model-comparison limitation, not an established need-rate BUG. The model assumes Endurance 50 and immediate service at want=50. Main annual Endurance is recorded above; priority 5 removes <=2 job deferral, but travel, competing needs and supply/amenity delays remain. The instrument reports actual time spent above want. Do not infer that changing need rates repairs those delays.

| Constant / source | Current | Frozen-throughput value matching the benchmark | Arithmetic |
| --- | --- | --- | --- |
| HUNGER_PER_HOUR / dwarves/needs.ts | 1 | 1.475480 | 1 * 0.48 / 0.325318 |
| THIRST_PER_HOUR / dwarves/needs.ts | 1.6 | 2.474190 | 1.6 * 0.77 / 0.497941 |
| MOOD_BASELINE / core/constants.ts | 55 | 59.500057 (mean 55); 74.500811 (mean 70) | mean(max(MOOD_MIN, min(100, max(new baseline + observed offset, observed floor)))) = target; instrument bisection |

These are conditional sensitivities on frozen observations, not tested replacement constants: faster need growth changes actions and workload, and a new mood baseline changes productivity and immigration. The mood arithmetic exactly recomputes the recorded daily samples; the rate arithmetic only scales the recorded throughput proportionally. The parent must choose any follow-up. No constant was changed.

Craft progression also has a concrete workload limit: cumulative skill XP is 100L + 30L(L-1). Level 5 needs 1,100 XP and level 13 needs 5,980: 4,880 extra XP, or 610 jobs at the craft_stone recipe xp row value 8 before Wit modifiers. Level 13 only permits a masterwork at the top quality roll; it does not guarantee one. The measured job and skill counts above do not justify changing XP or quality thresholds to manufacture a masterwork.

## Simulation findings

### Civilian Fighting on a narrow cavern stair - BUG, unfixed

Retained prior diagnostic, seed `three-years`, shaft `(31,15)`, z=21, before the final conservative cavern buffer. Miners `16777292` and `16777293` are both on the same StairsUpDown tile with `behavior=idle`, `activity=Fighting`, `targetTile=49135` at days 270, 280 and 284. At day 270 the first already has all seven needs at 100; the second has hunger 36.75, thirst 38.4 and rest 63. At day 280 both have all needs at 100 and remain on the same tile. Matching scenario death events record starvation, killer 0, at days 285 and 288 respectively. The retained trace includes the open stairs above the landing; no same-level lateral escape exists.

`src/systems/dwarves/brain.ts:79-106` (`findFleeTile`) scans eight horizontal rays and keeps z=posA.z. The `Fighting` branch at :359-381 retries the same search; without an escape it stays in combat and does not service needs. `docs/02-systems/10-dwarves.md:77` requires fleeing away toward the hearth, which needs the vertical route here. This is a source-backed path-selection failure, not evidence that every measured starvation has that cause. Threat detection through rock is permitted by the written radius rule; lack of line of sight is not separately labelled a spec BUG. The final fixture uses a conservative deep-mining buffer; this limits the deep-gem chain and does not establish that every cavern/need hazard is avoided. The simulation fault remains.

### High-quality meal restores the old hunger - BUG, unfixed

Source counterexample, not a newly measured seed/day: at `src/systems/dwarves/activities.ts:413-426`, `n` is captured once and `change` writes `{...n, [name]: clamp(n[name] - relief)}`. Eating a quality >=4 meal first writes hunger relief, then the joy relief writes from the original snapshot. Starting hunger=65, joy=80: first write gives hunger=0, joy=80; second write gives hunger=65, joy=60 although the meal was consumed. `docs/02-systems/10-dwarves.md:41` requires meal hunger -100 and :47 joy -20; both should persist. Component storage replaces the Needs value rather than updating the captured object. No runtime fix was made, and this code counterexample is not presented as the cause of any sweep death.

The already reported occupied workshop-corner/build completion fault (D-251/C-009) remains outside this task. The fixture keeps protected access and depot standing tiles out of its own workshop footprints; that workaround does not repair general build occupancy.

## Verification and reproducibility

Exactly three full main-scenario attempts were used after the owner time box: snapshot/public-reader correction; the rejected beds-first experiment; final frozen-fixture verification. No dangerous-peril tuning or rerun of either long instrument was performed.

The 20-seed sweep was invoked exactly once: status failed, exit 1; 15 tests passed / 5 failed, 9328.76 s captured wall time; 20 economy records and 20 endpoint summaries retained. Peril-0 survival assertions in the sweep remain unchanged; failures are reported, not marked away.
The mood instrument was invoked once: status passed, exit 0; 3 tests passed, 4 decompositions, 587.92 s including concurrent foreground verification.

| Check | Result |
| --- | --- |
| lint / typecheck | passed |
| content:check | 50 tables / 1,612 rows; passed |
| strings:check | 774 keys; passed |
| interface:check | 24 documents / 0 differences; passed |
| npm test | 187 files / 1,710 tests passed; 330.80 s; includes the explicit expected-gap signatures, not completion of their original targets |

Tasks 1-2 performance tier, excluding only the sweep, mood instrument and scratch instruments: 6 files passed / 1 failed; 31 tests passed / 1 failed / 1 existing TODO; 79.98 s. The separate per-system allocation file passed its 22 tests with 1 existing TODO. Reference worst tick was 56.1807 ms against 40 ms (average 4.492 ms). Its required single-file retry still failed: weather 06 average 0.02064435 ms against 0.020 ms and reference worst tick 102.3579 ms against 40 ms (average 7.965 ms), 46.32 s. The shared-machine explanation is plausible but does not turn these failures into a budget pass. Budgets and runtime were not changed; the reference performance gate remains a reported failure.
Raw data: [scenario, incrementally saved sweep, mood instrument and retained stair trace](../data/2026-10-07-balance-after-f17-data.json). All before values come from [the frozen earlier data](../data/M8-balance-economy-data.json). Telemetry observes real events/readers and clones the immigration stream only for its diagnostic next-roll calculation; it never writes world state or consumes a simulation RNG draw.
