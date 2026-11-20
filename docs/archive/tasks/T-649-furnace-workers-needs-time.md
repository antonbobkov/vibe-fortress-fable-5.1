# T-649 — The furnace workers spend two thirds of the day at their needs

**Closed:** 2026-11-19, in b6e946c0.

**Source:** [T-642's measurement](../../../reports/data/2026-11-19-t642-iron-for-steel.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-642's iron probe sampled the smelter's worker every 20 ticks in the workshop hall below the halls (`three-years-p2-1` at shift 0, `three-years-p4-6` at shift 50, days 70 to 336): at its job 25 to 35% of the time, asleep 25 to 28%, and at hunger, thirst and comfort 7 to 19% each, with the smelter's job standing open meanwhile. Its meals, drinks and seats are likely a level up and across the halls, a long walk for each; that is not measured yet. The second smelter T-642 added doubles the hours at the furnaces, but each worker still loses most of its day to the walk.

## What to do

Measure, for the furnace workers and the forge's smith in the workshop hall, how far each meal, drink and rest ended from the workshop and how long the walk took (as T-619's pace probe did for the soldiers), and what a player does about it: a drink and food store by the workshop hall, chairs and a table there, or the hall's own dining room. Do what raises the smelter's hours without costing the sweep.

Spec: testing-strategy.md § The long scenarios (the workshop hall).

## Done

The furnace workers' shares of the day before and after, the sweep's steel ledger and verdict.

- [x] **The shares of the day**, `test/perf/t649_furnace_needs_probe.test.ts` on `three-years-p2-1` at shift 0 and `three-years-p4-6` at shift 50, days 70 to 336: the smelter's workers spend 61 to 65% of the day at their needs, every other dwarf 58 to 64%, the forge's and the wood furnace's 55 to 69%; sleep is 26 to 29% for all (the long walk to bed is rest), the longer walk to meals, drinks and the hall 3 to 6% of the smelter's day, and its own job 3.5% working against 20 to 22% fetching. Nothing in the needs is wrong, so no rule changed and no sweep ran: [report](../../../reports/data/2026-11-20-t649-furnace-workers-needs.md); the fetch is a follow-up, [T-655-furnace-jobs-fetch](../../work/T-655-furnace-jobs-fetch.md).
