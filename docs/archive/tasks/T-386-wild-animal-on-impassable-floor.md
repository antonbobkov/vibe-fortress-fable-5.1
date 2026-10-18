# T-386 — A wild animal stands on a floor tile that its movement class cannot pass (sweep seeds)

**Closed:** 2026-10-18, in 6223587.

**Source:** the peril-2/4 sweep of 2026-10-17 at `3b75d98`, [data](../../../reports/data/2026-10-17-t381-peril-2-4-sweep.json); the invariant is `creature.on-impassable` · **Size:** S · **Needs:** — · **Status:** open

## Why

Two seeds stop on it:

| Seed | Tick (day) | Creature | Tile |
|---|---|---|---|
| `three-years-p2-2` | 78,000 (66) | 50331672 boar (wild, walker) | (4, 37, 32), kind Floor, no fluid |
| `three-years-p4-1` | 306,000 (256) | 50332356 deer (wild, walker) | (21, 35, 32), kind Floor, no fluid |

The tile is a floor with no water, so what makes it impassable for a walker is something on it: a building that blocks walking (a wall construction, a workshop, a closed or locked door, a chest), most likely completed while the animal stood there or with the animal pushed onto it. A creature on an impassable tile cannot path out and may be stuck for good.

## What to do

1. Diagnosis first: rerun `p2-2` alone to tick 78,000 (about 2 minutes) with a probe that prints the building on (4, 37, 32) and its history (`BuildingPlaced`, `BuildingCompleted`, `BuildingStateChanged`), the boar's positions over the last day, and whether a construction or a door changed state under it.
2. If a building completed or a door locked with the animal on its tile, find the rule that should prevent it (14 § Placement and the construction job's completion: a creature on the site; 14 § doors: a door does not close on a creature in its doorway) and fix the gap with a failing stepped test first.
3. Check `p4-1` against the same cause.

## Done

- `p2-2` and `p4-1` pass their daily checks past the ticks above.
