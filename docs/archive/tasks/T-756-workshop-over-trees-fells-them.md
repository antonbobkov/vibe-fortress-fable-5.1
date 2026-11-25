# T-756 — On a forest site the first workshop is refused almost everywhere: "needs the tree chopped first"

**Closed:** 2026-11-25, in d4bb404e,fb0b2c93.

**Source:** playtest 2026-11-25 (newcomer) ([report](../../../reports/data/2026-11-25-playtest-5.md), finding 2) · **Size:** M · **Needs:** — · **Status:** open

## Why

A newcomer's first building is a workshop, and on a wooded site the game refuses it almost wherever it is put. A grown tree anywhere in the 3 × 3 footprint blocks the placement (14 § Placement: "A grown `tree` refuses the building, and the refusal says to chop it first"). The status row says "Carpenter's workshop · blocked: needs the tree chopped first", but not which tile, and the player must designate chopping, run time, wait for the one woodcutter with the fortress's one axe, and come back.

- **Taiga embark** (world `deep-5589-1`, region "Bitterbrae", the Balanced preset, Day 1): with the carpenter's workshop armed I hovered a grid of 441 cells over the 44 × 44 map view. 12 allowed the placement. My first 18 hand-picked spots near the wagon were all refused, 11 for trees and 7 for "needs a floor" (`28-dig.png` shows the site).
- **The tutorial's own site** (`tutorial-vale`, a temperate forest by its site rule): 7 of 8 spots I tried near the wagon were refused for trees, while the tutorial's step 6 says "click a free spot". The tutorial never teaches chopping (`11-tutorial-workshop-placed.png`).

Saplings and shrubs already do the friendly thing: the placement is allowed and shows "clears 2 plants", and the builder uproots them first (14 § Placement, step 4).

## What to do

Decisions:

- **A grown tree no longer refuses a building.** Like a shrub, it counts as the floor it stands on for the placement rules. Placing the building marks each footprint tree for felling, with a `chop` designation at the build's priority (07 § Trees), unless one is already there.
- **The build job waits for the trees.** It is not offered while a footprint tree stands. Its inputs may be hauled meanwhile. When the last tree falls, the job opens as usual. The logs fall where felling drops them. The builder clears no tree itself: felling stays the woodcutter's job and needs an axe.
- **The ghost and the status row say so**: "Carpenter's workshop · fells 3 trees first · click to place", and "clears 2 plants, fells 1 tree" when both are there. The Jobs panel's reason for the waiting build is "waiting for 3 trees to be felled" (`ui.job_wait.*` or the build's needs line, whichever the panel uses for a build waiting on its site).
- **Cancelling the building before the trees fall** removes the `chop` designations that the placement made. A tree the player had marked before stays marked.
- Constructions (walls, floors, ramps) keep their own rules. This is for buildings with a footprint (workshops, furniture, the depot, mechanisms).

Spec: 14 § Placement (step 1's tree sentence, step 4), 07 § Trees (a chop marked by a placement), `ui-screens/fortress-screen.md` § Build tool (the status row), 11 if the waiting rule needs a line there.

## Done

- [ ] Tests (`describe` with the task id): a carpenter's workshop placed over 2 trees and a shrub is accepted, marks both trees for chopping and shows "fells 2 trees first"; its build job is not offered until both trees are felled, then is built; cancelling it before then removes both marks, but not a mark the player made first; a tree off the footprint is untouched.
- [ ] The world hash moves only for saves that place a building over a tree. Run `test/golden/world-hashes.test.ts`, and if a golden moves, say why in the commit (`golden:` paragraph). The scripted fortresses place on clear ground, so no sweep is expected. If a script's placement now succeeds where it was refused, say so.
