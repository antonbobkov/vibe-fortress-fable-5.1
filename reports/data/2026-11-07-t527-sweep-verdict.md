## Twenty-seed sweep: 4 sweeps of ae82c7e3

| Shift | Alive at year 1 | Peril-0 grown | Peril-0 with need deaths | Living at year 3 | Dwarf deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| 0 | 20 | 7 | 0 | 948 | 115 | 0 | 0 |
| 50 | 20 | 7 | 0 | 1043 | 104 | 0 | 0 |
| 100 | 20 | 7 | 1 | 899 | 190 | 0 | 1 |
| 150 | 20 | 7 | 0 | 1045 | 135 | 0 | 2 |
| **Pooled** | 20 | 7 | 0.25 | 983.75 | 136 | 0 | 0.75 |
| Reference | 20 | 7 | 0 | 948.5 | 125.25 | 0.25 | 0.25 |
| Bounds | ≥ 18 | ≥ 6 | ≤ 1 | ≥ 848.5 | ≤ 155.25 | | |

Pooled figures are means over the sweeps. Alive, grown and need-death fortresses are bounded by the set rule; living and deaths by the best accepted pooled figures and tolerances {"living":100,"deaths":30}.

**Verdict: pass.** Bounds exceeded: none.

If accepted: `SWEEP_REFERENCE` = `{"alive":20,"grown":7,"hungry":0.25,"living":983.75,"deaths":136,"extinct":0,"needDeaths":0.75}`; `SWEEP_MEASURED` = `{"living":983.75,"deaths":125.25}`.

| Seed | Year 1 by shift | Year 3 by shift | Deaths by shift | Need deaths by shift | Extinct (shift: day) |
|---|---|---|---|---|---|
| three-years-p0-1 | 14, 14, 14, 14 | 62, 40, 57, 76 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-2 | 13, 13, 13, 13 | 51, 32, 71, 71 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-3 | 17, 17, 16, 17 | 75, 76, 41, 74 | 0, 0, 2, 0 | 0, 0, 1, 0 |  |
| three-years-p0-4 | 8, 15, 12, 9 | 68, 64, 56, 47 | 4, 0, 4, 8 | 0, 0, 0, 0 |  |
| three-years-p0-5 | 15, 15, 16, 16 | 55, 42, 47, 47 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-6 | 14, 14, 14, 14 | 30, 45, 57, 52 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-7 | 18, 17, 18, 16 | 40, 63, 64, 77 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p2-1 | 10, 16, 15, 15 | 58, 75, 64, 48 | 4, 0, 4, 5 | 0, 0, 0, 0 |  |
| three-years-p2-2 | 11, 8, 5, 5 | 35, 44, 43, 53 | 7, 8, 10, 8 | 0, 0, 0, 0 |  |
| three-years-p2-3 | 16, 18, 18, 19 | 35, 77, 51, 61 | 12, 5, 33, 2 | 0, 0, 0, 0 |  |
| three-years-p2-4 | 7, 11, 5, 7 | 27, 52, 3, 2 | 22, 14, 22, 30 | 0, 0, 0, 0 |  |
| three-years-p2-5 | 10, 13, 13, 13 | 6, 69, 15, 18 | 12, 7, 8, 6 | 0, 0, 0, 0 |  |
| three-years-p2-6 | 15, 10, 13, 13 | 68, 23, 67, 52 | 3, 12, 12, 3 | 0, 0, 0, 0 |  |
| three-years-p2-7 | 17, 17, 15, 16 | 77, 63, 64, 64 | 3, 2, 5, 15 | 0, 0, 0, 0 |  |
| three-years-p4-1 | 17, 5, 15, 16 | 58, 35, 60, 44 | 6, 11, 14, 11 | 0, 0, 0, 2 |  |
| three-years-p4-2 | 14, 15, 14, 15 | 54, 76, 36, 68 | 4, 0, 16, 7 | 0, 0, 0, 0 |  |
| three-years-p4-3 | 9, 3, 11, 12 | 21, 47, 8, 58 | 12, 15, 19, 10 | 0, 0, 0, 0 |  |
| three-years-p4-4 | 12, 12, 7, 17 | 33, 10, 9, 12 | 10, 13, 19, 18 | 0, 0, 0, 0 |  |
| three-years-p4-5 | 12, 15, 14, 15 | 53, 51, 34, 47 | 5, 9, 4, 1 | 0, 0, 0, 0 |  |
| three-years-p4-6 | 10, 18, 17, 15 | 42, 59, 52, 74 | 11, 8, 18, 11 | 0, 0, 0, 0 |  |

Invariant findings (each fails its seed's job, not the verdict): shift 0, three-years-p2-4: dwarf.retreat-without-hearth-alert (calm) from tick 403200: t403200: dwarf 83886403 Dalla Forgefoot behavior retreat, alert calm.
