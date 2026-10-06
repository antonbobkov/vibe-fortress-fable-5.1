# T-110 — Close the migration: pending decisions, archive, large data files

**Source:** [`docs-restructure.md`](docs-restructure.md) § Decisions and tasks · **Size:** S · **Needs:** T-102 … T-109 · **Status:** open

## What to do

1. **The decision log.** What is left of `docs/05-plan/DECISIONS.md` after the triage moves to `docs/decisions.md`: pending decisions and open contradictions only, plus the one-line records kept on purpose. Rows added by branches that merged after their triage task ran are triaged here by the same three choices (fold, move, archive). The folder `docs/05-plan/` is then empty and is removed.
2. **Everything that names the old path.** The root `README.md`, [`../README.md`](../README.md), [`../backlog.md`](../backlog.md), [`../process/agent-workflow.md`](../process/agent-workflow.md), [`../process/ambiguity-protocol.md`](../process/ambiguity-protocol.md), [`../process/testing-strategy.md`](../process/testing-strategy.md), [`../archive/README.md`](../archive/README.md), `agents/*.md`, and comments in `src/`, `test/` and `scripts/` (search for `05-plan` and `DECISIONS.md`). `npm run docs:check` finds the links; a search finds the rest.
3. **Large data files.** They leave git or move under `reports/data/`:

   | File | Size | Read by | Linked from |
   |---|---|---|---|
   | `reports/M8-balance-economy-data.json` | 858 KB, about 34,000 lines | no script and no test | `reports/audits/M8-balance-economy.md`, one link: rewrite it if the file moves, or replace it with a note naming the last commit that held the file if it leaves git |

   Large files that stay where they are, because tooling reads them at those paths: `test/golden/render/m8-screens.json` (975 KB), `test/golden/render/m8-panels.json` (496 KB), `test/golden/render/m4-panels.json` (312 KB), `test/fixtures/reference-fortress.deepholm` (415 KB) and `reports/screenshots/*.png` (written by the e2e suite). `reports/coverage/` is written by `npm test -- --coverage` and is not tracked.
4. **This plan.** Move [`docs-restructure.md`](docs-restructure.md) and any work file of T-102 … T-110 still in `docs/work/` to `docs/archive/tasks/`, delete their backlog rows, and take the "until T-110" sentences out of the README, the workflow and the backlog.

## Leftovers from T-101, to close here if no earlier task did

- `Wave 1` … `Wave 4` still appear in the prose of the specification, for example `00-vision/scope.md` § Decisions fixed in Wave 1, `01-architecture/content-pipeline.md` § Authoring rules for Wave 3 tables, and "the Wave 4 catalog" in several files. T-101 stripped the `W1`–`W4` header markers only. Reword each mention to name the document it means.
- `test/golden/world-hashes.json` has a `$note` that names `01-testing-strategy.md`. It is a golden file: change the note only together with a real `golden:update` commit.
- The archived documents keep their build-era wording (`PROGRESS.md`, "current milestone", `reports/M<n>-gate.md`). That is correct for an archive. Do not rewrite it.

## Done

- `docs/05-plan/` does not exist, and `docs/decisions.md` holds only pending items.
- No tracked data file over 300 KB is left under `reports/` outside `reports/data/`.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, `npm run docs:check` among them.
