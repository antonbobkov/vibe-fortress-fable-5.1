# T-412 — A hostile creature never blocks a walker: 22's hostile hook is never installed

**Source:** T-409 (found while reading the movement helper) · **Size:** S · **Needs:** — · **Status:** open

## Why

22 § Movement helper says creatures block each other "at doors and when hostile". `MovementHelper.blockedByCreature` (`src/core/movement.ts`) asks `pathing.graph.hooks.hostile(id, other)` for the second case, but nothing in `src/` sets that hook: its default in `src/core/pathfinding.ts` returns `false`, and `src/app/headless.ts` installs only `forbidden`, `blocksMovementAt`, `doorAt`, `lockedHatchAt` and `blocksSightAt`. So in the game a dwarf walks through a tile held by a standing raider, and a raider through a tile held by a dwarf; only doors block.

## What to do

1. Decide whether 22's hostile clause should hold (install the hook from the factions, as 16 and 18 judge hostility) or be dropped from 22 (combat already stops movers by engaging them).
2. If the hook is installed, run the annual instrument and a raid seed before and after: it can move every fight.
3. A test of the decided rule.

## Done

- 22 and the code agree on whether a standing hostile blocks a walker on an open tile.

## Decision (orchestrator, 2026-10-21)

22's hostile clause is dropped: creatures block each other only at doors, and a creature lying down blocks no one (T-409). The reasons:

- Combat already stops a mover by engaging it: a hostile that meets a walker fights it (16), it does not need to hold its tile.
- The path search does not see creatures, so blocking walkers on hostiles would send them into repath waits and unreachable unclaims, the class of fault fixed in T-406 and T-409.
- Every balance figure was measured without it: the hook always returned `false`.

The dead hook is removed: `hostile` leaves `TerrainHooks` and its default in `src/core/pathfinding.ts`, and `MovementHelper.blockedByCreature` asks only whether a door stands on the tile. Nothing in `src/` used the hook; two tests that set it are rewritten to the door rule.
