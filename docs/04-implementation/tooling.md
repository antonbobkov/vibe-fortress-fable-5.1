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

| Workflow | What it runs | Time |
|---|---|---|
| `.github/workflows/ci.yml` (Verification) | The six static checks and the build; `npm test` split into four parallel shards; `npm run test:e2e` | about 12 minutes |
| `.github/workflows/measure.yml` (Measure), input `suite` | `sweep`: the twenty-seed file, one job per seed, plus a summary job | about 15 minutes |
| | `instrument`, with input `shifts` (`0,1,2,3,4,5,6,7` by default): the annual wildlife instrument (`test/perf/wildlife_year.test.ts`) once per shift, the same commit played that many ticks later, one job a shift; then a verdict job pools them (`test/perf/wildlife_year_verdict.test.ts`) and judges the change by testing-strategy.md § Annual wildlife survival | about 15 minutes with free runners |
| | `three_years_main`: the long economy run (`test/perf/three_years_main.test.ts`) | about 8 minutes |
| | `scenario`, with input `scenario=<id>`: one scenario from `test/scenarios`, such as `defence_year` or `pp_defence` | a few minutes |
| | `timing`: the timing tests (`test/perf/per-system.test.ts`, `test/perf/perf_reference.test.ts`), to see how quiet a runner is | a few minutes |
| | `defence_seeds`, with input `watch` (the script's cadence in ticks, 20 by default): `defence_year` on its eight seeds (`test/perf/defence_year_seeds.test.ts`), one job a seed; the set rule is read from the eight rows | about 5 minutes |

The repository is public, so the runners (4 vCPU, 16 GB) cost nothing. A job stops at 6 hours. Runs on GitHub give the same numbers as local runs: the annual instrument's row matched the local reference exactly on 2026-11-05.

### Running tests on GitHub

Tests of ten minutes or more locally always run here; five to ten minutes by judgement, preferring GitHub; new tests, quickly failing ones and fast iteration may stay local; fall back to local runs if Actions is unavailable for a long stretch (agent-workflow.md § Verifying, an experiment since 2026-11-05). Long ones: the full `npm test`, the e2e suite, the annual instrument, the twenty-seed sweep, `three_years_main` and `defence_year`. Short runs stay local: single test files, the arenas, one-seed probes.

1. **Push the branch.** The runner checks out the pushed commit, not your working tree, so commit and push first: `git push -u origin <branch>`.
2. **Start the run.**

   ```
   gh workflow run ci.yml --ref <branch>                                          # npm test (4 shards), e2e, checks, build
   gh workflow run measure.yml --ref <branch> -f suite=sweep                     # the twenty-seed file
   gh workflow run measure.yml --ref <branch> -f suite=instrument                # the annual wildlife instrument: eight shifts and the verdict
   gh workflow run measure.yml --ref <branch> -f suite=three_years_main          # the long economy run
   gh workflow run measure.yml --ref <branch> -f suite=scenario -f scenario=defence_year
   ```

   GitHub's API sometimes answers a start with HTTP 500 or 502. Wait a few seconds and run the same command again; nothing was started.
3. **Find the run id.** `gh run list --workflow <ci.yml|measure.yml> --branch <branch> -L 1` prints it with its status. Check that its commit is the one you pushed: `gh run view <id> --json headSha -q .headSha`.
4. **Wait for it in the background.** Poll, do not sleep in the foreground:

   ```
   until [ "$(gh run view <id> --json status -q .status)" = completed ]; do sleep 60; done
   gh run view <id> --json conclusion,jobs -q '.conclusion, (.jobs[] | .name+" "+.conclusion)'
   ```

   Several runs can go at the same time, on one branch or many; they do not share a machine with you or with each other.
5. **Read the result.**
   - `gh run view <id> --log-failed` prints only the failed steps: the quickest way to see which test or assertion broke.
   - `gh run view <id> --log` prints everything. Vitest output on the runner is coloured; strip it with `sed 's/\x1b\[[0-9;]*m//g'` before you grep.
   - `gh run download <id> -D <dir>` downloads every artifact, one folder each: `unit-1` to `unit-4` (each shard's log), `e2e` (its log, and Playwright's traces and report on a failure), `seed-<p0-1>` (a seed's result file `three-years-<seed>.json` and its log), `sweep-summary`, `instrument-shift-<n>` (one instrument sample: its rows, `wildlife-year-shift-<n>.json`, and log), `instrument` (the verdict, `verdict.md` and `verdict.json`, with every sample's result file), `three_years_main`, or the scenario's id. `-n <name>` downloads one.
   - For the sweep, `sweep-summary.md` has the totals, the row by peril, each seed's year-1 and year-3 population, deaths, need deaths and extinction day, and whether the set rule holds. The same table is on the run's page on GitHub.
6. **Read the outcome correctly.**
   - `ci.yml` passes only when all six jobs pass. The test count is the sum of the four shards' `Tests` lines.
   - A sweep seed job fails when the seed breaks one of its own assertions (an invariant, a witness) or produces no result file; its numbers are still in the summary. The summary job fails when the set rule breaks or a seed has no result. So the run can show failure while the set rule holds: read the summary before deciding.
   - Each Measure job checks that it ran at least one test, so a filter that matches nothing fails instead of passing empty.
   - For the instrument, read the verdict job (`instrument-verdict`): its summary on the run's page has each shift's row, the pooled row, the reference, the bounds and the verdict, and the rows to commit when the change is accepted. A sample job fails only on an invariant of its own (the accounting, the opening's setup), never on a bound: one sample is not judged. A verdict over shifts other than `0` to `7` prints its table and fails.
   - Artifacts are kept for 14 days (the sweep summary for 30). Copy any figure a report or commit needs into the commit or `reports/data/`.

**Your own probe.** A probe or journal that writes files can run the same way. Commit it on your branch, then run it as a scenario, or add a step to `measure.yml` on your branch. Files a Measure job writes under `out/` become its artifact. Do not commit `reports/screenshots`.

**Comparing two states.** Run the workflow once per branch or commit, wait for both, and compare the two results.

## Content authoring loop

1. Edit the Markdown table in `docs/03-content`.
2. Run `export-tables.mjs` (or edit the JSON by hand, keeping field names identical).
3. Run `content:check`; fix any dangling id, and add the line it asks for in `03-content/row-order.md` for a new row.
4. Run the scenario tests touched by the table (the runner maps table names to scenario ids).

## Debug and replay

- `F12` debug panel in the game.
- A season's command log can be exported from the debug panel and replayed headless: `node scripts/replay.mjs <save> <log>` prints world hashes per 100 ticks for bisecting divergence.
