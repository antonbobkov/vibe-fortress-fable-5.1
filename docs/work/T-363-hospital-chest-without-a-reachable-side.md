# T-363 — A hospital chest holding items has no tile beside it that a dwarf reaches (peril 2 sweep seed)

**Source:** T-356's order probe (2026-10-17, at `c05c2f7` with T-356's board change not yet in): seed `three-years-p2-5`, played whole as the sweep plays it · **Size:** S · **Needs:** — · **Status:** open

## Why

From tick 232,800 (day 194, year 2) to the end of the run, the T-176 checker reports `container.no-work-tile` on every daily check: built chest 50332438 at tile 60,608 = (32, 14, 26) holds 9 items, and no tile beside it is one a dwarf of the fortress reaches. The tile is the one the script gives the hospital's chest in every seed (the same tile carried T-354's smoothing job in `three-years-p4-1`). A container nobody can reach strands what it holds: its items count in the stocks and can never be fetched.

The probe ran with its findings recorded rather than asserted, so the sweep itself, which asserts, would stop on this seed at day 194.

## What to do

1. Rerun the seed to tick 232,800 and look at the eight tiles beside the chest and the room around it: what closed them (a wall or a construction built by the script, a door locked, furniture that blocks walking, a dig that left the room in its own pocket).
2. If a game rule closed the last way in (a construction sealed a room with stock inside, as 14 § Placement forbids for loose items), fix it with a failing stepped test first. If the script built it so, fix the script (`test/scenarios/three_years_fortress.ts`, the hospital room) under T-145.

## Done

- `three-years-p2-5` passes its daily invariant checks past day 194, or this file records why the chest may be closed in.
