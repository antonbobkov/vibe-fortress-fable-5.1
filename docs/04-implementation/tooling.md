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

GitHub Actions runs nothing on push. Both workflows start only on demand. Golden changes require a reviewer.

| Workflow | What it runs |
|---|---|
| `.github/workflows/ci.yml` (Verification) | `lint`, `typecheck`, `content:check`, `strings:check`, `interface:check`, `docs:check`, `test`, `build`, `test:e2e` |
| `.github/workflows/measure.yml` (Measure) | One heavy measurement, chosen by the `suite` input: `sweep` (the twenty-seed file, one job per seed), `instrument` (the annual wildlife instrument), `pp_defence`, or `e2e` |

The repository is public, so the runners (4 vCPU, 16 GB) cost nothing. A job stops at 6 hours.

### Running a measurement on GitHub

How to run a heavy measurement off the local machine. This describes a tool; whether a task needs a measurement is decided as before.

1. **Push the branch.** The runner checks out the pushed commit, not your working tree, so commit and push what you want measured first (`git push -u origin <branch>`).
2. **Start the run.**

   ```
   gh workflow run measure.yml --ref <branch> -f suite=sweep
   ```

   Other suites: `-f suite=instrument`, `-f suite=pp_defence`, `-f suite=e2e`. `ci.yml` takes no inputs: `gh workflow run ci.yml --ref <branch>`.
3. **Find the run id.** `gh run list --workflow measure.yml --branch <branch> -L 1` prints it, with its status.
4. **Wait for it.** A sweep takes about 15 minutes; its seeds run in parallel. In a shell that must not block for long, poll in the background:

   ```
   until [ "$(gh run view <id> --json status -q .status)" = completed ]; do sleep 60; done
   gh run view <id> --json conclusion,jobs -q '.conclusion, (.jobs[] | .name+" "+.conclusion)'
   ```

5. **Read the result.**
   - `gh run download <id> -n sweep-summary -D <dir>` gives `sweep-summary.md`: the totals, the row by peril, each seed's year-1 and year-3 population, deaths, need deaths and extinction day, and whether the set rule holds. The same table is on the run's page on GitHub.
   - `gh run download <id> -n seed-<p0-1> -D <dir>` gives one seed's result file (`three-years-<seed>.json`, the same file the local run writes) and its full console log.
   - `gh run download <id> -D <dir>` gives every artifact, one folder each. For the other suites the artifact is named after the suite.
   - `gh run view <id> --log-failed` prints only the failed steps' output, which is the quickest way to see which assertion a seed broke.
6. **Read the outcome correctly.**
   - A seed job fails when the seed breaks one of its own assertions (an invariant, a witness) or produces no result file. Its numbers are still in the summary.
   - The summary job fails when the set rule is broken or a seed has no result.
   - So the run as a whole can show failure while the set rule holds. Read the summary before deciding.
   - Artifacts are kept for 14 days (the summary for 30). Copy any figure a report needs into `reports/data/` in the commit.

**Measuring your own probe.** A probe or journal that writes files can run the same way. Commit it on your branch, run it with the matching suite, or add a step to `measure.yml` on your branch. Files the job writes under `out/` become its artifact. Do not commit `reports/screenshots`.

**Comparing two states.** Run the workflow once per branch or commit, wait for both, and compare the two summaries. Runs on different branches can go at the same time.

## Content authoring loop

1. Edit the Markdown table in `docs/03-content`.
2. Run `export-tables.mjs` (or edit the JSON by hand, keeping field names identical).
3. Run `content:check`; fix any dangling id, and add the line it asks for in `03-content/row-order.md` for a new row.
4. Run the scenario tests touched by the table (the runner maps table names to scenario ids).

## Debug and replay

- `F12` debug panel in the game.
- A season's command log can be exported from the debug panel and replayed headless: `node scripts/replay.mjs <save> <log>` prints world hashes per 100 ticks for bisecting divergence.
