# F-04 — A real year-one bootstrap scenario that asserts (M)

**Needs:** F-01, F-02, F-03, F-05 · **Spec touched:** `04-implementation/acceptance-tests.md` (one new row), `05-plan/M6-steel-and-blood.md` and `05-plan/M7-outside-world.md` (gate lines), `05-plan/DECISIONS.md` (balance findings)

## Why

`test/scenarios/year_one.scenario.ts` is the only long integration test, and it cannot succeed:

- It never digs. The still needs a barrel and raw stone, the kitchen a table and raw stone, the hearth three stone blocks and a log. The Balanced embark carries no stone, so these can never be built.
- Its stockpile has no filter, and a new stockpile accepts nothing (D-071).
- It asserts only that the carpenter was built. Everything else is logged.

The M4 and M5 gate reports describe the missing buildings as "balance observations for T-M8-06", which they are not. When a probe that actually plays the opening was run (F-01 § Why), it found the livelock and the stacked-input defect, both of which stop a fortress dead. The core loop needs a test that plays it.

## Decisions

1. **Decision F-04a — the fixture.**
   - A 48×48 `flat-test` map (`buildFlatTestMap(registry, 48, 48)`), Balanced embark (`embark: 'default'`), seed `year-one`, 20 days.
   - Played only through player commands (listed below), except for one spring laid through the terrain API: `flat-test` has no water, and every real region has some.
   - The spring is one surface tile holding a level-7 water source, walled on its four cardinal sides (water spreads cardinally only) and drinkable from its four diagonals.
