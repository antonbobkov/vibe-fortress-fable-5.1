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

## Outcome (2026-11-07)

On master `303a109a` the scenario still fails on relief 1, now only on `cut_gem completed through normal jobs` (run 42427934351): 11 dwarf deaths, all `bled_out`, population 9, 8 and 23 at years 1 to 3. On relief 0 the same code has no deaths and 58 dwarves (run 42428712635). Journalled with [the probe](../../reports/data/2026-11-07-t456-relief.probe.ts.txt):

- **Who kills them:** boars. Every death follows a boar's hit on the surface (days 70 to 334), mostly of a dwarf on `duty`: the script sends an armed squad after a dangerous wild animal, and on this map it meets the boars again and again. Founders 0 and 1, the two miners, are the first two (days 70 and 71).
- **Why no gem:** on this relief-1 map the gem walls lie only at z 20 and below, under the upper mine (z 23 to 26), where relief 0 has them at z 26 and 27. The deep shaft's head is 29 tiles of drift away at z 23; with both miners dead its first tile stays open, untaken, from day 120 to about day 340, and no rough gem is mined in three years.

The seven peril-0 seeds of the pooled master sweep (run 42420388361) lose 0 to 4 dwarves at relief 1; this seed's map is the outlier, and the deaths are the wildlife the scenario already accepts as timeline-dependent at peril 0. Chosen: the scenario plays on relief 1 on a representative seed, `three-years-p0-3`, every assertion unchanged. In the pooled sweep it ends at 80, 78, 60 and 75 dwarves with 0, 0, 1 and 0 deaths. Three candidates on relief 1, each passing: p0-3 (80 dwarves, cut_gem 25, forge_pick 17, alloy_steel 3, run 42430714755), p0-6 (51, cut_gem 12, run 42430719867), p0-7 (76, cut_gem 1, run 42430709340); p0-3 has the widest margins. The squad's losses to boars are filed as a new row.
