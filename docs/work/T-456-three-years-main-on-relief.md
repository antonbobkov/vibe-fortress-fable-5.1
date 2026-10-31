# T-456 — The `three_years` scenario does not yet play on relief

**Source:** T-451 · **Size:** M · **Needs:** the row on perils 2 and 4 on relief · **Status:** open

## Why

`THREE_YEARS_RELIEF` went to 1 for the twenty-seed file. The single-seed scenario `three_years` (`test/perf/three_years_main.test.ts`, seed `three-years`, peril 0) shares that fixture and fails on it: `cut_gem completed through normal jobs: expected 0 to be greater than 0`.

On relief 1 that fortress has 11 dwarf deaths and never grows, ending year 3 with 6 dwarves and 5,936 marks of wealth. Five die by day 84 and six by day 112. The scenario's chain assertions were measured on fed fortresses that grow, so its failure follows from the small population, whose cause has not been traced. The twenty-seed file keeps its own peril-0 seeds growing, 26 to 71 dwarves on this script.

So that the performance tier keeps guarding what it did, the scenario is pinned to relief 0: `threeYearsWorld('three-years', 0, undefined, 0)`. Every assertion stands, and only its map is level.

## What to do

Journal `three-years` at relief 1 to find who kills the first six dwarves by day 112, and why this seed stays small when the seven peril-0 seeds grow. Fix what is at fault. Then remove the pin, or choose a representative seed with reasons, keeping every assertion.

## Done

- The scenario plays on relief 1 with its assertions unchanged, or a dated report says why it should not.
