# Module Interfaces

**Owner:** architecture · **Depends on:** [architecture-overview.md](architecture-overview.md), [simulation-core.md](simulation-core.md), [data-model.md](data-model.md)

## The system contract, in full

```
interface GameSystem<S = unknown> {
  readonly id: SystemId
  readonly order: number
  readonly cadence: number
  readonly phase: number
  readonly subscribes: readonly EventType[]
  readonly ownsCommands: readonly CommandType[]

  init(ctx: InitContext): void
  tick(ctx: TickContext): void
  handle(event: GameEvent, ctx: TickContext): void
  applyCommand(cmd: Command, ctx: TickContext): CommandResult
  reader(): unknown            // each system narrows this to its own Reader type
  serialize(): S
  deserialize(state: S, ctx: InitContext): void
}

interface InitContext {
  loading?: boolean           // true during saved-world bootstrap; absent or false otherwise
  world: World                 // map, entities, calendar, fortress state
  registry: Registry
  rng: RngStream               // this system's stream
  readers: ReaderSet           // every system's reader, plus core readers (map, entities, calendar, pathing, spatial)
  register: RegistrationApi    // see below
}

interface TickContext extends InitContext {
  tick: number
  emit(event: GameEvent): void
  terrain: TerrainApi          // sanctioned tile mutation (see data-model.md)
  jobs: JobsApi                // create / cancel jobs (see 11)
  spawn: SpawnApi              // create creatures and items with all required components
}

type CommandResult = { ok: true } | { ok: false; reason: RejectReason }
```

`ReaderSet` is typed: `readers.fluids.levelAt(i)`, `readers.items.countOf(typeId)`. Readers are constructed at `init` and stable for the life of the world. Timing uses a `Clock` (`() => number`) injected by the platform, because `core` may not read `performance`.

