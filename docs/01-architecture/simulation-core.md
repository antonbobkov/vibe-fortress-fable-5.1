# Simulation Core

**Owner:** architecture (`core/`) · **Depends on:** [architecture-overview.md](architecture-overview.md), [constants.md](constants.md), [data-model.md](data-model.md), [module-interfaces.md](module-interfaces.md)

## Purpose

The simulation core is the machinery that runs the game: the frame loop, the tick, the scheduler, the command and event queues, the random number streams, the calendar and the fixed-point math. It has no game rules of its own. Every game rule lives in a system; the core only decides *when* each system runs and *how* information moves between them.

## The simulation host

The presentation layer never touches `World` directly. It talks to a `SimulationHost`:

```
interface SimulationHost {
  newGame(spec: NewGameSpec): Promise<void>     // world seed, region, embark result
  load(save: SaveBlob): Promise<void>
  save(): Promise<SaveBlob>
  setSpeed(speed: 0 | 1 | 2 | 4): void           // 0 = paused
  speed(): 0 | 1 | 2 | 4
  submit(command: Command): void                 // next tick's command phase; immediate while paused
  step(ticks: number): void                      // synchronous; used by headless tests and by the frame loop
  readers: ReaderSet                             // read-only access to every system's reader and to core readers
  onEvents(listener: (events: readonly GameEvent[]) => void): Unsubscribe
  stats(): HostStats                             // actual ticks per second, last tick duration, per-system timings
}
```

`InProcessHost` implements this in version 1. `readers` are the systems' readers themselves. A future `WorkerHost` would implement the same interface with a snapshot protocol behind `readers`; nothing in presentation would change except the latency of reads.

## The frame loop

The app owns one `requestAnimationFrame` loop:

```
onFrame(nowMs):
  if document.hidden: accumulatorMs = 0; lastFrameMs = nowMs; render(); return
  if speed == 0: accumulatorMs = 0; lastFrameMs = nowMs; render(); return
  tickIntervalMs = 1000 / (SIM_TICKS_PER_SECOND × speed)
  accumulatorMs += min(nowMs − lastFrameMs, 250)     // cap: a long stall does not cause a burst
  ticksThisFrame = 0
  while accumulatorMs ≥ tickIntervalMs and ticksThisFrame < MAX_TICKS_PER_FRAME:
    host.step(1)
    accumulatorMs −= tickIntervalMs
    ticksThisFrame += 1
  if ticksThisFrame == MAX_TICKS_PER_FRAME: accumulatorMs = 0     // fell behind: run slower, never skip
  render()
  lastFrameMs = nowMs
```

The status bar shows actual ticks per second from `host.stats()`. When the actual rate is below 80% of the requested rate for more than two seconds, the status bar shows the speed indicator in yellow.

## The tick

`World.step()` is the whole simulation tick. It is synchronous and deterministic.

```
step():
  tick = calendar.tick
  // 1. Commands
  for cmd in commandQueue.drain():                     // FIFO
    system = systems.byId(cmd.owner)                   // owner is part of the command type table
    result = system.applyCommand(cmd, ctx)
    commandLog.append(tick, cmd, result)
    if result.rejected: eventQueue.emit(CommandRejected{ cmd, reason: result.reason })
  // 2. Systems
  for system in systems.inOrder():                     // fixed order from 02-systems/README.md
    if (tick − system.phase) mod system.cadence == 0:
      timer.start(system.id)
      system.tick(ctx)
      timer.stop(system.id)
  // 3. Events
  batch = eventQueue.drain()                           // events emitted in steps 1–2, FIFO
  for event in batch:
    for system in systems.subscribedTo(event.type):    // in system order
      system.handle(event, ctx)
    presentationListeners.deliver(event)               // log, announcements, UI refresh hints
  // events emitted during step 3 stay in the queue for the next tick
  // 4. Calendar
  calendar.advance()                                   // increments tick; emits HourPassed / DayPassed / SeasonChanged / YearPassed
```

