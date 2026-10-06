# Tooling

**Owner:** implementation · **Depends on:** [`../01-architecture/tech-stack.md`](../01-architecture/tech-stack.md)

## package.json (dependencies)

Runtime: none. Dev: `typescript`, `vite`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `fast-check`, `@playwright/test`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `prettier`, `@types/node` (types only: the configuration files, the scripts and the tests use Node's built-in modules).

Scripts: `dev` (vite), `build` (tsc --noEmit && vite build), `typecheck` (tsc --noEmit), `test` (vitest run: unit, every scenario, property, golden), `test:e2e` (playwright test), `test:perf` (vitest run -c vitest.perf.config.ts), `lint` (eslint src test scripts), `content:check` (node scripts/content-check.mjs: validates JSON tables against the schemas and cross-references ids), `golden:update` (node scripts/golden-update.mjs <name>), `docs:check` (node scripts/docs-links-check.mjs: fails on a broken relative link in `docs/`, `reports/`, `agents/` or the root `README.md`), `gate` (node scripts/gate.mjs [label]: runs all of the above and writes `reports/gates/<label>-gate.md`; the label defaults to the date), `hash` (node scripts/world-hash.mjs <save>). [`../process/testing-strategy.md`](../process/testing-strategy.md) is the authority on test tiers and commands.

## tsconfig

`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `target ES2022`, `module ESNext`, path aliases `@platform/*`, `@core/*`, `@content/*`, `@systems/*`, `@render/*`, `@ui/*`, `@app/*` → `src/<layer>/*`.

## ESLint boundaries

```js
// eslint.config.js (excerpt)
const boundaries = [
  { from: 'src/core',     deny: ['@systems', '@render', '@ui', '@app', '@content'], allow: ['@platform/interfaces'] },
  { from: 'src/content',  deny: ['@systems', '@render', '@ui', '@app', '@platform'] },
  { from: 'src/systems',  deny: ['@render', '@ui', '@app', '@platform'] },
  { from: 'src/render',   deny: ['@app', '@platform/storage'], denyPattern: ['@systems/*/state', '@systems/*/tick', '@systems/*/rules'] },
  { from: 'src/ui',       deny: ['@app'],                      denyPattern: ['@systems/*/state', '@systems/*/tick', '@systems/*/rules'] },
  { from: 'src/systems/*', denyPattern: ['@systems/!(<self>)/state'] },   // no system imports another's state.ts
];
// every row is enforced twice: by the core no-restricted-imports rule over the alias specifiers (the form
// source files use), and by eslint-plugin-import's no-restricted-paths zones for relative cross-layer imports,
// which cannot see a path alias
```

Additional rules, in `src/core`, `src/systems` and `src/content`: `no-restricted-globals` for `Date` and `performance`, and `no-restricted-properties` for `Math.random`, `Date.now` and `performance.now` (a global rule can only ban a whole identifier, and `Math` must stay usable). In `src/systems` and `src/core`: `no-restricted-syntax` forbidding `for...of` over a `Map` or `Set` iterator method (`.keys()`, `.values()`, `.entries()`, and `.forEach`), except on `Object`, `Array` and `Reflect`; use the sorted helpers. A bare `for (const x of map)` cannot be told from an array loop without type information, so it is left to review and to the determinism scenario. Everywhere: `@typescript-eslint/switch-exhaustiveness-check`.

## Test layout

```
test/
  unit/            per-module rule tests (pure functions in rules/)
  scenarios/       one file per scenario id from acceptance-tests.md; a shared runner builds the world from the scenario spec
  property/        fast-check invariants (fluid conservation, determinism under commands, save round-trip, …)
  golden/          world hashes and render cell buffers for fixed seeds; updated only by an explicit script with a commit message noting the change
  e2e/             Playwright specs against the real app
  fixtures/saves/  one save per published formatVersion
  perf/            reference fortress builder and the budget assertions
scripts/
  content-check.mjs   schema + id cross-reference over src/content/*.json
  world-hash.mjs      reads a save container and prints its header and world hash
  export-tables.mjs   converts docs/03-content Markdown tables to src/content JSON; the JSON is committed
  golden-update.mjs   rewrites a golden file and prints the diff summary
  replay.mjs          replays a season's command log from a save
```

## CI

On every push: `lint`, `typecheck`, `content:check`, `strings:check`, `interface:check`, `docs:check`, `test`, `build`; nightly: `test:e2e` and `test:perf`. Golden changes require a reviewer.

## Content authoring loop

1. Edit the Markdown table in `docs/03-content`.
2. Run `export-tables.mjs` (or edit the JSON by hand, keeping field names identical).
3. Run `content:check`; fix any dangling id.
4. Run the scenario tests touched by the table (the runner maps table names to scenario ids).

## Debug and replay

- `F12` debug panel in the game.
- A season's command log can be exported from the debug panel and replayed headless: `node scripts/replay.mjs <save> <log>` prints world hashes per 100 ticks for bisecting divergence.
