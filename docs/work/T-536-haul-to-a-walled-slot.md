# T-536 — A haul stays blocked on a stockpile slot that has become impassable

**Source:** [T-530](../archive/tasks/T-530-walks-the-labels-join.md) (its sweep on `0e783c05`, run 42596593989, seed `three-years-p4-6` at shift 50, failed its T-176 invariants twice) · **Size:** S · **Needs:** T-530 · **Status:** done

## Why

`three-years-p4-6` at shift 50 breaks `job.unreachable-anchor-beside` from tick 300,000: job 9175, `haul_to_stockpile` with the numeric work tile 74473 (25, 15, 32, slot `t74473` of stockpile 16777307), blocked `unreachable` for 1,500 ticks without the failed-walk memory. A probe at that tick (branch `t530-probe-p46`, run 42638179021) found the slot tile impassable to every walker (connectivity label 0) with no building on it, the three tiles north of it impassable too, and five of its neighbours in the label of every fortress worker; no forbidden tile and no door near it. So the slot the haul reserved became a wall (or other solid terrain) after the job was made, and nothing cancels the haul or moves it to another slot: no stand tile is left, and the job waits for ever. Neither T-530 change touches it (no door, no pocket); T-530 moved the timeline, and on `a1b77155` the same seed and shift passed.

## What to do

Find what made the slot tile solid (a wall construction on a stockpile tile, a cave-in, a growing tree) and decide the rule: the haul is cancelled `target_invalid` and its slot released when its tile stops being walkable, as a haul to a built container already stands beside it. Write it into 13.

## Done

- `three-years-p4-6` at shift 50 plays its three years without the finding, and a unit test holds the rule.

## Outcome (2026-11-09)

**Cause:** a tree. A probe on the T-530 timeline (branch `t536-probe`, run 42642160524) logged the slot tile's history. The stockpile was zoned at tick 450, and a birch sapling took root on the tile at tick 28,820: 07's regrowth keeps saplings off farm plots, roads and constructed floors, but not off stockpiles. At tick 297,611 the sapling grew into a tree (`SaplingGrew`), and the haul aimed at the tile waited for ever. The three tiles north of it are open air, not walls. 13 also kept offering such a tile as an empty slot, since `emptyTile` looked only at items and reservations.

**Fix (13 § Stockpiles):** a stockpile tile no dwarf can stand on offers no slot and counts as no space. That is solid or open terrain, or a built building that blocks walkers (a chest, a statue). On `TilesChanged` or `BuildingCompleted`, a haul or dump job whose work tile is a stockpile or dump tile nobody can stand on any more is cancelled `target_invalid`. Its slot is released, and the item finds another home. A haul into a built container already stands beside it and is not affected. A dump job goes to the zone's first standable tile. The invariant was right and the game rule was wrong. Trees may still take root in surface stockpiles; that is kept as a fun feature (`fun-features.md`). Test: `test/unit/t536-walled-slot.test.ts`. It covers a tree on the slot (the haul is cancelled and re-routed), a tree tile (no slot), a chest on the slot (the haul is cancelled), and a dwarf on the way (it delivers elsewhere and T-176 stays clean).

**Verified:** p4-6 alone at shift 50 on T-530 with the fix passes (run 42643861792). After merging master (T-530), the pooled sweep passes with every seed job green (run 42644116254: pooled 19.75 / 7 / 0.25 / 979.5 / 133 / 0.75 / 1, verdict pass). `ci.yml` passes (run 42644123633: 3,695 tests, e2e 42 passed). The world-hash goldens are unchanged.
