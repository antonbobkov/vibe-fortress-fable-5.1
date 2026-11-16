# T-573 sweep verdict: a worker who goes down gives its job back

Measure run 43800558166, branch `t573-downed-worker` at `642f323e` (master `f3c87243` after T-571, with T-573). The verdict job's `verdict.md` follows without its "If accepted" line: the reference does not change. Every figure equals master's, from T-571's sweep (run 43790050289, [verdict](2026-11-15-t571-sweep-verdict-dormitories.md)): in these 80 timelines no worker went down while holding a job. `p4-4` at shift 0 failed its witness "gate doors built", as it does on master.

The rule's own case is `three-years-p2-4` at shift 200, replayed locally. Without the change it broke `job.worker-unconscious (plant)` at tick 277200. The worker was a bleeding patient (blood 202 of 642) who fainted while its planting job was held through its absence. With the change every invariant held.

## Twenty-seed sweep: 4 sweeps of 642f323e

| Shift | Alive at year 1 | Peril-0 grown | Peril-0 with need deaths | Living at year 3 | Dwarf deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| 0 | 20 | 7 | 0 | 981 | 130 | 0 | 0 |
| 50 | 19 | 7 | 0 | 934 | 114 | 1 | 1 |
| 100 | 20 | 7 | 0 | 1136 | 96 | 0 | 0 |
| 150 | 20 | 7 | 0 | 1013 | 140 | 1 | 0 |
| **Pooled** | 19.75 | 7 | 0 | 1016 | 120 | 0.5 | 0.25 |
| Reference | 20 | 7 | 0 | 1024.25 | 130.75 | 0.5 | 3 |
| Bounds | ≥ 18 | ≥ 6 | ≤ 1 | ≥ 898.25 | ≤ 143.75 | | |

Pooled figures are means over the sweeps. Alive, grown and need-death fortresses are bounded by the set rule; living and deaths by the best accepted pooled figures and tolerances {"living":100,"deaths":30}.

**Verdict: pass.** Bounds exceeded: none.

| Seed | Year 1 by shift | Year 3 by shift | Deaths by shift | Need deaths by shift | Extinct (shift: day) |
|---|---|---|---|---|---|
| three-years-p0-1 | 14, 14, 14, 14 | 67, 63, 56, 75 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-2 | 13, 13, 13, 13 | 37, 76, 74, 62 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-3 | 17, 17, 17, 17 | 74, 74, 80, 61 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-4 | 15, 15, 16, 16 | 64, 53, 50, 50 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-5 | 15, 15, 16, 16 | 55, 44, 76, 80 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p0-6 | 14, 14, 15, 14 | 64, 64, 69, 55 | 0, 0, 0, 1 | 0, 0, 0, 0 |  |
| three-years-p0-7 | 17, 17, 17, 18 | 64, 52, 52, 80 | 0, 0, 0, 0 | 0, 0, 0, 0 |  |
| three-years-p2-1 | 15, 16, 16, 12 | 44, 64, 58, 45 | 0, 5, 3, 3 | 0, 0, 0, 0 |  |
| three-years-p2-2 | 15, 12, 13, 13 | 45, 30, 34, 49 | 2, 11, 2, 3 | 0, 0, 0, 0 |  |
| three-years-p2-3 | 19, 18, 17, 18 | 54, 72, 71, 53 | 10, 4, 2, 7 | 0, 0, 0, 0 |  |
| three-years-p2-4 | 16, 8, 15, 12 | 44, 21, 39, 51 | 7, 12, 9, 10 | 0, 0, 0, 0 |  |
| three-years-p2-5 | 13, 14, 13, 13 | 33, 24, 64, 28 | 3, 2, 3, 2 | 0, 0, 0, 0 |  |
| three-years-p2-6 | 10, 12, 12, 12 | 42, 58, 69, 51 | 9, 12, 4, 7 | 0, 0, 0, 0 |  |
| three-years-p2-7 | 12, 17, 17, 12 | 65, 60, 79, 71 | 10, 4, 2, 16 | 0, 0, 0, 0 |  |
| three-years-p4-1 | 15, 14, 18, 17 | 50, 41, 61, 69 | 6, 8, 9, 20 | 0, 0, 0, 0 |  |
| three-years-p4-2 | 13, 15, 14, 14 | 35, 39, 43, 48 | 24, 9, 7, 8 | 0, 0, 0, 0 |  |
| three-years-p4-3 | 7, 0, 14, 14 | 38, 0, 30, 30 | 16, 12, 16, 4 | 0, 0, 0, 0 | 50: 89 |
| three-years-p4-4 | 14, 14, 11, 14 | 1, 15, 7, 3 | 21, 16, 16, 32 | 0, 1, 0, 0 |  |
| three-years-p4-5 | 14, 15, 15, 13 | 55, 32, 67, 0 | 11, 8, 8, 19 | 0, 0, 0, 0 | 150: 326 |
| three-years-p4-6 | 13, 13, 17, 13 | 50, 52, 57, 52 | 11, 11, 15, 8 | 0, 0, 0, 0 |  |

Invariant findings (each fails its seed's job, not the verdict): none.
