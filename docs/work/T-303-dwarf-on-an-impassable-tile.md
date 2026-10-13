# T-303 — A dwarf stands on an impassable tile beside the gate

**Source:** T-145 and [`../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md`](../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md) (§ The sweep) · **Size:** S · **Needs:** — · **Status:** open (diagnosis first)

## Why

Two seeds of the 20-seed sweep at `ac88f56` stop on the T-176 invariant `creature.on-impassable`:

- `three-years-p4-5`, tick 22,800 (day 19): creature 16777280 Harek Ambersong at (31, 14, 32), class walker, tile kind 2, fluid 0.
- `three-years-p4-2`, tick 45,600 (day 38): creature 16777286 Ingrid Deepbrow at (27, 10, 32), class walker, tile kind 2, fluid 0.

Both tiles are on the surface beside the fixture's gate, where the script places six walls and two doors around the entrance stair once the stair is dug.

## Reproduction

`npm exec -- vitest run -c vitest.perf.config.ts test/perf/three_years_seeds.test.ts -t p4-5` at `ac88f56` (14 seconds to the finding).

## What the spec says

The invariant `creature.on-impassable` of `test/scenarios/invariants.ts` (T-176). The sections of `14` and `22` that govern a building completed on an occupied tile are to be read when the cause is known.

## What to do

1. Find what made the tile impassable under the dwarf (a wall completed, a tree grown, a door locked) with the watch one tick earlier.
2. Fix the fault with a failing test first, or, if the invariant is too strict for the case, say so in the invariant.

## Done

- The two seeds pass the tick of their finding.
