# T-NEW — A stockpile that takes flux stone

**Source:** [T-659's measurement](../../reports/data/2026-11-20-t659-t660-steel-trips.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

A steel job fetches a flux stone (limestone, marble, dolomite, chalk) beside its iron bar and fuel, and the three-year probes found it 6 to 18 steps from the smelter (10 to 13 on most timelines), lying where it was mined, while the bar and the fuel lay by the smelter. A player would keep a few flux stones beside the smelter, but a stockpile filters by category and material class (13 § Stockpiles), and flux stone is of the class `stone` with every other rock: a stone stockpile by the smelter draws the whole mine's stone into the workshop hall.

## What to do

Decide whether a stockpile's filter may name a material tag (`flux`) or single materials beside its classes, as the stockpile editor would show it, and if so write it into 13 and 24 and let the three-year script keep a small flux store by the smelter. Measure the steel job's flux trip and the smelter worker's hours before and after with `test/perf/t660_smith_steel_probe.test.ts`.

Spec: 13 § Stockpiles; 24 (the stockpile editor); 12 § Recipes (the flux).

## Done

The flux trip's steps and the smelter's hours before and after, and the sweep's steel ledger and verdict if the script changes.
