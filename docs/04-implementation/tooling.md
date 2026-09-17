# Tooling

**Detail level:** W4 · **Owner:** implementation · **Depends on:** [`../01-architecture/tech-stack.md`](../01-architecture/tech-stack.md)

## package.json (dependencies)

Runtime: none. Dev: `typescript`, `vite`, `vitest`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `prettier`.

Scripts: `dev` (vite), `build` (tsc --noEmit && vite build), `test` (vitest run), `test:acceptance` (vitest run test/acceptance), `test:perf` (vitest run test/perf --reporter verbose), `lint` (eslint src test), `content:check` (node scripts/content-check.mjs: validates JSON tables against the schemas and cross-references ids), `hash` (node scripts/world-hash.mjs <save>).

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
// implemented with eslint-plugin-import's no-restricted-paths, one zone per row
```

Additional rules: `no-restricted-globals` for `Math.random`, `Date`, `performance` in `src/core`, `src/systems`, `src/content`; `no-restricted-syntax` forbidding `for...of` over `Map`/`Set` in `src/systems` and `src/core` (use the sorted helpers); `@typescript-eslint/switch-exhaustiveness-check`.

## Test layout

```
test/
  unit/            per-module rule tests (pure functions in rules/)
  acceptance/      one file per scenario id from acceptance-tests.md; a shared runner builds the world from the scenario spec
  golden/          world hashes and render cell buffers for fixed seeds; updated only by an explicit script with a commit message noting the change
  fixtures/saves/  one save per published formatVersion
  perf/            reference fortress builder and the budget assertions
scripts/
  content-check.mjs   schema + id cross-reference over src/content/*.json
  world-hash.mjs      loads a save and prints the world hash
  export-tables.mjs   (optional) converts docs/03-content Markdown tables to src/content JSON; the JSON is committed
```

## CI

On every push: `lint`, `test`, `content:check`, `build`; nightly: `test:acceptance` and `test:perf`. Golden changes require a reviewer.

## Content authoring loop

1. Edit the Markdown table in `docs/03-content`.
2. Run `export-tables.mjs` (or edit the JSON by hand, keeping field names identical).
3. Run `content:check`; fix any dangling id.
4. Run the acceptance tests touched by the table (the runner maps table names to test ids).

## Debug and replay

- `F12` debug panel in the game.
- A season's command log can be exported from the debug panel and replayed headless: `node scripts/replay.mjs <save> <log>` prints world hashes per 100 ticks for bisecting divergence.
