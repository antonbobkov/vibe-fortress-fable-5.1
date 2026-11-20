# T-655 — The furnace jobs walk six ticks for each tick of work

**Source:** [T-649's measurement](../../reports/data/2026-11-20-t649-furnace-workers-needs.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-649's probe found the furnace workers' needs ordinary (61 to 65% of the day, every other dwarf 58 to 64%), but at their own workshop's job they spend 20 to 29% of the day fetching and walking and 3.4 to 4.6% working: the smelter, the forge and the wood furnace alike, in `three-years-p2-1` at shift 0 and `three-years-p4-6` at shift 50. At `p4-6` the smelter's worker walked empty-handed to inputs 10 to 19 steps away for 5% of the day and carried ore, flux and fuel for 5% more; the wood furnace's burner walked 20 steps and more for its logs for 12% of the day although the fuel store stands by the furnace. A job's inputs come one item per trip (11 § Job steps).

## What to do

Measure, per furnace recipe, the trips a job makes and how far each goes: whether an input of several units (two bars, logs for charcoal) is fetched as one stack or one unit per trip, whether the input chosen is the nearest to the workshop or to the worker, and why the burner's logs come from 20 steps when the fuel store is beside it (the store full of ore and bars, the logs on the surface stockpile). Fix what is wrong in 11 or 13, or in the three-year script what a player would place otherwise. Do what raises the furnace hours without costing the sweep.

Spec: 11 § Job steps, 13 § Searching; testing-strategy.md § The long scenarios (the workshop hall).

## Done

The furnace jobs' trips and work share before and after, the sweep's steel ledger and verdict.
