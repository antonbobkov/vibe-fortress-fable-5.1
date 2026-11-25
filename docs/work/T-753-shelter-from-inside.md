# T-753 — A civilian already in the only room behind a door finds no shelter there

**Source:** T-745 (found while writing `test/unit/ui/t745-shut-in-thirst.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

## Why

19 § Hearth alert retreat step 2 looks for "an indoor tile behind a door" by a breadth-first search from the dwarf that counts a tile only once the search has passed a door. A civilian who is already standing in a room whose one door leads outdoors (a flat-test room: a wall across the map, a `lock_on_alert` door, indoor tiles behind it, no hearth) finds none: its search leaves by the door into the open and never comes back. With no hearth hall and no bedroom it is one of 10's `unsheltered()`, works as under a Watchful alert, and the Military panel says "No shelter: 2 dwarves keep working, unable to reach the hall or a room behind a door." while it stands in that room with the door locked behind it. Its fellows who were outside when the alert came walk in and shelter on the same tiles.

Seen in the T-745 test: two dwarves teleported into the room before the alert stayed `idle` under Hearth; with a hearth there (a 5×5 hall) they retreated. A fortress with a hearth hall, or with interior doors, does not meet it, so it is rare in play.

## What to do

Decide in 19 whether a civilian already on the indoor side of a door (the side away from the outdoors, as 14 reads a door's outside) shelters where it stands, and pin it with a test. Keep the retreat tile rules of T-447 and the fixed-tile rule as they are.

## Done

- [ ] Test: a civilian inside a one-door room shelters there under Hearth; the panel's no-shelter line does not count it.
- [ ] If the rule changes the simulation: the sweep and the defence check on GitHub.
