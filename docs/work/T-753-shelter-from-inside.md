# T-753 — A civilian already in the only room behind a door finds no shelter there

**Source:** T-745 (found while writing `test/unit/ui/t745-shut-in-thirst.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

## Why

19 § Hearth alert retreat step 2 looks for "an indoor tile behind a door" by a breadth-first search from the dwarf that counts a tile only once the search has passed a door. A civilian who is already standing in a room whose one door leads outdoors (a flat-test room: a wall across the map, a `lock_on_alert` door, indoor tiles behind it, no hearth) finds none: its search leaves by the door into the open and never comes back. With no hearth hall and no bedroom it is one of 10's `unsheltered()`, works as under a Watchful alert, and the Military panel says "No shelter: 2 dwarves keep working, unable to reach the hall or a room behind a door." while it stands in that room with the door locked behind it. Its fellows who were outside when the alert came walk in and shelter on the same tiles.

Seen in the T-745 test: two dwarves teleported into the room before the alert stayed `idle` under Hearth; with a hearth there (a 5×5 hall) they retreated. A fortress with a hearth hall, or with interior doors, does not meet it, so it is rare in play.

## What to do

Decide in 19 whether a civilian already on the indoor side of a door (the side away from the outdoors, as 14 reads a door's outside) shelters where it stands, and pin it with a test. Keep the retreat tile rules of T-447 and the fixed-tile rule as they are.

## Done

- [x] Decided (19 § Hearth alert retreat step 2, 10 § Behavior selection step 2): when step 2's search finds no tile behind a door, a dwarf that stands on an indoor tile, not a doorway, whose indoor tiles (walked without passing a door, hatch, floodgate or drawbridge) reach a door, locked or not, shelters on its own tile. It comes after the search, so a dwarf that can reach a room behind a door still goes there, and only the case the search cannot see changes. The tile is fixed as any step-2 tile is.
- [x] Test: a civilian inside a one-door room shelters there under Hearth; the panel's no-shelter line does not count it; a roofed dwarf with no door anywhere still has none (`test/unit/defense/t753-shelter-from-inside.test.ts`).
- [x] If the rule changes the simulation: the sweep and the defence check on GitHub, at a5cbad28. Sweep (run 45686734409): verdict pass, pooled living 1128.5 (bound ≥ 1046.63), deaths 122.5 (≤ 132.5), alive 20, grown 7, extinct 0, need deaths 0.5. One seed job (p4-1 at shift 50) failed on a lone `squad.member-dead` sample: a soldier killed the tick before it stayed listed until 16's next squad step. Fixed here: a dead member, or leader, leaves its squad when its `CreatureDied` is handled (16 § Squads; `test/unit/combat/t753-dead-member-leaves-squad.test.ts`). Defence check (run 45686738112): verdict pass, raids turned back 7.38 of 8 (≥ 5), a soldier killed 6.50 (≥ 4).
- [x] Found: with no hearth, the door locks 20 ticks into the alert on a dwarf walking to it from a few tiles out (`T-NEW-hearthless-door-shuts-out.md`).
