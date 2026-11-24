# T-689 — A channeller left standing in the air

**Source:** [T-663's report](../../reports/data/2026-11-20-t663-water-inside-the-gate.md) (sweep `44850405030`, `three-years-p2-4` at shift 50) · **Size:** S · **Needs:** — · **Status:** done

## Why

The three-year script's cistern channels its feed shaft a level at a time from the surface, each miner standing on the ramp the level above left (03 § Tile transitions: a channel is worked standing on its tile). On `three-years-p2-4` at shift 50 the invariant checker found the founder miner on an `open` tile of that shaft, (5, 25, 30), from tick 82,800 to the end of the run (`creature.on-impassable`, kind 0, no fluid). 03 says that before the floor opens the worker moves to the first passable 8-neighbour, and with none the movement helper makes it fall. Here the stair beside the shaft was evidently not yet dug to that level, so there was no neighbour, and the miner stayed in the air over the ramp below instead of falling onto it.

## What to do

Find why the channeller did not fall (the tile below a channelled ramp is the new ramp the channel made: does the fall test take a ramp as a landing, or run before the ramp exists?), fix it in the movement helper or 03's channel completion, and test it with a channel column whose worker has no neighbour to step to. Separately, the script's shaft (`cistern-well.ts`, `column`) should wait for its stair to reach each level before channelling it, so its miner steps off as planned; that change moves the three-year timelines and needs a sweep.

Spec: 03 § Designations (channeling); 22 (falling).

## Done

The channeller falls (or steps off) in a test, and the three-year script's shaft waits for its stair, with a sweep.

- [x] Cause: the miner left in the air was not the channel's worker. Replayed at `d9a83b31` (`three-years-p2-4`, shift 50), the founder miner (who had channelled the level above) stood on the shaft's ramp at (5, 25, 30) beside the second miner working its channel; at tick 81,923 the channel opened, the worker, with no passable neighbour, fell onto the new ramp at z 29, and the founder stayed on the `open` tile, where nothing moved it again (a creature falls only when it steps onto an open tile). Channel completion moved and dropped only its worker. The fall itself takes a ramp as a landing, after the ramp is written.
- [x] Fix: every creature on the channelled tile falls once it opens (`terrain/producer.ts` `onComplete`), as a collapsing construction's do; the worker still steps off first when it can.
- [x] Tests: `test/unit/terrain/t689-channel-column-fall.test.ts`: a shaft level of rock on every side, its miner falls one level onto the new ramp and no creature is on an impassable tile; a dwarf held on the tile beside the miner falls with it.
- [x] Spec: 03 § Digging as a job (Channeling). Fun features: "Underfoot when the channel opens".
- [x] The shaft waits for its stair: already so on master since T-663's second sweep (`cistern-well.ts` `column`, `stairAt`: each level below the top is channelled only once the stair beside it is a stair at that level, and the bank's levels too, its stair a diagonal neighbour). The three-year cistern is off by default (`waterInside`), so nothing of the script changed here; the sweep was run for the channel fix.
