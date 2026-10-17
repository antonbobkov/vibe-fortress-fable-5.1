# T-341 — A grazer can still loop on grass behind a no_pets door

**Closed:** 2026-10-16, in 8ea4863.

**Source:** the review of T-335 (2026-10-16) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-335 made a grazer skip grass in another walker region. Connectivity labels are computed with no faction, so an unlocked door counts as passable (`src/systems/buildings/build.ts:1179-1191`), but a tame mover is blocked at a `no_pets` door. Grass behind such a door has the animal's label: `grassForTame` picks it, the path fails, the walk target is dropped, and the next think picks the same tile again, the loop T-335 fixed.

## What to do

- Fix the loop for this case: check reachability with the animal's mover options, or skip for a while a grass tile whose walk just came back unreachable (that needs a small piece of saved state). A unit test with a pasture behind a `no_pets` door, failing first.
- The review's nits, in the same task: 08 says "the grass it chose" while `tame.ts:241` keeps any qualifying walk target (reword 08, or keep the target only when the previous think chose grass); apply `GRAZE_SEARCH_RADIUS` to a kept target when `pastureId` is 0; make label 0 consistent between `grassForTame` and `grassStillFor`; tests for dropping the kept target when its grass is claimed, the pasture is reassigned, or the region changes.

## Done

- The no_pets case does not loop; the nits are fixed or decided in this file; gates as for a simulation change.
