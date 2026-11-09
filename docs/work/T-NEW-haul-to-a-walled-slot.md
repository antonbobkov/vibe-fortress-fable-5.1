# T-NEW — A haul stays blocked on a stockpile slot that has become impassable

**Source:** [T-530](T-530-walks-the-labels-join.md) (its sweep on `0e783c05`, run 42596593989, seed `three-years-p4-6` at shift 50, failed its T-176 invariants twice) · **Size:** S · **Needs:** T-530 · **Status:** open

## Why

`three-years-p4-6` at shift 50 breaks `job.unreachable-anchor-beside` from tick 300,000: job 9175, `haul_to_stockpile` with the numeric work tile 74473 (25, 15, 32, slot `t74473` of stockpile 16777307), blocked `unreachable` for 1,500 ticks without the failed-walk memory. A probe at that tick (branch `t530-probe-p46`, run 42638179021) found the slot tile impassable to every walker (connectivity label 0) with no building on it, the three tiles north of it impassable too, and five of its neighbours in the label of every fortress worker; no forbidden tile and no door near it. So the slot the haul reserved became a wall (or other solid terrain) after the job was made, and nothing cancels the haul or moves it to another slot: no stand tile is left, and the job waits for ever. Neither T-530 change touches it (no door, no pocket); T-530 moved the timeline, and on `a1b77155` the same seed and shift passed.

## What to do

Find what made the slot tile solid (a wall construction on a stockpile tile, a cave-in, a growing tree) and decide the rule: the haul is cancelled `target_invalid` and its slot released when its tile stops being walkable, as a haul to a built container already stands beside it. Write it into 13.

## Done

- `three-years-p4-6` at shift 50 plays its three years without the finding, and a unit test holds the rule.
