# Data Model

**Owner:** architecture (`core/`) · **Depends on:** [architecture-overview.md](architecture-overview.md), [constants.md](constants.md)

## Overview

There are two kinds of state: **tiles** (dense grids, one value per position) and **entities** (sparse things with an id and components). Everything the simulation knows is one or the other, or a system's private state that refers to them by id.

## Map3D

### Indexing

A tile position is `(x, y, z)` with `0 ≤ x < LOCAL_MAP_W`, `0 ≤ y < LOCAL_MAP_H`, `0 ≤ z < LOCAL_MAP_Z`. The linear index is

```
i = (z × LOCAL_MAP_H + y) × LOCAL_MAP_W + x
```

x increases eastward (screen right), y increases southward (screen down), z increases upward. All grids share the index. Systems pass tile indices (`TileIndex`, a number) in events and jobs; positions are unpacked only when needed.

### Grids

| Grid | Type | Bits | Owner (writer) | Meaning |
|---|---|---|---|---|
| `kind` | `Uint8Array` | — | 03 terrain | Tile kind, table below |
| `material` | `Uint16Array` | — | 03 terrain | Registry index of the material; for trees, saplings and shrubs the plant species; 0 = none (air) |
| `fluid` | `Uint8Array` | 0–2 level, 3 type, 4 settled, 5 source, 6 frozen, 7 reserved | 04 fluids | Level 0–7; type 0 water, 1 magma; `settled` means asleep; `source` refills; `frozen` set while the tile is ice (kind is then `wall` or `floor` with material `ice`) |
| `designation` | `Uint8Array` | 0–3 designation, 4–7 priority | 03 terrain | Designation kind (table below) and its priority 1–9 |
| `flags` | `Uint16Array` | table below | several, through the terrain API | Boolean state |
| `tempOverride` | `Int8Array` | — | 05 materials | 0 = none; otherwise a local temperature contribution in units of 5 °C |
| `buildingAt` | `Map<TileIndex, EntityId>` | — | 14 buildings | Which building occupies the tile, if any |

### Tile kinds

| Value | Kind | Walkable | Notes |
|---|---|---|---|
| 0 | `open` | no (falls) | Air or a hole; things fall through; the floor of the tile below is visible |
| 1 | `wall` | no | Solid; material is stone, soil, ore, ice or a construction material |
| 2 | `floor` | yes | Solid ground at the bottom of the tile; material is what it was cut from or built of |
| 3 | `ramp` | yes | Connects to the level above at adjacent wall sides; the tile above must be `open` |
| 4 | `stairs_up` | yes | Connects up |
| 5 | `stairs_down` | yes | Connects down |
| 6 | `stairs_updown` | yes | Connects both |
| 7 | `fortification` | no | Blocks movement; passes projectiles and fluids |
| 8 | `tree` | no | Trunk; material = tree species; chopped to logs |
| 9 | `sapling` | yes | Grows into a tree |
| 10 | `shrub` | yes | Gatherable; material = shrub species |
| 11 | `boulder` | no | Surface rock that must be dug; drops stone |

A tile with `kind ∈ {floor, ramp, stairs_*, sapling, shrub}` is *solid-bottomed*: things rest on it. A tile with `kind == open` above a solid-bottomed tile is "the space above a floor", which is how open sky and dug-out rooms are represented: a room is a layer of `floor` tiles with `open` tiles above them only if the ceiling was channeled; by default the tile above a floor is `wall` (the ceiling rock), except on the surface.

Clarification of the surface: for a column, the highest tile whose kind is not `open` is the ground; the tiles above it are `open`. Surface tiles have the `outdoor` flag.

### Designations

| Value | Designation | Applies to | Result |
|---|---|---|---|
| 0 | none | | |
| 1 | `dig` | wall, boulder | floor |
| 2 | `channel` | floor, ramp, sapling, shrub | open; wall below becomes ramp |
| 3 | `stairs_up` | wall | stairs_up |
| 4 | `stairs_down` | floor | stairs_down (tile above unaffected) |
| 5 | `stairs_updown` | wall | stairs_updown |
| 6 | `ramp` | wall | ramp, and the tile above becomes open |
| 7 | `smooth` | wall, floor (natural stone) | sets `smoothed` |
| 8 | `engrave` | smoothed wall or floor | sets `engraved` |
| 9 | `remove` | construction | returns material; tile becomes open or floor per rules in 03 |
| 10 | `chop` | tree | logs; tile becomes floor |
| 11 | `gather` | shrub | product; shrub regrows |
| 12 | `harvest` | crop at stage 3 (07) | the crop is harvested; the tile stays a farm plot tile |