The `ctx: TickContext` passed to every call is described in `module-interfaces.md`. It gives a system its rng stream, the world, the registry, the readers, and the emit function.

### Why events are not delivered synchronously

A system that emits an event during its tick has not finished mutating its state. Delivering the event immediately would let a handler read half-updated state and would make the outcome depend on emission order inside the tick. Deferring all events to step 3 means every handler sees the state at the end of the tick, and the order of delivery is the order of emission, which is fixed by the system order.

The cost is one tick of latency for every reaction. At `SIM_TICKS_PER_SECOND` this is 50 ms of game time and invisible to the player.

## The scheduler

The scheduler holds the systems in their fixed order with their cadence and phase. Phases spread the periodic systems across different ticks so that no single tick carries all of them.

| # | System | Cadence | Phase | Notes |
|---|---|---|---|---|
| 03 | terrain | 1 | 0 | Applies designation changes and construction results every tick |
| 04 | fluids | 2 | 0 | Water; magma is processed on every second fluids tick (`FLUID_TICK_CADENCE_MAGMA`) |
| 05 | materials | 10 | 3 | Fire, freeze and thaw checks |
| 06 | weather | 50 | 7 | Once per game hour |
| 07 | plants | 50 | 11 | Once per game hour; growth is accumulated per hour |
| 08 | animals | 1 | 0 | Behavior and movement |
| 09 | foraging | 10 | 5 | Target selection; fish pool regeneration hooks |
| 10 | dwarves | 1 | 0 | Behavior, movement, needs |
| 11 | jobs | 1 | 0 | Assignment and job state machines |
| 12 | workshops | 1 | 0 | Work timers |
| 13 | items | 10 | 1 | Decay, stock counts, stockpile refresh |
| 14 | buildings | 10 | 9 | Room detection, ownership refresh |
| 15 | morale | 50 | 23 | Thought decay, mood recompute |
| 16 | combat | 1 | 0 | Attacks, projectiles |
| 17 | health | 5 | 2 | Bleeding, healing, infection |
| 18 | threats | 50 | 31 | Schedule checks; hostile party AI runs every tick through 16 and the movement helper |
| 19 | defense | 1 | 0 | Traps and mechanisms |
| 20 | trade | 50 | 41 | Caravan schedule; caravan movement runs every tick through the movement helper |
| 21 | immigration | 1200 | 600 | Once per game day |

Systems 01 and 02 do not tick; they run on demand from the app's screen flow.

