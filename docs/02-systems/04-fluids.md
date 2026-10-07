# 04 Fluids

**Owner:** `systems/fluids` · **Depends on:** [`../01-architecture/data-model.md`](../01-architecture/data-model.md), [`../01-architecture/constants.md`](../01-architecture/constants.md), [03-terrain-and-mining.md](03-terrain-and-mining.md), [05-materials-and-temperature.md](05-materials-and-temperature.md)

## Purpose

Move water and magma through the map in a way that is cheap at scale and rich enough for rivers, lakes, waterfalls, floods, hand-dug channels, drains, obsidian casting and drowning traps. The same rules run both fluids with different parameters.

## Concepts

- **Level**: 0–`FLUID_MAX_LEVEL` units in a tile. A tile holds one fluid type at a time.
- **Passable for fluid**: a tile fluid can enter: `open`, `floor`, `ramp`, `stairs_*`, `sapling`, `shrub`, `fortification`, and any of these with a building that does not block fluid. Blocking buildings: closed floodgate, raised bridge, closed hatch (for vertical movement only). Walls, trees and boulders are not passable.
- **Active tile**: a tile whose fluid may still move. Only active tiles are simulated. A new game starts with none active; generated fluid stays as generated until disturbed. There is no first-tick activation pass or saved `started` flag. River sinks drain on the first step and start river flow.
- **Settled**: a tile that has not changed for `FLUID_SETTLE_STEPS` steps; removed from the active set until a neighbor changes.
- **Source**: a tile that refills to full at every step (river inflow, the Sea of Fire, a volcano pipe). **Sink**: a tile at the map edge that destroys fluid entering it (river outflow).
- **Step**: one run of the fluid rules over the active set. Water steps every `FLUID_TICK_CADENCE_WATER` ticks, magma every `FLUID_TICK_CADENCE_MAGMA`.
- **Body**: a set of full tiles connected through full tiles. Used only by the pressure rule.

## Rules

### The four movement rules

For each active tile `T` with level `L > 0`, in the order below, each rule may move fluid at most once per step; a tile that moved by an earlier rule does not try later rules in the same step.

1. **Fall.** Let `B` be the tile below. If `T` is not solid-bottomed and `B` is passable for fluid, contains no fluid of the other type, and `B.level < FLUID_MAX_LEVEL`: move `min(L, FLUID_MAX_LEVEL − B.level)` units from `T` to `B`. (A hatch closed over `T` blocks the fall.)
2. **Spread.** For each of the four cardinal neighbors `N` on the same level, visited in a rotating order that advances by one each step (so no direction is favored over time): if `N` is passable for fluid, contains no fluid of the other type, and `N.level < L − 1`: move one unit from `T` to `N`. If `N.level == L − 1` and `N.level ≥ 1`, and `T` has made fewer than `FLUID_EQUALIZE_BUDGET` such equalizing moves since its level was last written by any other rule (a fall, a spread of two or more, pressure, a refill, a drain, evaporation, steam, freezing, thawing or an outside write), move one unit with probability `SPREAD_EQUALIZE_PERMILLE`. Equalizing never moves water into an empty tile, so a level-1 film is at rest; and because only real flow renews the budget, a closed body with uneven levels stops swapping units within a bounded number of steps and settles. Stop after `T` has given away `SPREAD_MAX_PER_STEP` units.
3. **Pressure.** Only if `L == FLUID_MAX_LEVEL` and neither rule above moved anything: let `A` be the tile above `T`. If `A` is not solid-bottomed and is passable for fluid, contains no fluid of the other type, `A.level < FLUID_MAX_LEVEL`, and there exists a tile `H` in `T`'s body with `H.z > A.z`, then move one unit from `H` to `A`. `H` is found by a breadth-first search over full same-type tiles starting from `T`, stopping at the first tile with `z > A.z`, bounded by `PRESSURE_SEARCH_LIMIT` tiles and by the per-step `PRESSURE_BUDGET_TILES` budget shared across all tiles; if the budget runs out, the tile is retried next step. Vertical neighbours in the body join only through the upper tile's open bottom, the same test as fall and lift. Sources count as `H` at their own z and never lose units.
4. **Evaporate.** Water only. If `L == 1`, `T` is not a source, and no cardinal or vertical neighbor contains water: with probability `WATER_EVAPORATE_PERMILLE` the unit vanishes. If an isolated level-1 water tile fails its evaporation draw, retry next step without counting an idle step, so it stays active until it evaporates. Magma at level 1 stays.

