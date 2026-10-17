# 03 Terrain & Mining

**Owner:** `systems/terrain` · **Depends on:** [`../01-architecture/data-model.md`](../01-architecture/data-model.md), [`../01-architecture/constants.md`](../01-architecture/constants.md), [01-world-generation.md](01-world-generation.md), [11-jobs-and-labor.md](11-jobs-and-labor.md)

## Purpose

Generate the local map from a `LocalMapSpec`, and keep `Map3D` correct as the fortress digs, builds, burns and floods. Own designations and the jobs that carry them out. Own discovery.

## Concepts

- **Column**: all tiles at one `(x, y)`. The **surface** of a column is its highest non-open tile.
- **Layer**: a horizontal band of rock of one material. Layers are generated as a stack per column with small undulation.
- **Vein**: a random-walk path of ore tiles through a host layer. **Cluster**: a blob of gem or ore tiles.
- **Cavern**: a natural open region within a cavern band, with a floor, pillars, lakes and flora.
- **Designation**: a player mark on a tile that becomes a job.
- **Support**: a construction's requirement to touch a solid tile.
- **Discovery**: whether the player can see a tile.

## Rules

### Local map generation

Stages, each with its own rng stream (`terrain.<stage>`), run in order:

1. **Heightmap.** Base surface z from region elevation: `surfaceZ = SURFACE_Z_MIN + (elevation − SEA_LEVEL) × (SURFACE_Z_MAX − SURFACE_Z_MIN) / (255 − SEA_LEVEL)`. Add two octaves of noise scaled by `relief` (0: ±1, 3: ±6). Round noise offsets to the nearer level, with exact half-level ties toward the base, so relief 0 remains flat. Clamp to `SURFACE_Z_MIN..SURFACE_Z_MAX`. Smooth with one pass of a 3×3 median so cliffs are rare except in high relief.
2. **Rivers and lakes.** For a river, trace a path from the midpoint of each inflow edge to the midpoint of the outflow edge (or to a lake center if no outflow) with a wandering random walk biased toward the target; widen to the class width (brook 1, river 3, major 5); carve each width band to its lowest surface minus the class depth (brook 1, river 2, major 2); the bed is a stone `floor`, and level-7 water fills the bed tile through one level below that lowest surface; the inflow tiles at the edge are marked `source`; the outflow tiles are marked `sink` (04). A river with no inflow edge carves no path. A lake has a centre chosen uniformly where the largest radius fits, radius uniform 6–12, and a plain disc edge without jitter. Its bed is two below each column's own surface, filled from the bed tile through one below that surface, with no sources.
3. **Soil.** The top `soilDepth` tiles of each column (biome-dependent, 1–5; 0 on `glasslands` and `alpine`) are `wall` of a soil material chosen per biome (loam, clay, sand, peat, silt). Below the surface in a river bed the soil is replaced by the stone below.
4. **Rock layers.** Per geology class, a layer template lists candidate materials in order from top to bottom with thickness ranges (content). The stack is generated once per map with thicknesses rolled from the ranges, then applied to every column with an undulation of ±1 z from low-frequency noise, so layers tilt gently. The stack is anchored at the surface and extends to z = `MAGMA_SEA_TOP_Z + 1`; the stack repeats if it runs out.
5. **Sea of Fire.** z in `0..MAGMA_SEA_TOP_Z`: all tiles `open` with magma level 7 and `source`, except basalt pillars (noise threshold 8%) and the outer 2-tile rim which is basalt wall. z = `MAGMA_SEA_TOP_Z + 1` is a wall layer of basalt (the sea's roof).
6. **Caverns.** For each band, a 3D noise field whose lowest-noise `CAVERN_OPEN_FRACTION` of interior tiles is opened (count rounded down, ties by tile position; the two-tile rim stays closed) (scaled by `deepness`: 0.25 at 0 to 0.55 at 255; `fungal_depths` adds 0.15; `deep_well` makes cavern one 0.7 and mostly water). Open tiles in the band become `open`; the tile below the lowest open tile in each column becomes `floor`. Cavern lakes select the lowest-noise 18% of floor tiles (60% in cavern one with `deep_well`), with ties by position and counts rounded down; water fills from the floor through one above the band's lowest open level, stopping at the band ceiling or a blocking tile. Each dry floor tile in cavern two and three rolls a 2‰ chance for a magma pool (level 7, no source, radius 2–4). Pillars are left where noise is highest. Cavern floors get fungal flora (07) and the band's species list (08). Caverns do not connect to the surface or to each other except through the noise; connections are not forced.
7. **Veins and clusters.** For each mineral row in the content table, the expected count per map is `base × wealthMultiplier[wealth]` with `ironheart` and `gemsprings` adding to specific minerals. Veins: choose a random start tile in a host layer (the mineral lists host materials), random-walk `length` steps with 6-direction moves biased horizontally, painting a 1–2 tile radius; clusters: a blob of radius 1–3. Deepsilver: only at `z ≤ DEEPSILVER_Z_MAX`, only in walls adjacent (within 2) to the Sea of Fire rim or to a magma pool, count by wealth (0 at wealth 0–1). `wyrm_roost` guarantees one deepsilver vein next to the wyrm's chamber in cavern three.
8. **Volcano.** If `volcano`: a magma pipe of radius 1–2 from the Sea of Fire to the surface at a random location at least 20 tiles from the arrival edge; the surface around it for radius 6 is obsidian and bare. On `glasslands` the whole surface soil layer is replaced by obsidian and the pipe radius is 3, with two more shallow magma pools at cavern one depth.
9. **Trees and vegetation.** On soil surface tiles, place trees by the biome's tree density and species weights (trees are `tree` kind at the surface tile; trees occupy one tile and are 1 tile tall in version 1); shrubs by shrub density; grass flag on remaining soil floors. Trees are not placed within 2 tiles of the river bed except willows.
10. **Trait features.** `old_battlefield`: scatter `BATTLEFIELD_ITEM_COUNT` rusted iron weapons and armor, choosing uniformly among the metal-made rows of those tables, at quality 0; scatter the bone piles and skulls of the region trait as bone. All lie on dry surface floors 15–40 tiles from the arrival edge. `sunken_halls`: choose the highest dry surface floor in the far half of the map where the footprint fits; among equal heights prefer greater inward distance from the arrival edge, then column order. Two levels below that entrance, carve an 11-tile corridor east, six 3×3 rooms (three on each side, each with a one-tile opening to the corridor), and a stairwell at the corridor’s end down two further levels. A 5×5 vault begins two tiles east of the foot of the stair, sealed by the intervening rock. A stair shaft joins the surface entrance to the corridor. Spawn 12 common furniture items in the rooms’ own stone, drawn from `bed`, `table`, `chair`, `chest`, `cabinet`, `door`; the vault holds `VAULT_TREASURE` deepsilver items (axe, helm, breastplate) and a sleeping `blind_stalker`. `gemsprings`: choose three dry surface-soil patches of 2×2 tiles nearest a river tile drawn by the stream, or nearest the map centre when there is no river; keep the patches one tile apart. Their tiles are `open` with water level 7, recorded as warm springs for 05 so they never freeze. `wyrm_roost`: carve a 9×9 floor at the bottom of cavern three with two levels of headroom; start its deepsilver vein in the wall immediately east when that wall meets the deepsilver magma-distance rule; record the sleeping wyrm. Item and creature entries are recorded in `LocalMapResult.spawns` for arrival.
11. **Discovery and lighting.** All outdoor tiles and the tiles adjacent to them are `discovered`; `outdoor` and `lit` flags computed per column.
12. **Connectivity.** Ask 22 to build initial connectivity labels.

The generator runs synchronously with progress callbacks after each stage; budget 1.5 s.

### Tile transitions (what designations do)

| Designation | Precondition | Result | Item produced |
|---|---|---|---|
| `dig` | `wall` or `boulder`, not `constructed` | `floor` with the same material; the tile above is unchanged | Per material class: `stone` and `obsidian`: `raw_stone` with `MINING_STONE_DROP_PERMILLE`; `ore`: always `ore`; `gem`: always `rough_gem`; every other class: none |
| `channel` | `floor`, `ramp`, `sapling`, `shrub`, or `stairs_down` | Tile becomes `open`; if the tile below is `wall`, it becomes `ramp`; if it is `floor` it stays; if it is `open` nothing more | Drops from the tile below as if dug when it becomes a ramp |
| `stairs_up` | `wall` | `stairs_up` | As dig |
| `stairs_down` | `floor` | `stairs_down` | None |
| `stairs_updown` | `wall` | `stairs_updown` | As dig |
| `ramp` | `wall` with an `open` or `floor` tile above | `ramp`; the tile above becomes `open` if it was `floor` | As dig |
| `smooth` | natural `wall` or `floor` of stone | sets `smoothed` | None |
| `engrave` | `smoothed` tile | sets `engraved`; quality from the economy `rollQuality(engraving skill)` using 03's stream, with motif 0, is stored in a side table | None |
| `remove` | `constructed` tile | the construction's material returns as an item; `wall` or `floor` becomes `open`, except a constructed floor over natural rock becomes the natural floor; stairs and ramps become `open` | The block, log or bar used |
| `chop` | `tree` | `floor` (grass if soil); logs by species size | 1–4 logs |
| `gather` | `shrub` | shrub stays; regrowth timer set (07) | The shrub's product |

Digging a `wall` that has a `floor` above it (which is every underground wall) never affects the tile above. Digging removes the last support of nothing, because natural rock is never subject to support.

A removed or collapsed construction returns 14's recorded input item type. When no record exists, its material class supplies a fallback: wood returns a `log`, metal a `bar`, anything else a `stone_block`. Drops are also recorded in `terrain.intendedDrops()`, and sent to the item spawn API when present.

When a designation is applied to a tile that no longer matches its precondition (because something else changed it), the designation is cleared silently. A designation worked standing on its own tile (channel, down stairs, and smoothing or engraving a floor) is cleared in the same way, with its job, when a building other than a door that blocks walking on the tile is built there (14 `BuildingCompleted`), and is cleared when it is made on such a tile, before any job: nobody can stand there to do the work.

### Digging as a job

- A designation creates a job of type `dig`, `channel`, `carve_stairs`, `carve_ramp`, `smooth`, `engrave`, `remove_construction`, `chop` or `gather` with the designation's priority, through the `terrain` job producer.
- `dig`, `channel`, carving and `remove_construction` require the `mining` labor and a pick in hand (the worker fetches one from a stockpile if not carrying one; picks are tools that a miner keeps until the labor is disabled). `chop` requires `woodcutting` and an axe. `smooth` and `engrave` require `masonry` (smoothing) and `engraving` (engraving) labors and no tool. `gather` requires `herbalism` and no tool.
- Work time: `baseTicks × hardness(material) / (100 + SKILL_TIME_BONUS_PERCENT × skillLevel)`, then the mood multiplier (15). Progress is stored on the job and survives interruption.
- The worker stands on the target for channel, down stairs, or floor smoothing and engraving; other jobs use an adjacent walkable tile in the same-level 8-neighborhood. Up and up/down stairs also allow the tile directly above when it is a down or up/down stair, supplied by the producer's `extraStandTiles`. With no valid stand tile, the job is `blocked: unreachable`.
- Channeling: before removing the floor, move the worker to the first passable 8-neighbour in tile order. With none, the movement helper makes it fall after the floor opens.
- On completion: apply the transition, spawn the item on the tile, or on the first solid-bottomed tile below when it is now `open`, grant skill experience, emit `TilesChanged` and, for ore or gem, `MineralMined { tile, material }` and on the first tile of a vein `VeinFound { material }`. Digging into an open cavern tile emits `CavernBreached { cavern }` the first time for each cavern.
- A vein is the face-connected set of tiles of one mineral material, searched with a 4,096-tile bound and keyed by its lowest tile index. Dug tiles retain material, so digging preserves the identity. Only the first mined tile whose key is absent from `veinsFound` emits `VeinFound`.
- A player `CancelJob` clears its designation so it cannot recreate the job. Removing or changing a designation cancels its job with `target_invalid`.
- Deepsilver: each deepsilver tile dug emits `DeepsilverMined { tile }` (18 raises Deep pressure). Before the first deepsilver designation is applied, the UI shows a one-time confirmation (24) explaining the consequence.

### Support and collapse

- A `constructed` `wall`, `floor`, `ramp`, `stairs_*` or `fortification` is *supported* if any of its six face-adjacent tiles is `wall`, `floor`, `ramp`, `stairs_*`, `fortification` or `tree` (natural or constructed). The tile below counting as support means a floor built on rock is supported by the rock.
- When a tile changes, every constructed neighbor is re-checked. An unsupported construction collapses: it becomes `open` (an unsupported construction has no solid tile below by definition), its material item is spawned at the first solid tile below, creatures on it fall (22 movement helper) and items on it fall. Each terrain action settles its queued support checks until stable in `(z ascending, y, x)` order, then emits one `ConstructionCollapsed` batch if anything collapsed. Several settling actions in one tick can emit several batches. Constructions that touch can support each other; no path to natural ground is required.
- Natural tiles never collapse. Removing all rock around a natural pillar leaves a floating pillar; this is accepted.

### Discovery

- `discovered` is set for: all `outdoor` tiles and their 26 neighbors at generation; any tile changed by a designation and its 26 neighbors; any tile a fortress creature stands on and its 26 neighbors (updated by the movement helper when a creature enters a tile whose neighbors are not all discovered); on `CavernBreached`, the entire connected open region of the cavern reachable from the breach tile within the cavern band (flood fill bounded to the band), plus one tile of rock around it.
- Undiscovered tiles are drawn as blank and are not inspectable. Designations can be placed on undiscovered tiles (the player can plan blind), but the material is shown as "unknown rock".

### Outdoor and lit

- `outdoor` for tile `i` at `(x, y, z)`: every tile above it in the column is `open`. Recomputed for the whole column when any tile in the column changes kind.
- `lit`: `outdoor`, or an `open` or walkable tile that is within `LIGHT_SPREAD` tiles horizontally of an outdoor open tile on the same level with no wall between. Recomputed per chunk when the chunk changes. Surface crops need `lit`; cave crops need not `lit`.

### Restricted traffic

`SetTraffic { tiles, mode: normal | restricted | forbidden }` sets the `restricted` flag (forbidden is restricted plus a stored per-tile mark in the terrain state making it impassable for dwarves; 22 reads both).

### Fluids and constructions interplay

- 04 calls `terrain.setKind` for obsidian, ice and thaw.
- 14 calls `terrain.setKind` for constructions and `terrain.setFlag(constructed)`.
- 05 calls `terrain.setKind` when a burning tree or wooden construction burns away.
- Every such call goes through the same support and discovery updates as designation work.

## State

- `designations: SortedList<{ tile, kind, priority }>` mirrored in the `designation` grid; the list is the iteration source.
- `engravings: Map<TileIndex, { quality, engraverId, motifId }>`.
- `forbiddenTiles: Set<TileIndex>` (sorted array).
- `cavernBreached: [boolean, boolean, boolean]`.
- `veinsFound: TileIndex[]`: sorted keys of veins already announced.
- `layerStack` and `LocalMapSpec` for the legend and for regeneration in tests.

The saved state retains the changed and discovered tile batches and the levels awaiting relighting until the normal terrain flush. Saving and loading neither dispatch these notifications nor recompute light. An older save without these pending fields starts with empty batches.

## Interfaces

### Reader

- `terrain.designationAt(i)`, `terrain.designations()`
- `terrain.engravingAt(i)`
- `terrain.surfaceZ(x, y)`
- `terrain.isSupported(i)`
- `terrain.cavernBreached(n)`
- `terrain.materialClassAt(i)` (stone, soil, ore, gem, ice, wood, constructed)
- `terrain.spec()` — the `LocalMapSpec`
- `terrain.isForbidden(i)` — the tile's traffic mode is `forbidden`
- `terrain.inspect(i)` — the look cursor's data for a tile (the inspector's `tile` section)
- `terrain.intendedDrops()` — the items mining owes the world while no item system is present to take them (a copy)