`cadence` and `phase` are constants on each system. Changing them is a design change, not a tuning knob, because systems that run at a cadence accumulate their per-tick effects (a plant grows by `cadence` ticks' worth each run).

## Commands

A command is a plain record with a `type` and typed fields. The command table in `04-implementation/command-catalog.md` names an owning system for every type. The core does not validate commands; the owning system does, in `applyCommand`, returning either `{ ok: true, events? }` or `{ ok: false, reason: ReasonCode }`.

Rules:

- Commands are applied at the start of a tick, in submission order, before any system ticks. Each handler validates field types before using them. The command phase catches any throw from `applyCommand`, logs the command as rejected with `precondition_failed`, emits `CommandRejected` and continues the remaining queue; the tick still advances.
- While paused, the host runs that same command phase immediately on submission. The phase uses `calendar.tick`, the number of the next tick to run, for command contexts and log entries. It does not run systems, connectivity, event handlers or the calendar. Already applied commands are removed from the queue and are not applied again on resuming.
- Rejected paused commands are delivered immediately to presentation listeners, once, so the status row and alert log update at once. `CommandRejected` has no simulation subscribers. Other events emitted by commands remain queued for the normal tick dispatch and are saved with the pending queues. Presentation callbacks remain read-only; commands they submit wait until their event batch finishes and the next command phase runs.
- A recorded paused command replays in the command phase of its stamped tick. With no system running between paused submissions and that tick, replay with or without pauses reaches the same world hash. A save taken while paused preserves the applied state, command log and pending events; loading it does not apply those commands again.
- If a paused command dirties connectivity, its current labels remain in use until the normal connectivity pass. Saving preserves that pending boundary; loading must not refresh those queries before the first resumed system tick.
- Validation runs before mutation, and a rejected command changes nothing except the catalogued `UndoDesignation` case: it clears designations without progress, retains those with progress, and reports `has_progress` when any are retained.
- The command log keeps every command of the current season with its tick and result. The world clears its log in step 5 of the tick whose calendar advance enters a new season, so the log holds commands from the season's first tick onward (the `SeasonChanged` autosave, taken after the next tick, carries that tick's entries too). The log is saved (it is small) and replayable in headless mode for reproducing bugs.
- A malformed payload cannot make its diagnostic history unsaveable. After the handler runs, the log and `CommandRejected` use a saveable diagnostic copy: unsupported values become `$invalid` records as defined in the save format, including ignored extra fields of an accepted command. The handler's result, tick and submission count stay unchanged; ordinary command bytes and replay stay unchanged. Diagnostic markers remain data on load, never executable code or non-finite simulation values.
- Undo exists only for designations, zones and planned buildings before work starts, and is itself a command (`UndoDesignation`, `RemoveZone`, `CancelBuilding`) so that it goes through the same path.
- The UI may submit many commands per frame (a drag designation submits one command per tile; the core coalesces consecutive designation commands with identical parameters into one batch for the log, but applies them individually).
- Replay (`replay.mjs <save> <log>`) submits every entry whose tick is at or after the loaded game's tick, just before that tick runs (a coalesced entry as the one merged command), and prints the world hash every 100 ticks and at the end.
- A command whose owning system is not present or does not list the command in its `ownsCommands` is rejected with `not_found` and logged, emitting `CommandRejected`.

## Events

An event is a plain record with a `type` and typed fields. The event table in `04-implementation/event-catalog.md` lists fields, emitters and subscribers. Rules:

- Emit through `ctx.emit(event)` only. Events are queued; nothing runs when `emit` is called.
- Subscriptions are declared statically in each system (`subscribes: EventType[]`). The scheduler builds the dispatch table at startup.
- Presentation listeners receive every event after all systems have handled it. They may not emit events; they may submit commands.
- High-frequency events (`TileChanged`, `FluidChanged`, `StockChanged`) are batched: the emitter accumulates them during its tick and emits one event carrying an array at the end of its tick. Consumers are written for batches.
- Events carry ids, never object references. A consumer looks the target up through the world and must handle the case where it no longer exists.

## Random numbers

`core/rng.ts` implements `xoshiro128**` over 32-bit integers. The world seed is a 64-bit value shown to the player as a string. Streams:

- `world.rngFor(systemId)` returns a persistent stream seeded from `hash(worldSeed, systemId)`. `hashString` is FNV-1a/32 over UTF-16 code units, and `seedFor(worldSeed, streamId) = hashString(streamId, hashString(worldSeed))`. The four state words of `xoshiro128**` come from `splitmix32` of that seed, replacing the all-zero state with the golden-ratio constant (`0x9e3779b9`). Its state is part of the system's saved state.
- World generation uses `rngFor('worldgen.elevation')`, `rngFor('worldgen.climate')`, and so on, one stream per stage, so that changing one stage does not change the others.
- Local map generation uses one stream per stage in the same way.

Stream API, all deterministic and integer-only:

```
nextU32(): number                       // 0 … 2^32−1
int(loInclusive, hiInclusive): number
chance(permille): boolean               // true with probability permille/1000
pick<T>(array: readonly T[]): T          // array must be non-empty
weighted<T>(entries: readonly [T, weight][]): T
shuffle<T>(array: T[]): void            // Fisher–Yates in place
fixed(): Fixed                          // 0 … 999 as a fixed-point fraction
```

`int(lo, hi)` uses rejection sampling to eliminate modulo bias, consuming further draws of the same stream deterministically.

Nothing in L1–L3 uses `Math.random`. An ESLint rule forbids it outside `platform/`.

## Calendar

