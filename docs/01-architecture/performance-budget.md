# Performance Budget

**Owner:** architecture · **Depends on:** [tech-stack.md](tech-stack.md), [simulation-core.md](simulation-core.md)

## Reference scenario

The *reference scenario* is: standard map, year 3, 80 dwarves, 120 tame and wild animals, 25,000 items, 600 buildings, 60 zones, a river crossing the map, one breached cavern, a 40-tile waterfall channel running, at speed 4× on a 2020 mid-range laptop (4-core, integrated graphics) in Chrome. Two saved fixtures stand for it (§ Reference fixtures).

Target: average tick ≤ 6 ms, worst tick ≤ 20 ms, so that 4× (80 ticks/s) fits in a 16 ms frame with `MAX_TICKS_PER_FRAME` = 8 leaving room for rendering.

## Reference fixtures

- **The reference fortress** (`test/fixtures/reference-fortress.deepholm`, built by `test/perf/scripted-reference.ts`) is the reference scenario with a settlement on it: every workshop that has recipes, twelve of them with a standing order its stock can feed; six farm plots (two surface, four cave) with a crop for every season and seeds; food, drink and a still; two squads of six with gear in stock and a barracks each, one on Train; a hospital with beds, a chest and supplies; a trade depot; a gate with a door set to lock on alert, a drawbridge on a lever and four cage traps; ten stockpiles of 5×5 (three of them for drink, in barrels) with the presets a played fortress uses; and labors set by profession templates. Its 25,000 single items lie spread over the map, loose, as stock does in a played fortress.
- **The furniture fixture** (`test/fixtures/reference-fortress-furniture.deepholm`) is the first 80-dwarf fixture: the same map, channel, cavern, dwarves, animals and 25,000 items, with 600 pieces of furniture and sixty small zones, and no workshop, farm plot, squad, wounded dwarf, trap or caravan.

Every budget in the table below was measured on the furniture fixture, and `per-system.test.ts` and `perf_reference.test.ts` hold them there, so that no number changes meaning silently. On the furniture fixture systems 07 plants, 12 workshops, 16 combat, 17 health, 19 defense and 20 trade have nothing to do: their figures there read *not exercised*. They are measured on the reference fortress, and the figure is reported in the dated report [`2026-10-16-reference-fortress.md`](../../reports/audits/2026-10-16-reference-fortress.md) and gates nothing until a task makes it pass: the reference fortress's average tick is far above the target (the job board, T-345 and T-344), and the budget of a system on it is *unmeasured* in the sense of `process/agent-workflow.md` until then.

## Per-system tick budget (average, amortized over cadence)

| System | Budget (ms) | Dominant cost | Mitigation |
|---|---|---|---|
| 03 terrain | 0.10 | Designation scans | Designations kept in a sorted list, not scanned from the grid |
| 04 fluids | 1.50 | Active tiles | Active set per chunk; settle after `FLUID_SETTLE_STEPS`; water at cadence 2, magma 4; batch `FluidsChanged` per chunk |
| 05 materials | 0.15 | Fire spread, freeze checks | Only burning tiles and outdoor water tiles are visited |
| 06 weather | 0.02 | Snow cover updates | Only outdoor chunks |
| 07 plants | 0.15 | Growth timers | Per-hour accumulation; crops and saplings in lists |
| 08 animals | 0.40 | Behavior and movement | Bounded perception radius; wild animals far from dwarves think every 10 ticks |
| 09 foraging | 0.05 | Target search | Candidate lists cached per species |
| 10 dwarves | 0.50 | Needs, behavior selection, movement | Behavior selection only when idle or on need threshold; movement is a cheap step |
| 11 jobs | 0.60 | Assignment | Idle workers only; candidate set bounded to 32 jobs by labor and connectivity; hauling batched |
| 12 workshops | 0.10 | Timers | Only active workshops |
| 13 items | 0.30 | Decay, stock counts | Rot only for items with a rot timer, kept in a bucket queue by expiry; stock counts incremental |
| 14 buildings | 0.10 | Room detection | Only rooms whose zone or tiles changed |
| 15 morale | 0.20 | Thought decay, mood | Per-hour; thoughts as small arrays |
| 16 combat | 0.20 | Attack resolution | Only creatures with a target |
| 17 health | 0.10 | Bleeding, healing | Only wounded creatures in a list |
| 18 threats | 0.10 | Hostile AI | Party-level goals; individuals reuse party paths; one shared fortress-creature snapshot per threat step; loot search bounds bestUnattendedItems to same-z Chebyshev square |
| 19 defense | 0.05 | Trap checks | Trap tiles indexed; check on entity step events, not per tick scans |
| 20 trade | 0.02 | Schedule | Per-hour |
| 21 immigration | 0.01 | Daily | Negligible |
| 22 pathing | 1.00 | A* | Budget of `PATH_NODES_PER_TICK` expansions; connectivity precheck; route cache; requests queued by urgency |
| core | 0.30 | Events, commands, calendar, spatial index | Batched events; bucket updates on movement only |
| **Total** | **5.85** | | |

The pathfinding budget is the one that stretches: if the budget is exhausted in a tick, remaining requests wait, and the requester's brain idles for that tick. This degrades gracefully: creatures pause for a few ticks under load instead of the frame stalling.

## Memory budget

