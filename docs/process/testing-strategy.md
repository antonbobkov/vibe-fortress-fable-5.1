# Testing Strategy

**Owner:** implementation · **Depends on:** [`../04-implementation/tooling.md`](../04-implementation/tooling.md), [`../04-implementation/acceptance-tests.md`](../04-implementation/acceptance-tests.md), [`../01-architecture/simulation-core.md`](../01-architecture/simulation-core.md), [agent-workflow.md](agent-workflow.md)

Agents cannot look at the screen. Every behavior must therefore be observable through readers, events, world hashes, cell buffers or DOM/canvas probes. This document defines the tiers, the runner, and the gate. It applies to every task, whatever its size: a fix, a feature or a refactoring adds or extends tests in the same commit as the code.

## Tiers

| Tier | Tool | Location | Runs on | Purpose |
|---|---|---|---|---|
| Unit | Vitest | `test/unit/**` | every commit | Pure rules (`rules/*.ts`), core data structures, loader validation, UI panels under `jsdom`, the scripts' own logic |
| Scenario | Vitest + headless runner | `test/scenarios/**` | every commit | The acceptance tests of `04-implementation/acceptance-tests.md`, one file per scenario id |
| Property | Vitest + `fast-check` | `test/property/**` | every commit | Invariants: fluid conservation, determinism under random command streams, save round-trip, label consistency |
| Golden | Vitest | `test/golden/**` | every commit | World hashes and cell buffers for fixed seeds; changes require an explicit update script |
| E2E | Playwright (Chromium headless) | `test/e2e/**` | tasks touching `render/`, `ui/`, `app/`; every gate; nightly in CI | The real app in a browser: boot, generate, embark, issue commands through the DOM/keyboard, read the cell buffer through a test hook, take screenshots for the gate report |
| Performance | Vitest, separate config | `test/perf/**` | tasks touching code that has a budget in `performance-budget.md`; every gate; nightly in CI | Tick budgets on the reference fortress, per-system budgets, and the long balance measurements |

Dev dependencies added beyond `tooling.md`: `fast-check`, `@playwright/test`, `jsdom` (unit tests of `render/` and `ui/`), `@vitest/coverage-v8` (coverage gates). Runtime dependencies: none.

Recipe behaviour is tested through the real loop: `test/unit/workshops/recipe-smoke.test.ts` runs every recipe once from order to `ItemCrafted`. Tests that call a producer's `onComplete` directly may check output arithmetic, but a scenario named in `acceptance-tests.md` must run the loop (orders, claims, hauling, work), not call internals.

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

Every scenario file (`<id>.scenario.ts`) exports one `Scenario`. `test/scenarios/index.test.ts` checks that each file's scenario id matches its name, and the suites `m0.test.ts` … `m8.test.ts` run them, grouped by their `milestone` so that they run in parallel. **Every scenario runs on every `npm test`.** The `milestone` field records which build milestone introduced the scenario and decides only which suite runs it; a new scenario sets `milestone: 8`. A scenario that cannot pass because of a recorded contradiction carries a `todo` naming the `C-` id and is reported as todo.

Statistical scenarios (hit rates, quality distributions) run their trials inside one scenario with a fixed seed and assert against the tolerance in the acceptance table; they never use randomness outside the world's streams.

## Golden tests

- `test/golden/world-hashes.json`: `{ seed, size }` → hash of `WorldMap`; `{ seed, ticks }` → hash of the world after N ticks of `flat-test` with the default embark and no commands, for N in {0, 1000, 5000}.
- `test/golden/render/*.json`: cell buffers of the fortress viewport for `{ seed, z, camera }` at tick 0 and after a scripted command list, and of every screen and panel.
- Update only through `npm run golden:update -- <name>`, which rewrites the file and prints the diff summary. The update goes in the same commit as the behaviour change that caused it, and the commit body has a paragraph that starts with `golden:` and explains which files changed and why.
- A task that is not meant to change behaviour (a refactoring, a documentation or tooling task) must leave every golden file byte-identical.

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

