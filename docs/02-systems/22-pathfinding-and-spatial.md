# 22 Pathfinding & Spatial

**Owner:** `core/pathfinding.ts`, `core/connectivity.ts`, `core/spatial.ts`, `core/movement.ts` · **Depends on:** [`../01-architecture/data-model.md`](../01-architecture/data-model.md), [04-fluids.md](04-fluids.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [`../01-architecture/performance-budget.md`](../01-architecture/performance-budget.md)

## Purpose

Answer "can this creature get there, and how" quickly and deterministically for hundreds of creatures on a 3D grid, keep track of where entities are, and move them along their paths.

## Concepts

- **Movement class**: `walker`, `small`, `large`, `aquatic`, `amphibious`. A creature has exactly one from its species.
- **Passable**: whether a tile can be entered by a class, given kinds, buildings, fluids and flags.
- **Cost**: the fixed-point price of entering a tile (1000 = one normal step).
- **Edge**: an allowed move between two tiles: eight horizontal directions, and vertical moves through stairs and ramps.
- **Connectivity label**: an integer per tile per class such that two tiles share a label if and only if a path exists between them.
- **Request**: a path query with an urgency; answered within the per-tick budget.
- **Spatial index**: per-chunk sorted lists of entity ids.

## Rules

### Passability

`passable(i, class, mover?)`, where `mover` is the optional options bag `{ faction?, magmaSafe?, size?, opensDoors?, tame? }` (the species' `magmaSafe` flag, `Creature.sizeClass`, the `O` flag, a `Tame` component); every field defaults to the value that blocks nothing extra, so `passable(i, class)` is the plain terrain answer that the connectivity labels use. `cost` takes the same bag. The `burning` and forbidden-set checks come before any class-specific answer, so an aquatic creature does not enter a burning or forbidden tile.

- Kind: `floor`, `ramp`, `stairs_*`, `sapling`, `shrub` are enterable by all land classes; `fortification` by `small` only; `open` is never chosen by pathfinding (falling is a consequence, not a move); `wall`, `tree`, `boulder` never.
- Buildings (14): `blocksMovementAt(i, class, faction, mover)`: constructed walls (already `wall` kind); a `door` blocks `wild`, `large`, and hostiles without `opensDoors` (they may break it, 18), tame movers when its mode is `no_pets`, and everyone when `locked`; `hatch` never blocks horizontal movement; raised `drawbridge` and closed `floodgate` block all; buildings with the `impassable` tag (statue, cage, occupied coffin) block all.
- Fluids (04): water level ≥ `FLUID_DEEP_LEVEL` blocks `walker`, `small`, `large` (except creatures with `size ≥ WADE_LARGE_SIZE`, which are blocked only at level 7); magma at any level blocks all classes except species with `magmaSafe`; `aquatic` may enter only water ≥ `FLUID_DEEP_LEVEL`; `amphibious` may enter any water.
- Flags: `burning` blocks all; `restricted` is allowed at high cost for dwarves; the terrain's forbidden set blocks dwarves; `web` is allowed at high cost.
- Faction: a `fortress` creature never paths through a tile occupied by a hostile (dynamic obstacles are handled by the movement helper, not the planner).

### Costs

| Condition | Cost multiplier |
|---|---|
| Normal step | 1000 |
| Diagonal step | 1414 |
| Vertical step (stairs or ramp) | 1000 |
| Water 1–`FLUID_WADE_LEVEL` | ×2 |
| Snow cover | ×`SNOW_MOVE_COST_PERCENT` (06) |
| `restricted` (dwarves) | ×5 |
| `web` | ×3, and entering entangles for `WEB_TICKS` |
| Door tile | +200 (opening delay) |
| Trap tile (own traps, dwarves) | +0 |

### Edges

- Horizontal: to the eight neighbors on the same level if passable. A diagonal is allowed only if both orthogonally adjacent tiles are not `wall`, `tree`, `boulder` or `fortification` (no cutting corners through solids).
- Stairs: from `stairs_up` or `stairs_updown` at `z` to the tile above if it is `stairs_down` or `stairs_updown`; from `stairs_down` or `stairs_updown` to the tile below if it is `stairs_up` or `stairs_updown`. Both tiles must be passable for the class; `large` creatures cannot use stairs.
- Ramps: from a `ramp` at `R = (x, y, z)`: for each cardinal direction `d`, if the tile `(x + dx, y + dy, z)` is `wall`, `tree`, `boulder` or `fortification` (the ramp leans on it) and `U = (x + dx, y + dy, z + 1)` is passable, there is an edge `R ↔ U`. The tile directly above the ramp must be `open` for the ramp to function (03 guarantees it at creation; if a floor is built there the ramp becomes a dead end). Ramps are the only vertical route for `large` creatures.
- Hatches: a `locked` hatch removes the stairs edge through its tile, and the ramp edges through a hatch on the open tile above a ramp.

### A*

- Open set: a binary heap keyed by `g + h`; `h = max(|dx|, |dy|) × 1000 + |dz| × Z_HEURISTIC_COST`. Closed set and `g` values in reusable typed arrays indexed by tile (generation-stamped to avoid clearing).
- Deterministic tie-breaking by tile index.
- Node limit per request `PATH_NODE_LIMIT`; on reaching it the request fails with `too_far` unless it asked for `nearest`, in which case the closed node with the smallest `h` is returned as the destination.
- Per tick budget `PATH_NODES_PER_TICK` across all requests. Requests are served from a priority queue by `urgency` (`flee` 0, `combat` 1, `job` 2, `need` 2, `wander` 3, `caravan` 3) then by request id. A request not finished within the budget is resumed next tick (its open set is kept; at most `PATH_CONCURRENT` requests are in progress).
- Before searching: if `label(from) ≠ label(to)` the request fails immediately with `unreachable`.

### Connectivity labels

Two-level scheme per movement class (`walker`, `small`, `large`, `aquatic`; `amphibious` uses `walker` labels unioned with `aquatic` at query time):

1. **Chunk components**: within each chunk (16 × 16 × 1), a flood fill over passable tiles using horizontal edges only yields local components. Stored as `localLabel: Uint16Array` per tile and a per-chunk component count.
2. **Portals**: every edge that leaves a chunk (to its four horizontal neighbors, and through stairs and ramps to the chunks above and below), kept as the tile pair that forms the crossing, so a stored portal never goes stale when the neighbouring chunk is rebuilt. Each chunk resolves its portals to its sorted, distinct component links `(localA, chunkB, localB)`.
3. **Global labels**: a union–find over all chunk components joined by the links of every chunk. Components are numbered in chunk order and then by local label; the smaller root wins a union, so the sets and the labels do not depend on the order of the unions. `label(tile)` is one more than the smallest component number in the set of its component; `0` is an impassable tile.

Incremental update: `TilesChanged` and `BuildingStateChanged` mark chunks `dirtyPath`; 04 marks the chunk of a fluid write itself, during its own step, and only when the write moves the tile into another passability band for the labels (empty or water below `FLUID_DEEP_LEVEL`; water from `FLUID_DEEP_LEVEL` up; magma). At the end of the tick (after step 3 of the tick, in a core phase), every dirty chunk is rebuilt whole. Every fact an edge depends on (both tiles, the corner tiles of a diagonal, the tiles a stair or ramp reads) lies within one tile of the edge's source tile, so a change inside a chunk can alter only the edges that leave a tile within one tile of it: in each of the dirty chunk's 26 neighbours only those edges are recomputed, and the links of the dirty chunks and their neighbours are resolved again. A class's union–find (a few thousand links; well under 1 ms) then runs only when a dirty chunk's component count or a link changed. Portals, links and labels equal those of a full rebuild, so a loaded game's full relabel gives a running game's labels, and labels are exact at the start of every tick.

Doors: an unlocked door is passable for connectivity purposes for classes that can use doors; locking a door dirties its chunk. Bridges and floodgates likewise. Fluids: a rising river dirties the chunks where its water crosses a passability band; connectivity follows.

`reachable(from, to, class)`: label equality. `nearestReachable(from, target, class, limit)`: BFS from `target` over passable tiles until one with `label == label(from)` is found, bounded by `limit` tiles.

### Path cache

Frequently repeated routes (workshop ↔ stockpile, bed ↔ dining hall) are cached: key `(fromChunk, toTile, class)`, value the path and the set of chunks it crosses. A cached path is valid until any of its chunks is dirtied. Cache size `PATH_CACHE_SIZE`, LRU. A cache hit is spliced with a short A* from the requester's tile to the cached path's first tile in the same chunk. The cache is an option of the pathfinder: the game runs with it on, because it is saved with 22's state and a loaded game must answer as the uninterrupted one would; a pathfinder constructed without the option has no cache.

### Movement helper

```
moveAlongPath(id, ctx):
  m = Motion(id); if no path: return idle
  m.progress += m.speed × 1000 / cost(nextTile)          // Fixed math; speed in tiles per tick × 1000
  while m.progress ≥ 1000 and path remains:
    next = path[m.stepIndex + 1]
    if not passable(next, class) or occupied by a blocking creature (hostile to the mover, or any creature if the tile is a door):
        m.repathCount += 1; clear the path (a blocking creature instead makes the mover wait REPATH_WAIT_TICKS, until REPATH_LIMIT waits have passed); return blocked
    Position(id) = next; m.stepIndex += 1; m.progress −= 1000
    spatial.move(id, prev, next); record (id, prev, next) in the tick's EntitiesMoved batch
    if kind(next) == open: fall(id) → Fell { levels }; return fell
  if m.stepIndex == last: clear path; return arrived
  return moving
```

`blocked` leaves the goal to the brain that asked for the path: the helper is not told the goal, so it issues no request itself, and the brain re-requests or gives up at `REPATH_LIMIT`. Creatures do not block each other except at doors and when hostile; two dwarves may share a tile (drawn as one). Falling: from an `open` tile, drop to the first solid-bottomed tile below (or into fluid: a creature landing in deep water is submerged; in magma, burned) and emit `Fell { id, levels }` for 17.

Speed: `Motion.speed` is recomputed by the owning brain when its inputs change: species base × attributes (10) × wound modifier (17) × carry modifier (10) × armor modifier (16).

### Spatial index

- Per chunk: a sorted `EntityId[]` of entities with a `Position` in it. `spatial.move` updates two chunks. `spatial.inRadius(i, r, filter)` visits the chunks intersecting the box and filters by Chebyshev distance and a predicate (kind, faction, component presence); `spatial.at(i)` lists entities on a tile; `spatial.nearest(i, predicate, maxRadius)` expands rings of chunks.
- `EntitiesMoved { moves: [id, from, to][] }` is emitted once per tick by the core after all brains have run (consumed by 03 discovery, 18 spotting, 19 traps, 04 submersion checks).

### Line of sight

`lineOfSight(a, b)`: same z; Bresenham from `a` to `b`; blocked by `wall`, `tree`, `boulder`, closed doors, raised bridges, closed floodgates, and `fortification` unless the fortification is adjacent to `a` or to `b`. Undiscovered tiles do not block (the player's knowledge is not the creatures'). Length cap `LOS_MAX`.

## State

- `localLabel` and `globalLabel` per class; portal lists; dirty chunk set; the request queue and in-progress searches; the path cache; spatial buckets; `Motion` components.
- No rng.

A save holds the pathfinder's state under 22's id: every unreleased request with its path, each in-progress search with its open heap and its touched `g`, parent and closed entries, the queue order, the next request id and the path cache in LRU order, and the movement helper's walks. Only the connectivity labels and the spatial buckets are rebuilt on load. A mover in mid-path therefore continues exactly as in the uninterrupted game.

When a command has dirtied connectivity and its normal pass has not run, a save preserves the current local labels, component counts and outgoing portals of the dirty chunks and their 26 neighbours. Load restores this snapshot and its dirty set over the rebuilt map, reconstructs global labels, then restores requests and walks. The pending chunks are refreshed by the normal pass, so a paused save and its load make the same first resumed decisions. Clean and older saves use the ordinary derived-label rebuild.

## Interfaces

### Reader (`readers.pathing`, `readers.spatial`)

- `pathing.reachable(from, to, class)`, `pathing.nearestReachable(from, target, class, limit)`
- `pathing.requestPath(id, from, to, class, urgency, options: { nearest?, avoidHostiles? }, mover?) → requestId`; `pathing.pathResult(requestId)` (`pending | ready(path) | failed(reason)`)
- `pathing.passable(i, class, mover?)`, `pathing.cost(i, class, mover?)`
- `pathing.edges(i, class, mover?)` — a fresh list of legal `[to, cost]` steps, horizontal then vertical, using the same mover restrictions as the pathfinder; at most the adjacent stair, ramp and horizontal edges
- `pathing.lineOfSight(a, b)`, `pathing.labelOf(i, class)` (debug)
- `pathing.requestsPending()`, `pathing.requestsServed()` — the requests waiting or in progress, and the requests settled so far (the debug panel)
- `pathing.connectivityRevision()` — a counter that changes whenever the connectivity labels are rebuilt. It is derived and not saved; 10 uses it to recheck the shelter of shut-out civilians only when connectivity has changed
- `spatial.inRadius`, `spatial.inBox`, `spatial.at`, `spatial.nearest`
- `spatial.inRadiusWhere(i, r, predicate)`, `spatial.inBoxWhere(from, to, predicate)` — the same searches with a caller's predicate in place of an entity kind

### Core API

`movement.moveAlongPath(id, ctx)`, `movement.teleport(id, to)` (spawning, caging, bridge pushes), `movement.fall(id)`.

### Events consumed

`TilesChanged`, `BuildingStateChanged` (dirty chunks).

### Events emitted

`EntitiesMoved` (batched), `Fell { id, levels, landedOn }`.

### Registrations

Overlay `connectivity` (debug: label colors); overlay `paths` (debug: current paths of selected creatures); inspector section `tile › path` (passability per class, cost, label).

## Player-facing behavior

None directly. Unreachable jobs are explained in the jobs panel; the connectivity overlay is in the debug menu.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `Z_HEURISTIC_COST` | 1000 | |
| `PATH_NODE_LIMIT` | 8000 | Per request |
| `PATH_NODES_PER_TICK` | 24000 | |
| `PATH_CONCURRENT` | 16 | In-progress searches kept across ticks |
| `PATH_CACHE_SIZE` | 512 | |
| `REPATH_WAIT_TICKS` | 5 | |
| `REPATH_LIMIT` | 3 | Attempts before the brain gives up the goal |
| `LOS_MAX` | 30 | |

## Extension points

- Flying: a `fly` class whose passability includes `open`; edges gain vertical moves through open tiles.
- Swimming: `amphibious` already exists; a swimming skill would scale water cost.
- Hierarchical pathfinding across chunks (using portals as waypoints) if profiles show A* dominating on large maps; the two-level labels already provide the abstraction.
- Creature-blocking rules (single occupancy) would change `moveAlongPath` only.
