# T-512 measurements: the sowing rule, before and after

Master `1a8f0ef4` ("before") against T-512's sowing rule over it ("after", `ce56f509`). Shifted samples are the same code with `w.step(n)` before the opening, on throwaway branches that have since been deleted.

## The twenty-seed sweep (`measure.yml` suite `sweep`)

| Sample | Run | Deaths | Living | Peril 0 / 2 / 4 living | Need deaths | Extinct | Set rule |
|---|---|---|---|---|---|---|---|
| before, shift 0 | 42325939870 | 131 | 973 | 459 / 239 / 275 | 0 | — | holds |
| before, shift 1 | 42325942200 | 140 | 859 | 448 / 223 / 188 | 6 (p2-4, p4-4) | p2-4 d313, p4-4 d117 | holds |
| before, shift 2 | 42325944699 | 127 | 968 | 432 / 249 / 287 | 1 (p2-5) | p4-4 d185 | holds |
| after, shift 0 | 42325947404 | 156 | 786 (19 seeds) | 432 / 254 / 100 | 3 (p4-5) | p4-3 d189, p4-5 d183 | p4-6 gave no result (a caravan invariant) |
| after, shift 1 | 42325949783 | 137 | 787 | 370 / 231 / 186 | 1 (p4-4) | p4-3 d188, p4-4 d74 | holds |
| after, shift 2 | 42325952264 | 153 | 889 | 414 / 288 / 187 | 0 | p4-3 d189 | holds |

- No peril-0 seed has a need death in any sample. The set rule holds wherever all twenty seeds gave a result.
- Peril-0 living is 446 before and 405 after on average. The gap is in immigration: waves come to 59, 56 and 57 before against 55, 48 and 53 after, with the same hall spirit and mood (59–62) and no peril-0 deaths. One commit's samples spread as widely (`p0-5`: 78, 47 and 80 before).
- `p4-3` dies out in its year-2 siege in all three after samples and in no before sample. The trollkin break the south gate door ([probe](2026-11-06-t512-siege.probe.ts.txt); T-NEW: the three-year gatehouse is one broken door from the halls).
- `p4-6`, after shift 0: `caravan.present-over-20d`. An attacked Wildwood caravan stayed on the map 21 days ([work file](../../docs/work/T-517-attacked-caravan-never-leaves.md)).
- One-tick shifts do not always separate a seed's timelines: several seeds give the same figures at shifts 0 and 2 (before `p0-1`, `p0-6`; after `p4-3`).

## Frost on `three-years-p0-3` ([probe](2026-11-06-t512-frost.probe.ts.txt), unshifted, local)

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Surface crops killed by frost, before / after | 23 / 4 | 98 / 0 | 126 / 2 |
| Surface harvests, before / after | 44 / 42 | 97 / 142 | 185 / 539 |
| Cave harvests, before / after | 154 / 154 | 465 / 178 | 973 / 403 |

Living at the end: 78 before, 74 after, with no death in either. The cave harvests fall after because the Mountainhome caravan of day 124 sold no cave seed in that timeline (before, 130 dimcap and 20 pale bell seed were in stock on day 126), so the cave strips came a year later.

## `defence_year_seeds` (`measure.yml` suite `defence_seeds`)

| Sample | Run | Soldier kills by seed (d, d-2 … d-8) | Sum | Seeds with a kill | Raid turned back |
|---|---|---|---|---|---|
| before, shift 0 | 42338338128 | 1, 2, 1, 3, 3, 3, 2, 3 | 18 | 8 of 8 | 8 of 8 |
| before, shift 1 | 42339497804 | 2, 2, 3, —, 1, 2, 1, 2 | 13 | 7 of 7 | 4 of 7 |
| after, shift 0 | 42338339967 | 0, 1, 0, 2, 0, 2, 3, 1 | 9 | 5 of 8 | 6 of 8 |
| after, shift 1 | 42339502537 | 0, 4, 1, 1, 3, 2, 3, 3 | 17 | 7 of 8 | 7 of 8 |

- Before, shift 1: `defence-year-4` stopped on a refused command of the script ("PlaceBuilding rejected (footprint_blocked)", a chair, tick 205257), and the raid rule failed there (4 of 7).
- Earlier rows ([T-466](2026-11-05-t466-defence-seeds-after.jsonl), [T-486](2026-11-05-t486-defence-seeds.jsonl), [T-504](2026-11-05-t504-defence-seeds-after.jsonl)): soldier kills on 8, 7 and 8 of 8 seeds.
- `defence-year` alone has 1 or 2 kills before and 0 in both after samples, so a soldier's kill is now a rule over the eight seeds (at least 4).

## Other runs

- `three_years_main` (`measure.yml`): before 42326156318, after 42326158930. Both pass with no death; population 15 / 40 / 76 before and 15 / 34 / 58 after at years 1 / 2 / 3.
- The annual instrument, run 42326251265 (`d47e2be6`): passes, identical to the reference (pooled median 12.63, sum of the living 143, wildlife-free 6.63). It does not play the three-year script.