| Area | Budget | Note |
|---|---|---|
| `Map3D` grids | 4 MB | 8 bytes per tile |
| Chunks | 1 MB | includes spatial buckets |
| Entities and components | 40 MB | 25,000 items dominate; components are compact records |
| Pathfinding | 8 MB | connectivity labels (`Uint16Array` per movement class), open and closed sets reused |
| Registry | 4 MB | tables and derived indices |
| Presentation | 20 MB | atlases per zoom, cell buffers |
| Save (uncompressed) | 8 MB | |
| Total steady state | ≤ 300 MB | including JavaScript heap overhead |

## Rendering budget

- Full redraw of the viewport (up to 160 × 60 cells) from the atlas: ≤ 4 ms at zoom 1.
- The compositor does one pass over visible cells and one over entities in visible chunks.
- The sidebar and status bar are text cells in the same pass.
- No per-frame allocations in the hot path: cell buffers are reused.

## Generation budgets

- World generation, standard size: ≤ 2 s, done in stages with a progress callback so the preview can animate.
- Local map generation: ≤ 1.5 s.
- Save: ≤ 1 s of simulation pause; load: ≤ 1.5 s.

## Measurement

`host.stats()` exposes per-system timings (moving average and last worst case). Diagnostic moving-average windows cover one simulated second (`SIM_TICKS_PER_SECOND` ticks, 20 ticks), including zero-cost cadence ticks, alongside lifetime totals and worst cases. The application injects its platform `Clock` on host creation and load.

Optimized candidate and spatial views avoid altering saved state or tie-break order:
- Derived indexes (tile/kind, item type/chunk/carrier/container, rotten-source, and static activity indexes) rebuild cleanly on load and invalidate incrementally on owned component/API mutations through the item API, leaving reachability, flags, occupancy, and slot/id tie orders intact.
- `ItemsReader.carriedItems` supplies held ammunition directly.
- `bestUnattendedItems` maintains per-tile value maxima in cached value bands ranked by value and entity slot (allowing thief and loot goals to stop after finding a reachable winner in top bands). For party loot searches (18), `bestUnattendedItems` accepts optional `from` and `radius` bounds restricting evaluation to the same-z Chebyshev square; if items excluded by party loot remain loose or in worlds lacking the item reader, the fallback full spatial search runs. Stockpile classification and connectivity are evaluated live.

The worst tick of a fixture is measured on its work, not on the machine's noise. One tick's time carries a collection, the scheduler or a late compilation: over five quiet runs of the same 2,000 ticks the worst single tick moved between 34.5 and 42.2 ms on the played fortress and between 35.3 and 43.9 ms on the furniture fixture. The tier therefore loads the fixture three times, runs the same 2,000 ticks in each pass, takes each tick's least time over the three passes, and holds the largest of those to the bound. The least of three passes cannot see a stall that comes once (a collection, a one-time cost in the process), so the single-pass worst is held to a loose 80 ms of its own: it measured 32.8 to 60.1 ms over twelve quiet runs. Over five runs that figure fell on the same tick every time and moved between 23.9 and 28.0 ms on the played fortress (a weather change of many tiles, handled by 04 and 14) and between 29.2 and 30.2 ms on the furniture fixture (needs searches that start on one tick for many of the 80 dwarves).

Acceptance tests in `04-implementation/acceptance-tests.md` include a performance scenario that runs the reference fortress for 2,000 ticks in headless mode and asserts the budget with a 2× tolerance on CI machines.

## Load shedding rules

The application measures completed simulation ticks over consecutive wall-time sample windows of at least one second (`LOAD_SHEDDING_RATE_SAMPLE_MS = 1_000`), including explicit host steps; a completed window supplies tick rate evidence over its full interval.

Thresholds:
- Rate strictly below 80% (`LOAD_SHEDDING_RATE_PERCENT`) for 2 seconds (`LOAD_SHEDDING_ENGAGE_MS = 2_000`) engages shedding rules 1, 2, and 3.
- Rate at or above 80% for 5 seconds (`LOAD_SHEDDING_RECOVER_MS = 5_000`) disengages rules in reverse order (3, 2, 1).
- Interruptions: Pause, hidden browser tabs (`visibilitychange` resets the sampling clock even when requestAnimationFrame is suspended), frame reset, and requested speed changes interrupt continuous observation and reset the window. New games and loads initialize with clean policy flags (load shedding flags are unsaved runtime state).

Rules:
1. The status bar shows the speed indicator in yellow and adds the localized text "slow" for accessibility.
2. Pathfinding allocates a shared non-dwarf expansion pool capped at half of `PATH_NODES_PER_TICK` (`LOAD_SHEDDING_PATH_DIVISOR = 2`) within the unchanged global pool. Dwarf species (including merchants and hostiles without `Brain`) retain full eligibility, and interrupted searches preserve their queue state.
3. Wild animal brains run every 20 ticks (`WILD_LOAD_SHEDDING_THINK_TICKS` in `animals/constants.ts`) instead of every 10 when far from dwarves. Near wild animals and tame animal cadence/movement remain unaffected.

Named constants are defined in `src/core/performance-constants.ts` (`LOAD_SHEDDING_*`) and `src/systems/animals/constants.ts` (`WILD_LOAD_SHEDDING_THINK_TICKS`). Nothing about game rules changes; only the pace of non-critical thinking.
