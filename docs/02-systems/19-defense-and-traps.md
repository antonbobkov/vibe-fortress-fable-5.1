# 19 Defense & Traps

**Owner:** `systems/defense` · **Depends on:** [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [16-combat.md](16-combat.md), [17-health-and-medicine.md](17-health-and-medicine.md), [04-fluids.md](04-fluids.md), [18-threats-monsters-and-raids.md](18-threats-monsters-and-raids.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Let the map be a weapon. Own the behavior of traps, the detection side of mechanisms (what steps on a plate, what a lever pull does), the patterns that walls, bridges, floodgates and fortifications make possible, war-animal stations, and the retreat logic behind the hearth alert. 14 owns placement and the state of doors, bridges and floodgates; 16 owns fighting; this system owns triggers and defense-specific rules.

## Concepts

- **Trap**: a building with a `trap:<kind>` tag: `stone_fall`, `spike`, `cage`, `weapon`.
- **Armed / spent / jammed**: trap states.
- **Trigger**: an entity entering a trap or plate tile, or a fluid condition on a plate.
- **Mechanism trigger**: the event this system sends to 14 when a plate condition changes or a lever job completes.
- **Retreat tile**: where a civilian goes on hearth alert.
- **Station**: a chain building or a squad station tile where a war animal waits.

## Rules

### Trap targeting

Every trap has a `mode`: `enemies` (default) or `all`. Under `enemies`, a trap triggers for creatures whose faction is `hostile:*` or `deep`, for `wild` creatures, and for stealthed creatures (which are spotted by the trigger); never for `fortress` or `trader:*` creatures. Under `all` it triggers for anything but the fortress's tame animals. Triggering is evaluated from the batched `EntitiesMoved` event each tick, against the `trapTiles` index; a creature that enters a trap tile by falling or by being pushed also triggers it.

### Trap kinds

| Kind | Materials (14) | On trigger | After |
|---|---|---|---|
| `stone_fall` | 1 mechanism, 1 raw stone | The stone drops: `DamageDealt { blunt, amount: STONE_FALL_DAMAGE × density(stone) / 100 }` to a random part with head weight doubled; the stone becomes an item on the tile | `spent`; `rearm_trap` job (labor `mechanics`, input 1 raw stone) when `autoRearmTraps` |
| `spike` | 1 mechanism, 1–3 spears or spikes, a link | Only when *extended* by a linked lever or plate: each spike attacks every creature on the tile with `pierce` at `TRAP_SKILL` (16 resolution, no dodge for surprised targets; a spike item has no weapon row, so it attacks with 16's unarmed base damage, while installed spears use their weapon row); a lever can extend and retract repeatedly; a plate extends on trigger and retracts on reset | never spent; spikes do not break |
| `cage` | 1 mechanism, 1 empty cage | If `size(creature) ≤ CAGE_MAX_SIZE`: the creature is removed from the map into the cage item (`CreatureCaged`); the cage item stays on the trap tile until hauled; larger creatures trigger nothing and walk over | `spent`; `rearm_trap` with a new empty (unoccupied) cage |
| `weapon` | 1 mechanism, 1–3 weapons | Each weapon attacks the creature as in 16 at `TRAP_SKILL`; with `TRAP_JAM_PERMILLE` × (corpses on the tile + 1) the trap jams | `armed` unless jammed; `clean_trap` job (labor `cleaning`) unjams; corpses stay under ordinary refuse hauling or burial |

`TrapTriggered { trapId, creatureId, kind, outcome }` is emitted for every trigger. A trap tile is walkable; dwarves cross their own traps safely under `enemies`.

Caged creatures: the cage item with an occupant can be hauled to a stockpile accepting `furniture/cage`, placed as a `cage` building (14), sold to a caravan (20 values exotic creatures), tamed (08), or released (`ReleaseCage`: the creature reappears adjacent; hostile creatures resume hostility).

### Pressure plates

Each tick, for each plate: evaluate its trigger condition from the plate's settings (14):

- `creatures { minSize, includeFortress }`: any creature on the tile with `size ≥ minSize` and (faction matches: hostiles, wild, deep, and fortress creatures only if `includeFortress`).
- `water ≥ n` / `magma ≥ n`: the tile's fluid.

A plate with no trigger set uses `creatures { minSize: 0, includeFortress: false }`: hostiles, wild and deep creatures of any size. When the condition changes from false to true, emit `MechanismTriggered { sourceId: plateId, on: true }`; from true to false, `{ on: false }`; both subject to `PLATE_RESET_TICKS` (14) between edges. 14 toggles linked targets. A plate linked to a bridge, a floodgate and a spike trap makes a corridor trap with no dwarf involved.

### Levers

The `pull_lever` job (14) completes here: `MechanismTriggered { sourceId: leverId, on: toggled state }`. 14 applies the change after `LINK_DELAY_TICKS`. The lever panel shows linked targets and their current states.

### Doors, bridges, floodgates as defense

All owned by 14; this system documents the patterns the design guarantees work, and the tests in `04-implementation/acceptance-tests.md` check them:

- **The gate**: a drawbridge over a channel (a moat one tile wide, any depth, or filled with water) linked to a lever inside. Raised: no path. Hostiles loiter and retreat (18).
- **The airlock**: two doors with `lock_on_alert`; civilians retreat behind them.
- **The kill corridor**: a 1-wide corridor lined with fortifications on both sides at the same level, crossbow squads stationed behind them, weapon traps along the floor. Ranged fire through fortifications from adjacent tiles (16).
- **The drowning chamber**: a corridor section with a floodgate on a water channel at one end, a plate or lever, and a drain floodgate at the other. Water at level ≥ `FLUID_DEEP_LEVEL` drowns non-aquatic creatures (17). Trollkin drown; wyrms do not (magma-safe species are not water-safe, but a wyrm's size lets it stand in water up to level 6: `size ≥ WADE_LARGE_SIZE` creatures are not submerged until level 7).
- **The magma chamber**: the same with magma from a channel to a magma pool or the Sea; everything burns except magma-safe species; the corridor must be built of magma-safe materials.
- **The pit**: a drawbridge over a shaft of 3+ levels; retracting it drops whatever stands on it (`Fell` damage, 17) into a room whose only exit is a locked hatch. Fallen hostiles can be shot from fortifications above.
- **The cavern seal**: a wall or a locked door at the breach; trolls break doors, so a wall or a raised bridge is the reliable seal.

### War animals

- A `chain` building (14) with an assigned animal (08 `AssignAnimal { animalId, chainId }`) keeps it within 1 tile; it attacks any hostile within `WAR_ANIMAL_RADIUS` (08). Chained animals spot stealthed creatures at `SPOT_RADIUS_DOG` with line of sight, using the same sight test as 18; the chain adds no ability to see through an obstacle.
- A squad station also accepts assigned war animals (`AssignAnimal { animalId, squadId }`): the animal follows the squad's position.
- On hearth alert, unassigned war animals go to the hearth hall entrance: the first hall tile adjacent to a door, else 08's hall home tile; assigned ones stay at their station.

### Hearth alert retreat

`defense.retreatTile(dwarfId)`:

1. If a `hearth_hall` zone exists and is reachable: the nearest free tile in it.
2. Else the nearest reachable tile that is not `outdoor` and lies behind at least one door on the path from the dwarf's current tile (computed by a bounded BFS that counts door tiles crossed; `RETREAT_SEARCH_LIMIT` tiles).
3. Else the dwarf's bedroom if any.
4. Else stay and flee locally (10 `flee`).

10 calls this on `AlertChanged` to `hearth` and when a retreat target becomes unreachable. A civilian whose hunger, thirst or rest is critical leaves the retreat to serve the need and returns to it afterwards (10 § Behavior selection), so a hall that holds no food or drink does not starve the dwarves it shelters for as long as the fortress stores any. A civilian without a reachable shelter skips retreat while retaining flee precedence. Only those shut-out civilians are watched and rechecked after alert changes, building-state changes or a connectivity rebuild; 10 saves the watched ids. 14 locks `lock_on_alert` doors after all civilians inside their enclosure have passed or after `ALERT_LOCK_GRACE_TICKS`, whichever comes first (the door locks when no fortress creature has been adjacent on the outside for `ALERT_OUTSIDE_CLEAR_TICKS` (20) ticks, or when the grace period ends). A door does not lock on any creature standing in its doorway, a hostile included: the lock waits until the doorway is clear, so a soldier on guard there is never shut on an impassable tile. The grace starts when the `AlertChanged` to `hearth` is handled. A door's outside is the side away from the hearth when the door stands in a straight corridor (so the inner door of an airlock counts its vestibule side as outside even indoors); when no corridor direction toward the hearth can be determined, it is the cardinal neighbour that is `outdoor`. 14 detects each door's lock exactly once per alert, whichever of the two rules caused it: the door's chunks are marked dirty so that connectivity treats it as locked, and `BuildingStateChanged { state: 'locked' }` is emitted. When the alert returns to `calm`, the alert lock clears, the chunks are dirtied again and `BuildingStateChanged { state: 'open' }` is emitted.

### Fortifications and ranged defense

Fortifications are constructions (03, 14) and their firing rules are in 16. This system adds the `overlook` rule reference: a fortification one level above an approach lets ranged soldiers fire down. The hint system mentions both.

## State

- `traps: Map<EntityId, { kind, mode, state: armed | spent | jammed, loaded: EntityId[] }>`, `trapTiles: Map<TileIndex, trapId>`.
- `plates: Map<EntityId, { lastState: boolean, lastEdgeTick }>`.
- `chains: Map<chainId, animalId>`.
- Rng stream (jams).

## Interfaces

### Reader

- `defense.trapAt(i)`, `defense.trapState(id)`, `defense.trapMode(id)`
- `defense.retreatTile(dwarfId)`
- `defense.plateActive(id)`
- `defense.stationOf(animalId)`

### Commands

`SetTrapMode { trapId, mode }`, `PullLever { leverId }` (a built lever; creates the `pull_lever` job). (`ReleaseCage` and `SetDoorMode` are 14's. Lock-on-alert is a flag of `SetDoorMode`, not a command of its own.)

### Events consumed

`EntitiesMoved` (batched, from the movement helper), `FluidsChanged`, `JobCompleted` (rearm, clean, pull_lever), `BuildingCompleted` and `BuildingRemoved` (trap registry), `AlertChanged`, `CreatureDied` (corpses on weapon traps).

### Events emitted

`TrapTriggered`, `TrapSpent { trapId }`, `TrapJammed { trapId }`, `TrapRearmed { trapId }`, `CreatureCaged { creatureId, cageItemId }`, `MechanismTriggered { sourceId, on }`, and two events that other systems own: 16's `DamageDealt` (a stone-fall trap's hit) and 18's `ThiefSpotted` (a chained animal spots a stealthed hostile within `SPOT_RADIUS_DOG`).

### Registrations

Job producer `defense` (`rearm_trap`, `clean_trap`); inspector section `building › trap` (kind, mode, state, loaded items) and `building › plate`; announcements: `TrapTriggered` (note; alert when a creature is caged: "The cage trap has caught a trollkin"), `TrapJammed` (alert), `TrapSpent` (note).

## Player-facing behavior

- Build menu › Traps: the four kinds; placing shows required items and counts available. Mode toggle in the trap panel.
- Plate panel: trigger condition editor; links list.
- Hints: "A drawbridge over a channel is the surest gate", "Cage traps catch anything smaller than a wyrm", "Trollkin break doors; walls and bridges hold".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `STONE_FALL_DAMAGE` | 40 | Base, scaled by stone density |
| `TRAP_SKILL` | 5 | Effective skill for trap weapons |
| `TRAP_JAM_PERMILLE` | 50 | Per trigger, times corpses + 1 |
| `CAGE_MAX_SIZE` | 150 | |
| `WADE_LARGE_SIZE` | 180 | Creatures this large drown only at level 7 |
| `RETREAT_SEARCH_LIMIT` | 3000 | Tiles |
| `ALERT_LOCK_GRACE_TICKS` | 400 | |
| `ALERT_OUTSIDE_CLEAR_TICKS` | 20 | Ticks without a fortress creature outside a `lock_on_alert` door before it locks |

## Extension points

- New trap kinds: a row with a tag and a case in the trigger switch.
- Timed mechanisms and repeaters: a `timer` building emitting `MechanismTriggered` on a schedule.
- Alarm bells: a building that sets the alert when a plate triggers.
