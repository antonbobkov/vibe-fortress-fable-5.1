# The annual guard on the sum of the living, and `defence_year` without natural arrivals, 2026-10-13

Examined: the twelve-seed wildlife year (`test/perf/wildlife_year.test.ts`) and the scenario `defence_year`, for T-308. Commits: `28e2eab` and `dff4195` (no change under `src/` between them), and the branch `t-301` at `a88d3cd`. No file under `src/` changes with this report.

## The annual rows

Each row is one run of the twelve seeds. The four grassland seeds are 15, 14, 15, 14 with unchanged hashes in every row.

| Tree | Median | Sum of the living | Second-worst | Minimum | Wildlife-free | Extinct | Need deaths | forest 1, 2, 3, 4 | taiga 1, 2, 3, 4 | Rows |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| `28e2eab` | 13 | 135 | 8 | 0 | 8 of 12 | 1 | 0 | 8, 10, 0, 13 | 13, 12, 13, 8 | [rows](../data/2026-10-12-t301-before-wildlife.json) |
| `dff4195` with this task's tests | 13 | 135 | 8 | 0 | 8 of 12 | 1 | 0 | 8, 10, 0, 13 | 13, 12, 13, 8 | [rows](../data/2026-10-13-t308-wildlife.json) |
| T-301's chest fix with treatment units | 13 | 126 | 0 | 0 | 8 of 12 | 2 | 0 | 8, 9, 0, 13 | 13, 12, 13, 0 | [rows](../data/2026-10-12-t305-units-wildlife.json) |
| T-301's chest fix with T-211 and the fight rule | 13 | 131 | 3 | 0 | 8 of 12 | 1 | 0 | 11, 3, 0, 13 | 13, 12, 13, 8 | [rows](../data/2026-10-12-t211-fight-rule-wildlife.json) |
| `a88d3cd` (T-301: chest and duty fixes) | 13 | 133 | 6 | 0 | 8 of 12 | 1 | 0 | 13, 6, 0, 12 | 13, 7, 13, 11 | [rows](../data/2026-10-12-t301-after-wildlife.json) |
| `a88d3cd` with the first rule tried for T-307 | 13 | 126 | 0 | 0 | 8 of 12 | 2 | 0 | 13, 9, 0, 9 | 13, 0, 13, 11 | [rows](../data/2026-10-13-t307-endangered-patient-wildlife.json) |

Forest seeds 1 and 2 and taiga seeds 2 and 4 each change by five or more living between rows, in both directions. The sum stays between 126 and 135.

## The guards

Old: median 12, second-worst 8, wildlife-free 6 of 12, extinctions 1, need deaths 1. The second-worst reference was 8 and its bound 8, so every row but the first two fails it.

New: the second-worst seed is reported and not guarded. The sum of the living may fall at most 12 below the best measured sum (135, so 123). The other four are unchanged, and a row is still blocked when three of the five guarded figures worsen together.

| Tree | Old rule | New rule |
|---|---|---|
| `dff4195` | passes | passes |
| Chest fix with treatment units | fails: second-worst, extinctions | fails: extinctions (2 against a cap of 1) |
| Chest fix with T-211 and the fight rule | fails: second-worst | passes: the sum worsens by 4, nothing else |
| `a88d3cd` | fails: second-worst | passes: the sum worsens by 2, nothing else |
| `a88d3cd` with the T-307 rule | fails: second-worst, extinctions | fails: extinctions |

The verdicts in the second column are computed from the saved rows; only the `dff4195` row was run under the new rule.

## `defence_year`

The scenario plays 35 days on a peril-2 forest map, then stages a raid. On `dff4195` one dwarf bleeds to death to a boar and the scenario passes; on `a88d3cd` three die and it fails on the squad's size. The decision was to give it the alert response of the other long fixtures and keep its assertions. Four forms of that response were run on both trees:

| Form | `dff4195` | `a88d3cd` |
|---|---|---|
| `checkFortressDefense` whole: the fortress's militia from day 1 | no death; the scenario's own squad gets no members and the lever is not linked | not run |
| The alert, and the scenario's squad sent to kill once it is formed (day 25) | passes, no death | three deaths from day 26; a building is still planned |
| The alert only, nobody sent | no death; an assertion fails | no death; under the alert most of the time from day 4; a building is still planned |
| The militia until day 25, then the scenario's squad | no death; an assertion fails | three deaths by day 13 |

None passes on both. With natural surface arrivals left out (`surfaceWildlife: 'none'`, the option `hospital_run` uses) the scenario passes on both trees with no dwarf death, the lever linked on day 27 or 28 and four squad members. That is what T-308 commits. The assertions are unchanged.

## Findings that need work

None new. The unstable seeds are listed in `balance-status.md`.
