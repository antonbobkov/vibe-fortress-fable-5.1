# The browser year with T-212: one run is not a measurement

**Date:** 2026-10-11 · **Task:** T-212 · **Follows:** [`2026-10-11-hungry-predators.md`](2026-10-11-hungry-predators.md) · **Code measured:** `cloud/main` at `61c95c1` (no T-212) and `cloud/T-212` at `caf4a6a` (`cloud/main` merged into T-212), each with T-150's `test/e2e/full-year.spec.ts` · **By:** Claude (Opus)

## The answer

The orchestrator saw the browser playthrough end with **11** living dwarves on `cloud/main` and **1** on `cloud/T-212`, one run each. That difference does not come from T-212. **The playthrough gives a different year on every run of the same code**, because it issues its UI commands while the game runs at 4× in real time, so the outcome depends on wall-clock timing. Repeated runs, same spec, same machine:

| Code | Runs | `livingCount` at day 112, each run | Runs at 7 or fewer | Median | Dwarves dead (all runs) |
|---|---|---|---|---|---|
| `cloud/main` (no T-212) | 10 | 7, 2, 3, 10, 0, 0, 7, 11, 10, 12 | **6 of 10** | 8.5 | 55 |
| `cloud/T-212` | 12 | 12, 11, 11, 12, 8, 1, 11, 12, 12, 12, 11, 10 | **1 of 12** | 11 | 21 |

With the orchestrator's two runs added, `cloud/main` is at 7 or below in 6 of 11 runs and `cloud/T-212` in 2 of 13. The single run that ended with 1 living dwarf on `cloud/T-212` falls inside a range that `cloud/main` reaches as well (0 living in two of its runs).

No fault in T-212's code was found, and no code was changed. One cost of the rule as decided does show in the T-212 deaths. A civilian caught fleeing an animal that only defends its ground, and would have let it go, now stays and fights. That accounts for 14 of the 21 deaths: 7 to boars, 5 to wolves defending, 2 to badgers. Before, this was T-219, with figures from the chain probe; these are the browser-year figures for it.

## How it was measured

- The spec was copied to an untracked file ([source](../data/2026-10-11-full-year-trace.spec.ts.txt)) that is identical except for one addition to its event listener. For every `AttackResolved` involving a fortress creature, the copy logs the tick, the outcome, both creatures' faction, species, brain state or wild state (`def` = a defending attack, `hungry`), held tool and position, and whether system 10 has marked the defender caught. It only reads. Its end state is printed by the spec's own code.
- It was run `CI=1 npx playwright test <copy>` repeatedly, one run at a time on ports 5174/5175, in a clean export of each commit sharing the same `node_modules` ([loop](../data/2026-10-11-full-year-repeat.sh.txt)). Per-run data, including each dwarf death with its day, its killer (species and the killer's state at its last logged attack) and whether the dwarf had been caught: [`2026-10-11-full-year-repeat-runs.json`](../data/2026-10-11-full-year-repeat-runs.json).
- The first T-212 run's attack lines were lost, because the spec's console relay only forwards lines that begin with `[full-year]`. That run had no dwarf death, so no death is unattributed.

## Why the runs differ

- The spec sets the speed to 4× through the UI (`test/e2e/full-year.spec.ts:154-158`) and lets the frame loop run the first day while it places workshops and work orders with keyboard and mouse (`:160-411`). Those commands land on whatever tick the clock has reached when Playwright delivers them. Only after that does it step the rest in fixed `h.step` chunks (`:413-420` and later).
- Seen in the data: the same code on the same world seed produced different wild arrivals in every run. On `cloud/T-212`, boars arrived between 1 and 10 times in the twelve runs; on `cloud/main`, between 0 and 11 times. The first dwarf death fell anywhere from day 17 to day 98 on `cloud/main`.

## What kills, with and without T-212

| Killer (state at its last logged attack) | `cloud/main`, 10 runs | `cloud/T-212`, 12 runs |
|---|---|---|
| wolf, hunting | 28 | 5 |
| wolf, defending | 4 | 5 |
| boar, defending | 18 | 7 |
| badger, defending | 3 | 4 |
| bear, defending | 2 | 0 |
| **Dwarves dead** | **55** | **21** |
| of them caught (10 § Behavior selection) | — | 19 |

- On `cloud/main` the worst runs are a hungry wolf pack: 10 dead on days 91–107 in one run, 9 on days 17–39 in another. The rest are boars: 12 dead on days 43–63 in the run that ended with 0 living.
- On `cloud/T-212` the run that ended with 1 living lost 11 dwarves on days 73–104: 10 of them had been caught by wolves and boars, 6 by wolves (5 of those wolves defending) and 4 by boars. The orchestrator's run (its log, not repeated here) lost 7 of its 10 dead to two boars on days 46–64.

## Effect on the decision and the rows

- Nothing in this run is a fault against the spec T-212 wrote. The defending-animal cost is the rule as decided ("an attacker at least as fast as itself"). T-219 already asks the owner whether a defending animal's bite should catch a civilian; its work file now cites these figures.
- The spec's own pass condition (`livingCount > 7`) fails on `cloud/main` in 6 of 10 runs. Its `test.fixme` (`test/e2e/full-year.spec.ts:635-637`) turns those runs into skips, so in this sample the spec "passes" on `cloud/main` 4 times in 10 and on `cloud/T-212` 11 times in 12. A single run of it cannot compare two versions of the game. Filed as T-221. The spec belongs to the local side (T-150) and was not edited.

## Not established

- Which UI commands land on different ticks from run to run, and how early the runs diverge.
- Whether the defending-animal deaths would be fewer under the alternative readings that T-219 lists.
