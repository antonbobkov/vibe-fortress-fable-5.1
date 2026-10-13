# T-308 — The annual cohort and `defence_year` are decided by which dwarf an animal kills

> **Closed 2026-10-13** on the branch `t-308`, in the commit "T-308: the annual guard is the sum of the living; defence_year stages its own casualties".

**Source:** T-301 and [`../../../reports/audits/2026-10-13-annual-guard-on-the-sum-of-the-living.md`](../../../reports/audits/2026-10-13-annual-guard-on-the-sum-of-the-living.md) · **Size:** M · **Needs:** — · **Status:** closed

## Why

`testing-strategy.md` § Annual wildlife survival said: at three distinct unstable seeds, file a task to enlarge the cohort. There are four new ones. Under three changes that move the job timeline (T-301's chest fix with treatment units, with T-211, and with the duty fix), these seeds change by five or more living, in both directions:

| Seed | Before | With units | With T-211 and the fight rule | With the duty fix |
|---|---:|---:|---:|---:|
| `wildlife-temperate_forest-1` | 8 | 8 | 11 | 13 |
| `wildlife-temperate_forest-2` | 10 | 9 | 3 | 6 |
| `wildlife-taiga-2` | 12 | 12 | 12 | 7 |
| `wildlife-taiga-4` | 8 | 0 | 8 | 11 |

The sum of the living over the twelve seeds is 135, 126, 131 and 133. The median, the wildlife-free count and the need deaths do not move. The second-worst figure does: its reference was 8 and its bound was 8, so the guard passed only while at most one seed was under 8. It rejected all three rows.

`defence_year` (in `npm test`) had the same weakness in one sample. It plays 35 days among boars, one dwarf bleeds to death in the accepted run, and its assertions (the lever linked by day 35, four squad members, every building built) held only if that dwarf was not the mechanic or a soldier. It failed under every variant measured for T-301.

## Decisions (the orchestrator's, 2026-10-13)

A. The annual instrument keeps twelve seeds: a larger cohort doubles the cost of every behaviour gate. The second-worst seed stops being a guard and is reported, like the worst seed. In its place the guard is the sum of the living over the twelve seeds, which may fall at most 12 below the best measured sum. Median (−1), wildlife-free (−2), extinctions (best + 1) and hunger/thirst deaths (+1) stay, and so does "blocked if three of the five guarded figures worsen together", with the sum as the fifth figure. The reference sum is 135, measured on `28e2eab` and again on `dff4195`. The list of unstable seeds stays in `balance-status.md`.

B. `defence_year` was to get the alert response of the other long fixtures, with its assertions unchanged, and to pass on `master`'s `src` and on T-301's.

## What was done

A as decided: `test/perf/wildlife_year_measurements.ts`, `wildlife_year_constants.ts` (`LIVING_SUM_REGRESSION_TOLERANCE` = 12 in place of `SECOND_WORST_REGRESSION_TOLERANCE`), `wildlife_year.test.ts`, the two policy tests, `testing-strategy.md` § Annual wildlife survival, `balance.md` § Many-seed annual survival and the row of `balance-status.md`.

B differs from the decision, because the alert response does not meet the decision's own condition. Four forms of it were run, with the assertions untouched:

| Form | `master`'s `src` | T-301's `src` |
|---|---|---|
| `checkFortressDefense` whole (the militia from day 1) | no death; the scenario's own squad gets no members, the lever is not linked | not run |
| The alert, and the scenario's squad sent out once it is formed | passes, no death | three deaths from day 26, a building still planned |
| The alert only | no death; an assertion fails | no death; the fortress is under the alert most of the time, a building still planned |
| The militia until the scenario's squad is formed, then that squad | no death; an assertion fails | three deaths by day 13 |

What passes on both is to leave natural surface arrivals out of the scenario, as `hospital_run` does (`surfaceWildlife: 'none'`): the scenario stages its own casualties with its raid, and its assertions are about the traps, the gate, the trained squad and that raid. `threeYearsWorld` takes the option; the three-year fixtures do not use it.

## Done

- The annual instrument's verdict does not flip on a change that leaves the sum of the living within twelve dwarves: `master` passes with 13 / 135 / 8 of 12 / 1 / 0 and unchanged hashes.
- `defence_year` passes on `master`'s `src` and on T-301's, with no dwarf death in either.
