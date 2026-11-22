# T-NEW — 13 names the stack an item merged into

**Source:** T-671 · **Size:** S · **Needs:** — · **Status:** open

## Why

The inspection design (§ 5) moves an item's view to the stack it merged into "if 13 can name" it. 13's `items.merge(a, b)` destroys `b` with no event, so T-671's view guesses: an item gone with no `ItemDestroyed` heard takes the view to a stack of its type and material on its last tile. A merge into a stack carried or held elsewhere, or two candidate stacks on the tile, are guessed wrong or not at all.

## What to do

Have `items.merge` emit an event (for example `ItemsMerged { id: b, into: a }`, added to 13 § Events and the event catalog), and let the fortress screen follow it instead of the guess in `FortressScreen.mergedInto`. A simulation change: check the hash goldens and replay.

## Done

Unit test: a stack merged into a carried stack moves the view to it; the guess is gone.
