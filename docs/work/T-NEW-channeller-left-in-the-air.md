# T-NEW — A channeller left standing in the air

**Source:** [T-663's report](../../reports/data/2026-11-20-t663-water-inside-the-gate.md) (sweep `44850405030`, `three-years-p2-4` at shift 50) · **Size:** S · **Needs:** — · **Status:** open

## Why

The three-year script's cistern channels its feed shaft a level at a time from the surface, each miner standing on the ramp the level above left (03 § Tile transitions: a channel is worked standing on its tile). On `three-years-p2-4` at shift 50 the invariant checker found the founder miner on an `open` tile of that shaft, (5, 25, 30), from tick 82,800 to the end of the run (`creature.on-impassable`, kind 0, no fluid). 03 says that before the floor opens the worker moves to the first passable 8-neighbour, and with none the movement helper makes it fall. Here the stair beside the shaft was evidently not yet dug to that level, so there was no neighbour, and the miner stayed in the air over the ramp below instead of falling onto it.

## What to do

Find why the channeller did not fall (the tile below a channelled ramp is the new ramp the channel made: does the fall test take a ramp as a landing, or run before the ramp exists?), fix it in the movement helper or 03's channel completion, and test it with a channel column whose worker has no neighbour to step to. Separately, the script's shaft (`cistern-well.ts`, `column`) should wait for its stair to reach each level before channelling it, so its miner steps off as planned; that change moves the three-year timelines and needs a sweep.

Spec: 03 § Designations (channeling); 22 (falling).

## Done

The channeller falls (or steps off) in a test, and the three-year script's shaft waits for its stair, with a sweep.
