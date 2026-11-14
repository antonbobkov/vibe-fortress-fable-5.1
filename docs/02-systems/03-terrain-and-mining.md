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

1. **Heightmap.** Base surface z from region elevation: `surfaceZ = SURFACE_Z_MIN + (elevation − SEA_LEVEL) × (SURFACE_Z_MAX − SURFACE_Z_MIN) / (255 − SEA_LEVEL)`. Relief 0 is level ground: every column stands at the base. From relief 1, add two octaves of noise (periods 32 and 12, weights 0.7 and 0.3) of amplitude `amp = [0, 3, 5, 8][relief]`, less `amp / 2`, so even relief 1 swells a level up and down. Round noise offsets to the nearer level, with exact half-level ties toward the base. Add ridges: a third field (one octave, period 40) rises where it lies within a fifth of its middle, linearly to `[0, 1, 2, 3][relief]` levels at the middle, so ridges run along its middle contour. Clamp to `SURFACE_Z_MIN..SURFACE_Z_MAX`. Smooth with one pass of a 3×3 median so cliffs are rare except in high relief. Then, from relief 1, on their own stream (`terrain.relief`), raise outcrops and crags, both bare rock with no soil (stage 3): `outcrops + 3 × (relief − 1)` outcrops (the biome's count, per 96 × 96 tiles, in `regions-biomes-and-traits.md` § Biome surface), each a disc of radius 1–2 (1–3 at relief 3) centred at least 3 tiles from the edge, raised one level above its centre's surface (one or two at relief 3); where the biome has crags, `crags + 2 × (relief − 1)` crags, each a cone of radius 2–4 whose peak stands 2–4 levels plus `relief − 1` above its centre, falling linearly to one level at its rim, with a ring of scree two columns wide around it (stage 9). Raising never lowers a column.
2. **Rivers and lakes.** For a river, trace a path from the midpoint of each inflow edge to the midpoint of the outflow edge (or to a lake center if no outflow) with a wandering random walk biased toward the target; widen to the class width (brook 1, river 3, major 5). All the map's water stands at one level, held below its *water surface*: the lowest ground among the dry columns cardinally beside the river's bands and the lake's disc, before any carving. Each width band is carved to the water surface minus the class depth (brook 1, river 2, major 2), whatever the ground above it, so a river through high ground runs in a cut; the bed is a stone `floor`, and level-7 water fills the bed tile through one level below the water surface. Every bank is therefore `wall` at the water's top, at least one bank stands one level above the water, where it can be drunk from (10), and the water has no step for a source to drive it over a bank (04). Where a river runs in a cut it has *drinking steps*: at every `DRINK_STEP_SPACING` tiles of its path, on both banks and straight across the way it runs, a lane one column wide whose floor is one level above the water at the bank and rises one level a column until it meets the ground. A lane that would leave the map or meet water is not cut. A lake has one such lane from its centre in each cardinal direction. From relief 1 a lane's columns grow no tree or shrub and hold no boulder. The inflow tiles at the edge are marked `source`; the outflow tiles are marked `sink` (04). A river with no inflow edge (the region where it rises) carves one path from a spring: a point drawn by the stream at least `SPRING_EDGE_MARGIN` tiles from every edge and, when there is an outflow edge, in the half of the map away from it; the spring's width band is marked `source` in place of inflow tiles. A lake has a centre chosen uniformly where the largest radius fits and in the half of the map on the arrival edge's side, so its water lies within the drink search (10) of a dwarf at the wagon, radius uniform 6–12, and a plain disc edge without jitter. Its bed is two below the water surface, filled from the bed tile through one below the water surface, with no sources.
3. **Soil.** The top `soilDepth` tiles of each column (biome-dependent, 1–5; 0 on `glasslands` and `alpine`) are `wall` of a soil material chosen per biome (loam, clay, sand, peat, silt). Below the surface in a river bed the soil is replaced by the stone below. Outcrop and crag columns have no soil: their surface is rock (on `glasslands`, obsidian as everywhere).
4. **Rock layers.** Per geology class, a layer template lists candidate materials in order from top to bottom with thickness ranges (content). The stack is generated once per map with thicknesses rolled from the ranges, then applied to every column with an undulation of ±1 z from low-frequency noise, so layers tilt gently. The stack is anchored at the surface and extends to z = `MAGMA_SEA_TOP_Z + 1`; the stack repeats if it runs out.
5. **Sea of Fire.** z in `0..MAGMA_SEA_TOP_Z`: all tiles `open` with magma level 7 and `source`, except basalt pillars (noise threshold 8%) and the outer 2-tile rim which is basalt wall. z = `MAGMA_SEA_TOP_Z + 1` is a wall layer of basalt (the sea's roof).
6. **Caverns.** For each band, a 3D noise field whose lowest-noise `CAVERN_OPEN_FRACTION` of interior tiles is opened (count rounded down, ties by tile position; the two-tile rim stays closed) (scaled by `deepness`: 0.25 at 0 to 0.55 at 255; `fungal_depths` adds 0.15; `deep_well` makes cavern one 0.7 and mostly water). Open tiles in the band become `open`; the tile below the lowest open tile in each column becomes `floor`. Cavern lakes select the lowest-noise 18% of floor tiles (60% in cavern one with `deep_well`), with ties by position and counts rounded down; water fills from the floor through one above the band's lowest open level, stopping at the band ceiling or a blocking tile. Each dry floor tile in cavern two and three rolls a 2‰ chance for a magma pool (level 7, no source, radius 2–4). Pillars are left where noise is highest. Cavern floors get fungal flora (07) and the band's species list (08). Caverns do not connect to the surface or to each other except through the noise; connections are not forced.
7. **Veins and clusters.** For each mineral row in the content table, the expected count per map is `base × wealthMultiplier[wealth]` with `ironheart` and `gemsprings` adding to specific minerals. Veins: choose a random start tile in a host layer (the mineral lists host materials), random-walk `length` steps with 6-direction moves biased horizontally, painting a 1–2 tile radius; clusters: a blob of radius 1–3. Deepsilver: only at `z ≤ DEEPSILVER_Z_MAX`, only in walls adjacent (within 2) to the Sea of Fire rim or to a magma pool, count by wealth (0 at wealth 0–1). `wyrm_roost` guarantees one deepsilver vein next to the wyrm's chamber in cavern three. Ores, gems and deepsilver draw on the stage's stream in that order; a mineral row added after version 1 (a row of `row-order.md`: `halite`, `bog_iron`, `giant_bone`) is placed after the deepsilver, each on its own stream (`terrain.minerals.<id>`), so the older minerals of a map lie where they did. `giant_bone` is a mineral of class `bone` (a fossil), placed in the sedimentary layers as any mineral is.
8. **Volcano.** If `volcano`: a magma pipe of radius 1–2 from the Sea of Fire to the surface at a random location at least 20 tiles from the arrival edge; the surface around it for radius 6 is obsidian and bare. On `glasslands` the whole surface soil layer is replaced by obsidian and the pipe radius is 3, with two more shallow magma pools at cavern one depth.
9. **Slopes, boulders, trees and vegetation.** First the slopes: every dry surface `floor` one level below a cardinal neighbour's dry surface `floor` or `ramp` (the neighbour's tile on its level is `wall`) becomes a `ramp` of its own material, so every one-level step of the surface can be walked, up a slope of several steps as up one (the neighbour may itself be a ramp); two levels or more stay a cliff. Then, from relief 1, loose boulders (stream `terrain.boulders`): each dry surface `floor` outside the volcano's bare ground and the drinking steps becomes a `boulder` with the biome's `boulders` probability (`regions-biomes-and-traits.md` § Biome surface), three times that on bare rock and at least 250‰ in a crag's scree; a boulder is of the first rock under its column's soil. Then, on soil surface tiles, place trees by the biome's tree density and species weights (trees are `tree` kind at the surface tile; trees occupy one tile and are 1 tile tall in version 1); shrubs by shrub density; grass flag on remaining soil floors. Trees are not placed within 2 tiles of the river bed except willows. Cave shrubs follow on cavern floors, and then, on their own stream (`terrain.rare_patches`), each cave shrub may turn into a rare species with its `rarePermille` by cavern tier (`plants.md` § Rare cave patches). Only a tile that is already a cave shrub changes, and the other streams draw the same numbers. Last, lying snow, where the biome has a `snow` share: a dry surface `floor` or `ramp` carries `snow` where a patch field (two octaves, periods 14 and 5, weights 0.7 and 0.3, from stream `terrain.snow`), raised a tenth for each level its surface stands above the base surface, lies in the top `snow` of its range; 06 treats it as snow cover. The surface keeps its kind of resources: soil, trees, shrubs and grass only where the biome has them.
10. **Trait features.** `old_battlefield`: scatter `BATTLEFIELD_ITEM_COUNT` rusted iron weapons and armor, choosing uniformly among the metal-made rows of those tables, at quality 0; scatter the bone piles and skulls of the region trait as bone. All lie on dry surface floors 15–40 tiles from the arrival edge. After the other traits, on its own stream (`terrain.battlefield_channel`), an `old_battlefield` map holds a dead runecaster's channel with `BATTLEFIELD_CHANNEL_PERMILLE`: one row drawn uniformly among the `weapons` rows with a launcher and no ammunition, at quality 0, on a tile of the same band. A metal one lies in iron with no stone; a wooden one is of a material of class `wood` drawn uniformly and keeps a stone drawn uniformly among the `stone`s of the `spells` table ([25-runecraft.md](25-runecraft.md) § Channels). There is at most one, the trait's other picks draw the same numbers, and no other map holds one. `sunken_halls`: choose the highest dry surface floor in the far half of the map where the footprint fits (every column from one west of the entrance to 16 east of it, and 4 rows each side, is dry and stands above the hall level, so the hall lies in rock); among equal heights prefer greater inward distance from the arrival edge, then column order. Two levels below that entrance, carve an 11-tile corridor east, six 3×3 rooms (three on each side, each with a one-tile opening to the corridor), and a stairwell at the corridor’s end down two further levels. A 5×5 vault begins two tiles east of the foot of the stair, sealed by the intervening rock. A stair shaft joins the surface entrance to the corridor. Spawn 12 common furniture items in the rooms’ own stone, drawn from `bed`, `table`, `chair`, `chest`, `cabinet`, `door`; the vault holds `VAULT_TREASURE` deepsilver items (axe, helm, breastplate) and a sleeping `blind_stalker`. `gemsprings`: choose three dry surface-soil patches of 2×2 tiles nearest a river tile drawn by the stream, or nearest the map centre when there is no river; keep the patches one tile apart. Their tiles are `open` with water level 7, recorded as warm springs for 05 so they never freeze. `wyrm_roost`: carve a 9×9 floor at the bottom of cavern three with two levels of headroom; start its deepsilver vein in the wall immediately east when that wall meets the deepsilver magma-distance rule; record the sleeping wyrm. Item and creature entries are recorded in `LocalMapResult.spawns` for arrival.
11. **Discovery and lighting.** All outdoor tiles and the tiles adjacent to them are `discovered`; `outdoor` and `lit` flags computed per column.
12. **Connectivity.** Ask 22 to build initial connectivity labels.

The generator runs synchronously with progress callbacks after each stage; budget 1.5 s.

### Tile transitions (what designations do)

| Designation | Precondition | Result | Item produced |
|---|---|---|---|
| `dig` | `wall` or `boulder`, not `constructed` | `floor` with the same material; the tile above is unchanged | Per material class: `stone` and `obsidian`: `raw_stone` with `MINING_STONE_DROP_PERMILLE`; `ore`: always `ore`; `gem`: always `rough_gem`; `bone`: always a `fossil`; `soil` whose material carries the tag `soil_drop` (`clay`, `sand`, `peat`): a `soil_load` with `SOIL_DROP_PERMILLE`; every other class, and every other soil: none |
| `channel` | `floor`, `ramp`, `sapling`, `shrub`, or `stairs_down` | Tile becomes `open`; if the tile below is `wall`, it becomes `ramp`; if it is `floor` it stays; if it is `open` nothing more | Drops from the tile below as if dug when it becomes a ramp |
| `stairs_up` | `wall` | `stairs_up` | As dig |
| `stairs_down` | `floor` | `stairs_down` | None |
| `stairs_updown` | `wall` | `stairs_updown` | As dig |
| `ramp` | `wall` with an `open` or `floor` tile above | `ramp`; the tile above becomes `open` if it was `floor` | As dig |
| `smooth` | natural `wall` or `floor` of stone | sets `smoothed` | None |
| `engrave` | `smoothed` tile | sets `engraved`; quality from the economy `rollQuality(engraving skill)` using 03's stream, with motif 0, is stored in a side table | None |
| `remove` | `constructed` tile | the construction's material returns as an item; `wall` or `floor` becomes `open`, except a constructed floor over natural rock becomes the natural floor; stairs and ramps become `open` | The block, log or bar used |
| `chop` | `tree` or `sapling` | `floor` (grass if soil); logs by species size for a tree | A tree: 1–4 logs; a sapling: none |
| `gather` | `shrub` | shrub stays; regrowth timer set (07) | The shrub's product |

Every drop is of the dug tile's material. The soil drop's roll is on its own stream, `rngFor('03.soil_drop')`, drawn only for a tile of such a soil, so digging stone, ore and every other soil draws the same numbers as before.

Digging a `wall` that has a `floor` above it (which is every underground wall) never affects the tile above. Digging removes the last support of nothing, because natural rock is never subject to support.

A removed or collapsed construction returns 14's recorded input item type. When no record exists, its material class supplies a fallback: wood returns a `log`, metal a `bar`, anything else a `stone_block`. Drops are also recorded in `terrain.intendedDrops()`, and sent to the item spawn API when present.

When a designation is applied to a tile that no longer matches its precondition (because something else changed it), the designation is cleared silently. A designation worked standing on its own tile (channel, down stairs, and smoothing or engraving a floor) is cleared in the same way, with its job, when a building other than a door that blocks walking on the tile is built there (14 `BuildingCompleted`), and is cleared when it is made on such a tile, before any job: nobody can stand there to do the work.

### Digging as a job

- A designation creates a job of type `dig`, `channel`, `carve_stairs`, `carve_ramp`, `smooth`, `engrave`, `remove_construction`, `chop` or `gather` with the designation's priority, through the `terrain` job producer.
- `dig`, `channel`, carving and `remove_construction` require the `mining` labor and a pick in hand (the worker fetches one from a stockpile if not carrying one; picks are tools that a miner keeps until the labor is disabled). `chop` requires `woodcutting` and an axe. `smooth` and `engrave` require `masonry` (smoothing) and `engraving` (engraving) labors and no tool. `gather` requires `herbalism` and no tool.
- Work time: `baseTicks × hardness(material) / (100 + SKILL_TIME_BONUS_PERCENT × skillLevel)`, then the mood multiplier (15). Progress is stored on the job and survives interruption.
- The worker stands on the target for channel, down stairs, or floor smoothing and engraving; other jobs use an adjacent walkable tile in the same-level 8-neighborhood. Up and up/down stairs also allow the tile directly above when it is a down or up/down stair, supplied by the producer's `extraStandTiles`. With no valid stand tile, the job is `blocked: unreachable`.
- Channeling: before removing the floor, move the worker to the first passable 8-neighbour in tile order. With none, the movement helper makes it fall after the floor opens.
- On completion: apply the transition, spawn the item on the tile, or on the first solid-bottomed tile below when it is now `open`, grant skill experience, emit `TilesChanged` and, for ore or gem, `MineralMined { tile, material }` and on the first tile of a vein `VeinFound { material }`. A tile of class `bone` (a fossil, or a boulder of bone) emits `MineralMined` as an ore does, and no `VeinFound`; the first one dug in a fortress emits `FossilFound { dwarfId, tile }` once (saved flag `fossilFound`): the note "{dwarf} has found the bones of something old." and the digger's thought `first_fossil` (15). Digging into an open cavern tile emits `CavernBreached { cavern }` the first time for each cavern.
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
- `fossilFound: boolean`: the first tile of class `bone` has been dug (absent in older saves and while false).
- `layerStack` and `LocalMapSpec` for the legend and for regeneration in tests.

The soil drop's stream `03.soil_drop` is saved in the `rng` section with every other stream; a game that has dug no such soil has none. The saved state retains the changed and discovered tile batches and the levels awaiting relighting until the normal terrain flush. Saving and loading neither dispatch these notifications nor recompute light. An older save without these pending fields starts with empty batches.

## Interfaces

### Reader

- `terrain.designationAt(i)`, `terrain.designations()`
- `terrain.engravingAt(i)`
- `terrain.surfaceZ(x, y)`
- `terrain.isSupported(i)`
- `terrain.cavernBreached(n)`
- `terrain.materialClassAt(i)` (stone, soil, ore, gem, bone, ice, wood, constructed)
- `terrain.spec()` — the `LocalMapSpec`
- `terrain.isForbidden(i)` — the tile's traffic mode is `forbidden`
- `terrain.forbiddenTiles()` — the forbidden set, ascending (a copy)
- `terrain.inspect(i)` — the look cursor's data for a tile (the inspector's `tile` section)
- `terrain.designationWork(i)` — where a designated tile's work stands: `queued` (its job is open, or it has none yet), `assigned` (a worker holds its job), `blocked` (its job is blocked), or null with no designation (the map's blink, 23 § Animation)
- `terrain.intendedDrops()` — the items mining owes the world while no item system is present to take them (a copy)

