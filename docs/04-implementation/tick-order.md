# Tick Order

**Owner:** implementation (`core/scheduler.ts`) · **Depends on:** [`../01-architecture/simulation-core.md`](../01-architecture/simulation-core.md), [`../02-systems/README.md`](../02-systems/README.md)

The exact sequence of one `World.step()`. Cadence and phase are from the scheduler table; a system runs when `(tick − phase) mod cadence == 0`.

```
1. commands
   for cmd in commandQueue (FIFO): owner.applyCommand(cmd) → log; CommandRejected on failure
2. systems, in this order
   03 terrain      every tick        designation list → job producer state; apply pending tile mutations; discovery from last tick's EntitiesMoved; support checks; TilesChanged batch flushed at the end of its tick
   04 fluids       tick % 2 == 0     queued freeze/thaw pass; water step; magma step when tick % 4 == 0; entity submersion/magma contact checks; FluidsChanged
   05 materials    (tick − 3) % 10   fire; override recompute for dirty chunks; TemperatureTick
   06 weather      (tick − 7) % 50   hourly weather logic (aligned to the game hour by phase 7 … note: the calendar hour boundary is at tick % 50 == 0; weather runs 7 ticks later on purpose so that HourPassed from the previous boundary has been dispatched)
   07 plants       (tick − 11) % 50  growth, plot jobs, harvest jobs
   08 animals      every tick        animal brains (think intervals inside), movement
   09 foraging     (tick − 5) % 10   hunt target selection, fish job production, butcher jobs
   10 dwarves      every tick        behavior selection, activities, movement; needs update on HourPassed handled in step 3 of the previous tick
   11 jobs         every tick        producers polled, blocked retries, assignment for queued workers (workers queue themselves in 10 the same tick, so assignment answers in the same tick)
   12 workshops    every tick        order → job creation, magma checks
   13 items        (tick − 1) % 10   haul job creation, rot queue, miasma, counts, wealth
   14 buildings    (tick − 9) % 10   room recompute for dirty rooms, auto-assignment (daily), pending mechanism toggles due this tick (checked every tick in handle of MechanismTriggered with a delay; the toggle itself is applied in this system's tick when due — so mechanism latency is LINK_DELAY_TICKS rounded up to the next buildings tick, at most +9 ticks)
   15 morale       (tick − 23) % 50  thought decay, mood recompute, hall spirit
   16 combat       every tick        targets, melee, ranged, projectiles, threat scan, squad duties, training
   17 health       (tick − 2) % 5    bleeding, pain, consciousness, healing, patient needs
   18 threats      (tick − 31) % 50  schedule (daily, on DayPassed), party think; member brains run every tick inside 16's targeting and the movement helper called from 18's per-tick member pass (18 also runs a light per-tick pass for member movement: implemented as an every-tick system with the heavy party logic gated to every 50 ticks)
   19 defense      every tick        trap and plate detection from last tick's EntitiesMoved; lever job completions
   20 trade        (tick − 41) % 50  schedule and caravan party think; member movement every tick (same pattern as 18)
   21 immigration  (tick − 600) % 1200   deferred checks; the seasonal evaluation is on SeasonChanged
   core pathing    every tick        serve path requests within budget (after all brains have requested), then movement helper has already run inside brains; EntitiesMoved batch assembled
3. connectivity rebuild for dirty chunks (core)
4. events: dispatch queued events FIFO to subscribers in system order, then to presentation listeners
5. calendar.advance(): tick++; emit HourPassed / DayPassed / SeasonChanged / YearPassed into the queue (dispatched next tick)
```

## Clarifications

- While paused, the host runs step 1 immediately when a command is submitted, using `calendar.tick` (the next tick to run) for contexts and logging. Steps 2–5 do not run. Rejections are delivered once to presentation immediately; other command events stay queued for step 4. Commands applied while paused are not repeated when the next tick runs.
- 18 and 20 are registered with cadence 1 for member movement and internally gate party logic to `(tick − phase) % 50 == 0`; the scheduler table's "50" describes the heavy part. This keeps the movement helper called exactly once per creature per tick.
- Path requests made during a brain's tick are served in the core pathing pass of the same tick if budget allows; the brain sees the path on its next tick.
- `EntitiesMoved` is assembled during step 2 and emitted at the end of step 2; 03, 04, 18 and 19 consume it in step 4 of the same tick.
- `TilesChanged` emitted by 03 in step 2 is consumed in step 4; 22 marks chunks dirty in step 4 and the rebuild in step 3 of the *next* tick precedes any system use. Systems that need immediate passability after a change (none do; brains re-request paths on `blocked`) are unaffected.
- Autosave runs from the app after step 4 of the tick in which `SeasonChanged` was dispatched, before the next `step()`.

## Frame relationship

`host.step(1)` runs the sequence above once; the frame loop calls it `speed × SIM_TICKS_PER_SECOND / TARGET_FPS` times per frame on average (1× at 60 fps: one tick every three frames). Rendering reads state between steps only.
