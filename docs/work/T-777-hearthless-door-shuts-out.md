# T-777 — With no hearth, a door locks on the alert's 20th tick and shuts out the dwarves walking to it

**Source:** T-753, found while writing `test/unit/defense/t753-shelter-from-inside.test.ts` · **Size:** S · **Needs:** — · **Status:** open

## Why

19 § Hearth alert retreat: a `lock_on_alert` door locks when no fortress dwarf has been adjacent on its outside for `ALERT_OUTSIDE_CLEAR_TICKS` (20) ticks, or at the grace's end. With a hearth, 14 reads the door's outside as the whole side away from the hearth (`civilianOutsideDoor`, the straight-corridor case), so a dwarf walking in from across the map holds the door open. With no hearth it reads only the door's outdoor neighbours: a dwarf that is not standing next to the door when the alert comes does not count, the outside is "clear" from the alert's first tick, and the door locks 20 ticks later.

Seen in the T-753 test (flat-test map, a wall across it, a `lock_on_alert` door at (40, 20), indoor tiles behind it, no hearth): a civilian six tiles south of the door got the room as its retreat tile, walked to the doorstep (40, 21) by tick 20 and found the door locked there. It stayed outside, unsheltered, for the rest of the alert. The test now starts that dwarf on the doorstep.

A fortress with no hearth hall and no hearth is rare after the first days, but it is the fortress most likely to need the alert early.

## What to do

Decide in 19 / 14 what a hearthless door's outside is for the lock: for example, any fortress civilian whose retreat tile (19 `retreatTile`) lies on the door's inner side and who is not yet there holds the door, as "after all civilians inside their enclosure have passed" says. Keep the grace limit and the doorway rule. Pin it with a test: a dwarf six tiles out walks in before the door locks.

## Decision

A hearthless door's outside, for the lock, is read the way a hearth door's already is: in a straight corridor (walls on the two other sides) the whole side of the corridor away from the door's inner side, where the inner side is the one toward the hearth, or, with no hearth (or a hearth level with the door), the side opposite the door's one `outdoor` neighbour along the corridor. Any fortress dwarf (not a tame animal) on that side and level holds the door, up to `ALERT_LOCK_GRACE_TICKS`; the doorway rule is kept. When neither side decides (both or neither neighbour outdoor, or no corridor), the outdoor cardinal neighbours are read as before. Chosen over "a civilian whose retreat tile lies on the inner side", which would need 19's retreat tiles in 14 and a door-to-shelter mapping, and would read differently from the hearth case; one rule now serves both. It matches 14's inner side for `FortressShutOut` (the indoor side when there is no hearth).

## Done

- [x] Decide in 19 / 14 what a hearthless door's outside is for the lock (19 § Hearth alert retreat; 14's inner side already reads the same).
- [x] Test: with no hearth, a civilian a few tiles outside the only door reaches its shelter before the door locks; with nobody outside the door still locks after 20 clear ticks (`test/unit/defense/t777-hearthless-door-holds.test.ts`).
- [x] The sweep and the defence check on GitHub, the rule alone on master (branch `probe-t777-only`, f9ba0194): sweep run 45775769548, pooled living 1171.25 and deaths 110 (master about 1169.25 and 110.25), verdict pass, every seed job passed; defence check run 45775774320, raids turned back 7.38 of 8, a soldier killed 6.50 of 8, pass. Adopted. With T-753's narrowed rule alone (run 45775758880, 1169.5 and 111) the two sweeps differ in two seed-shifts only, so neither rule moves the sweep much.
