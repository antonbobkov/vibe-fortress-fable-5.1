# M6 gate report

Milestone: M6. Under the amended plan, the gate asserts the 20-dwarf played fortress and reports the 80-dwarf reference as T-M8-01's baseline. The played fortress passed its per-system allocations after the system 06 weather optimization. No allocation, fixture size, or specification constant was changed.

## Verification completed

| Step | Result | Measured output |
|---|---|---|
| `npm run lint` | pass | ESLint: zero errors |
| `npm run typecheck` | pass | TypeScript: zero errors |
| `npm run content:check` | pass | 50 tables, 1,585 rows; zero issues |
| `npm test` | pass | 142 files passed, 2 skipped; 1,439 tests passed, 2 skipped, 2 todo |
| `npm run test:e2e` | pass | Playwright: 9/9 |
| `npm run test:perf` | **pass** | 5 files, 10 tests; played allocations all pass, scripted reference measured |
| M6 command properties | pass | 7 targeted tests across determinism and save round-trip files, including accepted M6 command families |
| Played behavior | pass | 0 dwarf deaths, lake settled at tick 2,875, 31 crafted items, 67 completed hauls; 24 and 14 hauled items remain in the two stockpiles (45 and 29 total items) |
| Coverage (`npm test -- --coverage`) | pass | 1,439 passed, 2 skipped, 2 todo; all directory thresholds exceeded |
| Perf-tier `year_one_seeds` | pass | Five seeds, zero dwarf deaths and zero tame deaths on each |

The `year_one` scenario output on seed `year-one` was: carpenter day 0.92, mason 4.00, still 11.42, kitchen 3.25, hearth 5.42, room 4.59, first brew 17.17, first crop 0.67, 43 missing-input blocks, 99 conversations, **zero dwarf and tame deaths**. The perf-tier `year_one_seeds` passed for `year-one`, `year-one-b`, `year-one-c`, `year-one-d`, and `year-one-e`, with zero dwarf and tame deaths on each seed. D-183 records the owner's reading of F-04's older zero-`CreatureDied` wording: dwarf survival is asserted; tame deaths are reported. In the played fortress, three tame animals (a cat and two dogs) died, as did one cavern troll; zero dwarves died. `479cb6a` fixed the duplicate troll death event before this measurement.

Coverage is V8 line coverage from the full unit, scenario, property and golden suite; no threshold was lowered.

| Directory | Covered/total lines | Measured | Threshold | Result |
|---|---:|---:|---:|---|
| `src/core/**` | 4,784/4,909 | 97.45% | 90% | pass |
| `src/systems/**/rules/**` | 350/357 | 98.04% | 90% | pass |
| `src/systems/**` | 22,432/24,067 | 93.21% | 75% | pass |
| `src/render/**` | 1,198/1,206 | 99.34% | 60% | pass |
| `src/ui/**` | 5,229/5,924 | 88.27% | 50% | pass |

## Saved reference and performance

`test/fixtures/reference-fortress.deepholm` is the scripted year-three standard-map load: exactly 80 dwarves, 120 tame/wild animals, 25,000 item entities, 600 buildings and 60 zones, with a north-to-south river, breached cavern and running 40-tile waterfall. The `perf-1` default region had no river, so the scripted builder supplied the specified crossing on that generated map. It did not simulate years. `test/fixtures/played-fortress.deepholm` was saved after 2,875 autonomous ticks with 20 dwarves, six maintain-order workshops with inputs stocked, two stockpiles, farm, squad, disturbed natural water, cavern breach and waterfall. Its behavior test observes 31 crafted items across five recipe types and 67 completed hauls; 24 and 14 hauled items remain in the two stockpiles. The still's brew job has all inputs delivered but its barrel has only 7 free capacity for a 20-drink output after other activity filled it. Brew has not completed in this fixture; this is a follow-up for workshop/container ownership, not a missing input.

**M6 asserts per-system allocations against the 20-dwarf played fixture.** It measures and reports the 80-dwarf scripted load without failing M6 on it. The amended `M6-steel-and-blood.md` puts target-scale performance compliance and load shedding in T-M8-01 and T-M8-02. D-180 records this owner decision; there is no open 20-vs-80 contradiction row.

Both columns use a 200-tick warm-up and 2,000 measured ticks in a loaded save. Values are amortized milliseconds per tick. The 80-dwarf column is the measured M8 baseline; the played column is the asserted M6 load. Allocations are unchanged.

