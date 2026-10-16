# T-337 — A builder is shut inside the workshop he finished

**Source:** T-330, the crafts and forge player path ([`../../test/scenarios/pp_forge.scenario.ts`](../../test/scenarios/pp_forge.scenario.ts)) · **Size:** S · **Needs:** — · **Status:** open

## The fault

A workshop's build job works from a tile `adjacent` to the site (`src/systems/buildings/build.ts:576`), and a tile of the site's own footprint counts. The forge (and any workshop with `impassableTiles`) makes four of its nine tiles impassable when it is finished (`build.ts:696`, `complete`; the corners, `build.ts:1197`). A builder who worked from one of those tiles is left standing on an impassable tile. He cannot path off it: from then on he only idles and sleeps where he stands. The invariant `creature.on-impassable` (T-176) reports it.

This is likely the cause of [T-303](T-303-dwarf-on-an-impassable-tile.md), which found the same invariant on the surface beside the three-year fixture's gate, where that script builds its workshops.

## Trace

Seed `pp-forge`, the compact 48 × 48 forest Serene Vale of `test/scenarios/player-path.ts`, the Miner's Guild embark; a mason's workshop, a smelter and a forge placed on day 0.

- Tick 4,247 (day 3): Liv Thundersong (creature 16777282), building the forge (16777307), stands at (25, 19, 32), a corner of its footprint.
- Tick 4,583: the forge is built; the tile is no longer passable for a walker. He goes idle there.
- Ticks 4,584 to 6,500: he alternates `idle` and `work` with "No job" every 50 ticks and sleeps on the tile; he never moves. At tick 6,500 the invariant check finds him there.

The chain itself works: lead from galena is smelted and forged into crafts that stand in the stockpile by day 5.

## Decision

When a building is completed, every creature on a tile that it makes impassable steps to the nearest passable tile beside the footprint, in the same tick. Spec: one sentence in 14 § Placement, beside the `build` job completion. A builder may still work from inside the footprint.

## Done

- `pp_forge` passes and its `todo` is removed; a unit test that builds a forge with its builder on a corner tile, named T-337, fails without the change. Check whether `three-years-p4-5` and `-p4-2` of T-303 then pass.
