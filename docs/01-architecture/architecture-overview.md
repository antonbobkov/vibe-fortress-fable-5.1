# Architecture Overview

**Owner:** architecture · **Depends on:** [`../00-vision/vision.md`](../00-vision/vision.md), [constants.md](constants.md), [tech-stack.md](tech-stack.md)

## Goals

1. **Modularity.** Each game system is a package with a public contract. A system can be rewritten without touching any other, and a new system can be added by registering it.
2. **Determinism.** The same world seed and the same sequence of commands produce the same world, tick for tick, on any machine. This makes replays, regression tests and headless simulation possible.
3. **Data over code.** Content is tables. Systems are rules. No system contains a special case for a specific piece of content.
4. **Performance at scale.** About 450,000 tiles, hundreds of creatures and tens of thousands of items at 20 to 80 ticks per second in a browser tab.
5. **Testability.** The simulation has no dependency on the DOM, the canvas, timers or storage. It runs headless.

## Layers

```
┌────────────────────────────────────────────────────────────────┐
│ L5  App           bootstrap · screen flow · save manager ·      │
│                   world-gen flow · headless runner              │
├────────────────────────────────────────────────────────────────┤
│ L4  Presentation  view models · compositor · renderer ·         │
│                   ui screens & panels · widgets · keymap        │
├────────────────────────────────────────────────────────────────┤
│ L3  Systems       01 worldgen … 21 immigration                  │
│                   (each a package with the system contract)     │
├────────────────────────────────────────────────────────────────┤
│ L2  Content       data tables loaded into the registry          │
├────────────────────────────────────────────────────────────────┤
│ L1  Core          world · map3d · entities · registry ·          │
│                   scheduler · events · commands · rng · calendar │
│                   spatial index · pathfinding · serialization    │
├────────────────────────────────────────────────────────────────┤
│ L0  Platform      canvas · keyboard & mouse · storage ·          │
│                   real-time clock · compression · worker bridge  │
└────────────────────────────────────────────────────────────────┘
```

**Dependency rule.** A module imports only from its own layer or layers below. L1 through L3 never import from L0 except through the small `platform` interfaces injected at startup (for example the storage adapter). L3 never imports from L4 or L5. L4 reads L3 through readers and writes to L3 only through commands.

**Within L3.** A system owns its state and is the only writer of it. Any system may call any other system's *reader*. A system changes another system's state only by emitting an event that the owner handles. Shared state that belongs to no single system (the map, the entity store, the clock) lives in L1 and may be written by any system according to rules stated in the data model.

## Module map

This is the folder layout the implementation follows. Each folder is a package with an `index.ts` that exports its public surface and nothing else.

```
src/
  platform/    canvas.ts  input.ts  storage.ts  realtime.ts  compress.ts  worker-bridge.ts
  core/        world.ts  map3d.ts  entities.ts  components.ts  registry.ts  scheduler.ts
               events.ts  commands.ts  rng.ts  calendar.ts  spatial.ts  pathfinding.ts
               connectivity.ts  serialize.ts  ids.ts  fixed.ts (fixed-point math)
  content/     materials.json  minerals.json  items.json  weapons-armor.json  creatures.json
               plants.json  skills.json  jobs.json  buildings.json  recipes.json  regions.json
               thoughts.json  names.json  glyphs.json  schema.ts  loader.ts
  systems/     worldgen/  embark/  terrain/  fluids/  materials/  weather/  plants/  animals/
               foraging/  dwarves/  jobs/  workshops/  items/  buildings/  morale/  combat/
               health/  threats/  defense/  trade/  immigration/
               (each: index.ts  state.ts  reader.ts  events.ts  commands.ts  rules/  tick.ts)
  render/      atlas.ts  palette.ts  compositor.ts  renderer.ts  overlays/
  ui/          screens/  panels/  widgets/  keymap.ts  mouse.ts  viewmodel/  strings/
  app/         main.ts  game.ts  save-manager.ts  worldgen-flow.ts  headless.ts  sim-host.ts
```

## The system contract

Every L3 system implements the same interface. The scheduler calls it; nothing else does.