```
interface Calendar {
  tick: number                    // absolute tick since embark
  hour: number                    // 0–23
  dayOfSeason: number             // 1–DAYS_PER_SEASON
  season: Season                  // spring | summer | autumn | winter
  year: number                    // starts at 1
  dayOfYear: number               // 1–DAYS_PER_YEAR
  isDaylight: boolean             // set by 06 weather from its daylight table
  advance(): void                 // increments tick; emits boundary events
}
```

Boundary events are emitted in step 4 and dispatched in the next tick's step 3: `HourPassed { hour }`, `DayPassed { dayOfSeason, season, year }`, `SeasonChanged { season, year }`, `YearPassed { year }`. `hour` in `HourPassed` is the hour that has begun (the calendar's hour after the advance). When several boundaries coincide, events are emitted smallest first: `HourPassed`, `DayPassed`, `SeasonChanged`, `YearPassed`. `SeasonChanged` is the trigger for autosave and the immigration check; `DayPassed` is the trigger for daily rolls (infection, threats, sulks).

Date display: "Day 12 of Spring, Year 3". Hour display in the status bar as a sun or moon glyph, not a number.

## Fixed-point math

`core/fixed.ts` defines `type Fixed = number` holding an integer scaled by `FIXED_SCALE = 1000`. Helpers: `fx(n)`, `fmul(a, b)`, `fdiv(a, b)`, `flerp(a, b, t)`, `fclamp`, `fsqrt` (integer Newton), `fpercent(value, pct)`. Every fraction in a system (growth per tick, decay per hour, speed) is a `Fixed`. All operations truncate toward zero (normalising `-0` to `0` so that hashes and saves cannot differ). Floating point appears only in presentation (color blending, layout).

Integer overflow: all accumulators are checked against `2^31` in tests; anything that could exceed it (fortress wealth, total ticks) uses two 32-bit words or is bounded by design (`TICKS_PER_YEAR × 200 years < 2^31`).

## Determinism

The rules in `architecture-overview.md` are enforced by:

- `core/determinism-test.ts`: run scenario S for N ticks twice → hash equality; run S for N/2 ticks, save, load, run N/2 → hash equality with the uninterrupted run.
- The world hash covers `Map3D` arrays, entity tables in slot index order, and each system's `serialize()` output.
- Iteration helpers in `core/` (`forEachEntityWith`, `forEachTileInChunk`, `sortedKeys`) are the only ways systems iterate shared state; they guarantee order.

## Speed and pause

- Pause is speed 0. The renderer keeps running, so the player can inspect and issue commands while paused; the host applies their command phase immediately without advancing time. On resuming from pause or from a hidden tab, `lastFrameMs = nowMs`, so the simulation does not catch up.
- Speed changes take effect on the next frame. Speeds above 1× do not change any rule; only the number of ticks per real second changes.
- `danger` announcements set speed to 0 (see 24 UI). The core exposes `setSpeed` to presentation only; no system changes speed.

## Headless mode

`app/headless.ts` constructs a `World` with the full system set and no platform. A scenario is:

```
{ seed, region: RegionSpec | 'flat-test', embark: EmbarkSpec | 'default',
  commands: [{ tick, command }...],
  assertions: [{ tick, check: (readers) => boolean, message }...],
  ticks: number }
```

The headless runner is the basis of the tests in `04-implementation/acceptance-tests.md` and of the determinism test. It runs in Vitest and in a Node script.

## Startup sequence

World-map generation runs in the app before a fortress `World` exists. After Generate completes, the app delivers `WorldGenerated { seed, size }` once through its app listener seam; embark then creates the fortress.

1. Load content tables into the registry (`content-pipeline.md`).
2. Build the glyph atlases (presentation).
3. Construct `World` with the seed; construct systems in order; call `init` on each with the `InitContext` (which includes readers of all systems, so `init` may cache reader references but must not call them for state until `tick`).
4. Either generate (new game) or `deserialize` (load).
5. Presentation subscribes to events and begins the frame loop paused.
