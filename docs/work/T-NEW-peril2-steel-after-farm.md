# T-NEW — Peril-2 steel fell a seventh with T-664

**Source:** [T-664's report](../../reports/data/2026-11-20-t664-small-fortress-starves.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-664's final sweep (`44851035279`) ended starvation in the sweep and kept the drink, but the steel smelted at peril 2 fell from 35.8 alloy jobs a timeline (T-661's master, `44830514124`) to 30.7, with peril 4 up from 17.8 to 18.8. The famine rule is rare at the final threshold (2.6 famine days a peril-2 timeline) and leaves the smith and the furnace workers at the steel, so it is not obviously the famine's hands. T-664 also let the farm grow where no ground by the gate was left (strips west of the first field), kept a woodcutter in remnants, raised a trap's rearming in `defence_year` and fed patients raw food; at peril 2 the farm change is the likeliest to move the hours of the dwarves the steel chain shares (the haulers, the builder, the miners who dig the flux and coal).

## What to do

Trace two peril-2 timelines whose steel fell most between the two sweeps (`[three_years_steel]` weekly lines, `test/perf/t660_smith_steel_probe.test.ts`): what the smelters waited on (iron bars, coal, flux, fuel) and what the dwarves who used to bring it did instead. Fix what the script plays badly without giving back the farm.

## Done

The cause on the traced timelines and the sweep's steel ledger back near master's, with no rise in starvation.
