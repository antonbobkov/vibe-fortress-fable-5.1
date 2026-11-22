# T-684 — 13 names the stack an item merged into

**Source:** T-671 · **Size:** S · **Needs:** — · **Status:** open

## Why

The inspection design (§ 5) moves an item's view to the stack it merged into "if 13 can name" it. 13's `items.merge(a, b)` destroys `b` with no event, so T-671's view guesses: an item gone with no `ItemDestroyed` heard takes the view to a stack of its type and material on its last tile. A merge into a stack carried or held elsewhere, or two candidate stacks on the tile, are guessed wrong or not at all.

## What to do

Have `items.merge` emit an event (for example `ItemsMerged { id: b, into: a }`, added to 13 § Events and the event catalog), and let the fortress screen follow it instead of the guess in `FortressScreen.mergedInto`. A simulation change: check the hash goldens and replay.

## Done

- [x] Unit test: a stack merged into a carried stack moves the view to it; the guess is gone. `test/unit/items/t684-item-merged.test.ts`: 13 emits `ItemMerged { id, into, count }` and no `ItemDestroyed`; a stack merged into a carried stack takes the view there although a stack of its kind lies on its last tile; merges heard in one batch are followed to the last stack, and an item that vanishes with no event stays gone (no guess); a log line whose subject merged names the stack it joined; a job's listed stack follows into the stack it joined while that is the job's, else leaves the lists and invalidates. T-671's merged case now delivers the event.
- [x] Simulation: `ItemMerged` is a new event only (no state, no rng); `replay` and `t176-seed-hashes` pass unchanged.

Consumers that held a merged id: Look's item view (`FortressScreen.mergedInto`, the T-671 guess, now `lookEnds` `merged`, followed through chains), the log's line subjects (T-679; `AnnouncementLog.followMerges`), and 11's job input lists (`reserved`/`delivered`; T-687's lapsed seed, which T-687 prevents at the source; this covers any other path). Checked and without the gap: 13's hauling and rot (they hear the item listener's `destroyed`), containers (a container never merges, and `detach` takes a merged stack out of one), 16's equipment (weapons, armour and quivers do not stack; owned ammunition is never hauled), 14's burial (corpses do not stack) and the haul job's `merge` target (a stack being hauled is reserved, so nothing merges into it; a target gone by then leaves the item on its slot tile).
