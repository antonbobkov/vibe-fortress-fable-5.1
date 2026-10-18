# T-NEW — With no hearth hall, a civilian's shelter moves with the dwarf

**Source:** T-NEW-lever-under-hearth-alert's review tests, 2026-10-18 (`test/unit/t-new-lever-under-hearth-alert.test.ts`, the shelter without a hall) · **Size:** M · **Needs:** — · **Status:** open

## Why

19 § Hearth alert retreat, step 2: with no reachable hearth hall the retreat tile is "the nearest reachable tile that is not `outdoor` and lies behind at least one door on the path from the dwarf's current tile" (`src/systems/defense/retreat.ts:20-35`). Two things follow below ground:

- A door tile is itself indoor and is the first tile behind a door on any path, so it is the nearest one: the civilian shelters in the doorway. 14 does not lock a door with a creature in its doorway (19 § Hearth alert retreat), so a `lock_on_alert` door with a sheltering civilian in it stays open.
- The tile is recomputed from where the dwarf stands, by 10 at every behaviour selection and by 11 whenever it asks whether a lever is inside the shelter (10 § Behavior selection, step 2). From the doorway, the nearest tile behind a door is past the next door, so the shelter flips to the next area. In the review test of a lever on the level below, reached only past a second door, the board does not offer the pull on the alert's first tick, but once the mechanic stands in the first doorway its shelter becomes the area past the second door, and it pulls the lever under the alert.

With a hearth hall none of this happens: the retreat tile is the nearest hall tile and the shelter is the hall. The three-year fixture and the browser opening have a hall.

## Decisions

- The retreat tile is never a door, hatch, floodgate or drawbridge tile.
- A civilian keeps its retreat tile while the alert lasts and the tile stays reachable: 10 saves it with the brain's target, and 11 reads the shelter around that saved tile; it is recomputed only when the alert is raised, when the tile becomes unreachable, or when a hall becomes reachable.

## What to do

1. A failing stepped test: no hall, a civilian behind one door, a second door beyond it; under the alert it stands in neither doorway and its shelter does not change for a day.
2. The rule in 19 § Hearth alert retreat and 10 § Behavior selection, the fix, the save field with its default.
3. The lever review test of the level below then runs the alert for a day and asserts no pull.

## Done

- The test passes; the review test of the lever below asserts over a stepped day, not only the first tick.
