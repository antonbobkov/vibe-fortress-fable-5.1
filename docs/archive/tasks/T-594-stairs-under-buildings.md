# T-594 — Stairs cut into a floor that holds a building

**Closed:** 2026-11-17, in eb43fb87.

**Source:** T-589 (one Stairs tool; 03 lets up and up/down stairs be cut into a `floor`) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-589, 03's `stairs_up` and `stairs_updown` accept a `floor`, and the Stairs tool carries a shaft through a level already dug out. Those jobs are worked from an adjacent tile, so 03's rule that clears a designation "worked standing on its own tile" when a walk-blocking building stands there does not cover them: a stairs box over a furnished room can carve stairs under a bed, a table or a workshop tile. Nothing checks what happens to the building then.

## What to do

Decide whether a stair designation on a floor that holds a building (other than a door) is refused by 03's precondition, cleared like the standing-on-tile designations, or allowed with the building kept on the stair. Write the rule into 03 § Tile transitions, make the Stairs tool skip such tiles with a counted reason if they are refused, and test it.

## Done

The rule in 03, the code and a test with a stairs box over a furnished floor.
