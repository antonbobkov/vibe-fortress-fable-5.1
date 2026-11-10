## Twenty-seed sweep: 4 sweeps of 6e6a6ec3

| Shift | Alive at year 1 | Peril-0 grown | Peril-0 with need deaths | Living at year 3 | Dwarf deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| 0 | 20 | 7 | 0 | 892 | 149 | 1 | 0 |
| 50 | 19 | 7 | 0 | 786 | 138 | 2 | 7 |
| 100 | 20 | 7 | 0 | 913 | 170 | 1 | 1 |
| 150 | 20 | 7 | 1 | 953 | 131 | 0 | 2 |
| **Pooled** | 19.75 | 7 | 0.25 | 886 | 147 | 1 | 2.5 |
| Reference | 20 | 7 | 0 | 948.5 | 125.25 | 0.25 | 0.25 |
| Bounds | ≥ 18 | ≥ 6 | ≤ 1 | ≥ 848.5 | ≤ 155.25 | | |

Pooled figures are means over the sweeps. Alive, grown and need-death fortresses are bounded by the set rule; living and deaths by the best accepted pooled figures and tolerances {"living":100,"deaths":30}.

**Verdict: pass.** Bounds exceeded: none.

If accepted: `SWEEP_REFERENCE` = `{"alive":19.75,"grown":7,"hungry":0.25,"living":886,"deaths":147,"extinct":1,"needDeaths":2.5}`; `SWEEP_MEASURED` = `{"living":948.5,"deaths":125.25}`.

| Seed | Year 1 by shift | Year 3 by shift | Deaths by shift | Need deaths by shift | Extinct (shift: day) |
|---|---|---|---|---|---|
| three-years-p0-1 | 14, 14, 14, 14 | 59, 63, 63, 64 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-2 | 13, 13, 13, 13 | 55, 71, 55, 76 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-3 | 17, 18, 18, 17 | 63, 47, 48, 75 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-4 | 16, 15, 15, 16 | 57, 64, 64, 58 | 0, 0, 0, 2 | 0, 0, 0, 2 |  |
| three-years-p0-5 | 15, 15, 16, 16 | 60, 42, 47, 80 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-6 | 13, 14, 15, 14 | 48, 61, 80, 30 | 1, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-7 | 17, 17, 18, 18 | 80, 80, 76, 52 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p2-1 | 16, 11, 16, 15 | 56, 35, 64, 58 | 5, 6, 3, 1 | 0, 0, 0, 0 |  |
| three-years-p2-2 | 13, 11, 13, 6 | 27, 11, 34, 27 | 8, 14, 6, 11 | 0, 0, 0, 0 |  |
| three-years-p2-3 | 17, 18, 18, 18 | 60, 79, 71, 75 | 11, 3, 13, 0 | 0, 0, 0, 0 |  |
| three-years-p2-4 | 5, 5, 12, 5 | 0, 4, 44, 9 | 15, 17, 18, 22 | 0, 0, 0, 0 | 0: 123 |
| three-years-p2-5 | 5, 13, 10, 12 | 2, 6, 28, 4 | 12, 8, 11, 17 | 0, 0, 0, 0 |  |
| three-years-p2-6 | 15, 12, 10, 13 | 36, 42, 36, 29 | 7, 7, 8, 8 | 0, 0, 0, 0 |  |
| three-years-p2-7 | 16, 0, 9, 16 | 72, 0, 6, 59 | 8, 14, 21, 14 | 0, 7, 0, 0 | 50: 87 |
| three-years-p4-1 | 18, 16, 18, 17 | 49, 34, 38, 76 | 25, 14, 25, 2 | 0, 0, 0, 0 |  |
| three-years-p4-2 | 14, 11, 15, 15 | 44, 41, 26, 56 | 5, 4, 20, 9 | 0, 0, 0, 0 |  |
| three-years-p4-3 | 10, 12, 9, 14 | 24, 38, 23, 15 | 15, 6, 6, 9 | 0, 0, 0, 0 |  |
| three-years-p4-4 | 12, 15, 11, 14 | 12, 0, 0, 18 | 14, 27, 25, 16 | 0, 0, 1, 0 | 50: 313; 100: 326 |
| three-years-p4-5 | 13, 15, 16, 15 | 25, 20, 63, 48 | 16, 8, 5, 16 | 0, 0, 0, 0 |  |
| three-years-p4-6 | 15, 16, 17, 14 | 63, 48, 47, 44 | 7, 10, 9, 4 | 0, 0, 0, 0 |  |

Invariant findings (each fails its seed's job, not the verdict): none.
