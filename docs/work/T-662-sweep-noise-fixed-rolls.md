# T-662 — The sweep's noise under fixed immigration rolls

**Source:** [T-652's measurement](../../reports/data/2026-11-20-t652-immigration-roll-stream.md) · **Size:** M · **Needs:** T-652 · **Status:** open

## Why

Since T-652, a season's immigration roll is fixed by the world seed, the year and the season (21 § Evaluation). That is what lets two codes be compared on the same rolls. It also means that the four shifts of a sweep share their rolls: on T-652's sweep, all 169 seasons that two or more shifts of a seed rolled had the same roll in every shift, against 33 of 173 on master. The sweep's tolerances (`SWEEP_TOLERANCE`: living 100, deaths 30) and its best figures (987.75 living, 131.88 deaths) were measured when each shift drew its own rolls. Part of the spread they cover was immigration luck that no longer varies between shifts. Part of the reference was luck that the fixed rolls of these twenty seeds may not repeat. In T-652's sweep, the peril-4 waves of year 3 came at 78% of the rolls against a 70.3% chance, and those of year 1 at 39%.

## What to do

Play the eight shifts 0 to 350 of one master with T-652, as T-513 and T-580 did. Measure the spread of the pooled living and deaths over disjoint sets of four shifts under the fixed rolls. If it has narrowed, set `SWEEP_TOLERANCE` and the best figures from it, and say what that buys (a smaller change caught). If it has not narrowed, keep them, and say why. Either way, record the eight shifts' immigration rolls against their chance by peril and year, so that the seed set's fixed luck is known.

Spec: testing-strategy.md § The twenty-seed sweep; `test/perf/three_years_sweep.ts`.

## Done

- [x] The spread of the pooled figures under fixed rolls: eight shifts of master `f83df33f` (Measure runs 45005780661 and 45005782771), pooled with three neighbouring codes' sweeps, give one sweep a standard deviation of 52.3 living (92.4 on T-580's shifts) and 18 deaths (16.8), so a four-shift mean stands 32 living and 11 deaths from an eight-shift one; disjoint sets of four of the eight shifts differ by at most 75.25 living and 18 deaths. By peril, peril-0 living fell from 38.3 to 7.2 a sweep ([T-662's report](../../reports/data/2026-11-22-t662-sweep-noise.md)).
- [x] The tolerances and best figures: living 100 → 80 (2.5 × 32), deaths kept at 30 since their noise is the timeline's raids and ambushes, not the rolls. Reference and best reset to `f83df33f` (20 / 7 / 0 / 1151.75 / 98.25; best 1126.63 and 102.5; bounds 1046.63 and 132.5); T-580's bounds stood 239 living and 59 deaths from master's level. A verdict line now names a figure worth tracing (`SWEEP_TRACE`: deaths 22.5 over the best, living 65 under). Master's 97.75 to 120.25 deaths of 2026-11-22 are noise.
- [x] The seed set's rolls against their chance: 129 of 179 distinct seed-seasons rolled under 700 (125.3 expected); peril-2's first winter 7 of 7, peril-4's 3 of 6, peril-4's year 3 19 of 24.
- Follow-up: [a planting job keeps a vanished seed](T-NEW-plant-job-vanished-seed.md) (`p4-4` at shift 200 failed its invariants).