To decouple systems from concrete `World` dependencies and prevent cyclic imports, `WorldLike` exposes `map`, `entities`, `fortress`, `calendar` (`tick` and `isDaylight`), `emit`, `rngFor`, and `services`. `ReaderSetLike` structurally types the core readers. The world holds mutation services in `world.services: CoreServices` (`{ terrain, jobs, spawn, movement, items, spatial, combat }`), which every tick context reads. A bare `World` initializes with default M0 implementations so isolated unit tests stand; owning systems and the simulation host replace them at `init`:
- 03 installs the live `TerrainApi` (providing grids, entity store access, and `emit` for terrain collapse and breach events called during other systems' ticks).
- 11 installs the live `JobsApi`, including `workerDied(id, deathTile)` for death consumers to release the worker before its entity is removed. The board owns worker-field cleanup and uses 13's item API for drops.
- The simulation host installs the `SpawnApi` and the `MovementApi` helper.
- 13 installs `ItemsApi` (and registers its item creator into `spawn`).
- The simulation host installs the spatial writer and combat APIs.

`HeadlessGame` registers the full standard system suite unless a test scenario supplies an explicit replacement set.

`World.init({ loading: true })` supplies the loading flag only to initialization. Systems still install their readers, services and registrations, but do not create initial populations or their map side effects. `HeadlessGame` passes its loading option through and skips embark arrival; saved entities and system state are restored afterwards. Tick, command and event contexts do not retain the flag, and it is not saved.

## Reader conventions

- A reader is an object of pure query functions. It never mutates and never returns mutable internals; arrays returned are either frozen views or fresh copies, as documented per method.
- Reader methods are cheap by default. A method that does real work (a search, a flood fill) is named `find*` or `compute*` and documents its cost.
- Readers return ids, not objects, when referring to entities; the caller reads components through `readers.entities`.
- Readers may be called from `init` to cache references but not to read state; from `tick`, `handle`, `applyCommand`; and from presentation at any time between ticks.

Core readers:

- `readers.map`: `kindAt(i)`, `materialAt(i)`, `flagsAt(i)`, `designationAt(i)`, `fluidAt(i)`, `isWalkable(i, movementClass)`, `isOutdoor(i)`, `neighbors(i)`, `columnSurfaceZ(x, y)`, `chunkOf(i)`.
- `readers.entities`: `get`, `has`, `alive`, `each`, `with`, `at(i)` (entities with `Position` on tile i, from the spatial index).
- `readers.calendar`: the `Calendar` fields.
- `readers.pathing`: `reachable(from, to, movementClass)`, `edges(i, movementClass, mover?)` (a fresh list of legal next steps and costs), `requestPath(...)` (see 22).
- `readers.spatial`: `inRadius(i, r, kind?)`, `inBox(...)`, `nearest(i, predicate, maxRadius)`.
- `readers.fortress`: the fortress-level state.

## Registration APIs

Registration lets a system plug into another system's extensible tables at `init`, so the target system never needs editing when a new system or feature is added.

```
interface RegistrationApi {
  jobProducer(producer: JobProducer): void           // 11 pulls jobs from producers each tick
  recipeSet(set: RecipeSet): void                    // 12 merges recipes (content tables are the default set)
  thoughtSource(source: ThoughtSource): void         // 15 asks sources for thought triggers on events
  overlay(overlay: OverlaySpec): void                // 23 renders overlays; 24 lists them in the overlay menu
  panel(panel: PanelSpec): void                      // 24 adds a panel with a hotkey
  inspector(kind: EntityKindOrTile, section: InspectorSection): void   // 24 adds a section to inspection
  milestone(milestone: MilestoneSpec): void          // fortress legend milestones
  announcement(type: EventType, spec: AnnouncementSpec): void          // 24 maps events to log lines and severities
}
```

Registration is a static declaration of intent, so the order in which systems `init` does not matter; the target systems read their registries lazily on first `tick`.

### AnnouncementSpec

```
interface AnnouncementSpec {
  severity: 'note' | 'alert' | 'danger'
  stringKey: string
  once?: boolean
  atLeast?: { field: string; value: number }
  atMost?: { field: string; value: number }
  oneOf?: { field: string; values: readonly (string | number)[] }
  keyField?: string
  category?: string
}
```

Multiple specs may register for one event, without replacing earlier specs.
Numeric bounds require a numeric field; allowed values require an exact match.
The UI selects the first matching spec, then resolves its string key (with
`.fieldValue` when `keyField` is set), severity and category. With no match it
does not log a line. A `once` spec records the event type only after a match;
already-seen types stay suppressed when restored.

### JobProducer

```
interface JobProducer {
  id: string
  produce(ctx: TickContext, sink: JobSink): void     // called by 11 every tick; produce jobs that do not yet exist
  onJobEvent?(event: JobEvent): void                 // claimed, completed, cancelled, blocked
}
```

Producers are responsible for idempotence: they check with `sink.exists(key)` before creating. Job keys are strings like `dig:${tileIndex}` or `craft:${workshopId}:${orderIndex}`.

### ThoughtSource

```
interface ThoughtSource {
  on: EventType[]
  trigger(event: GameEvent, ctx: TickContext): ThoughtTrigger[]    // [{ dwarfId, thoughtId, magnitude? }]
}
```

Most thoughts come from the content table's `trigger` column (an event type plus a field match), so systems rarely need a custom source; the API exists for thoughts that need computation (for example "saw a friend die", which needs relationships).

## Commands

Every command type has one owning system. The core routes by the command table. A system's `applyCommand` returns a rejection with a `RejectReason` from a fixed enumeration (listed in `04-implementation/command-catalog.md`) that the UI maps to a message.

Command ownership by system (the full list is `04-implementation/command-catalog.md`):

| System | Commands |
|---|---|
| 03 terrain | `Designate`, `UndoDesignation`, `SetDesignationPriority`, `SetTraffic`, `DesignateStairwell`, `ConfirmDeepsilver` |
| 07 plants | `SetPlotCrop`, `DesignateHarvest` |
| 08 animals | `AssignPasture`, `MarkSlaughter`, `UnmarkSlaughter`, `TrainAnimal`, `TameCaged`, `AssignAnimal`, `SetBreedingCap`, `ReleaseCaged`, `NameAnimal` |
| 09 foraging | `SetHuntable` (gather and fishing zones are 14's `CreateZone`) |
| 10 dwarves | `AssignTitle`, `RenameDwarf`, `SetSchedule` |
| 11 jobs | `SetLabor`, `SetLaborPriority`, `CancelJob`, `SetJobPriority`, `SetStandingOrder` |
| 12 workshops | `AddWorkOrder`, `EditWorkOrder`, `RemoveWorkOrder`, `ReorderWorkOrder`, `SetWorkshopWorker`, `SuspendWorkshop` |
| 13 items | `ForbidItem`, `ClaimItem`, `DumpItem`, `MeltItem`, `SetStockpileFilter`, `SetStockpileContainers`, `SetStockpilePriority`, `LinkStockpile` |
| 14 buildings | `PlaceBuilding`, `CancelBuilding`, `DeconstructBuilding`, `SetBuildingPriority`, `CreateZone`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`, `AssignRoom`, `LinkMechanism`, `UnlinkMechanism`, `SetDoorMode`, `SetHatchMode`, `SetPlateTrigger`, `ReleaseCage`, `AssignCoffin` |
| 15 morale | none |
| 16 combat | `CreateSquad`, `DisbandSquad`, `RenameSquad`, `SetSquadMembers`, `SetSquadLeader`, `SetSquadMode`, `SetSquadEquipment`, `SetSquadStation`, `SetSquadPatrol`, `SquadOrder` (kill, station, patrol, follow, cancel), `SetAlert` |
| 17 health | `SetHospitalSupplies` (stored as a zone setting) |
| 18 threats | none |
| 19 defense | `PullLever`, `SetTrapMode` |
| 20 trade | `MoveToDepot`, `RemoveFromDepot`, `TradeOpen`, `TradeOffer`, `TradeCancel`, `SetRequests` |
| 21 immigration | `SetPopulationCap` |
| core | `RenameFortress` |
| app | `Save`, `Load`, `RetireFortress`, `SetSpeed`, `SetSetting` and the embark-session commands of 02 (not simulation commands; handled by the app) |

## Events

Every event has one or more emitters and any number of subscribers. The full catalog is in `04-implementation/event-catalog.md`. Conventions:

- Past tense: `TileChanged`, `JobCompleted`, `CreatureDied`.
- Fields are ids and plain values. A consumer verifies `alive(id)` before reading.
- Batched events end in the plural of the payload: `TilesChanged { indices: TileIndex[] }`, `StocksChanged { types: number[] }`, `FluidsChanged { chunks: number[] }`.

## The movement helper

Movement is not a system; it is a core helper (`MovementApi`) installed by the host in `world.services.movement` that three brains (10, 08, 18/20) call each tick for each creature they own:

```typescript
interface MovementApi {
  moveAlongPath(id: EntityId, ctx: { readonly tick: number; emit(event: GameEvent): void }): MoveResult
  teleport(id: EntityId, to: TileIndex): boolean
  fall(id: EntityId, ctx: { readonly tick: number; emit(event: GameEvent): void }): FallResult
  follow(id: EntityId, pathId: number): void       // point mover at a finished path request from first step
  clearPath(id: EntityId): void                    // drop the mover's path
  setSpeed(id: EntityId, speed: number): void      // write Motion.speed (documented as pathing.setSpeed)
  tileOf(id: EntityId): TileIndex                  // tile the entity stands on, or -1
  walkTo(id: EntityId, target: TileIndex, urgency: Urgency, ctx): WalkResult  // request, follow, re-request
  stopWalking(id: EntityId): void                  // cancel walk and drop path
  walkTarget(id: EntityId): TileIndex              // target of current walk, or -1
  crowdPercentAt(tile: TileIndex, joining?: number): number  // 22 § Crowding: the percent of its time anything on the tile takes
}
```

`moveAlongPath` advances `Motion.progressFixed` by speed, steps `Position` when a tile is crossed, and returns `arrived`, `moving`, `blocked` (tile became impassable), or `fell`. Speed is `Fixed` tiles per tick from the creature's species speed, attribute and wound modifiers (17), and terrain cost (22). Falling: a creature on an `open` tile falls to the next solid-bottomed tile below and takes fall damage through 17 by z-levels fallen.

## The spawn API

`ctx.spawn.creature(species, at, faction, overrides?)` and `ctx.spawn.item(type, material, at | containerId, count?, quality?)` create entities with every component the data model requires for that kind. This keeps component invariants in one place. Systems that create creatures (10, 08, 18, 20, 21) and items (03, 07, 09, 12, 13, 20, 02) use only these.

Invariants enforced by `spawn.creature`:
- Every creature receives `Kind`, `Creature`, `Motion` (species base speed and movement class), `Body`, and `Position` placed through the movement helper (so the spatial index and current tick movement batch register it).
- Age defaults to `0` if not specified in `overrides.ageTicks`.
- Body parts start at full hit points with no initial wounds: `maxHp = Math.floor((size * hpFactor) / 1000)` per part. Blood and `maxBlood` are initialized to size capacity (`BLOOD_PER_SIZE = 10`), remaining unread by systems prior to health system activation (17).
- A `wild` creature receives 08's `Wild` component initialized to the home chunk of its spawn tile.
- Dwarves: the creator (02 embark, 21 immigration, or test helper) provides 10's eight dwarf components (`Attributes`, `Skills`, `Needs`, `Personality`, `Schedule`, `Relationships`, `Title`, `Brain`) via `overrides.dwarf`. The spawn API automatically attaches 11's `Labors` (all enabled, or restricted to `hauling` for children) and `Worker` component. The complete M1 dwarf set comprises `Position`, `Motion`, `Creature`, `Body`, 10's eight components, and 11's two components; subsequent systems (15 `Mood`, 16 `Equipment`) attach theirs during their respective tasks.

`spawn.item` records `{ type, material, at, count, quality, tick }` and returns entity id `0` in stubbed mode (e.g. 03 terrain digging drops through it). Once system 13 initializes, it registers its concrete item creator via `spawn.setItemCreator(creator)`.

## Presentation contracts

### View model

Presentation builds a `ViewModel` per frame from readers:

```
interface ViewModel {
  cells: CellBuffer               // cols × rows of { glyph, fg, bg } for the map viewport
  status: StatusLine              // date, weather, population, hall spirit, food, drink, z, speed, alert
  sidebar: PanelRender | null
  log: LogLine[]                  // last N announcements with severity
  cursor: CursorState | null
}
```

The compositor (23) fills `cells` from `readers.map`, `readers.entities`, `readers.spatial`, the active overlays and the current viewport. It knows the render rules, not the simulation rules.

### Panels

```
interface PanelSpec {
  id: string; title: string; hotkey: Key
  render(readers, uiState): Widget          // immediate-mode widget tree
  onAction?(action: UiAction, submit: (cmd: Command) => void): void
}
```

### Announcements

The announcement specification remains pure data so that core simulation systems never import presentation modules:

```typescript
interface AnnouncementSpec {
  readonly severity: 'note' | 'alert' | 'danger'
  readonly stringKey: string
  readonly once?: boolean
  readonly oneOf?: { readonly field: string; readonly values: readonly (string | number)[] }
  readonly keyField?: string
}
```

Presentation (24) maps `stringKey` against `strings.json`, filling placeholders (`{dwarf}`, `{material}`, etc.) from the event's payload and reader data (e.g., resolving `finderId` or `minerId` to dwarf names and material indices to material names). The view focus is derived automatically from the event's `tile` or first `tiles` entry. When `once: true`, only the first occurrence of the event generates an announcement (e.g. 03's `DeepsilverMined`).

`oneOf` limits an announcement to events whose named field matches one of its values. `keyField` appends that event field's value to `stringKey`, separated by a dot, for weather-state and season-specific text. Weather changes announce only storm, snow, heatwave and cold snap; season lines use the season index.

## Interface stability

- Readers and registration APIs are the public surface of a system. Changing one is a design change recorded in the system's document.
- `state.ts` of a system is private. No other module imports it; the ESLint boundary rule enforces this.
- Events and commands are the public surface of the whole simulation. Adding is free; removing or renaming requires a save migration if the command log format changes.
