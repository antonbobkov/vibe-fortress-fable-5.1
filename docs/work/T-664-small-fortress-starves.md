# T-664 — A small peril-4 fortress starves with drink in stock

**Source:** [T-656's report](../../reports/data/2026-11-20-t656-thirst-under-the-alert.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

In the twenty-seed sweep, peril-4 fortresses that raids have cut to a dozen dwarves or fewer sometimes die of hunger with drink in the stores: their plants and meals run out together and every dwarf dies within a few days. Master-equivalent sweep `44780191075` had 29 such deaths at peril 4 (`p4-1` at shift 50 lost 11 on days 209 to 211, `p4-2` at shift 150 7, `p4-4` at shift 0 and `p4-5` at shift 150 5 each). T-656's sweep `44796007697` had 55: `p4-6` at shift 150, 29 dwarves at the end on master, starved to the last of 11 on days 198 to 201 with no plant or meal left after day 168 and 110 drinks in stock, and `p4-2` at shift 0 (eight dwarves, days 70 to 80) followed it; `p4-5` at shifts 100 and 150 no longer starved. The timelines diverge long before, so this does not say whether T-656's second woodcutter, taken from a fortress of nine to thirteen, cost the farm a hand. The sweep's need deaths rose from 7.5 to 13.75 a sweep; nothing bounds them at peril 4.

## What to do

Trace `three-years-p4-6` at shift 150 and `three-years-p4-1` at shift 50 (`test/perf/t656_drink_probe.test.ts` writes a line a day; add the farm, the kitchen and who holds the food labors): when the plants stop coming, why (the farmers dead or drafted, the plots outside a locked gate, the seed gone), and what a player would do with a dozen dwarves. Check whether the script's specialists (a second woodcutter, the brewer, the watch) take the last farm hands from a remnant, and if so keep them on food below some population.

## Done

The cause in the two traced timelines and the answer, with the sweep's verdict and its peril-4 starvation deaths before and after.
