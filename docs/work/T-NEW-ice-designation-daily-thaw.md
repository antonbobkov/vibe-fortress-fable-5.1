# T-NEW — An ice designation survives the afternoon thaw

**Source:** [T-583's audit of Making Do's reach](../../reports/audits/2026-11-17-t583-making-do-reach.md) § Issues, 2 · **Size:** S · **Needs:** — · **Status:** open

## Why

03 § Ice harvesting: "A tile that thaws clears its designation (its precondition no longer holds)." In a temperate winter the outdoor water freezes at night and thaws by day. T-583 designated `harvest_ice` on twelve frozen tiles of the three-year fixture's brook on day 90 (seed p0-1): three were cut in the first hours, then all twelve thawed at once (`TileThawed`), the other nine designations were cleared and their jobs cancelled (`target_invalid`), and the brook froze and thawed again every day after. Over a winter of designating every seven days the player probe cut 5 blocks for 48 tiles designated. The designation vanishes silently, so a player who designates ice in a temperate winter sees it go and does not know why; the design's "cut in winter, used in winter" works only where the water stays frozen all day.

## What to do

Keep a `harvest_ice` designation on a tile of outdoor water that thaws, and let its job wait while the tile is not frozen (blocked, as a job waits for a missing input) instead of clearing the designation; clear it only when the tile stops being outdoor water. Or, if that is judged wrong, say in the designate panel's line for the designation, or a first-time hint, that a thaw clears it. Write the rule into 03 § Ice harvesting and test it with a tile that thaws and freezes again before it is cut.

## Done

The rule in 03, the test, and the player probe (`test/perf/t583_making_do_player.test.ts`) cutting most of what it designates in a temperate winter.
