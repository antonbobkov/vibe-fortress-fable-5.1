# M0 — Skeleton

**Goal:** a repository that builds, lints, tests, loads all content, runs a headless world with the core loop, and draws a flat map in the browser. **Gate:** `core_*` scenarios, content check, lint, coverage thresholds, e2e `boot`.

Spec: [`../01-architecture/`](../01-architecture/architecture-overview.md) (all files), [`../04-implementation/schemas/`](../04-implementation/schemas/components.md), [`../04-implementation/tooling.md`](../04-implementation/tooling.md), [`../04-implementation/tick-order.md`](../04-implementation/tick-order.md).

## T-M0-01 Repository bootstrap (S)

Needs: —. Produces: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `vitest.perf.config.ts`, `eslint.config.js`, `.prettierrc`, `playwright.config.ts`, `index.html`, `src/app/main.ts` (empty boot), `test/` skeleton, `scripts/` skeleton, `reports/.gitkeep`, `.gitignore`.
Steps: exactly the configuration in `tooling.md` (aliases, strict flags, ESLint boundary zones, restricted globals) plus `fast-check` and `@playwright/test`. `npm run gate` script stub that runs the other scripts in order and writes `reports/M0-gate.md`.
Tests: `test/unit/tooling.test.ts` asserts that importing `@systems/x/state` from `src/render` fails lint (run ESLint programmatically on a fixture); that `Math.random` in `src/core` fails lint.
Done: `npm run lint`, `typecheck`, `test` green on an empty project.

## T-M0-02 Fixed-point math and rng (S)

Needs: 01. Produces: `src/core/fixed.ts`, `src/core/rng.ts`.
Spec: `simulation-core.md` § Random numbers, § Fixed-point math.
Tests: unit: `xoshiro128**` matches three published reference vectors; `int`, `chance`, `pick`, `weighted`, `shuffle` are deterministic per seed; `fmul/fdiv/flerp/fsqrt` against known values; overflow guard test.

## T-M0-03 Constants (S)

Needs: 01. Produces: `src/core/constants.ts` with every row of `constants.md` as a named export, plus a generated `test/unit/constants.test.ts` that asserts each value against a parsed copy of the Markdown table (script `scripts/parse-constants.mjs` reads `docs/01-architecture/constants.md`).
Done: any drift between doc and code fails the test.

## T-M0-04 Map3D and chunks (M)

Needs: 02, 03. Produces: `src/core/map3d.ts`.
Spec: `data-model.md` § Map3D (grids, tile kinds, designation nibble packing, flags, chunks), `components.md` enums.
Tests: unit: index math round-trips; grid sizes; flag set/clear; designation packing; chunk index; `neighbors(i)` (6 and 8 and 26) at edges; `columnSurfaceZ`. Property: random `setFlag` sequences leave other bits untouched.

## T-M0-05 Entity store and components (M)

Needs: 04. Produces: `src/core/entities.ts`, `src/core/components.ts` (every component interface from `components.md`, a `ComponentType` registry with owner metadata).
Spec: `data-model.md` § Entities; `components.md`.
Tests: unit: ids with generations (`alive` false after destroy, reused slot has a new generation); `with(a,b)` iterates ascending; SoA `Position` arrays; component ownership metadata matches the ownership table (parsed from the doc by a script, like constants).

## T-M0-06 Registry and content loader (L)

Needs: 05. Produces: `src/content/schema.ts` (validators for every row type in `content-rows.md`), `src/content/loader.ts`, `src/core/registry.ts`, `scripts/export-tables.mjs` (Markdown tables of `docs/03-content` → `src/content/*.json`), `scripts/content-check.mjs`, and the committed JSON tables.
Spec: `content-pipeline.md` (all), `content-rows.md` (all), `minerals-and-metals.md` § Generated recipes, `materials.md` § Generated per species.
Steps: write the exporter first; it must handle the column conventions (decimals → Fixed, hours/days → ticks, `[min, max]` ranges, `id`-first tables, the two-column-pair color table). Run it; commit the JSON. Loader: parse, validate, resolve references, assign indices sorted by id, build derived structures (recipes by workshop, thoughts by trigger, species by biome, item types by category), generate smelting/alloy/melt recipes and per-species materials, compute the content hash, freeze.
Tests: unit: every table loads; a fixture with a dangling id fails with table/row/field; generated recipes match `minerals-and-metals.md` (`smelt_galena` yields lead + 50% silver); `hematite` index is stable across loads; the content hash changes when a value changes. `npm run content:check` exits non-zero on a broken fixture.
Done: all 03-content tables round-trip; `content:check` green.

## T-M0-07 Calendar, event queue, command queue (S)

