# Testing Strategy

**Detail level:** plan · **Depends on:** [`../04-implementation/tooling.md`](../04-implementation/tooling.md), [`../04-implementation/acceptance-tests.md`](../04-implementation/acceptance-tests.md), [`../01-architecture/simulation-core.md`](../01-architecture/simulation-core.md)

Agents cannot look at the screen. Every behavior must therefore be observable through readers, events, world hashes, cell buffers or DOM/canvas probes. This document defines the tiers, the runner, and the gates.

## Tiers

| Tier | Tool | Location | Runs on | Purpose |
|---|---|---|---|---|
| Unit | Vitest | `test/unit/**` | every commit | Pure rules (`rules/*.ts`), core data structures, loader validation |
| Scenario | Vitest + headless runner | `test/scenarios/**` | every commit (milestone-tagged) | The acceptance tests of `04-implementation/acceptance-tests.md`, one file per scenario id |
| Property | Vitest + `fast-check` | `test/property/**` | every commit | Invariants: fluid conservation, determinism under random command streams, save round-trip, label consistency |
| Golden | Vitest | `test/golden/**` | every commit | World hashes and cell buffers for fixed seeds; changes require an explicit update script |
| E2E | Playwright (Chromium headless) | `test/e2e/**` | tasks touching `render/`, `ui/`, `app/`; every gate | The real app in a browser: boot, generate, embark, issue commands through the DOM/keyboard, read the cell buffer through a test hook, take screenshots for the gate report |
| Performance | Vitest, separate config | `test/perf/**` | gates M3, M6, M8 | Tick budgets on the reference fortress |

Dev dependencies added beyond `tooling.md`: `fast-check`, `@playwright/test`, `jsdom` (unit tests of `render/` and `ui/`), `@vitest/coverage-v8` (coverage gates). Runtime dependencies: none.

## The scenario runner

`test/scenarios/runner.ts` implements the scenario spec of `simulation-core.md` § Headless mode as a superset (`world` generalizes `region`; `setup`, `run` and `expect` generalize `ticks` and `assertions`):

```ts
interface Scenario {
  id: string; milestone: 0|1|2|3|4|5|6|7|8;
  seed: string;
  world: 'flat-test' | 'generated' | { region: Partial<RegionRecord> };   // 'flat-test' per acceptance-tests.md
  embark?: 'default' | 'none' | EmbarkSpec;                                // 'none' = no dwarves (pure environment tests)
  setup?: (w: TestWorld) => void;            // direct world edits before tick 0 (dig rooms, place items, spawn creatures) through TestWorld helpers
  commands?: { tick: number; command: Command }[];
  run: number | ((w: TestWorld) => void);    // ticks, or a driver that steps and asserts
  expect?: (w: TestWorld) => void;           // assertions after run
}
```

`TestWorld` wraps `World` with helpers that call only public APIs and the spawn API: `digRoom(x, y, z, w, h)`, `placeFloorSlab(...)`, `spawnDwarf(opts)`, `spawnCreature(species, at, faction)`, `spawnItem(type, material, at, count)`, `build(type, at, materialChoice)` (completes the build instantly through the same code path as the job, for setup only), `zone(type, tiles)`, `setNeed(id, need, value)`, `setSkill(id, skill, level)`, `forceWeather(state)`, `forceTemperature(tile, c)`, `events(type)` (all events of a type since tick 0), `hash()`, `step(n)`, `until(pred, maxTicks)`.

Every scenario file exports one `Scenario` and is discovered by `test/scenarios/index.test.ts`, which runs those with `milestone ≤ CURRENT_MILESTONE` (read from `PROGRESS.md`'s header line `current-milestone: n`).

Statistical scenarios (hit rates, quality distributions) run their trials inside one scenario with a fixed seed and assert against the tolerance in the acceptance table; they never use randomness outside the world's streams.

## Golden tests

- `test/golden/world-hashes.json`: `{ seed, size }` → hash of `WorldMap`; `{ seed, ticks }` → hash of the world after N ticks of `flat-test` with the default embark and no commands, for N in {0, 1000, 5000}.
- `test/golden/render/*.json`: cell buffers of the fortress viewport for `{ seed, z, camera }` at tick 0 and after a scripted command list.
- Update only through `npm run golden:update -- <name>`, which rewrites the file and prints the diff summary; the commit message must start with `golden:` and explain why.

## Property tests

| Property | Generator | Invariant |
|---|---|---|
| fluid conservation | random sealed basins, random initial levels, 500 steps | Σ levels constant; every tile settles: after 500 steps the only active tiles are isolated level-1 water tiles waiting to evaporate (D-090) |
| determinism under commands | random valid command streams over 2,000 ticks, run twice | equal hashes every 100 ticks |
| save round-trip | random tick to save at during a scripted run | equal hash to the uninterrupted run |
| connectivity consistency | random wall placements/removals | `reachable(a, b)` equals BFS reachability for 50 random pairs |
| item accounting | random craft/haul/destroy streams | `counts` equals a recount from entities |
| mood bounds | random thought streams with needs met | mood ≥ 20 |

## E2E harness

The app exposes `window.__deepholm` in test builds only (`import.meta.env.MODE === 'test'`): `{ host, readers, cells(): CellBuffer, submit(cmd), setSpeed(n), step(n), screenshotName(name) }`. Playwright tests drive the real UI (keys and clicks) and assert through `cells()` and readers; they never call `submit` except to set up state faster. Every e2e test also saves a screenshot to `reports/screenshots/<test>.png` (committed only at gates, 3 per gate maximum, downscaled).

E2E suite (grows per milestone): `boot` (M0), `generate-and-embark` (M1), `designate-by-drag` (M1), `build-and-stockpile` (M2), `panels-open-and-close` (M2), `quick-save-load` (M2), `fluid-overlay` (M3), `farm-plot-and-orders` (M4, extended in M5), `military-and-alert` (M6), `trade-session` (M7), `save-load-settings` (M7), `game-menu` (M7), `export-import` (M8), `full-year` (M8: plays a scripted first year at 4× and checks the year-one expectation table of `balance.md`), `boot-dist` (M8: `boot` against the built output).

## Coverage gates

Vitest coverage (`@vitest/coverage-v8`) thresholds, enforced at every milestone gate: `src/core` 90% lines, `src/systems/**/rules` 90%, `src/systems/**` 75%, `src/render` 60%, `src/ui` 50%. Thresholds are set in `vitest.config.ts` and raised, never lowered.

## Performance smoke

`test/perf/reference-fortress.ts` builds the reference fortress of `performance-budget.md` from a saved fixture (created at M6 gate) or, before it exists, from a synthetic builder. Assertions: average tick ≤ 2× the budget of the systems present, worst tick ≤ 40 ms. Runs at gates M3, M6, M8 and nightly.

## Commands

```
npm run typecheck      tsc --noEmit
npm run lint           eslint src test scripts
npm run content:check  scripts/content-check.mjs
npm test               vitest run (unit, scenarios ≤ current milestone, property, golden)
npm run test:e2e       playwright test
npm run test:perf      vitest run -c vitest.perf.config.ts
npm run golden:update  scripts/golden-update.mjs
npm run gate           runs all of the above and writes reports/M<n>-gate.md
```

## Test naming

`describe('T-M1-03 designations', ...)` for unit tests; scenario ids as file names (`tr_dig_room.scenario.ts`). A test that pins a `DECISIONS.md` entry names it: `it('D-007: ...')`.
