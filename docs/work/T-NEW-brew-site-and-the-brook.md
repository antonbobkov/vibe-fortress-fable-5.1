# T-NEW — Dwarves pass over the brew when the still stands far from the stockpile

**Source:** T-458 (`pp_drink`) · **Size:** S · **Needs:** — · **Status:** open

## Why

When T-458 first let `placeNear` choose a site with a shrub on it, `pp_drink`'s still moved to another site. Everything else in the chain held: two barrels of ale were brewed by the still. But by day 28 they still stood where they were made, 16 tiles from the wagon and not on the stockpile that wants barrels, and the ten dwarves drank water 125 times and alcohol none. The scenario now keeps to open ground, so it passes as before, but the fortress's outcome should not turn on which of two near sites the still takes.

## Decisions

1. Find out why the barrels were not hauled to the stockpile in those days (the stockpile's room, its filter, or the haul producer).
2. Fix what that finds, in 13 or 10. A dwarf with a brew in reach should sometimes drink it; do not change the rule that a dwarf may drink at a brook.

## Done

- **Scenario:** `pp_drink` passes with the still on its other site (a shrub on the site, as T-458 first placed it).
- The six static checks, `npm test`, e2e, and the instrument by the T-308 rule pass.
