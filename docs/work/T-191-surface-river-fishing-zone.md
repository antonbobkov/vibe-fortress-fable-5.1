# T-191 — Surface river banks cannot qualify for fishing zones

**Source:** T-153 and its run of `homestead_year.scenario.ts` · **Size:** S · **Needs:** — · **Status:** open

## Why

[`docs/02-systems/09-hunting-gathering-fishing.md`](../02-systems/09-hunting-gathering-fishing.md) § Fishing specifies:
> "A fishing zone placed by the player along an open water tile (river, lake, stream, ocean shore) designates the bank as active for fishing."

In generated 3D local maps (`src/systems/terrain/generate/rivers.ts:18`), river channels are carved to depth 1 below the local surface level (`surfaceZ - 1`). The river fluid (water level 7) sits at `z = surfaceZ - 1` (e.g. z = 31), while the surface banks are walkable floors at `z = surfaceZ` (e.g. z = 32). In the air above the water channel (`z = surfaceZ`), tiles are `TileKind.Open` air with fluid level 0.

However, in `src/systems/buildings/zones.ts:146` (`fishable(i)`):
```ts
const z = map.zOf(i);
for (const n of map.neighbors6(i)) {
  if (map.zOf(n) !== z) continue;
  if (map.fluidLevelAt(n) >= FLUID_DEEP_LEVEL && map.fluidTypeAt(n) === FluidType.Water && !map.fluidFrozenAt(n)) return true;
}
```
And in `src/systems/foraging/fishing.ts:37` (`cardinal(map, tile)`):
```ts
for (const n of map.neighbors6(tile)) {
  if (map.zOf(n) === z && (map.fluidLevelAt(n) > 0 || ...)) ...
}
```
Both functions check only horizontal neighbors on the SAME z-level (`map.zOf(n) === z`). Because water in a natural river channel is 1 z-level below the bank (`z - 1`), no bank tile adjacent to a river qualifies for fishing on the surface.

As a result, `qualifies(fishingZone, tile)` returns `false` on every surface bank tile across the entire map, and attempting to place a fishing zone on a natural river bank fails with `reason: 'bad_zone_tiles'`.

## Reproduction

In scenario `homestead_year` (seed `homestead-year`, generated 48×48 map with temperate grassland and stream river), the river flows west-to-east at `z = 31`. The walkable river banks at `z = 32` have water at `(x, y, 31)`.

Evaluating `bSystem.zones.qualifies('fishing', bankTile)` returns `false` for every bank tile along the river. A command `CreateZone { zoneType: 'fishing', tiles: [bankTile] }` fails with `reason: 'bad_zone_tiles'`. Total qualifying fishing tiles on the surface (z >= 20) is 0.

## What to do

1. In `src/systems/buildings/zones.ts:146` (`fishable(i)`), check for deep water not only on the same z-level (`n`), but also 1 z-level below open air adjacent tiles (`z - 1`), matching natural carved river channels.
2. In `src/systems/foraging/fishing.ts` (`cardinal` and `fishingWater`), support water tiles located at `z - 1` below adjacent open channel tiles so river bodies are properly identified from surface bank tiles.
3. Add a unit test verifying that walkable bank tiles along a carved river channel qualify for a fishing zone.

## Done

- Surface river bank tiles qualify for fishing zones and allow `CreateZone` to succeed.
- `npm test` passes.
