# M8 — Polish and Balance

**Goal:** performance within budget, load shedding, snapshots and export, golden renders for every screen, the e2e full year, and the balance pass. **Gate:** every scenario green, `perf_*` within budget, coverage thresholds, e2e suite including `full-year`.

Spec: [`performance-budget.md`](../01-architecture/performance-budget.md), [`balance.md`](../03-content/balance.md), [`acceptance-tests.md`](../04-implementation/acceptance-tests.md) § Performance.

## T-M8-01 Profiling pass and per-system budgets (L)

Needs: M7. Produces: `host.stats()` moving averages and worst cases; `test/perf/per-system.test.ts` asserting each system's average on the reference fortress against `performance-budget.md` × 2; optimizations only where a system exceeds its budget (candidates named in the budget table's Mitigation column). No rule changes.
Tests: `perf_reference`, `perf_gen`; the gate report lists per-system timings before and after.

## T-M8-02 Load shedding (S)

Needs: 01. Produces: the three shedding rules and recovery; status bar yellow speed indicator.
Spec: `performance-budget.md` § Load shedding rules.
Tests: unit: rules engage after 2 s below 80% and relax after 5 s (simulated clock); non-dwarf path budget halves.

## T-M8-03 Snapshots, export, import, storage quota handling (S)

Needs: M2-11. Produces: rolling `snapshot-<n>` on `SeasonChanged` after the autosave, `c_load_snapshot`, export file naming, import validation messages, quota-exceeded announcement and export offer.
Spec: `persistence.md` § Autosave and snapshots, § Export and import, § Failure handling.
Tests: unit: rotation; quota error path (mocked adapter); e2e: export downloads a file and import restores it (Playwright download and file chooser).

## T-M8-04 Golden renders for every screen and panel (M)

Needs: M7. Produces: `test/golden/render/*.json` for each wireframe in `04-implementation/ui-screens/` at a fixed state (built through `TestWorld` and the UI state), plus a visual diff script that renders goldens to PNG for the gate report.
Tests: every screen and panel has a golden; `golden:update` documented in the commit.

## T-M8-05 E2E `full-year` (M)

Needs: M7-11. Produces: `test/e2e/full-year.spec.ts`: boots the app, generates world `e2e-year`, embarks Balanced at a `serene_vale` region found through the filter panel, then drives a scripted first year through the real UI at 4× (dig, stockpiles, still, farm, hearth, bedrooms, depot) with checkpoints from `balance.md` § Year-one expectation; three screenshots for the report.
Tests: the spec itself; runtime ≤ 10 minutes.

## T-M8-06 Balance pass (L)

Needs: 05. Produces: run `year_one` and a `three_years` headless scenario over 20 seeds and three regions (peril 0/2/4); compare against `balance.md` tables (consumption, wealth curve, raid sizes, immigration, mood distribution); where a measured value differs from the model by more than 30%, record it in `DECISIONS.md` as a balance finding with the constant that would fix it and **do not change the constant** (constants are the user's to change); implement only fixes for bugs revealed (a rule not matching the spec).
Tests: `test/scenarios/three_years.scenario.ts` (milestone 8) reports the table; assertions only on the deterministic guarantees (mood floor, no spiral, caps).

## T-M8-07 Colorblind palette and accessibility checks (S)

Needs: M7-07. Produces: alternate palette complete for every state color; a test that no two state colors used side by side are identical in either palette; every state has a distinct glyph or word per `24` § Accessibility.
Tests: unit over the palette tables.

## T-M8-08 Documentation sync (S)

Needs: all. Produces: `scripts/interface-check.mjs`: lists each system's exported reader methods, emitted events and owned commands from the code and diffs against the "Interfaces" sections of `02-systems/*.md`; any difference is either a code bug (fix) or a spec typo (one-line fix in the doc with an `Implementation note:` prefix, logged in `DECISIONS.md`).
Tests: the script runs green in CI.

## T-M8-09 Release build (S)

Needs: 01–08. Produces: `vite build` output verified (single bundle, font, css); a static-server e2e smoke against the built output; `README.md` at the repo root with how to run, test and play (links to `docs/`).
Tests: e2e `boot` against `dist/`.

## T-M8-10 Gate M8 — release (S)

Needs: all. `reports/M8-gate.md` with: every scenario id and status, coverage, per-system timings, the three-year balance table, screenshots; `PROGRESS.md` header `current-milestone: done`; tag `v1.0.0`; push.
