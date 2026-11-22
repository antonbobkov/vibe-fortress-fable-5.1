# T-677 — A stockpile clears items that do not belong on it

**Closed:** 2026-11-21, in d0749ded,0fbb3b5e,ae2a49b5.

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** — · **Status:** open

## Why

A stockpile placed over items it does not accept fills around them: dwarves never move the foreign items aside, so the tiles stay taken.

## What to do

Make a stockpile tile holding an item the stockpile does not accept give a haul job for that item to a stockpile that accepts it, or to a free tile out of the way when none does (13 § Stockpiles), so the tile frees up. Keep it cheap (per stockpile change and on a slow sweep, not every tick).

## Done

- [x] A unit test: a stone on a food stockpile is hauled away and food fills the tile (`test/unit/items/t677-stockpile-clears-foreign.test.ts`: with no stone stockpile the stone goes to a free floor beside the stockpile and the meal fills the tile, failing with the clearing turned off; with a stone stockpile it goes there; a forbidden stone and goods the stockpile takes stay).
- [x] The sweep's verdict: `44983974110` on `e19c6c00`: Pooled 20 | 7 | 0 | 1151.75 | 98.25 | 0 | 0, **Verdict: pass**, all 80 seeds green (master after T-675, `44975306609`: 1189 living, 97.75 deaths, 0 extinct). Deaths rose by half a death, need deaths stay 0. Living fell by 37, within the tolerance: peril 0 is unchanged (484 against 487 living at shift 0), and the fall is in peril-2 and peril-4 timelines (`p4-5` at shift 0, `p4-1` at shifts 100 and 150, `p2-7` at shift 100) whose raids and cavern fights went differently once the timelines diverged; the one peril-0 rise (`p0-6` at shift 100, 3 deaths against 1) is a cavern creature's wounds (bled out, then two infections), not hauling or needs. A new stockpile with an empty filter clears nothing, so placing one and then picking its preset moves nothing aside in between (two tests that lay goods on an unset stockpile, `activities.test.ts` and `t195_train_needs`, failed in the first CI run until that rule).
