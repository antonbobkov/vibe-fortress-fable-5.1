# T-659 — The steel's two fuels come in two trips

**Source:** [T-655's measurement](../../reports/data/2026-11-20-t655-furnace-jobs-fetch.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

An `alloy_steel` job has four inputs, an iron bar, a flux stone, the fuel taken into the steel and the fuel the job burns, and its worker fetches each in a trip of its own (11 § Job steps): four trips for 200 ticks of work, more than any other furnace recipe. The two fuels are two inputs of one unit each, so the worker walks twice to the same bin of coal or charcoal for what one stack of two would bring in one trip. The flux stone came from 8 to 15 steps away, where the stone was mined or stockpiled, while the iron and the fuel lay by the smelter.

## What to do

Decide whether a recipe whose fuel input and burned fuel take the same item (12 § Fuel; a half fuel is never steel's carbon) fetches them as one input of two units, one stack in one trip, and if so write it into 12 and 11. Measure the alloy job's trips and the smelter's hours before and after on the three-year seeds T-655 probed (`test/perf/t655_furnace_fetch_probe.test.ts`). Look too at whether the three-year script, as a player, keeps flux stone by the smelter (the ore store takes ore only).

Spec: 12 § Fuel and § Operation, 11 § Assignment step 4.

## Done

The alloy job's trips and the smelter's hours before and after, and the sweep's steel ledger and verdict if the rule changes.