The app exposes `window.__deepholm` in test builds only (`import.meta.env.MODE === 'test'`): `{ host, readers, cells(): CellBuffer, submit(cmd), setSpeed(n), step(n), screenshotName(name) }`. Playwright tests drive the real UI (keys and clicks) and assert through `cells()` and readers; they never call `submit` except to set up state faster. Every e2e test also saves a screenshot to `reports/screenshots/<test>.png`. That folder is ignored by git; a screenshot is committed only when a gate report shows it (3 per gate maximum, downscaled).

E2E suite: `boot`, `generate-and-embark`, `designate-by-drag`, `build-and-stockpile`, `panels-open-and-close`, `quick-save-load`, `fluid-overlay`, `farm-plot-and-orders`, `military-and-alert`, `trade-session`, `save-load-settings`, `game-menu`, `export-import`, `labor-manager`, `full-year` (plays a scripted first year at 4× and checks the year-one expectation table of `balance.md`), `boot-dist` (`boot` against the built output). A task that adds a screen or a multi-step interaction adds or extends a spec here.

E2E starts a test-mode development server and a separate static server for a test-mode build of `dist/`. Production builds omit `window.__deepholm`: run `npm run build` after the e2e suite to restore production output.

## Coverage gates

Vitest coverage (`@vitest/coverage-v8`) thresholds, enforced whenever the tests run with `--coverage`, which every gate does: `src/core` 90% lines, `src/systems/**/rules` 90%, `src/systems/**` 75%, `src/render` 60%, `src/ui` 50%. Thresholds are set in `vitest.config.ts` and raised, never lowered.

## Performance smoke

`test/perf/reference-fortress.ts` builds the reference fortress of `performance-budget.md` from a saved fixture (`test/fixtures/reference-fortress.deepholm`). Assertions: average tick ≤ 2× the budget of the systems present, worst tick ≤ 40 ms; `per-system.test.ts` holds each system to twice its allocation. The tier also holds the long measurements that are too slow for `npm test` (the 20-seed three-year sweep, the mood instrument). It runs at every gate (unless the gate is run with `--no-perf`), nightly in CI, and for any task that touches budgeted code. It takes about 40 minutes.

## Commands

```
npm run lint             eslint src test scripts
npm run typecheck        tsc --noEmit
npm run content:check    scripts/content-check.mjs: src/content JSON against schemas and id cross-references
npm run strings:check    scripts/strings-check.mjs: no missing and no unused string key
npm run interface:check  scripts/interface-check.mjs: Interfaces sections of docs/02-systems against the code
npm run docs:check       scripts/docs-links-check.mjs: no broken relative link in docs/, reports/, agents/, README.md
npm test                 vitest run (unit, every scenario, property, golden)
npm run test:e2e         playwright test
npm run test:perf        vitest run -c vitest.perf.config.ts
npm run build            tsc --noEmit, vite build, scripts/build-check.mjs
npm run content:export   scripts/export-tables.mjs: docs/03-content tables to src/content JSON
npm run golden:update    scripts/golden-update.mjs <name>
npm run gate             all of the checks above, then writes reports/gates/<label>-gate.md (label: an argument, or the date)
```

CI (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, `content:check`, `strings:check`, `interface:check`, `docs:check`, `test` and `build` on every push, and adds `test:e2e` and `test:perf` nightly.

## The docs link check

`scripts/docs-links-check.mjs` reads every Markdown file under `docs/`, `reports/` and `agents/`, and the root `README.md`. It fails on an inline link or image whose relative target does not exist. It skips URLs, in-page anchors, fenced code and inline code, and it does not resolve the heading after a `#`. A task that moves or renames a document fixes every link to it in the same commit; the check is how it finds them. `test/unit/docs-links-check.test.ts` runs the same check, so `npm test` fails on a broken link too.

## Test naming

`describe('T-123 designations', ...)` for unit tests, with the id of the task that adds them; scenario ids as file names (`tr_dig_room.scenario.ts`). A test that pins a choice made under the [ambiguity protocol](ambiguity-protocol.md) says in its name what it pins; one that pins a decision-log row or a contradiction names the row: `it('D-007: ...')`, `it.todo('C-009: ...')`. Existing tests keep the labels they were written with (`T-M1-03`, `F-12`, `U-03`).