```
interface GameSystem<State> {
  readonly id: SystemId              // 'fluids', 'jobs', ...
  readonly order: number             // position in the fixed tick order (see 02-systems/README.md)
  readonly cadence: number           // run tick() every `cadence` ticks
  readonly phase: number             // offset within the cadence, spreads load across ticks
  readonly subscribes: EventType[]   // events delivered to handle()

  init(ctx: InitContext): void       // world, registry, rng stream, readers of other systems
  tick(ctx: TickContext): void       // mutate own state and core state; emit events; never call UI
  handle(event: GameEvent, ctx: TickContext): void   // react to subscribed events
  applyCommand(cmd: Command, ctx: TickContext): CommandResult   // only commands this system owns
  reader(): Reader                   // read-only API used by other systems and the UI
  serialize(): State                 // plain data; typed arrays allowed
  deserialize(state: State, ctx: InitContext): void
}
```

Rules that follow from the contract:

- A system never holds a reference to a renderer, a screen, or the DOM.
- A system never calls another system's `tick`, `handle` or `applyCommand`.
- A system's reader returns values or read-only views, never mutable internals.
- Everything a system needs from randomness comes from its own `rng` stream in the context.
- A system may register *jobs producers* with 11 Jobs, *recipes* with 12 Workshops, *thought sources* with 15 Morale, and *overlays* with the renderer, through registration APIs, so that adding a system never edits those systems.

## Data flow

```
 keyboard/mouse ─▶ ui (keymap, panels) ─▶ Command ─▶ CommandQueue
                                                          │ start of tick: validate + apply
                                                          ▼
                      ┌────────── World (map3d, entities, clock) ◀──── systems tick in order
                      │                                                    │ emit
                      │                                              EventQueue
                      │                                                    │ end of tick: dispatch FIFO
                      ▼                                                    ▼
                  readers ◀──────────────────────────── systems handle() / ui log
                      │
                      ▼
               view model (per frame) ─▶ compositor ─▶ renderer ─▶ canvas
```

- The UI never mutates the world. It creates commands.
- Systems never talk to the UI. They emit events; the UI's announcement log subscribes to them.
- The renderer never reads systems directly. It draws a view model assembled from readers.

## The tick

The simulation core advances in fixed steps. One tick:

1. **Apply commands.** Every queued command is validated by its owning system and applied, in queue order. Invalid commands produce a `CommandRejected` event with a reason string for the UI.
2. **Tick systems.** For each system in the fixed order, if `(tick − phase) mod cadence == 0`, call `tick()`.
3. **Dispatch events.** Events queued during steps 1–2 are delivered FIFO to subscribers in system order, then to presentation subscribers. Events emitted during dispatch are queued for the next tick.
4. **Advance the calendar.** Increment the tick counter; emit `HourPassed`, `DayPassed`, `SeasonChanged`, `YearPassed` as the boundaries are crossed. These are dispatched at the next tick's step 3.

The fixed order and each system's cadence are in [`../02-systems/README.md`](../02-systems/README.md). The precise algorithm, including how the frame loop calls ticks and what happens when the browser falls behind, is in `simulation-core.md` (Wave 2).

## Core concepts

**World.** The aggregate root. Owns `Map3D`, `EntityStore`, `Calendar`, the `Rng` streams, the `EventQueue`, the `CommandQueue`, and the registered systems. Serializable in full. There is exactly one `World` per game.

**Map3D.** Dense typed arrays indexed by `(z × H + y) × W + x`. Per tile: `kind` (Uint8: wall, floor, open, ramp, stairs variants, fortification, tree, sapling), `material` (Uint16 registry index), `fluid` (Uint8: 3 bits level, 1 bit type, 4 bits flags), `designation` (Uint8), `flags` (Uint16: discovered, constructed, smoothed, engraved, mud, snow, burning, vegetation, light, and reserved bits), `temperatureOverride` (Int8, used only by hot and cold sources). Per chunk: dirty flags for rendering, pathfinding and connectivity. No objects per tile. Total about 8 bytes per tile.

**Entities and components.** Everything that is not a tile is an entity: creatures, items, buildings, zones, stockpiles, squads, caravans, projectiles. An entity is a 32-bit id (24-bit index, 8-bit generation) with a set of components. Components are plain records stored in per-component tables; hot components (`Position`, `Motion`) are structure-of-arrays. Systems own component *types* and declare them in the data model; any system may read any component, and writes follow the ownership table in `data-model.md` (Wave 2).

**Registry.** All content tables loaded at startup into typed arrays indexed by a dense integer, with `id ↔ index` maps. Saves store string ids, never indices. The registry is immutable after load.

**Events.** Typed records with a `type` tag. Queued, never delivered synchronously, never return values. The full catalog is in Wave 4; each system document lists what it emits and consumes.

