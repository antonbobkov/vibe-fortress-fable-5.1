## Twenty-seed sweep: 4 sweeps of 424378bc

| Shift | Alive at year 1 | Peril-0 grown | Peril-0 with need deaths | Living at year 3 | Dwarf deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| 0 | 20 | 7 | 0 | 998 | 142 | 1 | 1 |
| 50 | 20 | 7 | 0 | 1052 | 132 | 0 | 0 |
| 100 | 19 | 7 | 1 | 953 | 114 | 1 | 7 |
| 150 | 20 | 7 | 0 | 1037 | 161 | 0 | 0 |
| **Pooled** | 19.75 | 7 | 0.25 | 1010 | 137.25 | 0.5 | 2 |
| Reference | 20 | 7 | 0 | 1024.25 | 130.75 | 0.5 | 3 |
| Bounds | ≥ 18 | ≥ 6 | ≤ 1 | ≥ 898.25 | ≤ 143.75 | | |

Pooled figures are means over the sweeps. Alive, grown and need-death fortresses are bounded by the set rule; living and deaths by the best accepted pooled figures and tolerances {"living":100,"deaths":30}.

**Verdict: pass.** Bounds exceeded: none.

If accepted: `SWEEP_REFERENCE` = `{"alive":19.75,"grown":7,"hungry":0.25,"living":1010,"deaths":137.25,"extinct":0.5,"needDeaths":2}`; `SWEEP_MEASURED` = `{"living":1010,"deaths":113.75}`.

| Seed | Year 1 by shift | Year 3 by shift | Deaths by shift | Need deaths by shift | Extinct (shift: day) |
|---|---|---|---|---|---|
| three-years-p0-1 | 14, 14, 14, 14 | 67, 75, 38, 70 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-2 | 13, 13, 13, 13 | 51, 71, 57, 75 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-3 | 17, 18, 17, 17 | 74, 47, 80, 72 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-4 | 15, 15, 16, 16 | 79, 79, 62, 73 | 0, 0, 1, 0 | 0, 0, 1, 0 |  |
| three-years-p0-5 | 15, 16, 16, 16 | 67, 77, 76, 80 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-6 | 15, 15, 15, 15 | 79, 75, 57, 70 | 0, 1, 0, 6 | 0, 0, 0, 0 |  |
| three-years-p0-7 | 17, 17, 17, 17 | 52, 80, 52, 61 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p2-1 | 16, 15, 16, 16 | 64, 74, 63, 57 | 7, 7, 1, 13 | 0, 0, 0, 0 |  |
| three-years-p2-2 | 13, 14, 15, 13 | 39, 39, 56, 65 | 7, 6, 3, 6 | 0, 0, 0, 0 |  |
| three-years-p2-3 | 18, 12, 19, 17 | 52, 55, 58, 47 | 7, 4, 7, 18 | 0, 0, 0, 0 |  |
| three-years-p2-4 | 14, 9, 14, 9 | 47, 35, 22, 21 | 13, 11, 13, 12 | 0, 0, 0, 0 |  |
| three-years-p2-5 | 13, 9, 13, 10 | 25, 18, 24, 31 | 16, 7, 17, 12 | 0, 0, 0, 0 |  |
| three-years-p2-6 | 16, 13, 12, 14 | 48, 49, 55, 48 | 8, 10, 8, 15 | 0, 0, 0, 0 |  |
| three-years-p2-7 | 13, 15, 18, 17 | 73, 68, 60, 80 | 2, 9, 4, 1 | 0, 0, 0, 0 |  |
| three-years-p4-1 | 16, 15, 15, 17 | 63, 56, 64, 68 | 13, 17, 3, 5 | 0, 0, 0, 0 |  |
| three-years-p4-2 | 2, 9, 12, 5 | 0, 28, 24, 10 | 15, 12, 6, 12 | 1, 0, 0, 0 | 0: 140 |
| three-years-p4-3 | 14, 9, 11, 14 | 45, 21, 19, 21 | 10, 11, 12, 18 | 0, 0, 0, 0 |  |
| three-years-p4-4 | 11, 12, 0, 10 | 4, 9, 0, 3 | 19, 16, 15, 20 | 0, 0, 6, 0 | 100: 99 |
| three-years-p4-5 | 13, 16, 15, 7 | 4, 56, 62, 33 | 23, 10, 9, 9 | 0, 0, 0, 0 |  |
| three-years-p4-6 | 18, 15, 16, 16 | 65, 40, 24, 52 | 2, 11, 15, 14 | 0, 0, 0, 0 |  |

Invariant findings (each fails its seed's job, not the verdict): shift 100, three-years-p2-5: dwarf.frozen-2d (work/Feed patient) from tick 339600: t339600: dwarf 50331847 Gefjun Granitespark 38,21,33|work|Feed patient|9361 target 63300 unchanged since t336997; needs {"hunger":83.63999999999986,"thirst":100,"rest":100,"social":100,"comfort":87,"purpose":0,"joy":100}; shift 100, three-years-p2-5: job.stuck-active-3d (feed_patient/fetching) from tick 340800: t340800: job 9361 feed_patient fetching|0|50331847|(38,21,33) unchanged since t336997.
