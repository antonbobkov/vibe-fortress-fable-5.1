# M7 gate report

Milestone: M7 — the outside world: trade and caravans, immigration, the legend, settings, help,
the game menu, the announcement registry, and the full-year scenario. Every step below was run in
the foreground and finished green. As at M6, the gate **asserts** the per-system allocations on the
20-dwarf played fixture and **reports** the 80-dwarf scripted fortress as T-M8-01's baseline
(D-180, the amended blockquote under T-M6-18 of `M6-steel-and-blood.md`, and T-M8-01 of
`M8-polish.md`). No allocation, fixture size or specification constant was changed.

## Verification completed

| Step | Result | Measured output |
|---|---|---|
| `npm run lint` | pass | ESLint: zero errors (12.8 s) |
| `npm run typecheck` | pass | TypeScript: zero errors (7.8 s) |
| `npm run content:check` | pass | 50 tables, 1,585 rows; zero issues |
| `npm run strings:check` | pass | 541 keys (140 in `strings.json`, 401 UI defaults); zero missing, unused or mismatched |
| `npm test` (with `--coverage`) | pass | 160 files passed, 1 skipped; **1,524 tests passed, 1 skipped, 2 todo** (654.3 s) |
| `npm run test:e2e` | pass | Playwright: **12/12** (89.5 s) |
| `npm run test:perf` | pass | 5 files, 10 tests; every played allocation passes, the 80-dwarf load measured |

`npm run strings:check` is new in M7 (T-M7-10) and is now a step of `scripts/gate.mjs`. The one
skipped test file is `test/scenarios/m8.test.ts`, which holds a placeholder until M8 has scenarios;
the one skipped test is that placeholder. The two todos are the owner-deferred contradictions
C-004 and C-005 (below).

## M7 gate scenarios

The gate list of `M7-outside-world.md` is `td_*`, `im_*`, `ui_*`, plus the e2e `trade-session` and
`save-load-settings`. Every one passed inside the full `npm test` run.

| Scenario | Milestone | Result | Scenario | Milestone | Result |
|---|---|---|---|---|---|
| `td_attack` | M7 | pass | `im_cap` | M7 | pass |
| `td_depot` | M7 | pass | `im_composition` | M7 | pass |
| `td_no_depot` | M7 | pass | `im_guaranteed` | M7 | pass |
| `td_offer` | M7 | pass | `im_threshold` | M7 | pass |
| `td_preload` | M7 | pass | `ui_danger_pause` | M6 | pass |
| `td_requests` | M7 | pass | `ui_hints_once` | M4 | pass |
| `td_schedule` | M7 | pass | `ui_keymap_parity` | M7 | pass |
| `td_wood_penalty` | M7 | pass | `year_one` | M7 | pass |

`td_depot` and `td_preload` are beyond the acceptance table's list; T-M7-01 and T-M7-02 added them.
`year_one` moved from milestone 4 to 7 with T-M7-11, because its caravan and immigration rows
cannot pass before M7 (D-202).

E2E suite, 12 specs: `boot`, `generate-and-embark`, `designate-by-drag`, `build-and-stockpile`,
`panels-open-and-close`, `quick-save-load`, `fluid-overlay`, `farm-plot-and-orders`,
`military-and-alert`, `trade-session` (M7), `save-load-settings` (M7), `game-menu` (M7).

## Contradictions and todos

The suite's two todos are unchanged and both are owner-deferred to T-M8-06:

| Id | Where | What is deferred |
|---|---|---|
| C-004 | `test/unit/terrain/producer.test.ts` | `tr_dig_room`'s 2,000-tick bound against the need rules of `10`; measured 2,274 ticks |
| C-005 | `test/unit/items/search.test.ts` | D-076's 1,500-tick bound for twelve tiles dug by two miners; measured 2,828 ticks |

No new contradiction was recorded in M7. Two rule-versus-rule readings were resolved as decisions
rather than contradictions: D-201 keeps `17`'s `alert` for a dwarf passing out where `10`
§ Registrations calls it a note, and D-199 reads the `debug` row of `ui-keymap-and-screens.md`
§ Screens as the panel that § Fortress panels and `24` § Panels describe.