**Commands.** Typed records of player intent (`Designate`, `PlaceBuilding`, `SetLabor`, `SetJobPriority`, `PullLever`, `TradeOffer`). The only way the UI changes the world. Validated, applied at the start of a tick, and appended to a command log that is part of the save (last season only) for debugging and replay.

**Rng.** Every system gets its own stream seeded from the world seed and the system id (`xoshiro128**`). Adding a random call in one system never perturbs another. World generation uses its own streams per stage.

**Calendar.** Tick counter with derived hour, day, season, year and daylight flag.

**Spatial index.** Per-chunk buckets of entity ids with a `Position`. Supports queries by radius, box and z-level.

**Pathfinding.** A* over `Map3D` movement flags with a per-tick request budget, path caching for repeated routes, and connectivity labels (flood-filled regions per movement class) so that unreachable jobs are rejected in constant time.

## Determinism rules

- No `Math.random`, `Date.now`, `performance.now` or floating-point transcendental functions inside L1–L3. Integer math throughout; fixed-point with a scale of 1000 where fractions are needed (`fixed.ts`).
- Iterate entities in ascending id order, tiles in `(z, y, x)` order, and any collection with a defined order. No iteration over `Map` or `Set` insertion order for anything that affects state; use sorted arrays.
- Commands and events are FIFO.
- `serialize` then `deserialize` produces a world whose next 10,000 ticks are identical to the original's. This is a test.

## Presentation architecture

- **View model.** Each frame the UI asks readers for what is visible: the slice of the map in view, the entities on it, overlays, status values, and the active panel's data. The renderer knows nothing about the simulation.
- **Compositor.** For each screen cell, a priority order chooses what to draw: cursor and selection > designation and zone overlays > creatures > items > buildings > fluids > terrain, with dimming for levels below the slice and a distinct style for undiscovered tiles.
- **Renderer.** A `Canvas 2D` context drawing from a pre-rendered glyph atlas; full redraw each frame at up to `TARGET_FPS`; interpolation is not used because the map is discrete.
- **UI.** A screen stack (main menu, world gen, world map, embark, fortress, legend) and, within the fortress screen, a panel registry. Panels are keyboard-first, mouse-equal, and drawn as text into the same cell grid with a small immediate-mode widget set (list, table, menu, toggle, number field, text field, button, tabs).
- **Input.** Raw key and mouse events pass through the keymap into UI actions. The keymap is a data table. Mouse and keyboard produce the same actions.

## Persistence

- A save is: header (version, seed, fortress name, date) + registry manifest (content ids and content hash, so loading with changed content is detected) + `Map3D` arrays (compressed) + entity tables + each system's `serialize()` output + the last season's command log.
- Autosave at every season change; the last four seasonal snapshots are kept; manual saves are unlimited. Storage is IndexedDB with file export and import.
- Versioned with forward migrations only.

## Performance strategy

- **Fluids** keep an active set; a tile is asleep until a neighbor changes; water runs every `FLUID_TICK_CADENCE_WATER` ticks and magma every `FLUID_TICK_CADENCE_MAGMA`.
- **Pathfinding** has a per-tick budget; connectivity is checked before A*; frequent routes are cached and invalidated by chunk dirty flags.
- **Jobs** keep an incremental board; each idle worker scores a bounded set of candidates; hauling batches items to the same destination.
- **Rendering** draws only the visible slice from the atlas.
- **Memory**: roughly 8 bytes per tile, about 3.5 MB of grids at standard size.

The numeric budget per system is in `performance-budget.md` (Wave 2).

## Extension points

- **New content**: add rows to a table. No code.
- **New system**: implement the contract, add it to the order table, subscribe to events, expose a reader. No other system changes.
- **New job type, recipe, thought or overlay**: register through the owning system's registration API at `init`.
- **New command or event**: add to the catalog; only the systems that care implement handlers.
- **New UI panel**: register with the panel registry and a hotkey.
- **Worker migration**: `SimulationHost` (start, stop, step, submitCommand, snapshot) is implemented in-process first. A worker implementation is a drop-in.

## Testing strategy

- **Headless runner** in `app/headless.ts`: world + systems, no platform, driven by a scenario (seed, commands with tick stamps, assertions).
- **Golden determinism test**: two runs of 10,000 ticks from the same seed and command log produce identical world hashes; a save/load in the middle produces the same hash.
- **Per-system rule tests**: rules are pure functions in `rules/` and are tested in isolation.
- **Acceptance tests** (Wave 4) map each system's acceptance criteria to scenarios.
