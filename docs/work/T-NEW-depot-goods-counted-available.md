# T-NEW — Goods at the trade depot count as available under any filter but one type

**Source:** T-631 (Stocks says how much of a row can be used now) · **Size:** S · **Needs:** — · **Status:** open

## Why

13's `items.countAvailable(filter)` has two paths. A filter of one type reads the stock counts, whose `available` leaves out goods taken to the trade depot (`isAvailable` in `src/systems/items/counts.ts`). Any other filter (`types`, `tag`, `category`, a material) counts the items in `src/systems/items/search.ts`, and that mask leaves out forbidden, reserved, owned, merchant, foreign and installed items but not `AtDepot` ones. `findItem` will not reserve a depot item, so every count of the second kind overstates what can be fetched.

T-631 met it: with 11 barley straw at the depot, 4 free and 4 free reeds, Build › Furniture lists the straw pallet with `(19)` while 8 units can be fetched, and Stocks (after T-631) says "11 at the depot". The same count drives a workshop's "waiting for" status (12, `operate.ts`), the whim's progress for whims that are not one type (10), the honey and soap checks (17) and fertilizer (07).

Adding `ItemFlag.AtDepot` to that mask was tried in T-631 and moves the simulation: `defence_year` then fails "a jammed trap cleaned" (deterministic, locally and on GitHub; it passes with the mask as it is). So depot goods reach some count in that scenario, and something there (a workshop order, a trap's cleaning input) depends on them. It was backed out; T-631 stayed in the UI.

## What to do

1. Find where `defence_year` has depot goods and which count reads them, and why leaving them out stops the trap cleaning.
2. Make the search path's mask match `isAvailable` (add `AtDepot`), so a pallet with only depot straw reads `(0)`, and fix whatever `defence_year` shows depends on the old count, or decide with the owner that depot goods should count for that reader.
3. Write in 13 § Searching that `countAvailable` follows the stock counts' rule under every filter.

Spec: 13 § Stock counts and the stocks panel, § Searching.

## Done

A unit test: depot straw does not count toward `countAvailable({ types })` or the pallet's build row; `defence_year` passes; the annual instrument's verdict on the branch, since the change can move the simulation.
