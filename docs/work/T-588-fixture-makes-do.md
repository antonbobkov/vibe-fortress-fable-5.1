# T-588 — The long fixtures play some of Making Do

**Source:** [T-583's audit of Making Do's reach](../../reports/audits/2026-11-17-t583-making-do-reach.md) § Issues, 4 · **Size:** M · **Needs:** T-580, T-582 · **Status:** blocked (needs T-580, T-582)

## Why

The three-year script (`test/scenarios/three_years_fortress.ts`, `three_years_economy.ts`), which the twenty-seed sweep plays, orders nothing of Making Do but the wooden bed stuffed with straw. Over twenty seeds it builds no kiln, smokehouse, rack, hive, candle stand, lantern, pallet or stone bed, makes no bedding, candle, soap, glass, brick, salt, mead or spirits, never sets a cellar, a compost heap or a fertilized plot, and never answers the Thane's whim (every whim of every seed is judged missed; `thane_pleased` never happens). Its dwarves dig clay, fossils and halite and leave them in the stockpiles. So the sweep, the instrument and the merge gate measure almost none of Making Do's rules in play: a regression in the kiln, the cellar, bedding or tipsy dwarves would pass every gate that plays a fortress.

T-583's player probe (`test/perf/t583_making_do_player.test.ts`) shows what an added strand does on top of the script, and what it costs (the probe places workshops and orders at fixed offsets and is no model for a script).

## What to do

Choose a few of Making Do's chains that a temperate-forest fortress can feed from its own map and its caravans, and have the three-year script (or `homestead_year`, if the sweep's reference should not move) play them as a player would: a kiln burning potash, bone ash from its fossils and bricks from the clay it digs; a clothier making bedding and pillows from straw, so the beds are dressed; a still distilling spirits with the cellar setting on its drink stockpile; a compost heap and fertilized plots; candles from the Hillfolk's tallow on stands in the dining hall; and an answer to the Thane's whim when it is one the script already makes (mead, spirits, fine meals). Keep the strand small and its orders behind the script's own, so the economy the sweep has measured stays the same in its first year.

This task is the script's: it is done after the other script edits in flight (the burial follow-up, T-582) have landed. If the sweep's reference moves, take the new reference by the sweep's rule.

## Done

The strand in the script, the sweep's verdict and (if it moves) the new reference, and T-583's reach probe run again showing the chains reached in most seeds.
