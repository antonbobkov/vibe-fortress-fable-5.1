# T-458 — A sapling or shrub on a building site cannot be cleared

**Closed:** 2026-11-01, in be16f7d.

**Source:** T-455 (`three-years-p2-3`) · **Size:** S · **Needs:** — · **Status:** open

## Why

In `three-years-p2-3` the south door of the gate is never built: a sapling rooted on the door tile refuses the door, and a shrub blocks the wall that would extend the ring. Neither can be cleared, so a player could not seal that fortress either. An 11-strong raid walks in on day 119 and the fortress dies out. A player who wants a door or wall on a tile should never be refused by a seedling.

## Decisions

1. **Placing clears.** Placing a building on a tile with a sapling or a shrub is allowed. The placement shows what will be cleared. The builder uproots the plant as the first step of the construction job: no extra job for the player, and it takes `CLEAR_PLANT_TICKS` (a constant in 07, marked unmeasured).
2. **What the plant leaves.** A shrub leaves what `gather` would leave if it has ripe yield. A sapling leaves nothing.
3. **Grown trees are unchanged:** they still refuse a building until chopped. The chop tool does that, and the refusal message says so.
4. **Also a tool.** The designate panel's chop tool also accepts saplings, and the gather tool accepts shrubs, if they do not already.
5. **Spec first:** 07 and 14.

## Done

- **Unit tests:** a door placed on a sapling and a wall on a shrub are built, with the plant gone and its yield dropped; a grown tree still refuses.
- `three-years-p2-3` gets its south door. Report what that does to its raid on day 119.
- The six static checks, `npm test`, e2e, and the instrument by the T-308 rule pass.
