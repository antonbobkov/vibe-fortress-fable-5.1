# T-NEW — The sweep's noise under fixed immigration rolls

**Source:** [T-652's measurement](../../reports/data/2026-11-20-t652-immigration-roll-stream.md) · **Size:** M · **Needs:** T-652 · **Status:** open

## Why

Since T-652, a season's immigration roll is fixed by the world seed, the year and the season (21 § Evaluation). That is what lets two codes be compared on the same rolls. It also means that the four shifts of a sweep share their rolls: on T-652's sweep, all 169 seasons that two or more shifts of a seed rolled had the same roll in every shift, against 33 of 173 on master. The sweep's tolerances (`SWEEP_TOLERANCE`: living 100, deaths 30) and its best figures (987.75 living, 131.88 deaths) were measured when each shift drew its own rolls. Part of the spread they cover was immigration luck that no longer varies between shifts. Part of the reference was luck that the fixed rolls of these twenty seeds may not repeat. In T-652's sweep, the peril-4 waves of year 3 came at 78% of the rolls against a 70.3% chance, and those of year 1 at 39%.

## What to do

Play the eight shifts 0 to 350 of one master with T-652, as T-513 and T-580 did. Measure the spread of the pooled living and deaths over disjoint sets of four shifts under the fixed rolls. If it has narrowed, set `SWEEP_TOLERANCE` and the best figures from it, and say what that buys (a smaller change caught). If it has not narrowed, keep them, and say why. Either way, record the eight shifts' immigration rolls against their chance by peril and year, so that the seed set's fixed luck is known.

Spec: testing-strategy.md § The twenty-seed sweep; `test/perf/three_years_sweep.ts`.

## Done

The spread of the pooled figures under fixed rolls, the tolerances and best figures kept or reset with the reason, and the seed set's rolls against their chance.