Units are conserved by rules 1–3. Sources create units; sinks and evaporation destroy them.

### Step algorithm

```
step(type):
  for each chunk with activeFluidCount > 0, in chunk index order:
    tiles = chunk.activeTiles (sorted ascending; iteration direction alternates per step)
    for T in tiles:
      if frozen(T) or level(T) == 0: deactivate(T); continue
      if fluidType(T) != type: continue   // keep active for its own type's step
      moved = fall(T) || spread(T) || pressure(T) || evaporate(T)
      if moved: touch(T) and touch(each tile that received or gave units) else if neither pressure nor evaporation requires retry: idle(T)
  for S in drained sources of this type, ascending: if not frozen and level(S) < FLUID_MAX_LEVEL: set level to max, touch(S)
  for K in sinks: if level(K) > 0: set level 0
  emit FluidsChanged { chunks touched }
```

`touch(i)`: activate the tile if it holds unfrozen fluid, reset its idle counter, and activate only its six neighbours that hold unfrozen fluid. Newly activated tiles start idle count at zero. Track sources below full as they drain, and refill only that sorted set; this has the same result as checking every source. `idle(i)`: increment the idle counter; at `FLUID_SETTLE_STEPS` mark settled and remove from the active set. Any `TilesChanged` event from 03 or a building state change from 14/19 touches the changed tiles and their neighbors. Activation is idempotent.

Iteration direction alternates between ascending and descending tile index per step, which removes the bias a single direction would give to flow along +x/+y.

### Water and magma contact

Checked whenever a rule would move fluid into a tile containing the other type (the rules above forbid the move) and additionally, for every active tile, once per step against its six neighbors:

- If a water tile touches a magma tile: the magma tile becomes obsidian by `terrain.setKind` (`wall` if its magma level ≥ `OBSIDIAN_WALL_LEVEL`, else `floor`), its fluid is cleared, and the water tile loses one unit (steam). Emit `ObsidianFormed { tile }`.
- Contact is evaluated for the water tile's side only, so each pair is handled once.

This is how the player casts obsidian walls and how a water trap kills a magma leak.

### Freezing and thawing

05 decides temperature. `TemperatureTick` from 05 sets `freezePending`; 04 processes it at the beginning of its next tick, before fluid steps. For outdoor water tiles (04 keeps the list `outdoorWaterTiles`), if the temperature is below `FREEZE_C` the tile freezes; frozen tiles above `THAW_C` thaw.

- `freeze(i)`: level ≥ `ICE_WALL_LEVEL` → `terrain.setKind(i, wall, ice)`; otherwise `terrain.setKind(i, floor, ice)` if the tile below is solid-bottomed, else `wall`. The level is preserved in the `fluid` byte with the `frozen` bit set. Creatures move to the first walkable tile in the nearest Chebyshev ring, radius 1 then 2, visited in `(dz, dy, dx)` order. With none, emit `CreatureDied { id, cause: frozen, killerId: 0 }` for 17 to handle. Items on the tile stay (inside the ice, retrievable by digging).
- `thaw(i)`: the tile restores its saved pre-freeze kind and material, clears `frozen`, and retains the stored water level; the tile is touched.
- Digging an ice wall follows 03's transition: an ice `floor` with no drop. On `TilesChanged`, a frozen tile that no longer has its recorded ice kind or ice material loses its fluid and freeze records. Frozen fluid counts as ice rather than liquid water for passability and wells. Maintain `outdoorWaterTiles` for liquid or frozen outdoor water on every level write and for whole columns named by `TilesChanged`.
- Underground water never freezes. `gemsprings` warm springs never freeze (their tiles carry a warm override in 05).