Decisions added in M7 by this agent: D-199 (the debug overlays, the debug panel's readers, `debug`
as a panel), D-200 (the two unowned § Mouse rows, the selection's keys, `c_main_menu`'s `{time}`,
and what `ui_keymap_parity` checks), D-201 (what a `ui` row of the event catalog requires and what
the strings audit checks), D-202 (which year-one rows are asserted and which reported).

## The year-one balance table

`test/scenarios/year_one.scenario.ts` now runs the whole first year on seed `year-one`
(flat-test 48×48, `serene_vale`-like: peril 0, wealth 2, temper 0), Balanced embark, with the F-04
bootstrap script, a trade depot, and the cave farm that `balance.md` § Year-one expectation itself
prescribes for days 10–20. The rows that follow from a rule are asserted; the rest are measured and
reported here.

| `balance.md` § Year-one expectation | Measured on `year-one` | Asserted? |
|---|---|---|
| Day 28 — Summer: Hillfolk caravan | day 45 (the `20` § Schedule window is day 33–46) | yes, the window |
| Day 28 — first immigrants (2–4) | day 29, 3 dwarves, guaranteed | yes, summer and 2–4 |
| Day 56 — Autumn: Wildwood caravan | day 71 (window day 61–74) | yes, the window |
| Day 56 — second guaranteed wave | day 57, 3 dwarves | yes, autumn and 2–4 |
| Day 56 — at peril ≥ 2 the first ambush or raid warning | peril 0 region: 0 raids, 0 warnings | yes, no raid at peril 0 |
| Day 84 — Winter: surface farm dormant | 0 surface crops planted in winter | yes |
| Day 84 — cave farm carries | 16 cave crops planted in winter, 80 over the year | yes |
| Day 84 — river frozen at temper ≥ 1 | temper 0 region: 26 tiles of the spring froze, first on day 85 | freezing only in the cold seasons |
| Day 112 — Year 2: Mountainhome caravan | scheduled for day 127 (spring-of-year-2 window 117–130) | yes, the window, and none in year 1 |
| Day 112 — the fortress is 11–15 dwarves | **13 dwarves** | no: reported, with a functional bound (> 7) |

Year-end state: 13 dwarves, **0 dwarf deaths**, 0 tame deaths, wealth 2,075 marks, 79
`CropHarvested`, 123 `ItemCrafted`, stocks drink 11 / meal 0 / plant food 33 / bars 5, two caravans
arrived and departed with no trade session opened (the scenario issues no offer; `td_offer` covers
the session). Blocked jobs over the year: `dig:unreachable` 38, `carve_stairs:unreachable` 3,
`build:missing_input` 5, `plant:missing_input` 48.

The first twenty days are unchanged from F-04 and still inside their bounds: carpenter day 0.92,
mason 4.00, still 11.42, kitchen 3.25, hearth 5.42, room 4.59, first brew 17.17, first crop 0.67,
43 missing-input blocks, 99 conversations, zero deaths.

### Balance findings

Three measured values differ from `balance.md` by more than 30%. No constant was changed; T-M8-06
owns the balance pass. They are recorded in `DECISIONS.md` § Balance findings.

| Id | Measure | Model | Measured |
|---|---|---|---|
| B-005 | Farm yield over year 1 | 0.25 plants per tile per day, about 900 from 32 tiles | 79 `CropHarvested`, with 48 `plant:missing_input` blocks |
| B-006 | Wealth at the end of year 1 | 4,000–8,000 marks | 2,075 marks, of which about 1,500 is the embark |
| B-007 | Meals in stock at the end of year 1 | the kitchen turning raw food into meals daily | 0 meals, 33 raw plant food stored, no craft job blocked |

B-006's model assumes "a competent player"; the year-one script builds five workshops, a depot and
two farm plots, and neither smooths rooms nor makes furniture, so part of the gap is the script.