### Terrain API (mutation, called by other systems)

`setKind(i, kind, material)`, `setFlag(i, flag, value)`, `setDesignation(i, kind, priority)`, `clearDesignation(i)`.

### Commands

`Designate { tiles: TileIndex[], kind, priority }`, `UndoDesignation { tiles }`, `SetDesignationPriority { tiles, priority }`, `SetTraffic { tiles, mode }`, `DesignateStairwell { x, y, zTop, zBottom }` (expands to `stairs_updown` on intermediate levels, `stairs_down` at top, `stairs_up` at bottom), `ConfirmDeepsilver` (no payload; sets the fortress's `deepsilverConfirmed` when the player accepts the one-time confirmation).

### Events consumed

`JobCompleted` (for its own job types), `JobCancelled`, `EntitiesMoved` (discovery), `BuildingCompleted` (support check; the designations worked from a footprint tile the building blocks).

### Events emitted

`TilesChanged { tiles[] }` (batched), `TilesDiscovered { tiles[] }` (batched), `VeinFound { material, tile }`, `MineralMined { tile, material }`, `FossilFound { dwarfId, tile }`, `DeepsilverMined { tile }`, `CavernBreached { cavern, tile }`, `ConstructionCollapsed { tiles[] }`, `TreeFelled { tile, species }`.

### Registrations

Job producer `terrain` (designation jobs); overlay `designations`; inspector section `tile` (kind, material, flags, designation, engraving, temperature from 05, fluid from 04). Announcements:
- `VeinFound`: note, string key `announce.vein_found` ("{dwarf} has found {material}.")
- `FossilFound`: note, string key `announce.first_fossil` ("{dwarf} has found the bones of something old.")
- `CavernBreached`: alert, string key `announce.cavern_breached` ("A cavern has been breached.")
- `DeepsilverMined`: danger, string key `announce.deepsilver_mined` ("Deepsilver has been mined."), first occurrence only (`once: true`)
- `ConstructionCollapsed`: alert, string key `announce.construction_collapsed` ("A construction has collapsed.")

## Player-facing behavior

- Designation menu (hotkey `d`): dig, channel, up stairs, down stairs, up/down stairs, ramp, stairwell, smooth, engrave, remove construction, chop, gather, traffic; then a box by two clicks (or two presses of `Enter`) that may span levels, every level between its two corners, or by a drag on one level; with a stair tool a box over several levels is a stair column on each of its tiles (24 § Input model). A priority key 1–9 while designating sets the priority; the current priority is shown in the menu. Designations render as overlay glyphs colored by priority. Shift+P or a click on the reprioritize row gives the current priority to the still-designated tiles of the last batch, also kept for Undo; with no batch or no remaining designation, the status row explains why nothing changed.
- Undo: the last designation batch (or a selected rectangle) is cleared if no work has begun; tiles with progress are kept and the UI says how many.
- Announcements: `VeinFound` as a note naming the finder and the material; `FossilFound` as a note naming the finder, once; `CavernBreached` as an alert; `DeepsilverMined` first occurrence as a danger-severity announcement that pauses; `ConstructionCollapsed` as an alert.
- The look cursor shows the material, whether smoothed or engraved, the designation, and "undiscovered" where applicable.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `MINING_STONE_DROP_PERMILLE` | 300 | Chance a dug stone tile drops a stone item (*unmeasured*) |
| `SOIL_DROP_PERMILLE` | 500 | Chance a dug soil tile tagged `soil_drop` drops a `soil_load` (*unmeasured*) |
| `DIG_BASE_TICKS` | 60 | Base time to dig one wall tile of hardness 100; measured, 90 ticks a granite tile at skill 0 and 50 at skill 10 ([work pace](../../reports/audits/2026-10-18-work-pace.md)) |
| `CHANNEL_BASE_TICKS` | 80 | *unmeasured* |
| `SMOOTH_BASE_TICKS` | 120 | Measured: 368 tiles smoothed in the first year of the economy fixture, 115 ticks normalised to skill 0 ([work pace](../../reports/audits/2026-10-18-work-pace.md)) |
| `ENGRAVE_BASE_TICKS` | 300 | *unmeasured* |
| `CHOP_BASE_TICKS` | 90 | Measured in play: 113 ticks normalised to skill 0 at a mean productivity of 88%, a tenth over what the formula gives, the pauses of needs included ([work pace](../../reports/audits/2026-10-18-work-pace.md)) |
| `GATHER_BASE_TICKS` | 40 | Measured: 40 ticks normalised to skill 0 ([work pace](../../reports/audits/2026-10-18-work-pace.md)) |
| `SKILL_TIME_BONUS_PERCENT` | 8 | Per skill level; level 20 works at 100/(100+160) ≈ 38% of base time. Measured: a granite tile takes 90, 69 and 50 ticks at skills 0, 4 and 10, a smelt 150, 114 and 84 ([work pace](../../reports/audits/2026-10-18-work-pace.md)) |
| `CAVERN_OPEN_FRACTION` | 0.25–0.55 | By deepness; see stage 6 (*unmeasured*) |
| `LIGHT_SPREAD` | 2 | Tiles daylight reaches horizontally into openings (*unmeasured*) |
| `BATTLEFIELD_ITEM_COUNT` | 30 | *unmeasured* |
| `BATTLEFIELD_CHANNEL_PERMILLE` | 333 | Chance an `old_battlefield` map holds one old channel, stage 10 (*unmeasured*) |
| `VAULT_TREASURE` | 3 | Deepsilver items in a sunken hall vault (*unmeasured*) |
| `SPRING_EDGE_MARGIN` | 16 | Least distance of a river's spring from the map edge, stage 2 (*unmeasured*) |
| `DRINK_STEP_SPACING` | 12 | Tiles of a river's path between its drinking steps, stage 2 (*unmeasured*) |
| `TREE_LOGS_MIN` / `TREE_LOGS_MAX` | 1 / 4 | By species (*unmeasured*) |

Hardness per material and layer templates are content.

## Extension points

- Multi-tile trees: the `tree` kind and `TreeFelled` already carry species; a canopy would be extra tiles with a `tree_branch` kind and a rule in stage 9.
- Aquifers: a stage between 3 and 4 that marks a layer as `source` water walls (04 already supports source tiles).
- Cave-ins of natural rock: a support rule for natural tiles is the only change.
- New designation kinds: a row in the transition table, a job type in `jobs.md`, and a menu entry.

## Planned: Making Do

Not yet in the game. Each block below is a rule of the Making Do content and names the task that builds it. That task moves its block into the sections above as plain specification (its constants into § Tuning constants, its events, commands and readers into § Interfaces) and deletes it here; the last one deletes this section. Every number here is *unmeasured*. The rows named are in the content documents' § Planned rows. A new rng draw goes on a stream of its own, so a map or a game without the new content draws the same numbers as before.

### Stage 9b: the boneyards (T-557)

- After stage 9 and before stage 10, on its own stream (`terrain.giant_bones`), a map whose biome is `desert`, `badlands`, `wetland` or `tundra` lays `BONEYARD_MIN`–`BONEYARD_MAX` skeletons. Every other biome draws nothing from the stream, so its map is unchanged.
- A skeleton: a spine, a straight or once-bent line of `BONEYARD_SPINE_MIN`–`BONEYARD_SPINE_MAX` dry surface floor tiles, each made a `boulder` of `giant_bone`; at every second spine tile a pair of ribs, one tile out on each side, made `wall` of `giant_bone` one level tall; at one end a skull, a 2×2 of `giant_bone` walls. A spine starts at least `BONEYARD_EDGE_MARGIN` tiles from every edge and from the arrival edge's wagon search band (02 § Arrival), and keeps 3 tiles from water, trees and the other skeletons; a tile that fails (water, a tree, a cliff, a drinking step) is left as it was and the skeleton is laid with a gap. Up to `BONEYARD_TRIES` starts are tried per skeleton.
- Where the surface is soil, the walls are dug into it (the soil tile becomes the bone wall), so the skeleton lies half sunk. In `wetland` a rib whose tile is shallow water (level ≤ 3) stays a wall in the water. In `tundra` the skull's two outer tiles are `ivory` walls in place of bone (the tusks): they drop a `tusk` when dug.
- The skull's four tiles are recorded (`giantSkulls`, a list of four-tile groups). When the last tile of a group is dug, a `giant_skull` drops beside its fossil.
- The ribs' cage, the tiles between a skeleton's ribs and beside its spine, is recorded per skeleton (`boneyards`, the tile lists). The first fortress dwarf to stand on one emits `RibsEntered { id, boneyard }` once per skeleton (thought `stood_in_the_ribs`, 15), checked by 10 on `EntitiesMoved`.
- The site summary (02) lists "the bones of something enormous" for these biomes as likely, not certain.
- Constants: `BONEYARD_MIN` / `BONEYARD_MAX` 1 / 3, `BONEYARD_SPINE_MIN` / `BONEYARD_SPINE_MAX` 8 / 14, `BONEYARD_EDGE_MARGIN` 12, `BONEYARD_TRIES` 20.
- Events: `RibsEntered { id, boneyard }` (10 emits it). Save: `giantSkulls`, `boneyards` and the per-skeleton entered flag (`boneyardsEntered`).
- Golden: the local-map hash of the four biomes' seeds moves; no other.

### Stage 9 conversions: the new wild plants (T-548)

After the shrubs, trees and grass of stage 9, and after the rare cave patches, one pass per row of `plants.md` § Planned rows, Conversions, each on its own stream (`terrain.convert.<plant id>`): every eligible tile, in tile order, turns into the row's plant with the row's permille. The rows say which tiles are eligible: an existing shrub, an existing tree, a grass floor, a bare rock floor, a dry sand floor, or a soil floor within 2 tiles of surface water. A tile that is already a planted conversion is not eligible again. The main stage-9 stream draws the same numbers, so the rock, the trees and the shrubs of a map are those it had, and only an eligible tile changes. `ironwood` converts existing trees: a converted tree keeps its tile and its age. The site summary (02) lists the converted plants with the shrubs, by the same rule.

### Glass passes light (T-558)

- A constructed `wall` or `floor` whose material is of class `glass` (the material `glass`) passes daylight. Natural `obsidian` is class `obsidian` and passes nothing.
- `skylit` (flag bit 14): a tile that is not `outdoor` and whose every tile above in the column is `open` or a constructed glass floor, with at least one glass floor among them. It is computed with `outdoor`, in the same column pass: scanning down from the sky, a glass floor keeps the light going as an open tile does, and the first other solid tile is the last tile reached, as for `outdoor`. A column is recomputed when any tile in it changes kind or material, as `outdoor` is. A tile that is `skylit` is `lit`.
- `lit` spread: a constructed glass wall does not stop daylight spreading (§ Outdoor and lit: "with no wall between"), so light reaches `LIGHT_SPREAD` tiles through it into the hall behind. The wall tile itself is not `lit`.
- 05 reads `skylit` (05 § Planned), 07 reads it (07 § Planned), 22 reads glass for sight (22 § Planned).
- Save: none; the flag is recomputed with `lit` on load as the other light flags are.

### Ice harvesting (T-559)

- Designation `harvest_ice` on a tile of frozen outdoor water (04's frozen record, an ice `wall` or ice `floor`). The job `harvest_ice` (labor `mining`, skill `mining`, a pick) is worked from a walkable tile beside it on its level or from the walkable tile directly above it (standing on the ice, through the producer's `extraStandTiles`). On completion it drops one `stone_block` of `ice` on the worker's tile and leaves the tile as it was: ice is cut, not dug out, and the water under it stays. The tile cannot be designated again for `ICE_RECUT_DAYS` (`iceCut: Map<TileIndex, tick>`). A tile that thaws clears its designation.
- Work time `ICE_HARVEST_TICKS`, skill-scaled as digging.
- Constants: `ICE_RECUT_DAYS` 3, `ICE_HARVEST_TICKS` 80. Save: `iceCut`.
- UI: the designation menu's `harvest ice` entry (key in `ui-keymap-and-screens.md` § Planned rows).

### Setting a fire (T-559)

- Designation `ignite` on a tile 05 calls burnable (`materials.burnableTile`), not `wet` and not `snow`. The job `ignite` (labor `woodcutting`, no skill, xp 0, a `firebrand` fetched and consumed) walks to a tile beside it, works `IGNITE_TICKS` and emits `TileIgnited { tile, dwarfId }`; 05 queues the ignition as it queues a lightning strike's (05 § Planned). The dwarf gets `set_a_fire` (15).
- The first `ignite` designation of a fortress asks for the confirmation `c_first_ignite` (24), as the first deepsilver designation does; `ConfirmIgnite` (no payload) sets the fortress's `igniteConfirmed`.
- Constants: `IGNITE_TICKS` 30. Events: `TileIgnited { tile, dwarfId }`. Commands: `ConfirmIgnite`. Save: `igniteConfirmed` on the fortress record (absent: false).

### Stage 10: the Starfall crater (T-560)

- `starfall` (regions-biomes-and-traits.md § Planned rows): on its own stream (`terrain.starfall`), a crater of radius `CRATER_RADIUS_MIN`–`CRATER_RADIUS_MAX` centred on a dry surface floor at least `CRATER_EDGE_DISTANCE` tiles from the arrival edge and `CRATER_RADIUS_MAX + 2` from every edge, away from water. Every column within the radius is lowered so that its floor stands one level below the centre's original surface: rock above that is opened, soil is removed, trees and shrubs on it go. The floor tiles are of `ash_soil`, which is ash for good (07: ash on `ash_soil` never clears). A ring of ramps joins the floor to the rim where the step is one level.
- One level below the centre's floor tile, the tile is a `boulder` of `star_iron` in a pocket opened for it, the only one on the map: `star_iron` has a mineral count of 0, so stage 7 places none.
- Wild wyrmtongue on the crater floor: each floor tile turns into `wild_wyrmtongue` with `CRATER_WYRMTONGUE_PERMILLE`, on the same stream.
- The crater's tiles are recorded (`craterTiles`). A fortress dwarf entering one emits `CraterEntered { id }` (10, on `EntitiesMoved`), the thought `saw_the_star` (15; the thought's cap and hours keep it from repeating while it lasts).
- Constants: `CRATER_RADIUS_MIN` / `CRATER_RADIUS_MAX` 3 / 5, `CRATER_EDGE_DISTANCE` 20, `CRATER_WYRMTONGUE_PERMILLE` 150. Events: `CraterEntered { id }`. Save: `craterTiles`.

### Bat roosts (T-556)

- After stage 6, on its own stream (`terrain.roosts`), each cavern floor tile of cavern one and two with an open tile above it and a natural `wall` above that (the cavern's ceiling over open floor) becomes a roost's drop tile with `ROOST_PERMILLE` (doubled by `fungal_depths`). The drop tiles are recorded in `LocalMapResult.roosts` for 08, which keeps them. Nothing is drawn: a roost is not a tile kind.
- Constants: `ROOST_PERMILLE` 1.
