# T-344 — Item haul planning costs time in proportion to the items that wait

**Source:** T-283 (building the reference fortress) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Why

Two measurements on the reference fortress map with eight stockpiles in place:
- With the 25,000 single items lying loose on the ground and not forbidden, the first tick after loading took 57 s, all of it in system 11 (the haul planning of 13: `Hauling.tick` and `bestFor` for each item that wants hauling).
- Once the loose items are forbidden, the items that still want hauling stay in the `wants` set when they wait for a barrel or a bag (`bestFor` answers `'wait'`), and `Hauling.tick` visits all of them on every tick: 3,775 waiting items cost about 20 ms per tick (system 11: 448 ms over 20 ticks), against the 0.60 ms allocation. With the number of single items in the fixture varied (stored on the stockpile tiles, 30 ticks measured), system 11 cost under 7 ms per tick at 1,000 items, 9.7 ms at 5,000 and 22 ms at 12,000: about 1.9 ms per 1,000 items.

A played fortress has food, drink and seeds waiting for containers, so the cost is not a fixture artefact.

## What to do

- Reproduce with a unit test: a stockpile that wants barrels, and a few thousand food items on the ground; time `Hauling.tick`.
- An item that waits for a container is looked at again when a container becomes available (`ContainerAvailable`, a container built, emptied or moved), not on every tick; a loose item gets its haul job at a bounded rate per tick without scanning all stockpiles for each of thousands of items in one tick.
- Gates as for any simulation change, including the annual instrument and the perf tier.

## Done

- System 11 costs at most its allocation on the reference fortress with its 25,000 items, with the loose items not forbidden, shown by `reference_fortress_figures.test.ts`.
- The reference fortress's 25,000 items are no longer forbidden in the builder (`scripted-reference.ts` says why they are).