## Coverage

V8 line coverage from the full unit, scenario, property and golden suite. No threshold was lowered.

| Directory | Covered/total lines | Measured | Threshold | Result |
|---|---:|---:|---:|---|
| `src/core/**` | 4,796/4,921 | 97.46% | 90% | pass |
| `src/systems/**/rules/**` | 350/357 | 98.04% | 90% | pass |
| `src/systems/**` | 23,731/25,383 | 93.49% | 75% | pass |
| `src/render/**` | 1,310/1,318 | 99.39% | 60% | pass |
| `src/ui/**` | 6,236/7,192 | 86.71% | 50% | pass |
| `src/app/**` | 1,868/2,081 | 89.76% | none documented | reported (D-037) |
| `src/content/**` | 1,043/1,076 | 96.93% | none documented | reported |
| `src/platform/**` | 281/393 | 71.50% | none documented | reported |

Overall: lines 92.68%, statements 92.68%, functions 92.18%, branches 82.93%.

## Performance

`01-testing-strategy.md` § Performance smoke runs the tier at the M3, M6 and M8 gates; it was run
here as well so M7 hands M8 a fresh baseline. Both columns use a 200-tick warm-up and 2,000
measured ticks in a loaded save, amortized milliseconds per tick.

**The gate asserts the 20-dwarf played column.** The 80-dwarf column is measured and reported as
T-M8-01's baseline; it is deliberately out of budget for six systems and nothing here was optimised
for it.

| System | Allocation ms | 20 played ms (asserted) | 20 result | 80 scripted ms (M8 baseline) | 80 over allocation |
|---|---:|---:|---|---:|---:|
| 03 terrain | 0.100 | 0.003 | pass | 0.006 | — |
| 04 fluids | 1.500 | 0.004 | pass | 1.101 | — |
| 05 materials | 0.150 | 0.001 | pass | 0.001 | — |
| 06 weather | 0.020 | 0.012 | pass | <0.001 | — |
| 07 plants | 0.150 | 0.003 | pass | 0.001 | — |
| 08 animals | 0.400 | not exercised (0 live animals) | — | **9.009** | **8.609 ms / 22.5×** |
| 09 foraging | 0.050 | <0.001 | pass | 0.001 | — |
| 10 dwarves | 0.500 | 0.140 | pass | **8.689** | **8.189 ms / 17.4×** |
| 11 jobs | 0.600 | 0.047 | pass | **26.152** | **25.552 ms / 43.6×** |
| 12 workshops | 0.100 | <0.001 | pass | 0.001 | — |
| 13 items | 0.300 | 0.086 | pass | **0.755** | **0.455 ms / 2.5×** |
| 14 buildings | 0.100 | <0.001 | pass | 0.001 | — |
| 15 morale | 0.200 | 0.009 | pass | 0.086 | — |
| 16 combat | 0.200 | 0.060 | pass | **1.223** | **1.023 ms / 6.1×** |
| 17 health | 0.100 | 0.004 | pass | 0.005 | — |
| 18 threats | 0.100 | 0.041 | pass | **0.544** | **0.444 ms / 5.4×** |
| 19 defense | 0.050 | 0.002 | pass | 0.012 | — |
| 20 trade | 0.020 | 0.001 | pass | 0.002 | — |
| 21 immigration | 0.000 | <0.001 | pass | <0.001 | — |
| 22 pathing/connectivity | 1.000 | 0.025 | pass | 0.458 | — |
| 24 ui (headless) | — | <0.001 | — | 0.001 | — |
| core (residual) | 0.300 | 0.078 | pass | **0.513** | **0.213 ms / 1.7×** |

The played fortress averaged **0.521 ms/tick** with a worst tick of **33.071 ms** against the 40 ms
smoke limit. The 80-dwarf reference averaged **48.559 ms/tick** against 6 ms (**8.1×**) with a worst
tick of **1,447.853 ms**; T-M8-01 owns profiling and budget compliance at that scale and T-M8-02
owns load shedding. Systems 20 and 21 are exercised for the first time at this gate and both sit
inside their allocations on both fixtures. System 08 has no living animals in the played fixture,
so that cell reports no exercised animal AI timing; the allocation assertion still checks its idle
overhead.

