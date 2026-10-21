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
