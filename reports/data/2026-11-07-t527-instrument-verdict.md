## Annual instrument: 8 samples of ae82c7e3

| Shift | Median | Worst | Second-worst | Sum of the living | Wildlife-free | Extinct | Starved years | Need deaths | Living by seed | Dug for stone |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 13 | 10 | 11 | 154 | 8 | 0 | 0 | 0 | 12, 13, 13, 12, 13, 12, 11, 10, 15, 14, 15, 14 | temperate_forest-2 day 6; temperate_grassland-3 day 6; temperate_grassland-4 day 6 |
| 1 | 13 | 7 | 8 | 145 | 7 | 0 | 0 | 0 | 13, 11, 8, 11, 13, 12, 13, 7, 15, 14, 15, 13 | temperate_forest-2 day 6 |
| 2 | 12.5 | 7 | 8 | 142 | 8 | 0 | 0 | 0 | 7, 9, 8, 11, 13, 12, 13, 11, 15, 14, 15, 14 | temperate_forest-2 day 6; taiga-3 day 6; temperate_grassland-3 day 6 |
| 3 | 12.5 | 8 | 10 | 146 | 8 | 0 | 0 | 0 | 10, 13, 8, 10, 13, 12, 11, 11, 15, 14, 15, 14 | temperate_forest-2 day 6 |
| 4 | 12 | 8 | 9 | 143 | 6 | 0 | 0 | 0 | 10, 9, 8, 11, 13, 12, 12, 11, 14, 14, 15, 14 | temperate_forest-2 day 6; temperate_grassland-3 day 6 |
| 5 | 12.5 | 8 | 10 | 145 | 6 | 0 | 0 | 0 | 10, 13, 8, 11, 13, 12, 12, 10, 14, 14, 14, 14 | temperate_forest-2 day 6; temperate_grassland-4 day 6 |
| 6 | 12 | 7 | 10 | 145 | 6 | 0 | 0 | 0 | 12, 10, 7, 11, 13, 12, 12, 10, 15, 14, 15, 14 | temperate_forest-2 day 6 |
| 7 | 13 | 8 | 11 | 151 | 10 | 0 | 0 | 0 | 8, 11, 12, 13, 13, 12, 13, 11, 15, 14, 15, 14 | temperate_forest-2 day 6 |
| **Pooled** | 12.56 | 7.88 | 9.63 | 146.38 | 7.38 | 0 | 0 | 0 | | |
| Reference | 12.63 | 6 | 8.88 | 143 | 6.63 | 0 | 0 | 0 | | |
| Bounds | ≥ 11.38 | | | ≥ 130 | ≥ 4.13 | ≤ 2 | ≤ 2 | | | |

Median, worst, second-worst, sum and wildlife-free are means over the samples; extinct, starved years and need deaths are counted over all of them. Tolerances: {"median":1.25,"living":13,"wildlifeFree":2.5,"extinct":2,"starvedYears":2}.

**Verdict: pass.** Bounds exceeded: none. Worsened together (by more than half a tolerance against the reference): none.

If accepted: `WILDLIFE_REFERENCE` = `{"median":12.56,"worst":7.88,"secondWorst":9.63,"living":146.38,"wildlifeFree":7.38,"extinct":0,"starvedYears":0,"hungerThirstDeaths":0}`; `WILDLIFE_MEASURED` = `{"median":12.63,"worst":7.88,"secondWorst":9.63,"living":146.38,"wildlifeFree":7.38,"extinct":0,"starvedYears":0,"hungerThirstDeaths":0}`.
