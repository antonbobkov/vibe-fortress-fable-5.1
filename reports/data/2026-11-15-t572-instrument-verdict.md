## Annual instrument: 8 samples of df8a7333

| Shift | Median | Worst | Second-worst | Sum of the living | Wildlife-free | Extinct | Starved years | Need deaths | Living by seed | Dug for stone |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 13 | 9 | 11 | 155 | 11 | 0 | 0 | 0 | 13, 13, 13, 13, 9, 12, 13, 11, 15, 14, 15, 14 | temperate_grassland-1 day 6; temperate_grassland-3 day 6 |
| 1 | 13 | 11 | 11 | 154 | 9 | 0 | 0 | 0 | 13, 12, 11, 13, 13, 12, 13, 11, 14, 14, 14, 14 | temperate_forest-2 day 6 |
| 2 | 12 | 7 | 10 | 144 | 6 | 0 | 0 | 0 | 10, 12, 11, 12, 13, 12, 7, 11, 14, 14, 15, 13 | temperate_grassland-3 day 6; temperate_grassland-4 day 6 |
| 3 | 13 | 11 | 11 | 156 | 11 | 0 | 0 | 0 | 13, 13, 11, 13, 13, 12, 13, 11, 14, 14, 15, 14 | temperate_forest-2 day 7 |
| 4 | 13 | 7 | 11 | 150 | 9 | 0 | 0 | 0 | 13, 12, 11, 13, 13, 12, 7, 11, 15, 14, 15, 14 | temperate_grassland-1 day 6; temperate_grassland-3 day 6 |
| 5 | 13 | 11 | 11 | 156 | 10 | 0 | 0 | 0 | 13, 13, 11, 13, 13, 11, 13, 11, 15, 14, 15, 14 | temperate_forest-2 day 7; taiga-1 day 6; temperate_grassland-1 day 6; temperate_grassland-4 day 6 |
| 6 | 13 | 8 | 10 | 149 | 8 | 0 | 0 | 0 | 11, 8, 13, 11, 13, 12, 13, 10, 15, 14, 15, 14 | temperate_forest-2 day 6 |
| 7 | 13 | 8 | 10 | 150 | 9 | 0 | 0 | 0 | 13, 10, 10, 13, 13, 12, 13, 8, 15, 14, 15, 14 | temperate_grassland-3 day 6; temperate_grassland-4 day 6 |
| **Pooled** | 12.88 | 9 | 10.63 | 151.75 | 9.13 | 0 | 0 | 0 | | |
| Reference | 12.94 | 9.63 | 10.5 | 151.88 | 9.38 | 0 | 0 | 0 | | |
| Bounds | ≥ 11.69 | | | ≥ 138.88 | ≥ 6.88 | ≤ 2 | ≤ 2 | | | |

Median, worst, second-worst, sum and wildlife-free are means over the samples; extinct, starved years and need deaths are counted over all of them. Tolerances: {"median":1.25,"living":13,"wildlifeFree":2.5,"extinct":2,"starvedYears":2}.

**Verdict: pass.** Bounds exceeded: none. Worsened together (by more than half a tolerance against the reference): none.

If accepted: `WILDLIFE_REFERENCE` = `{"median":12.88,"worst":9,"secondWorst":10.63,"living":151.75,"wildlifeFree":9.13,"extinct":0,"starvedYears":0,"hungerThirstDeaths":0}`; `WILDLIFE_MEASURED` = `{"median":12.94,"worst":9.63,"secondWorst":10.63,"living":151.88,"wildlifeFree":9.38,"extinct":0,"starvedYears":0,"hungerThirstDeaths":0}`.