### Terrain API (mutation, called by other systems)

`setKind(i, kind, material)`, `setFlag(i, flag, value)`, `setDesignation(i, kind, priority)`, `clearDesignation(i)`.

### Commands

`Designate { tiles: TileIndex[], kind, priority }`, `UndoDesignation { tiles }`, `SetDesignationPriority { tiles, priority }`, `SetTraffic { tiles, mode }`, `DesignateStairwell { x, y, zTop, zBottom }` (expands to `stairs_updown` on intermediate levels, `stairs_down` at top, `stairs_up` at bottom), `ConfirmDeepsilver` (no payload; sets the fortress's `deepsilverConfirmed` when the player accepts the one-time confirmation).

### Events consumed

`JobCompleted` (for its own job types), `JobCancelled`, `EntitiesMoved` (discovery), `BuildingCompleted` (support check; the designations worked from a footprint tile the building blocks).

### Events emitted

`TilesChanged { tiles[] }` (batched), `TilesDiscovered { tiles[] }` (batched), `VeinFound { material, tile }`, `MineralMined { tile, material }`, `DeepsilverMined { tile }`, `CavernBreached { cavern, tile }`, `ConstructionCollapsed { tiles[] }`, `TreeFelled { tile, species }`.

### Registrations

Job producer `terrain` (designation jobs); overlay `designations`; inspector section `tile` (kind, material, flags, designation, engraving, temperature from 05, fluid from 04). Announcements:
- `VeinFound`: note, string key `announce.vein_found` ("{dwarf} has found {material}.")
- `CavernBreached`: alert, string key `announce.cavern_breached` ("A cavern has been breached.")
- `DeepsilverMined`: danger, string key `announce.deepsilver_mined` ("Deepsilver has been mined."), first occurrence only (`once: true`)
- `ConstructionCollapsed`: alert, string key `announce.construction_collapsed` ("A construction has collapsed.")

## Player-facing behavior

- Designation menu (hotkey `d`): dig, channel, up stairs, down stairs, up/down stairs, ramp, stairwell, smooth, engrave, remove construction, chop, gather, traffic; then a rectangle by drag or by two clicks, or a single tile. A priority key 1–9 while designating sets the priority; the current priority is shown in the menu. Designations render as overlay glyphs colored by priority. Shift+P or a click on the reprioritize row gives the current priority to the still-designated tiles of the last batch, also kept for Undo; with no batch or no remaining designation, the status row explains why nothing changed.
- Undo: the last designation batch (or a selected rectangle) is cleared if no work has begun; tiles with progress are kept and the UI says how many.
- Announcements: `VeinFound` as a note naming the finder and the material; `CavernBreached` as an alert; `DeepsilverMined` first occurrence as a danger-severity announcement that pauses; `ConstructionCollapsed` as an alert.
- The look cursor shows the material, whether smoothed or engraved, the designation, and "undiscovered" where applicable.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `MINING_STONE_DROP_PERMILLE` | 300 | Chance a dug stone tile drops a stone item (*unmeasured*) |
| `DIG_BASE_TICKS` | 60 | Base time to dig one wall tile of hardness 100 (*unmeasured*) |
| `CHANNEL_BASE_TICKS` | 80 | *unmeasured* |
| `SMOOTH_BASE_TICKS` | 120 | *unmeasured* |
| `ENGRAVE_BASE_TICKS` | 300 | *unmeasured* |
| `CHOP_BASE_TICKS` | 90 | *unmeasured* |
| `GATHER_BASE_TICKS` | 40 | *unmeasured* |
| `SKILL_TIME_BONUS_PERCENT` | 8 | Per skill level; level 20 works at 100/(100+160) ≈ 38% of base time (*unmeasured*) |
| `CAVERN_OPEN_FRACTION` | 0.25–0.55 | By deepness; see stage 6 (*unmeasured*) |
| `LIGHT_SPREAD` | 2 | Tiles daylight reaches horizontally into openings (*unmeasured*) |
| `BATTLEFIELD_ITEM_COUNT` | 30 | *unmeasured* |
| `VAULT_TREASURE` | 3 | Deepsilver items in a sunken hall vault (*unmeasured*) |
| `TREE_LOGS_MIN` / `TREE_LOGS_MAX` | 1 / 4 | By species (*unmeasured*) |

Hardness per material and layer templates are content.

## Extension points

- Multi-tile trees: the `tree` kind and `TreeFelled` already carry species; a canopy would be extra tiles with a `tree_branch` kind and a rule in stage 9.
- Aquifers: a stage between 3 and 4 that marks a layer as `source` water walls (04 already supports source tiles).
- Cave-ins of natural rock: a support rule for natural tiles is the only change.
- New designation kinds: a row in the transition table, a job type in `jobs.md`, and a menu entry.