| System | Allocation ms | 20 played ms (M6 gate) | 20 result | 80 scripted ms (M8 baseline) | 80 over allocation |
|---|---:|---:|---|---:|---:|
| 03 terrain | 0.100 | 0.002 | pass | 0.007 | — |
| 04 fluids | 1.500 | 0.004 | pass | 1.111 | — |
| 05 materials | 0.150 | <0.001 | pass | 0.001 | — |
| 06 weather | 0.020 | **0.0133** | pass | <0.001 | — |
| 07 plants | 0.150 | 0.003 | pass | 0.001 | — |
| 08 animals | 0.400 | not exercised (0 live animals) | — | **8.917** | **8.517 ms / 22.3×** |
| 09 foraging | 0.050 | <0.001 | pass | 0.001 | — |
| 10 dwarves | 0.500 | 0.132 | pass | **8.234** | **7.734 ms / 16.5×** |
| 11 jobs | 0.600 | 0.036 | pass | **25.115** | **24.515 ms / 41.9×** |
| 12 workshops | 0.100 | <0.001 | pass | 0.001 | — |
| 13 items | 0.300 | 0.082 | pass | **0.719** | **0.419 ms / 2.4×** |
| 14 buildings | 0.100 | <0.001 | pass | 0.001 | — |
| 15 morale | 0.200 | 0.008 | pass | 0.083 | — |
| 16 combat | 0.200 | 0.055 | pass | **1.212** | **1.012 ms / 6.1×** |
| 17 health | 0.100 | 0.003 | pass | 0.005 | — |
| 18 threats | 0.100 | 0.038 | pass | **0.517** | **0.417 ms / 5.2×** |
| 19 defense | 0.050 | 0.001 | pass | 0.009 | — |
| 20 trade | 0.020 | not present | — | not present | — |
| 21 immigration | 0.000 | not present | — | not present | — |
| 22 pathing/connectivity | 1.000 | 0.028 | pass | 0.449 | — |
| core (residual) | 0.300 | 0.066 | pass | **0.477** | **0.177 ms / 1.6×** |

The 80-dwarf reference is **out of budget**: its average whole tick was **46.859 ms** against 6 ms (**7.8×**), with a **1,376.270 ms** worst tick against 20 ms (**68.8×**, also beyond the 40 ms smoke limit). T-M8-01 owns profiling and budget compliance at that scale; T-M8-02 owns load shedding. The played fortress averaged **0.475 ms/tick**, worst **32.457 ms**. System 06 weather fell from 0.048 to 0.0133 ms/tick after caching outdoor surfaces and skipping unchanged rain flags. No CI or whole-tick tolerance is applied to individual systems. System 08 has no living animals in the saved played fixture, so that column does not claim an exercised animal AI timing; the allocation assertion still checks its idle overhead.

## M6 gate scenarios

All listed scenarios passed in the full `npm test` run. The M6 scenario suite reported 42 passes; the table also includes `dw_starve` from M4 because it is named in M6's gate list. `year_one` passed in the M4 suite. The two accepted suite todos are C-004 and C-005, both deferred by the owner to T-M8-06.

| Gate scenario | Status | Gate scenario | Status |
|---|---|---|---|
| `an_predator` | pass | `an_tame` | pass |
| `bd_bridge` | pass | `bd_burial` | pass |
| `bd_floodgate` | pass | `cb_alert_hearth` | pass |
| `cb_armor` | pass | `cb_hit_table` | pass |
| `cb_ranged` | pass | `cb_squad_station` | pass |
| `cb_training` | pass | `cb_worked_examples` | pass |
| `df_cage` | pass | `df_dwarf_safe` | pass |
| `df_pattern_airlock` | pass | `df_pattern_corridor` | pass |
| `df_pattern_drowning` | pass | `df_pattern_gate` | pass |
| `df_pattern_magma` | pass | `df_pattern_pit` | pass |
| `df_plate_bridge` | pass | `df_retreat_tile` | pass |
| `df_stone_fall` | pass | `dw_starve` | pass |
| `fl_drown` | pass | `fo_hunt` | pass |
| `fo_no_ammo` | pass | `he_bandage` | pass |
| `he_bleed` | pass | `he_fall` | pass |
| `he_fracture` | pass | `he_infection` | pass |
| `he_limb` | pass | `th_deep` | pass |
| `th_loiter` | pass | `th_restless` | pass |
| `th_retreat` | pass | `th_schedule` | pass |
| `th_thief` | pass | `th_troll_door` | pass |
| `th_warning` | pass | `ui_danger_pause` | pass |
| `mo_grief` | pass | | |

## M7 handoff

The property generator covers squad, alert, trap, lever and hospital commands, and the determinism and save-round-trip properties pass. The played fixture's hauling into both stockpiles and lake settling are checked. C-004 (`test/unit/terrain/producer.test.ts`) and C-005 (`test/unit/items/search.test.ts`) are the only owner-deferred contradictions; both remain todo until T-M8-06. The 80-dwarf table above is T-M8-01's baseline; its largest excess is system 11 jobs at 41.9× allocation. The still's delivered barrel loses free capacity during a long brew job; the job stalls at 999 progress and is a workshop/container follow-up. No screenshots were added. The standalone optimization commits are `2689675` (system 10), `c5014df` (system 18), `479cb6a` (single death event), and `65474d4` (weather).
