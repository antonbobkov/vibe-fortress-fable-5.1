# T-817 — three_years_main makes no alloy steel

**Source:** T-810 (`three_years_main` runs 46099451914 on `master`, 46099449775 and 46072704388 on the T-810 branches) · **Size:** M · **Needs:** — · **Status:** open

## Why

`three_years_main` fails on `master` (at least since 4c8e61d7), in `test/scenarios/three_years.scenario.ts:286`. The assertion "alloy_steel completed through normal jobs: expected 0 to be greater than 0" fails because seed `three-years-p0-3` completes no `alloy_steel` job in three years. The T-810 runs fail in the same place, with and without the trader hold, so T-810 is not the cause.

## What to do

- Find when the main fortress stopped making steel: bisect over the recent merges, on GitHub with `gh workflow run measure.yml -f suite=three_years_main`.
- Then fix the cause, or, if a balance change made steel unreachable on this seed, record that and change the witness as the ambiguity protocol says.

## Done

- [ ] The cause found and fixed, or the witness changed with its reason.
- [ ] `three_years_main` green on GitHub.
