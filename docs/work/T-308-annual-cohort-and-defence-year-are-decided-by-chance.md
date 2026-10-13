# T-308 — The annual cohort and `defence_year` are decided by which dwarf an animal kills

**Source:** T-301 and [`../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md`](../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md) (§ The guards) · **Size:** M · **Needs:** — · **Status:** open

## Why

`testing-strategy.md` § Annual wildlife survival says: at three distinct unstable seeds, file a task to enlarge the cohort. There are now four. Under three changes that move the job timeline (T-301's chest fix with units, with T-211, and with the duty fix), these seeds change by five or more living, in both directions:

| Seed | Before | With units | With T-211 and the fight rule | With the duty fix |
|---|---:|---:|---:|---:|
| `wildlife-temperate_forest-1` | 8 | 8 | 11 | 13 |
| `wildlife-temperate_forest-2` | 10 | 9 | 3 | 6 |
| `wildlife-taiga-2` | 12 | 12 | 12 | 7 |
| `wildlife-taiga-4` | 8 | 0 | 8 | 11 |

The sum of the living over the twelve seeds is 135, 126, 131 and 133. The median, the wildlife-free count and the need deaths do not move. The second-worst figure does: its reference is 8 and its bound is 8, so the guard passes only while at most one seed is under 8. It rejected all three rows. `wildlife-taiga-4` and `wildlife-temperate_forest-3` are already recorded as unstable in `balance-status.md`.

`defence_year` (in `npm test`) has the same weakness in one sample. It plays 35 days among boars with no alert response, one dwarf bleeds to death in the accepted run, and its assertions (the lever linked by day 35, four squad members, every building built) hold only if that dwarf is not the mechanic or a soldier. It failed under every variant measured for T-301.

## What to do

1. Enlarge the annual cohort, as the testing strategy asks. State the second-worst guard on a figure that one seed cannot move by itself (a lower quartile over more seeds, or the sum of the living). Keep the extinction, median and need-death guards. Record the new reference at the commit that makes the change.
2. `defence_year`: give the scenario the alert response the other long fixtures have (`checkFortressDefense`), or stage its defence assertions so that they do not depend on a wild animal's choice of victim. This is a fixture change with its own review. It is not done inside a behaviour change to make that change green.

## Done

- The annual instrument's verdict does not flip on a change that leaves the sum of the living within a few dwarves.
- `defence_year` passes on `master` and on T-301's commit.
