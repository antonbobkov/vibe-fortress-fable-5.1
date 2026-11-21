# T-670 — An item's view, and names that open what they name

**Source:** [the inspection design](../../reports/designs/2026-11-21-inspection-and-follow.html), § 8 second task · **Size:** M · **Needs:** T-669 · **Status:** open

## Why

After T-669 a click on a loose item still has nowhere of its own to go, and a dwarf's view names the items it carries and the friends it has without a way to open them (design § 3 Item view).

## What to do

Build the design's second task: the item view of § 3 (it holds the item id, its place from `items.tileOf`, a second line for how it is held: lying, carried, worn, in a container, in a building; 13's item fields plus maker, owner and reserving job), names as links in the creature and item views (a carried item, a friend, the carrier, the container, the stockpile) and `Bksp` back through the short history. No item commands yet (§ 9).

## Done

Unit tests: an item picked up, put in a barrel and laid in a stockpile keeps its view; links open and Bksp returns.
