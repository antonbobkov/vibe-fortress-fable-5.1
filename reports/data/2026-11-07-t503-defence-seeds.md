# T-503: `defence_year_seeds` at both cadences

`measure.yml` suite `defence_seeds` on branch `t510-t503-cats-range` at master `6f5763ad` (T-518 merged), before T-503's guard: run 42370466878 at `watch=25`, run 42370483511 at `watch=20` (the script's own). Every job passes; eight rows at each cadence. The guard added in T-503 acts only where the script would have thrown, so these rows stand for it unchanged.

On today's master the archery target of `defence-year-6` stands on tile 60167 (x 23, y 5, two tiles west and one south of the fortress centre, outside the planned dining hall, pantry and hearth hall), the same tile as in T-466's fault, and at cadence 25 the range is zoned there by tick 80,076. So T-518's change moved the timeline past the fault rather than closing it: the script still zoned the range over the target's origin without checking it. T-503 adds the check (`test/unit/t503-archery-range-site.test.ts`, which throws `CreateZone rejected (overlap)` without it).

Columns: the raid's size, its ending, its captain's fate, soldier kills, trap triggers, creatures caged, the bridge trial.

## Cadence 25 (run 42370466878)

| Seed | Size | Raid | Captain | Kills | Traps | Caged | Trial |
|---|---|---|---|---|---|---|---|
| defence-year | 10 | repelled | caged | 2 | 6 | 3 | done |
| defence-year-2 | 10 | repelled | caged | 2 | 5 | 1 | done |
| defence-year-3 | 11 | looted | left | 2 | 1 | 1 | done |
| defence-year-4 | 10 | looted | left | 2 | 0 | 0 | none |
| defence-year-5 | 9 | looted | left | 0 | 2 | 1 | done |
| defence-year-6 | 8 | repelled | caged | 3 | 4 | 1 | done |
| defence-year-7 | 10 | repelled | caged | 5 | 3 | 2 | done |
| defence-year-8 | 9 | looted | left | 1 | 0 | 0 | none |

## Cadence 20 (run 42370483511)

| Seed | Size | Raid | Captain | Kills | Traps | Caged | Trial |
|---|---|---|---|---|---|---|---|
| defence-year | 9 | repelled | caged | 1 | 2 | 1 | done |
| defence-year-2 | 9 | looted | caged | 0 | 9 | 3 | done |
| defence-year-3 | 11 | looted | left | 0 | 0 | 0 | done |
| defence-year-4 | 11 | looted | left | 1 | 0 | 0 | none |
| defence-year-5 | 9 | looted | left | 1 | 1 | 1 | done |
| defence-year-6 | 10 | looted | left | 2 | 3 | 1 | done |
| defence-year-7 | 10 | repelled | caged | 4 | 3 | 2 | done |
| defence-year-8 | 9 | looted | left | 0 | 0 | 0 | none |

Raids turned back: 4 of 8 at cadence 25, 2 of 8 at cadence 20, below the set rule's 5 (`DEFENCE_SET_RULE`); a soldier kills on 7 and 5 seeds (rule 4). Each job plays one seed, so the set rule is not asserted in these runs.
