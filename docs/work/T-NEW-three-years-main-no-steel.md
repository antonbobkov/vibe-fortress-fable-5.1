# T-NEW — `three_years_main` makes no steel on master

**Source:** [T-529](T-529-squad-lost-to-boars.md) ([the audit](../../reports/audits/2026-11-09-t529-squad-and-boars.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

The main three-year scenario (`test/perf/three_years_main.test.ts`, seed `three-years-p0-3`, relief 1) fails on master `a9a24607`: `alloy_steel completed through normal jobs: expected 0 to be greater than 0`. Run locally on 2026-11-09, it ends year 3 with 75 dwarves, no death and 54,631 marks, and its `[three_years_steel]` lines show the steel order standing from day 224 with charcoal and flux in stock and never more than 6 iron bars at a time, while the forge makes picks 6, mail shirts 6, shields 8, short swords 5, battle axes 3 and helms 4 from 34 smelts of hematite, and no `alloy_steel`. T-529's change gives the identical run (the same summary to the meal), since this seed's map has no boar or badger near the gate. T-456 chose the seed on 2026-11-08 with `alloy_steel` 3 (Measure run 42430714755), so a change merged since then moved the iron.

## What to do

Find the commit since T-456 after which `three-years-p0-3` stops making steel, and why: the iron bars the steel order waits for, and the orders that take them first. Fix the script's order of the metal chain if a player would order it otherwise, or choose another representative seed by T-456's method, keeping every assertion.

## Done

- `three_years_main` passes on master with its assertions unchanged, or a dated report says why it should not.
