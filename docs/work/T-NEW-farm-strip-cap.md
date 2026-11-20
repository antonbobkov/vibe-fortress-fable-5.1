# T-NEW — The three-year farm stops growing at its strips' cap

**Source:** [T-664's report](../../reports/data/2026-11-20-t664-small-fortress-starves.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

The three-year script's farm grows by strips of four by four (`checkFarm`, `three_years_economy.ts`), up to sixteen strips or 32 tries, since a strip's place on a slope may hold no soil. T-664 stopped a failed search for ground by the gate from counting as a try; in `three-years-p2-4` at shift 0 the farm then grew to 17 plots of 174 tiles, but the tries at the strips' places west of the first field still reached 32 by day 228 with fourteen strips sown, and a fortress of 68 ended year 3 with no plant or meal in stock (the cap the script sets itself is 4 tiles a dwarf, 300 here). The places run in rows south of the first field and leave the 48 by 48 map after a few rows, so most late tries find nothing.

## What to do

Trace where the strips' tries fail on `p2-4` at shift 0 (`test/perf/t664_farm_probe.test.ts` writes the strips each day). Let a strip whose place has no ground take the nearest free sunlit soil on the wagon's side instead (as `nearGateStrip` does by the gate), so the cap is on the land the fortress farms and not on its tries, and measure the food and the sweep.

## Done

The farm's tiles against the dwarves on the traced timeline before and after, and the sweep's verdict.