### Mist

When rule 1 moves units into a tile `B` that has a solid bottom (a `floor`, `ramp` or stairs), or into a tile whose own below tile is not passable, and the tile two above `T` (`T.z + 1`) also contains falling water (level > 0, kind `open`), then the fall is at least two levels tall: emit mist on the 3×3 around `B` at `B.z` and `B.z + 1`. Mist is stored in `mistTiles: Map<TileIndex, expiresTick>` with expiry `MIST_DURATION_TICKS` after the last emission. `fluids.isMisty(i)` reads it. 10 Dwarves checks it when a dwarf enters a tile and emits `DwarfFeltMist`; 15 turns that into a thought with a per-dwarf cooldown.

### Mud

When a step ends with water at level ≥ 1 on a tile whose kind is `floor` and whose material class is soil or stone, set `mud` through `terrain.setFlag`. Mud persists until a construction is placed on the tile (14 clears it) or the tile is dug. Mud is what lets farm plots be placed on rock.

### Creatures and items in fluid

- After each step, for each touched tile with entities (spatial index): water level ≥ `FLUID_DEEP_LEVEL` → emit `CreatureSubmerged { id }` per creature (17 applies drowning to non-aquatic creatures each health tick while submerged; 22 treats the tile as impassable); magma level ≥ 1 → emit `MagmaContact { tile, entities[] }` (17 applies burn damage; 13 destroys items whose material melts at or below `MAGMA_C`).
- On `EntitiesMoved`, run the same entity check on each destination, including settled fluid; resulting events dispatch with the next tick's event batch. Ongoing drowning while a creature stays submerged is 17's health check.
- Movement into deep water is refused by 22 for walkers, so creatures end up submerged only when water rises around them, when they fall, or when pushed by a bridge.
- Water at 1–`FLUID_WADE_LEVEL` doubles movement cost (22).

### Wells and drinking

`fluids.waterBelow(i, maxDepth)` returns the first tile in the column below `i` with water level ≥ 1 within `maxDepth` levels, searching through `open` tiles only. A tile with liquid water ends the search successfully regardless of kind; another non-open tile, including ice, stops it without water. 14's well building uses it to decide whether the well works. Dwarves drink directly from any adjacent water tile with level ≥ 1 that is not magma (10).

### Sources and sinks in play

- River inflow tiles refill each step; outflow tiles drain. A river dammed by constructions floods its banks until the water finds another way or the player opens a channel.
- The Sea of Fire is all sources. A channel from it upward carries magma by pressure to the level of the sea's surface (`MAGMA_SEA_TOP_Z`); magma cannot rise higher on its own, which is why magma forges must be built near the bottom or a pump is needed (pumps are not in version 1; players bring the forge to the magma).
- Volcano pipes are source columns up to the surface, so magma at the surface is at the pipe's level and can be channeled sideways.

### Performance

- The active set is per chunk (`activeTiles: Uint32Array` with a count) so that a resting river costs nothing.
- Pressure searches are bounded per step and per search.
- `FluidsChanged` is emitted per chunk, not per tile; the compositor redraws touched chunks.
- Expected steady state on the reference fortress: 800–2,000 active tiles per water step (a waterfall channel and a mist garden), under the 1.5 ms budget.

## State

- The `fluid` grid (owned here, stored in `Map3D`).
- `active: per chunk Uint32Array + count`, `idleCounter: Uint8Array` (per tile, only meaningful for active tiles). The serialized idle counters are parallel to the flattened `active` array.
- `sources: TileIndex[]` per type; `sinks: TileIndex[]`.
- `outdoorWaterTiles: SortedSet<TileIndex>`; `frozenOriginalKind: Map<TileIndex, kind>`, `frozenOriginalMaterial` and `frozenIceKind`; `freezePending`.
- `mistTiles: Map<TileIndex, expiresTick>`.
- `equalizeCounts`: equalizing moves made by each tile since its level was last written by another rule (non-zero entries only).
- The rng stream state.

