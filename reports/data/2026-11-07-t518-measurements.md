# T-518 measurements: a second line behind the three-year gate

"Before" is master `56379184` (T-519 merged), and T-513's reference run of master `ec0c9e03`. "After" is the T-518 branch, `44d3f334`, which is that master merged in. Every sweep is `measure.yml` suite `sweep`: four timelines (shifts 0, 50, 100 and 150) of the twenty seeds and one verdict.

## The twenty-seed sweep

| Sample | Run | Alive at year 1 | Peril-0 grown | Peril-0 with need deaths | Living at year 3 | Dwarf deaths | Extinct | Need deaths | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| before, `56379184` | 42362125659 | 19.75 | 7 | 0 | 878.5 | 145 | 2.5 | 1.25 | pass |
| before, T-513 reference (`ec0c9e03`) | 42347442263 | 19.75 | 7 | 0 | 876 | 145 | 2.5 | 1.25 | pass |
| after, `44d3f334` | 42362123219 | 20 | 7 | 0 | 973.75 | 111.5 | 0.25 | 2 | pass |

The figures are means over the four timelines. The set rule holds in every timeline after: all twenty alive at year 1, 7 of 7 peril-0 seeds grown, no peril-0 seed with a need death.

| Peril 4, over the 24 seed-timelines | Before (`56379184`) | After |
|---|---|---|
| Extinct | 8: `p4-1` 50 (day 61); `p4-3` 0, 50, 100, 150 (days 187–189); `p4-4` 100, 150 (days 286, 245); `p4-5` 0 (day 183) | 1: `p4-4` 50 (day 138) |
| Living at year 3, per sweep | 178.5 | 222 |
| Dwarf deaths, per sweep | 81.75 | 61 |
| Need deaths, total | 3 (`p4-5` 0) | 8 (`p4-4` 0: 1, `p4-4` 50: 7) |

- `p4-3` survives its year-2 siege in all four timelines (28, 22, 17 and 49 living at year 3). Before, it died out in all four.
- `p4-4` at shift 50 starves: raids take it from 14 to 8 dwarves by day 73, the food is gone on day 79 with the alert calm and every door open, and the dwarves die of starvation from day 101 ([probe](2026-11-07-t518-siege.probe.ts.txt)). Its gate holds; it is a food economy that does not recover from losing its farmers.
- `p2-4` at shift 50 fails its job on its witnesses (one dwarf left, no hearth or dining hall) both before and after.

## Runs on the way

| Run | Commit | What it showed |
|---|---|---|
| 42352087419 | `f487af01`, the line built at routine priority | Verdict pass, pooled 971.25 living, 118.25 deaths, 0.5 extinct. `p4-3` at shift 50 still died on day 188: its west inner door was still only planned on day 185, 80 days after placing, waiting behind the mason's routine blocks; the trollkin broke the north gate door and the siege came in that way. |
| 42356438707 | `b12e8553`, the doors made first and built ahead of routine work | Verdict pass, pooled 963.75 / 113.5 / 0.5. `p4-3` survives in all four. `p4-2` at shift 0 had `container.no-work-tile` from day 97: four dwarves on the surface and one in the shaft, none behind the locked line, and the script did not lift the alert, because it still counted the stair's foot as inside. |

## `defence_year_seeds` (`measure.yml` suite `defence_seeds`, peril 2, no sieges)

| Sample | Run | Soldier kills by seed (d, d-2 … d-8) | Sum | Seeds with a kill |
|---|---|---|---|---|
| before, `56379184` | 42362130584 | 0, 1, 0, 2, 0, 2, 3, 1 | 9 | 5 of 8 |
| before, `27ede65e` | 42351237355 | 0, 1, 0, 2, 0, 2, 3, 1 | 9 | 5 of 8 |
| after, `a7a8107a` (no defence-script change) | 42351235586 | 2, —, 1, 1, 0, 2, —, 2 | 8 | 5 of 6 |
| after, `44d3f334` | 42362128179 | 1, 0, 0, 1, 1, 2, 4, 0 | 9 | 5 of 8 |

On `a7a8107a`, `defence-year-2` and `-7` stopped on a refused command of the fortress script: the dining hall's chair (`footprint_blocked`) and its zone (`overlap`). `defence_year`'s script had put its barracks, archery target or range on dining-hall tiles while the hall waited for its kitchen. It now leaves the dining hall's tiles alone.

## Other runs

- `three_years_main` (42362146080, `44d3f334`): passes with no death; population 15 / 53 / 65 at years 1 / 2 / 3 (15 / 34 / 58 in T-512's after run).
- `defence_year` (42362144163, `44d3f334`): passes. Two dwarves bled out in fights, one soldier kill.
- The annual instrument (42351239983, `a7a8107a`): passes, identical to the reference (pooled median 12.63, sum of the living 143, wildlife-free 6.63). It does not play the three-year script, and nothing under `src/` changed.
- `ci.yml` (42362132522, `44d3f334`): all six jobs pass; 3599 unit tests over the four shards, e2e 39 passed.
