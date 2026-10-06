# Build Milestones

**Detail level:** W4 · **Owner:** implementation · **Depends on:** [acceptance-tests.md](acceptance-tests.md), [tooling.md](tooling.md)

The order in which to build the game so that something is testable at every step. Each milestone lists what is built, which acceptance tests pass, and what the player can do. Estimates assume one developer familiar with TypeScript.

## M0 — Skeleton (1 week)

Build: repo layout, Vite, ESLint boundaries, Vitest; `core/` (`World`, `Map3D`, `EntityStore`, `Scheduler`, `EventQueue`, `CommandQueue`, `Rng`, `Calendar`, `fixed`), `content/loader` with schema validation over the Wave 3 tables converted to JSON, `platform/canvas`, `render/atlas`, a compositor that draws terrain only, `app/headless`.
Tests: `core_*`, `rd_levels_below` (on a hand-built map).
Player: sees a hard-coded flat map, pans, changes z-level.

## M1 — Ground (2 weeks)

Build: 01 world generation, 03 local map generation and designations, 22 pathfinding and connectivity, movement helper, spatial index, 10 dwarves (movement and idle only), 11 jobs (dig only), the designate tool, the look panel, the log.
Tests: `wg_*`, `tr_dig_room`, `tr_channel_ramp`, `tr_stairwell`, `tr_discovery`, `pf_*`.
Player: generates a world, embarks with a default party onto a real map, designates digging, watches dwarves dig.

## M2 — Things (2 weeks)

Build: 13 items and stockpiles, hauling, 14 constructions and furniture placement (no mechanisms), zones, room detection, the build and zones tools, the stocks panel, save and load.
Tests: `jb_*`, `it_*` except rot and miasma, `bd_room_tiers`, `bd_support`, `bd_door_lock`, `core_save_roundtrip`.
Player: stockpiles, builds walls and floors, places furniture, saves.

## M3 — Water, fire, sky (2 weeks)

Build: 04 fluids, 05 materials and temperature, 06 weather, ice, mist, mud, fire, overlays.
Tests: `fl_*`, `ma_*`, `we_*`.
Player: rivers flow, channels flood, winter freezes the brook, lightning starts fires.

## M4 — Life (3 weeks)

Build: 07 plants and farming, 08 animals and domestication, 09 foraging, 10 needs and activities, 12 workshops (kitchen, still, carpenter, mason, craftsdwarf first), 15 morale, the hearth, embark screen with the catalog and presets, units, mood, animals, orders panels.
Tests: `pl_*`, `an_*`, `fo_*`, `dw_*` (except the combat-dependent ones, which wait for M6), `ws_bed`, `ws_maintain`, `mo_*`, `bd_hearth`.
Player: the whole year-one loop: farms, hunting, meals, ale, bedrooms, the hearth, happy dwarves.

## M5 — Metal (2 weeks)

Build: smelter, forge, wood furnace, magma variants, mechanic's workshop, jeweler, tannery, leatherworks, loom, clothier, farmer's workshop, butcher, kennel, bowyer; all recipes; professions; quality and masterworks; work orders panel complete.
Tests: `ws_*`, `it_value`, `it_wealth`.
Player: the full production tree.

## M6 — Steel and blood (3 weeks)

Build: 16 combat, 17 health and hospitals, 18 threats (schedules, parties, AI, cavern monsters, the Deep), 19 defense (traps, plates, levers, bridges, floodgates, hearth alert), military and threats panels, combat log, mechanisms in 14.
Tests: `cb_*`, `he_*`, `th_*`, `df_*`, `bd_bridge`, `bd_floodgate`, `bd_burial`, and the combat-dependent scenarios deferred from M3 and M4 (`fl_drown`, `an_predator`, `an_tame`, `fo_hunt`, `fo_no_ammo`, `dw_starve`).
Player: squads, raids, traps, the caverns, the Hollow.

## M7 — The outside world (2 weeks)

Build: 20 trade and caravans with the session screen, 21 immigration, reputation, requests, civilizations and population panels, the legend screen, retire, legends list, settings, keybinding remap, hints, milestones.
Tests: `td_*`, `im_*`, `ui_*`.
Player: the complete game.

## M8 — Polish and balance (2 weeks)

Build: performance pass against `perf_*`, load shedding, colorblind palette, snapshots and export/import, debug panel, golden render tests, tutorial hint tuning, the balance pass against [`../03-content/balance.md`](../03-content/balance.md) with the year-one expectation table.
Tests: everything green; `perf_reference` within budget.

## Dependencies between milestones

```
M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8
             └────────┘  (M3 can run in parallel with M2 by a second developer: it touches 04–06 and the terrain API only)
```

## Definition of done per milestone

- All listed acceptance tests pass in CI.
- `core_determinism` and `core_save_roundtrip` still pass with the new systems registered.
- No ESLint boundary violations.
- The system documents' "Interfaces" sections match the code's exported readers, events and commands (a script lists exported symbols and greps the documents).