2. **Decision F-04b — what it asserts.**
   - The production loop progresses: dig → haul → build → craft → brew, cook and farm.
   - The job loop stays healthy (a guard against F-01's livelock returning).
   - Nobody dies.
   - It does **not** assert the balance table's days. Those are balance targets, and the measurements below show the pace is set by food running out (F-08 Decision F-08e). Each checkpoint's bound comes from a measurement rule, and every checkpoint that misses the balance-table day is recorded as a balance finding for T-M8-06.
3. **Decision F-04c — the calibration rule.** After F-01, F-02, F-03 and F-05 are merged:
   - run the five seeds `year-one`, `year-one-b`, `year-one-c`, `year-one-d` and `year-one-e`;
   - for each checkpoint below take the latest day among them, `max`;
   - the scenario's bound is `ceil(max × 1.25)` days, but never later than day 20;
   - a checkpoint that some seed does not reach within 20 days is a defect: diagnose it (the F-01 probe diagnostics below are the starting point) and fix it, or record it in `DECISIONS.md` as a contradiction if the spec prevents it.

   Do not tune constants.

## The script (`test/scenarios/year_one.scenario.ts`, replacing the file)

Coordinates are relative to the wagon's centre `(cx, cy)` (`w.game.arrival.wagon`), `Z = FLAT_TEST_SURFACE_Z` (32). Zones use only the tiles for which `zoneTileQualifies` holds and that hold no zone. A building is placed only if `ghost(...).reason === null`; otherwise the scenario fails with the reason.

Day 0, in this order:

1. The spring: set `(cx+9, cy+3, Z)`, `(cx+7, cy+3, Z)`, `(cx+8, cy+4, Z)` and `(cx+8, cy+2, Z)` to `Wall` granite through `w.game.world.services.terrain.setKind`, then `w.setFluid(w.index(cx+8, cy+3, Z), 7, 'water', true)`.
2. `CreateZone stockpile` over the 6×4 rectangle at `(cx−3, cy+4)`, then `SetStockpileFilter { filter: 'everything' }`.
3. `DesignateStairwell { x: cx+6, y: cy+6, zTop: 32, zBottom: 29 }`.
4. `Designate { kind: 'dig', priority: 4 }` over the 5×5 rectangle at `(cx+7, cy+4, 29)`.
5. `PlaceBuilding` (orientation 0, `materialChoice` 0): `carpenter` at `(cx−8, cy+10)`, `mason` at `(cx−4, cy+10)`, `still` at `(cx, cy+10)`, `kitchen` at `(cx+4, cy+10)`, `hearth` at `(cx−1, cy+15)`.
6. `CreateZone meeting_area` over the 5×3 rectangle at `(cx−3, cy+16)`.
7. `w.step(5)`. Then `CreateZone farm_plot` over the 4×4 rectangle at `(cx−8, cy+16)`, and `SetPlotCrop` with `barley` for seasons 0 and 1.

Then step 100 ticks at a time to day 20. At each step, record the first tick at which each building is `built` and at which all 25 room tiles are `Floor`. As soon as each workshop is built, issue its order once:

- mason: `make_stone_block`, `once`, 2;
- still: `brew`, `maintain`, threshold 20;
- kitchen: `cook_easy_meal`, `maintain`, threshold 10.

## Assertions

| Checkpoint | Balance-table target | Measured on 5 seeds with the F-01, F-02 and F-03 prototypes, spring, **without F-05** | Bound |
|---|---|---|---|
| carpenter built | days 1–3 | 0.4–0.5 | by rule (≤ 1) |
| still built | days 1–3 | 2.0–6.7 | by rule |
| kitchen built | days 10–20 | 4.9–9.3 | by rule |
| mason built | — | 4.0–9.5 | by rule |
| hearth built and `HearthLit` | days 4–10 | 9.5–11.8 | by rule |
| 5×5 room dug | — | 9.7–11.8; one seed not by day 20 (see below) | by rule |
| ≥ 1 `ItemCrafted { recipeId: 'brew' }` | — | 0–1 (one seed made none) | by day 20 |
| ≥ 1 `CropPlanted` | days 10–20 | 10 on every seed | by day 20 |
| `CreatureDied` | — | 0 | none |
| `JobBlocked { reason: 'missing_input' }` over 20 days | — | 38–55 (2,239 before F-01) | ≤ 200 |
| `Talked` events | — | 63–81 | ≥ 10 |

The room and brew misses in the measured column are expected to disappear with F-05: underground miners could not find the spring (13–29 thirst `Starving` announcements per seed) and ate the brewable dimcaps raw. If they do not disappear after F-05, they are defects to diagnose (Decision F-04c).

For each checkpoint whose calibrated bound is later than its balance-table target, append a row to `DECISIONS.md` § Balance findings:

`| B-<n> | year-one … year-one-e | flat-test 48×48 + spring | <checkpoint> | <table day> | <min–max measured> | hunger and thirst need rates (balance.md § Needs and consumption), embark supplies (embark-catalog.md § Presets) |`

## Supporting test

`test/perf/year_one_seeds.test.ts` in the perf tier (`npm run test:perf`, not `npm test`) runs the same script for all five seeds and prints one line per seed with every checkpoint day. It is the calibration tool for Decision F-04c and a gate-report input from M6 on. It asserts only that no seed has a `CreatureDied`.

## Diagnostics to keep in the file (as a helper, not assertions)

When an assertion fails, the scenario prints, via a `diagnose(w)` helper:

- each dwarf's `Brain.behavior` and `activity`, `Worker.jobId` and `toolId`;
- counts of `open` jobs by key prefix;
- counts of `JobClaimed`, `JobBlocked` (by reason), `JobUnblocked` and `JobCompleted` by job type;
- `items.count` for `raw_stone`, `stone_block`, `log`, `drink` and `plant_food`.

These are the diagnostics that found F-01.

## Spec amendments

`docs/04-implementation/acceptance-tests.md` § 10 Dwarves: add the row

| `year_one` | 48×48 flat-test with one spring, Balanced embark, the opening orders of `05-plan/fixes/F-04-bootstrap-scenario.md`, 20 days | carpenter, still, mason, kitchen, hearth built and the room dug within their calibrated bounds; ≥ 1 brew; crops planted; nobody dies; ≤ 200 `missing_input` blocks |

`docs/05-plan/M6-steel-and-blood.md` gate line and `docs/05-plan/M7-outside-world.md` gate line: add "`year_one` and the perf-tier `year_one_seeds` (no deaths on any seed)". From M6 on, the scenario is where starvation and dehydration deaths would first show.

## Done

- `year_one` rewritten and passing; `year_one_seeds` added to the perf tier.
- Bounds set by Decision F-04c, with the five-seed measurement quoted in the scenario's header comment.
- Balance-finding rows added for every checkpoint later than its table day.
- Do not edit past gate reports. The next gate report's year-one section reports this scenario's output instead.
