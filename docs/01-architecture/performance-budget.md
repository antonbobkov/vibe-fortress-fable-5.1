# Performance Budget

**Detail level:** W2 · **Owner:** architecture · **Depends on:** [tech-stack.md](tech-stack.md), [simulation-core.md](simulation-core.md)

## Reference scenario

All budgets are measured on the *reference fortress*: standard map, year 3, 80 dwarves, 120 tame and wild animals, 25,000 items, 600 buildings, 60 zones, a river crossing the map, one breached cavern, a 40-tile waterfall channel running, at speed 4× on a 2020 mid-range laptop (4-core, integrated graphics) in Chrome.

Target: average tick ≤ 6 ms, worst tick ≤ 20 ms, so that 4× (80 ticks/s) fits in a 16 ms frame with `MAX_TICKS_PER_FRAME` = 8 leaving room for rendering.

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
| 18 threats | 0.10 | Hostile AI | Party-level goals; individuals reuse party paths |
| 19 defense | 0.05 | Trap checks | Trap tiles indexed; check on entity step events, not per tick scans |
| 20 trade | 0.02 | Schedule | Per-hour |
| 21 immigration | 0.00 | Daily | Negligible |
| 22 pathing | 1.00 | A* | Budget of `PATH_NODES_PER_TICK` expansions; connectivity precheck; route cache; requests queued by urgency |
| core | 0.30 | Events, commands, calendar, spatial index | Batched events; bucket updates on movement only |
| **Total** | **5.84** | | |

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

`host.stats()` exposes per-system timings (moving average and last worst case). The debug panel (24) shows them as a table. Acceptance tests in Wave 4 include a performance scenario that runs the reference fortress for 2,000 ticks in headless mode and asserts the budget with a 2× tolerance on CI machines.

## Load shedding rules

When the actual tick rate falls below 80% of the requested rate for two seconds:

1. The status bar shows the speed indicator in yellow.
2. Pathfinding halves its per-tick node budget for creatures that are not dwarves.
3. Wild animal brains run every 20 ticks instead of every 10 when far from dwarves.

When the rate recovers for five seconds, the rules relax in reverse order. Nothing about rules changes; only the pace of non-critical thinking.
