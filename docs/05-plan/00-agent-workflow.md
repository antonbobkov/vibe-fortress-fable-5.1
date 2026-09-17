# Agent Workflow

**Detail level:** plan · **Depends on:** [README.md](README.md), [01-testing-strategy.md](01-testing-strategy.md)

## Picking up a task

1. Open [`PROGRESS.md`](PROGRESS.md); take the first unchecked task whose *Needs* are all checked. Mark it `[~]` (in progress) with your agent name and the date, commit that change (`chore: start T-M1-03`).
2. Read, in this order: the task; every spec section it cites (follow the links; read the whole section, not the sentence); the algorithm file for the subsystem if one exists in `04-implementation/algorithms/`; the schemas in `04-implementation/schemas/` for the types you will touch; the acceptance tests the task lists.
3. Read the existing code of the modules you will change and their tests. Do not read the whole repository.

## Working

- Implement exactly the cited rules. Copy constant names from the spec verbatim; every constant lives in `src/core/constants.ts` (global) or `src/systems/<id>/constants.ts` (system), never inline.
- Content ids in code appear only in tests and in the content-driven paths the spec names (for example, the loader generating `smelt_<ore>` recipes). A system that needs to know "is this a bed" reads the building's `sleep` tag, never the id `bed`.
- Keep the layer rule: ESLint enforces it; do not add exceptions.
- Write the tests the task lists. Use the scenario runner for acceptance tests; use plain Vitest for rules.
- When a test from the spec's acceptance table cannot pass yet because it depends on a later milestone, the task says so explicitly; otherwise every listed test must pass.

## Verifying (before every commit)

```
npm run lint && npm run typecheck && npm run content:check && npm test
```

`npm test` runs unit tests, the scenarios tagged for the current milestone and earlier, the determinism scenario and the golden tests. It must be green. Then:

```
npm run test:e2e        # only for tasks that touch render/, ui/, app/
```

## Committing

- One commit per task: `T-M1-03: designations and the dig job`. Body: the spec sections implemented and the tests added.
- Update `PROGRESS.md` in the same commit: `[x]`, agent, date, commit hash left blank (filled by the next agent from `git log` if needed; not required).
- Push at every milestone gate and at least daily.

## The milestone gate

The last task of every milestone is the gate task. It runs the full milestone test set, the performance smoke for that milestone, the e2e suite, and produces `reports/M<n>-gate.md` (test counts, timings, coverage) committed to the repo. If anything fails, the gate task is not done and the failing task's owner (the same agent or the next) fixes it before proceeding.

## Ambiguity protocol

When the spec does not decide something you must decide to proceed:

1. Search the spec again (`grep -ri` across `docs/`); most questions are answered in a table somewhere.
2. If still undecided: choose the reading that (a) changes the least state, (b) is the simplest to test, (c) matches the nearest worked example in `03-content/balance.md` or the acceptance tests.
3. Append a row to [`DECISIONS.md`](DECISIONS.md): date, task id, question, choice, spec sections consulted, and the test that pins the choice.
4. Never change a constant's value or a formula to make a test pass. If a spec test and a spec rule contradict, record it in `DECISIONS.md` as a contradiction, implement the rule, mark the test `it.todo` with the decision id, and continue.

## Things agents must not do

- Add runtime dependencies. Dev dependencies only as listed in `01-testing-strategy.md`.
- Disable, skip or loosen an existing test to make a commit green, except through the contradiction rule above.
- Commit generated artifacts other than `src/content/*.json`, golden files under `test/golden/`, gate reports under `reports/`, and `PROGRESS.md`/`DECISIONS.md` updates.
- Touch `docs/00-` through `docs/04-` except to fix a typo or to add a `DECISIONS.md` cross-reference note in the affected section (one line, prefixed `Implementation note:`).
- Use `Math.random`, `Date.now` or `performance.now` in `src/core`, `src/systems` or `src/content`.

## Estimating and pacing

Task sizes are given as S (under an hour of agent work), M (a few hours), L (a day). An agent that exceeds three times the estimate stops, records what blocked it in `PROGRESS.md` under the task, and either splits the task (adding sub-tasks `T-M1-03a`, `T-M1-03b` to `PROGRESS.md`) or moves to the next independent task.

## Definition of done (every task)

- Code implements every cited spec section.
- Tests listed in the task exist, pass, and are tagged with the task id in their `describe` name.
- Lint, typecheck, content check and the full test suite pass.
- `PROGRESS.md` updated; commit made with the task id.