## Interfaces

### Reader

- `fluids.levelAt(i)`, `fluids.typeAt(i)` (`none | water | magma`), `fluids.isSource(i)`, `fluids.isFrozen(i)`
- `fluids.isMisty(i)`
- `fluids.waterBelow(i, maxDepth)`
- `fluids.isMagmaAdjacent(i, radius)` — for magma workshops (12)
- `fluids.activeCount()` — debug
- `fluids.isActive(i)` — the tile is in the active set, so its fluid may still move (23 animates only these tiles)

### Commands

None directly. Channels, floodgates and bridges are 03 and 14 commands.

### Events consumed

`EntitiesMoved` (destination entity checks), `TilesChanged` (touch), `BuildingStateChanged` (floodgate, bridge, hatch: touch), `TemperatureTick` (from 05: freeze and thaw list processing).

### Events emitted

`FluidsChanged { chunks[] }`, `ObsidianFormed { tile }`, `CreatureSubmerged { id, tile }`, `MagmaContact { tile, entities[] }`, `TileFrozen { tile }`, `TileThawed { tile }`, `MistProduced { tiles[] }` (only when a new mist area starts, for the announcement "A waterfall's mist fills the hall"), `CreatureDied { id, cause }` with the cause `frozen` (a creature in water that freezes, when there is no walkable tile beside it to move it to).

### Registrations

Overlay `fluid levels` (digits 1–7 on fluid tiles); inspector section `tile › fluid`.

## Player-facing behavior

- Water renders as `≈` in four blue shades by level band (1–2, 3–4, 5–6, 7), magma in four orange-red shades. Falling fluid (an `open` tile with fluid) uses `≈` too; mist tiles get a pale cyan background tint.
- The fluid overlay shows level digits. Sources are marked in the look cursor ("river source").
- Announcements: `ObsidianFormed` as a note; a creature drowning or burning as an alert naming the creature; `MistProduced` once per mist area as a note.
- Design implications the hints mention: channels carry water downhill; a floodgate holds a channel; water rises to the level of its source; magma stays at the sea's level.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `FLUID_SETTLE_STEPS` | 8 | Idle steps before a tile sleeps |
| `SPREAD_EQUALIZE_PERMILLE` | 500 | Chance to move a unit into a neighbor at level − 1 |
| `FLUID_EQUALIZE_BUDGET` | 16 | Equalizing moves a tile may make between two real flows |
| `SPREAD_MAX_PER_STEP` | 2 | Units a tile may give away sideways per step |
| `PRESSURE_SEARCH_LIMIT` | 256 | Tiles per body search |
| `PRESSURE_BUDGET_TILES` | 4000 | Total search tiles per step |
| `WATER_EVAPORATE_PERMILLE` | 8 | Per step for an isolated level-1 water tile (about 250 ticks to vanish on average) |
| `OBSIDIAN_WALL_LEVEL` | 4 | Magma level at or above which contact makes a wall |
| `ICE_WALL_LEVEL` | 4 | Water level at or above which freezing makes a wall |
| `FREEZE_C` / `THAW_C` | −1 / 2 | Hysteresis so tiles do not flicker |
| `MIST_DURATION_TICKS` | 100 | |
| `MAGMA_C` | 1200 | Temperature used for melting items |

## Extension points

- Pumps: a building with function tag `pump` that moves units from its input tile to its output tile each step, bypassing pressure; add to the step after the rules.
- Other fluid types (oil, blood pools): the type bit is one bit; a second bit is reserved in the fluid byte. Rules take a parameter table per type.
- Flow direction rendering: track the last move direction per active tile in a side array.