### Flags

| Bit | Flag | Writer | Meaning |
|---|---|---|---|
| 0 | `discovered` | 03 | Visible to the player |
| 1 | `constructed` | 03 | Built, not natural |
| 2 | `smoothed` | 03 | Raises room value |
| 3 | `engraved` | 03 | Raises room value more |
| 4 | `mud` | 04 | Farmable; set by water contact, cleared by construction |
| 5 | `snow` | 06 | Snow cover on outdoor tiles |
| 6 | `grass` | 07 | Grazable cover on soil floors |
| 7 | `ash` | 05 | Left by fire; prevents regrowth for a season |
| 8 | `burning` | 05 | On fire |
| 9 | `outdoor` | 03 | No solid tile above in the column; recomputed on change |
| 10 | `lit` | 03 | Daylight reaches it (outdoor, or within 1 tile of an outdoor open tile horizontally) |
| 11 | `restricted` | 24 via 03 | Player traffic restriction: dwarves avoid |
| 12 | `web` | 08 | Cave spider web; entangles |
| 13 | `wet` | 06 | Rained on this hour; decorative and slows fire |
| 14–15 | reserved | | |

### Chunks

A chunk is `CHUNK_SIZE × CHUNK_SIZE × 1` tiles. Per chunk:

- `dirtyRender: boolean` — the compositor may cache the chunk's cells until this is set.
- `dirtyPath: boolean` — the pathfinder's connectivity labels for this chunk must be recomputed.
- `activeFluidCount: number` — number of unsettled fluid tiles; chunks with zero are skipped by 04.
- `entityBucket: EntityId[]` — the spatial index bucket (kept sorted).

Chunk index: `c = (z × chunksPerRow + cy) × chunksPerRow + cx` with `chunksPerRow = LOCAL_MAP_W / CHUNK_SIZE`.

### Terrain API

Only 03 writes `kind` and `material` directly. Other systems that need to change a tile call the terrain reader's *request* methods, which are ordinary function calls that validate and mutate immediately (they are not events), because tile changes must be atomic with the caller's logic:

- `terrain.setKind(i, kind, material)` — used by 04 for obsidian and ice, by 14 for constructions, by 07 for tree growth.
- `terrain.setFlag(i, flag, value)` — used by 04 (mud), 05 (ash, burning), 06 (snow, wet), 07 (grass), 08 (web).
- `terrain.setDesignation(i, kind, priority)` — used by 03's own command handling.

These methods mark chunk dirty flags and queue `TileChanged` batches. This is the one sanctioned exception to "only the owner writes": the terrain API is the owner, and callers go through it.

## Entities

### Ids

`EntityId` is a 32-bit integer: bits 0–23 index, bits 24–31 generation. An id whose generation does not match the slot's current generation is dead. `EntityStore.alive(id)` checks this; every event consumer checks it before use.

### Kinds

Each entity has exactly one `Kind` component that tags what it is. Kinds: `creature`, `item`, `building`, `zone`, `stockpile`, `squad`, `party`, `projectile`, `crop`, `room`.

### Store API

```
create(kind): EntityId
destroy(id): void                       // components removed; slot generation incremented. No event is queued: the owning system emits ItemDestroyed or CreatureDied
alive(id): boolean
add<T>(id, component: ComponentType<T>, value: T): void
get<T>(id, component): T | undefined
has(id, component): boolean
remove(id, component): void
each(kind, fn)                          // ascending slot index order
with(a, b?, c?)                         // ascending slot index order over entities having all listed components
```

Hot components (`Position`, `Motion`) are stored as structure-of-arrays typed arrays indexed by entity index; all others as `Map<index, T>` iterated through a sorted index list maintained on add and remove. Iteration through `each` and `with` follows ascending slot index, which is the entity-table order the world hash uses. For entities that have never been destroyed, slot index order and numeric id order are identical. `Motion` is stored as structure-of-arrays with `movementClass` held as a `Uint8` code into `MOVEMENT_CLASSES`; `get` decodes it back to the documented string, keeping the component's public shape.

### Components and their owners

The owner is the only system that writes the component. "Core" means the movement helper or the store.

