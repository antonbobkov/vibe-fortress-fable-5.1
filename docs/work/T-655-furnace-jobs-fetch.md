# T-655 — The furnace jobs walk six ticks for each tick of work

**Source:** [T-649's measurement](../../reports/data/2026-11-20-t649-furnace-workers-needs.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-649's probe found the furnace workers' needs ordinary (61 to 65% of the day, every other dwarf 58 to 64%), but at their own workshop's job they spend 20 to 29% of the day fetching and walking and 3.4 to 4.6% working: the smelter, the forge and the wood furnace alike, in `three-years-p2-1` at shift 0 and `three-years-p4-6` at shift 50. At `p4-6` the smelter's worker walked empty-handed to inputs 10 to 19 steps away for 5% of the day and carried ore, flux and fuel for 5% more; the wood furnace's burner walked 20 steps and more for its logs for 12% of the day although the fuel store stands by the furnace. A job's inputs come one item per trip (11 § Job steps).

## What to do

Measure, per furnace recipe, the trips a job makes and how far each goes: whether an input of several units (two bars, logs for charcoal) is fetched as one stack or one unit per trip, whether the input chosen is the nearest to the workshop or to the worker, and why the burner's logs come from 20 steps when the fuel store is beside it (the store full of ore and bars, the logs on the surface stockpile). Fix what is wrong in 11 or 13, or in the three-year script what a player would place otherwise. Do what raises the furnace hours without costing the sweep.

Spec: 11 § Job steps, 13 § Searching; testing-strategy.md § The long scenarios (the workshop hall).

## Done

The furnace jobs' trips and work share before and after, the sweep's steel ledger and verdict.

- [x] **The trips and why** ([report](../../reports/data/2026-11-20-t655-furnace-jobs-fetch.md), `test/perf/t655_furnace_fetch_probe.test.ts`, `three-years-p4-6` at shift 50 and `p2-1` at shift 0, days 126–336): every furnace input but the forge's bars is one unit, one trip each (charcoal 1, a smelt 2, steel 4); the forge's bars come as one stack when one lies to hand. Two rules sent the workers past nearer inputs: the claim searched from the worker's tile (back from a meal, 13 to 20 steps off) and not the workshop's, and a unit input took the largest stacks of the fortress whatever their distance. 85 of the burner's 146 log trips at `p4-6` had a nearer log free. The burner's logs lay loose on the surface: the fuel store held 21 to 27 ore and no log.
- [x] **The rules** (11 § Assignment step 4, algorithms/jobs-and-hauling.md): a claim searches for inputs from the job's delivery or stand tile the worker reaches (a sheltering civilian from its own tile); a unit input takes the fewest stacks and of those the nearest. `test/unit/workshops/t655-nearest-stack.test.ts`. **The script:** the fuel store takes no ore once the ore store stands; a tree grown on a watch post is felled and the look counts that post unheld (the sweep's `p2-7` and `p4-4` at shift 50 threw on it, as master's `p4-4` at shift 150 did).
- [x] **Before and after** (charcoal at `p4-6`): logs 17.5 → 3.6 steps from the furnace, 85 → 0 trips with a nearer one free, fetch : work 498 : 86 → 165 : 95 ticks; the furnace now keeps its 40 charcoal and stands stocked 86% of the time. Smelter at work 2.5 → 5.2% of its worker's day at `p2-1`, 5.8 → 6.3% at `p4-6`.
- [x] **Sweep** (measure.yml run 44730019657 on `a4a9ecaa`): Pooled 19.75 | 7 | 0 | 1069.75 | 117.5 | 1 | 4.75; **Verdict: pass**; all 80 seed jobs green (master 44715696949: 1018.75 / 116.5, not judged). Steel ledger, master → T-655: steel smelted 22.7 → 25.3 a timeline, five kits 9 → 10, under five charcoal 10 → 7, under fifteen logs 20 → 13, under five iron bars 24 → 31.
- [x] **Follow-ups**: [the steel's two fuels in two trips](T-NEW-steel-fuel-in-one-trip.md), [the smith's steel jobs refetched](T-NEW-smith-steel-refetched.md).