`fl_perf` (the M3 tier): average tick 0.82 ms, worst 19.69 ms, pathing 0.559 ms, relabelled on 252
of 2,000 ticks. `fl_settle`: disturbed water settles inside 4,200 ticks. `played_behavior`: 0 dwarf
deaths, lake settled at tick 2,875, 37 crafted items, 71 completed hauls, 28 and 14 hauled into the
two stockpiles.

The perf-tier `year_one_seeds` passed on all five seeds with **zero dwarf deaths on each**:

| Seed | carpenter | mason | still | kitchen | hearth | room | first brew | first crop | dwarf deaths |
|---|---|---|---|---|---|---|---|---|---|
| `year-one` | 0.92 d | 4.00 d | 11.42 d | 3.25 d | 5.42 d | 4.59 d | 17.17 d | 0.67 d | 0 |
| `year-one-b` | 0.84 d | 3.25 d | 12.59 d | 2.25 d | 4.59 d | 5.75 d | 16.50 d | 0.67 d | 0 |
| `year-one-c` | 0.84 d | 4.42 d | 11.84 d | 2.50 d | 5.75 d | 4.42 d | 16.42 d | 0.59 d | 0 |
| `year-one-d` | 0.84 d | 3.17 d | 1.59 d | 2.34 d | 5.17 d | 4.34 d | 11.09 d | 0.67 d | 0 |
| `year-one-e` | 0.84 d | 4.42 d | 2.75 d | 3.42 d | 5.92 d | 4.34 d | 11.50 d | 0.67 d | 0 |

## Properties

The command generator registry now covers M7 (T-M7-12): 20's `MoveToDepot`, `RemoveFromDepot`,
`TradeOpen`, `TradeOffer`, `TradeCancel` and `SetRequests`, and 21's `SetPopulationCap`. Settings
and keybindings are app-level state, not commands (`24` § State), so they have no generator.
`resolveCommand` now resolves entity references inside arrays and inside the records of an array,
which `TradeOffer`'s `give[].itemId` needs. Determinism under commands, the save round-trip, fluid
conservation, connectivity consistency, item accounting and the mood bound all pass with the
enlarged stream: 10 property files, 21 tests.

## Screenshots

Two screenshots were regenerated, looked at and committed (`01-testing-strategy.md` § E2E harness
allows three per gate): `reports/screenshots/game-menu.png` (the new M7 Esc menu, with the
fortress name in the title row and `[x]` on Retire) and `reports/screenshots/panels-open-and-close.png`
(the units panel and the status bar's `[?] help`). Neither shows a raw string key. The other e2e
screenshots were restored to the images an earlier gate committed.

## M8 handoff

- `current-milestone` is **8**. Every M0–M7 task is ticked in `PROGRESS.md`.
- The 80-dwarf table above is T-M8-01's baseline. Its largest excess is still system 11 jobs, now
  at 43.6× its allocation, followed by 08 animals at 22.5× and 10 dwarves at 17.4×.
- Balance findings for T-M8-06: B-001 … B-007. B-005, B-006 and B-007 are new and come from the
  full-year run; B-002 and B-003 (embark supplies against the documented season) still stand.
- C-004 and C-005 remain todo until T-M8-06 re-measures them.
- T-M8-04 (golden renders for every screen and panel) has three new panels to cover: `help` with
  its two tabs, `debug`, and the completed `overlays` list with its `Debug:` group.
- The four overlays added in M7 (`jobs`, `connectivity`, `paths`, `chunks`) tint backgrounds only
  and each builds its frame index once from the movers or the claimed jobs, never per cell.
- `scripts/strings-check.mjs` is wired into the gate; it also checks that every `RejectReason` of
  `command-catalog.md` has a `reject.<reason>` line, which the status bar now shows.
