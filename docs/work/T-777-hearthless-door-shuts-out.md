# T-777 — With no hearth, a door locks on the alert's 20th tick and shuts out the dwarves walking to it

**Source:** T-753, found while writing `test/unit/defense/t753-shelter-from-inside.test.ts` · **Size:** S · **Needs:** — · **Status:** open

## Why

19 § Hearth alert retreat: a `lock_on_alert` door locks when no fortress dwarf has been adjacent on its outside for `ALERT_OUTSIDE_CLEAR_TICKS` (20) ticks, or at the grace's end. With a hearth, 14 reads the door's outside as the whole side away from the hearth (`civilianOutsideDoor`, the straight-corridor case), so a dwarf walking in from across the map holds the door open. With no hearth it reads only the door's outdoor neighbours: a dwarf that is not standing next to the door when the alert comes does not count, the outside is "clear" from the alert's first tick, and the door locks 20 ticks later.

Seen in the T-753 test (flat-test map, a wall across it, a `lock_on_alert` door at (40, 20), indoor tiles behind it, no hearth): a civilian six tiles south of the door got the room as its retreat tile, walked to the doorstep (40, 21) by tick 20 and found the door locked there. It stayed outside, unsheltered, for the rest of the alert. The test now starts that dwarf on the doorstep.

A fortress with no hearth hall and no hearth is rare after the first days, but it is the fortress most likely to need the alert early.

## What to do

Decide in 19 / 14 what a hearthless door's outside is for the lock: for example, any fortress civilian whose retreat tile (19 `retreatTile`) lies on the door's inner side and who is not yet there holds the door, as "after all civilians inside their enclosure have passed" says. Keep the grace limit and the doorway rule. Pin it with a test: a dwarf six tiles out walks in before the door locks.

## Done

- [ ] Test: with no hearth, a civilian a few tiles outside the only door reaches its shelter before the door locks.
- [ ] If the rule changes the simulation: the sweep and the defence check on GitHub.
