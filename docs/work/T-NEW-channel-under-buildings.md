# T-NEW — A channel dug under a bed or a door

**Source:** T-594 (stairs are not cut under a building) · **Size:** S · **Needs:** — · **Status:** open

## Why

03 clears a designation worked standing on its own tile when a building that blocks walking is built there, but a `channel` under a building a dwarf can stand on (a bed, a chair, a door) keeps its designation. The channel opens the floor, and the building is left over open space. T-594 settled the same question for stairs: a floor that holds a building fails every stair precondition, and placing a building clears a stair designation on its floors.

## What to do

Decide whether `channel` follows the stair rule: a floor that holds a building fails the precondition, the designate tool skips it with `under a building`, and `BuildingPlaced` clears the designation. Check `ramp` too, which opens a floor above the wall it carves. Write it in 03 § Tile transitions and test it.

## Done

The rule in 03, the code and a test with a channel box over a furnished floor.
