# T-568 — Seven pallets from one stack of cloth are laid one after another

**Source:** T-551's test of the founders' pallets (`test/unit/t551-making-do-beds.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

The Making Do design and T-551's Done ask that the seven founders "sleep on pallets of the wagon's cloth within the hour". They do not: seven pallets placed beside the wagon on the default embark, with 15 units of cloth in two stacks, are all laid after about 236 ticks (some five hours), by two dwarves.

## What was seen

- A `build` job reserves whole stacks: `JobBoard.reserveInputs` (`src/systems/jobs/board.ts`) calls `findUnits(…, split = !isBuild)`, so a build never splits a stack when it claims it (F-01, the job assignment livelock), and 14 § Placement leaves the remainder of a stack on the site. The first two pallet jobs reserve the wagon's 5 cloth and the 10 beside it; the other five block on `missing_input` until a remainder lies on a site, and each is then taken by whichever dwarf is free, one at a time.
- The same holds for every build of a counted input (a hearth's blocks, a wall of logs from one stack), but a pallet is the first such build that many dwarves want at once on day one.

## What to do

Decide whether a build may split a stack when it claims it, as a workshop job does, without bringing back the livelock F-01 fixed, or whether a counted building input should fetch only its units. Measure the founders' pallets before and after; the economy fixture places beds, not pallets, so its timeline should not move.

## Done

The seven founders' pallets laid by several dwarves at once, within about an hour of being placed; `t551-making-do-beds` tightened to it; the sweep and instrument verdicts pass.
