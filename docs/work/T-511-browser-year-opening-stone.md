# T-511 — The browser year's opening can leave its kitchen or hearth waiting for stone

**Source:** T-509 ([report](../../reports/audits/2026-11-05-t509-instrument-noise.md#taiga-seed-3-two-ticks-later)) · **Size:** S · **Needs:** — · **Status:** open

## Why

The annual instrument plays the browser opening's command schedule. T-509 found that the rock that schedule digs (the stair and the 5 by 5 room three levels down) drops a stone from 30% of its tiles, so the stones it yields move with the timeline: 5 to 9 in the instrument's seeds. The mason, the still, the kitchen and the "4 stone blocks" order then compete for them, and in some timelines a building waits all year: `wildlife-taiga-3`'s kitchen two ticks later (no meal cooked, 11 dwarves starved), the hearth of grassland seeds 3 and 4 in 7 of 16 timelines each. The instrument's player now digs another room of rock when a building has waited two days for stone or blocks (testing-strategy.md § Annual wildlife survival). `test/e2e/full-year.spec.ts` (§ Checkpoint 2) still has the old opening, so on its own seed it can lose its kitchen or hearth the same way, and its single sample would then report a starving or shelterless year as the game's.

## What to do

1. In the browser year, record at the day-20 checkpoint whether every placed building is built, and print it in the end-state line.
2. If any is not, give the browser player the instrument's reaction (dig the next room beside the lower room), or have the opening dig a larger lower room; keep the two openings the same.

## Done

- The browser year's end-state line says which opening buildings stand, and its opening digs for the stone they wait for, as the instrument's does.
