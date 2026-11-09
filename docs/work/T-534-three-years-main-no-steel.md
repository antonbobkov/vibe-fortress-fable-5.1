# T-534 — `three_years_main` makes no steel on master

**Source:** [T-529](../archive/tasks/T-529-squad-lost-to-boars.md) ([the audit](../../reports/audits/2026-11-09-t529-squad-and-boars.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

The main three-year scenario (`test/perf/three_years_main.test.ts`, seed `three-years-p0-3`, relief 1) fails on master `a9a24607`: `alloy_steel completed through normal jobs: expected 0 to be greater than 0`. Run locally on 2026-11-09, it ends year 3 with 75 dwarves, no death and 54,631 marks, and its `[three_years_steel]` lines show the steel order standing from day 224 with charcoal and flux in stock and never more than 6 iron bars at a time, while the forge makes picks 6, mail shirts 6, shields 8, short swords 5, battle axes 3 and helms 4 from 34 smelts of hematite, and no `alloy_steel`. T-529's change gives the identical run (the same summary to the meal), since this seed's map has no boar or badger near the gate. T-456 chose the seed on 2026-11-08 with `alloy_steel` 3 (Measure run 42430714755), so a change merged since then moved the iron.

## What to do

Find the commit since T-456 after which `three-years-p0-3` stops making steel, and why: the iron bars the steel order waits for, and the orders that take them first. Fix the script's order of the metal chain if a player would order it otherwise, or choose another representative seed by T-456's method, keeping every assertion.

## Done

- `three_years_main` passes on master with its assertions unchanged, or a dated report says why it should not.

## Outcome (2026-11-09)

**When:** T-456 chose the seed on its branch at `3cfb9f0e`, before T-527 (run 42438978685 passes there, `alloy_steel` 3). The merge `ead1656d` brought T-456 together with T-527 and already fails (run 42622261911); nothing after it touches the cause. T-527 changes no rule the metal chain uses: it moves the timeline, and on the new one the smelter's build job loses out.

**Why no steel:** not ore, flux, fuel or the worker. The smelter is placed at the routine build priority (5) on day 35 and stands `constructing`, one of its three stones delivered, its build job `open` and untaken from day 63 to about day 150: the builder takes the nearer smoothing and hauling of the same priority first (11 § Assignment: priority is strict and a job does not age). Smelting begins about 80 days late (hematite 14 smelts by day 224, against 38), the forge's standing iron orders take every bar, and the steel order of day 224 never finds one.

**Fix:** the three-year script builds the wood furnace and the smelter at `METAL_BUILD` = 4, one step ahead of the routine backlog, as a player raises a build left waiting (`test/scenarios/three_years_economy.ts`). On p0-3 smelting now starts by day 56. Test: `test/unit/t534-smelter-build-first.test.ts` (at priority 5 a builder smooths 42 nearer tiles before the smelter; at 4 it builds the smelter first). Every assertion of the scenario is unchanged.

**Verified:** `three_years_main` passes on branch `t-534` (run 42624915804): year 3 ends with 63 dwarves, no death, 81,401 marks, 53 hematite smelts and `alloy_steel` 4. `ci.yml` passes (run 42624920101, e2e 42 passed). The pooled sweep was not run: no game rule changed, only the script's build priority, which moves the twenty-seed timelines as any script change does.