| Component | Owner | Fields |
|---|---|---|
| `Kind` | core | `kind` |
| `Position` | core (movement helper on behalf of brains; spawners on creation) | `x, y, z` |
| `Motion` | 22 pathing | `pathId, stepIndex, progressFixed, speedFixed, movementClass` |
| `Creature` | spawner (10, 08, 18, 20) | `species, name, sex, ageTicks, faction (fortress, wild, hostile:civ, trader:civ), sizeClass` |
| `Body` | 17 health | `parts[6] { hp, maxHp, wounds[] }, blood, maxBlood, pain, conscious, permanent[]` |
| `Attributes` | 10 dwarves | `str, agi, tou, end, wil, wit, cha` |
| `Skills` | 10 dwarves | `level: Uint8Array(skillCount), xp: Uint16Array(skillCount)` |
| `Needs` | 10 dwarves | `hunger, thirst, rest, social, comfort, purpose, joy` (0–`NEED_MAX`) |
| `Personality` | 10 dwarves | `traits: TraitId[]` (three per dwarf) |
| `Schedule` | 10 dwarves | `sleepStartHour, sleepHours` |
| `Relationships` | 10 dwarves | `friends: EntityId[], grudges: EntityId[]` |
| `Title` | 10 dwarves | `title: thane | warden | broker | chief_medic | none` |
| `Labors` | 11 jobs | `enabled: bitset` |
| `Worker` | 11 jobs | `jobId, phase, carrying: EntityId | 0` |
| `Mood` | 15 morale | `value, tier, thoughts: { thoughtId, startTick, value }[], sulkCounterDays` |
| `Equipment` | 16 combat | `weapon, shield, armor[slot], quiver` (item ids) |
| `Soldier` | 16 combat | `squadId, onDuty, stance, targetId` |
| `Patient` | 17 health | `hospitalZoneId, bedId, needs: treatment list` |
| `Item` | 13 items | `type, material, quality, wear, count, containerId, ownerId, flags (forbidden, dump, melt)` |
| `Container` | 13 items | `contents: EntityId[], capacity` |
| `Building` | 14 buildings | `type, material, state, origin, footprint, orientation, linkedIds[], ownerId` |
| `Workshop` | 12 workshops | `orders[], currentJobId, progressFixed, inputsPresent[]` |
| `Zone` | 14 buildings | `type, tiles: TileIndex[] (sorted), settings` |
| `Stockpile` | 13 items | `filter, containersWanted` |
| `Room` | 14 buildings | `zoneId, tiles, qualityScore, tier, ownerId` |
| `Squad` | 16 combat | `members[], schedule, equipmentSet, orders[], alert` |
| `Party` | 18 threats / 20 trade | `civ, purpose (raid, thief, ambush, siege, caravan), members[], state, arrivedTick, goal` |
| `Hostile` | 18 threats | `partyId, role, behaviorState, lootId` |
| `Tame` | 08 animals | `pastureId, trained: none | war | hunting, hunger, ownerId` |
| `Wild` | 08 animals | `behaviorState, homeChunk, fleeUntilTick` |
| `Projectile` | 16 combat | `itemId, from, to, progressFixed, shooterId, damage` |
| `Crop` | 07 plants | `plotZoneId, plant, stage, growthFixed, tile` |
| `Corpse` | 13 items (an `Item` with type `corpse`) | `species, diedTick` |
| `Merchant` | 20 trade | `partyId, goods: EntityId[]` |

Systems may add private components of their own without listing them here, but a component read by another system must be in this table.

## Content indices

Content ids are strings in tables and saves. At load, the registry assigns each row a dense index within its table. `material` in `Map3D` and `type` in `Item` are those indices. The registry's `idOf(index)` and `indexOf(id)` convert.

## Fortress-level state

Some state belongs to the fortress as a whole and to no system in particular. It lives in `World.fortress`:

```
{ name, embarkTick, wealthCached, populationCached, hallSpiritCached,
  alert: calm | watchful | hearth, deepPressure, reputation: Record<Civ, number>,
  populationCap, milestones: Set<MilestoneId> }
```

The caches are recomputed by their owners (13 wealth, 10 population, 15 hall spirit) at their cadence and read by everyone else.

## Sizes

At standard map size: 442,368 tiles. `kind` 1 B, `material` 2 B, `fluid` 1 B, `designation` 1 B, `flags` 2 B, `tempOverride` 1 B: 8 bytes per tile, 3.5 MB total. Chunk records: 1,728. Entities: a year-3 fortress has around 80 dwarves, 100 animals, 20,000 items, 500 buildings, 50 zones.