Needs: 02. Produces: `src/core/calendar.ts`, `src/core/events.ts`, `src/core/commands.ts`.
Spec: `simulation-core.md` § Calendar, § Events, § Commands; `event-catalog.md` and `command-catalog.md` type unions (generate `src/core/event-types.ts` and `command-types.ts` from the catalogs with a script, or hand-write and test against the catalog's parsed list).
Tests: unit: boundary events at exact ticks; FIFO order; events emitted during dispatch land in the next tick; command log entries; the type unions contain every catalog name (parsed from the docs).

## T-M0-08 Scheduler, World, system contract (M)

Needs: 04, 05, 07. Produces: `src/core/world.ts`, `src/core/scheduler.ts`, `src/core/system.ts` (the `GameSystem` interface, `InitContext`, `TickContext`, `RegistrationApi` with all registration slots as no-op registries), `src/core/readers.ts` (`ReaderSet` with core readers).
Spec: `module-interfaces.md` (all), `simulation-core.md` § The tick, `tick-order.md`.
Tests: unit: a fake system with cadence 10 phase 3 ticks at 3, 13, 23; system order respected; `applyCommand` routing by owner; rejection produces `CommandRejected`; a system emitting during `handle` is delivered next tick. Scenario `core_event_order`, `core_command_rejection`, `core_calendar` (with no real systems).

## T-M0-09 Spatial index, movement helper, pathfinding stubs (M)

Needs: 08. Produces: `src/core/spatial.ts`, `src/core/movement.ts`, `src/core/pathfinding.ts` and `src/core/connectivity.ts` as full implementations of `pathfinding-and-connectivity.md` **except** building-dependent passability (a hook returning false until M2).
Spec: `22-pathfinding-and-spatial.md`, `algorithms/pathfinding-and-connectivity.md`.
Tests: unit: passability per kind; diagonal corner rule; stairs and ramp edges both directions (the ramp rule in words); A* on hand-built 3D mazes equals BFS distance (with costs 1000); node budget resumes across ticks; connectivity labels equal BFS reachability (property test); `moveAlongPath` steps, falls, blocks; spatial `inRadius` correctness vs brute force. Scenarios `pf_ramp`, `pf_corner`, `pf_labels`, `pf_budget` (all on hand-built maps through `TestWorld`).

## T-M0-10 Serialization core (M)

Needs: 08. Produces: `src/core/serialize.ts` (value helpers, typed array base64, sorted Map/Set), `src/app/save-manager.ts` (container format, sections, header), `src/platform/storage.ts` (IndexedDB adapter with an in-memory fallback for tests), `src/platform/compress.ts`.
Spec: `persistence.md`, `save-format.md`.
Tests: unit: container round-trip byte-exact; header parse without inflating; sections in order; typed arrays preserved; `Map` order canonical; a save with `formatVersion + 1` is refused; content hash mismatch soft-match logic with a fixture registry.

## T-M0-11 Headless runner and TestWorld (M)

Needs: 08, 09, 10. Produces: `src/app/headless.ts`, `test/scenarios/runner.ts`, `test/scenarios/test-world.ts`, `test/scenarios/index.test.ts`, `test/golden/*` scaffolding, `scripts/golden-update.mjs`, `scripts/world-hash.mjs`.
Spec: `simulation-core.md` § Headless mode, `01-testing-strategy.md`.
Steps: `flat-test` world builder (flat granite at z=32, 3 soil levels, no caverns above z=20, magma sea per spec) built directly into `Map3D` (the real generator arrives in M1; keep this builder afterwards as the test fixture). `hash()` covers grids, entities in id order, every system's `serialize()`.
Tests: scenario `core_determinism` (two runs, hashes at 1,000/5,000/10,000 on the empty flat world), property `determinism under commands` with the command generator producing only commands that exist so far (none yet: the generator is a registry that later tasks extend).

## T-M0-12 Platform, glyph atlas, palette, renderer (M)

Needs: 03, 06. Produces: `src/platform/canvas.ts`, `src/platform/input.ts`, `src/platform/realtime.ts`, `src/render/palette.ts` (from `glyphs-and-colors.md` JSON), `src/render/atlas.ts`, `src/render/renderer.ts` (draw a `CellBuffer`), `src/render/cellbuffer.ts`.
Spec: `23-rendering.md` § Canvas and cells, § Atlas, § Palette; `algorithms/compositor.md` § draw and atlas.
Tests: unit (jsdom + `canvas` mock): atlas builds `glyphCount` sprites per color; LRU eviction at `ATLAS_COLOR_CACHE`; `dim()` cached; layout arithmetic (`computeLayout`) for several window sizes including the step-down rule; the renderer issues one `fillRect` per bg run (spy).

## T-M0-13 Compositor (terrain only), app boot, e2e hook (M)

Needs: 11, 12. Produces: `src/render/compositor.ts` (terrain, open-tile look-down, undiscovered; fluid/building/item/creature layers as no-ops until their milestones), `src/app/game.ts` (screen stack with only `fortress` for now, loading the `flat-test` world), `src/app/sim-host.ts` (`InProcessHost`, frame loop with `MAX_TICKS_PER_FRAME` and hidden-tab pause), keyboard pan and z-level, `window.__deepholm` test hook, `test/e2e/boot.spec.ts`.
Spec: `simulation-core.md` § The frame loop, `23-rendering.md` § Compositor steps 1–2 and 10, `24-ui-and-input.md` § Map keys (pan, z).
Tests: unit: compositor golden for a hand-built 8×8 map (all kinds, a 3-deep shaft, undiscovered corner) with the cell buffer compared to `test/golden/render/m0-terrain.json`; scenario `rd_levels_below` (the 3-deep shaft: floor 2 below dimmed twice, 3 below shows abyss). E2E `boot`: page loads, canvas present, `cells()` non-empty, pressing `>` changes `readers.ui.z`, screenshot saved.

## T-M0-14 Gate M0 (S)

Needs: all above. Runs `npm run gate`; writes `reports/M0-gate.md`; sets `current-milestone: 1` in `PROGRESS.md`. Coverage thresholds active from here.
