## Annual instrument: 8 samples of 715788a1

| Shift | Median | Worst | Second-worst | Sum of the living | Wildlife-free | Extinct | Starved years | Need deaths | Living by seed | Dug for stone |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 13 | 10 | 11 | 155 | 10 | 0 | 0 | 0 | 13, 13, 13, 13, 13, 11, 10, 11, 15, 14, 15, 14 | temperate_forest-2 day 6; temperate_grassland-3 day 6; temperate_grassland-4 day 6 |
| 1 | 13 | 6 | 9 | 146 | 8 | 0 | 0 | 0 | 13, 13, 6, 9, 13, 12, 12, 11, 15, 14, 14, 14 | temperate_forest-2 day 6 |
| 2 | 13 | 6 | 10 | 149 | 9 | 0 | 0 | 0 | 13, 13, 6, 12, 13, 12, 13, 10, 15, 13, 15, 14 | temperate_forest-2 day 6; taiga-3 day 6; temperate_grassland-3 day 6 |
| 3 | 12.5 | 6 | 8 | 140 | 7 | 0 | 0 | 0 | 10, 13, 6, 11, 13, 12, 8, 10, 15, 13, 15, 14 | temperate_forest-2 day 7 |
| 4 | 13 | 6 | 6 | 144 | 9 | 0 | 0 | 0 | 13, 13, 6, 13, 6, 12, 12, 11, 15, 14, 15, 14 | temperate_forest-2 day 6; temperate_grassland-3 day 6 |
| 5 | 12.5 | 6 | 9 | 145 | 7 | 0 | 0 | 0 | 12, 13, 6, 12, 13, 12, 11, 9, 15, 14, 14, 14 | temperate_forest-2 day 7; temperate_grassland-4 day 6 |
| 6 | 12 | 6 | 8 | 141 | 7 | 0 | 0 | 0 | 13, 8, 11, 13, 6, 11, 11, 11, 15, 14, 15, 13 |  |
| 7 | 13 | 11 | 11 | 156 | 12 | 0 | 0 | 0 | 11, 13, 12, 13, 13, 12, 13, 11, 15, 14, 15, 14 | temperate_forest-2 day 6; temperate_grassland-4 day 6 |
| **Pooled** | 12.75 | 7.13 | 9 | 147 | 8.63 | 0 | 0 | 0 | | |
| Reference | 12.94 | 9.63 | 10.5 | 151.88 | 9.38 | 0 | 0 | 0 | | |
| Bounds | ≥ 11.69 | | | ≥ 138.88 | ≥ 6.88 | ≤ 2 | ≤ 2 | | | |

Median, worst, second-worst, sum and wildlife-free are means over the samples; extinct, starved years and need deaths are counted over all of them. Tolerances: {"median":1.25,"living":13,"wildlifeFree":2.5,"extinct":2,"starvedYears":2}.

**Verdict: pass.** Bounds exceeded: none. Worsened together (by more than half a tolerance against the reference): none.

If accepted: `WILDLIFE_REFERENCE` = `{"median":12.75,"worst":7.13,"secondWorst":9,"living":147,"wildlifeFree":8.63,"extinct":0,"starvedYears":0,"hungerThirstDeaths":0}`; `WILDLIFE_MEASURED` = `{"median":12.94,"worst":9.63,"secondWorst":10.5,"living":151.88,"wildlifeFree":9.38,"extinct":0,"starvedYears":0,"hungerThirstDeaths":0}`.
