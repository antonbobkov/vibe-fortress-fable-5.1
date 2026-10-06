# T-108 — Triage D-rows: tooling and tests, and the C-rows

**Source:** [`docs-restructure.md`](docs-restructure.md) § Where deltas are accumulating (item 1), § The triage tasks · **Size:** S · **Needs:** — · **Status:** open

## Why

[`../05-plan/DECISIONS.md`](../05-plan/DECISIONS.md) holds 233 `D-` rows. Many are normative and exist nowhere else, so the effective specification is the spec plus this log. This task empties the part of the log that belongs to its scope.

## Scope

Rows that are a tooling or test-harness choice and govern no game rule: lint and boundary rules, dev dependencies, the scenario runner and `TestWorld`, golden files and their update script, coverage, e2e, the performance harness and fixtures, the gate, CI, build and release checks. Also the whole § Contradictions table (C-001 … C-009).

A row belongs to the task whose scope holds the spec section the row governs (see its *Spec consulted* cell, then its *Choice*). A row that governs sections in two scopes belongs to the task that holds the first section it names. That task folds it into every section it governs, including one outside its scope, and says so in the commit body. Every row outside this scope is left untouched.

## What to do

For each row in scope, do exactly one of these, then delete the row from the log:

- **Fold it.** Write the rule into the spec section it governs, as plain spec text in that document's own style, with no id and no date. If the section already says it, there is nothing to write.
- **Move it.** A tooling or test-harness choice goes to `docs/process/tooling.md` (create it if it does not exist; one short entry per choice), or into [`../process/testing-strategy.md`](../process/testing-strategy.md) when it is about a test tier.
- **Archive it.** A superseded or purely historical row goes to `docs/archive/decisions-archive.md` (create it if it does not exist; keep the row whole).

A row whose rejected alternative is worth remembering stays in the log as one short line.

Targets: `docs/process/tooling.md` (new: tooling choices that are not specification), [`../process/testing-strategy.md`](../process/testing-strategy.md), and `docs/04-implementation/tooling.md` where a row corrects what the spec says about tooling.

The C-rows: a resolved contradiction (it has a `Resolved by …` line) is archived once the spec text and the test agree, which the resolving task should already have done. Check, then archive. C-009 is open: it stays in the log and in [`../backlog.md`](../backlog.md) until the owner decides it. The other triage tasks leave the tooling rows they meet for this task.

Rules:

- No game rule changes. If a row and the code disagree, stop on that row and report it. Do not pick a side.
- Tests and comments that name a folded row (`it('D-007: …')`, `// D-090`) keep the id. It is a label that git history explains, not a link. Do not rename tests.
- A spec sentence that cites a row ("(D-090)") loses the citation once the row is folded.
- Another triage task may be running in parallel on its own rows of the same file. Delete rows only. Do not reflow, renumber or re-sort the table.

## Done

- No row of this scope is left in the log, except the one-line records kept on purpose.
- The commit body lists every spec file edited and, per row, which of the three it was (a compact list, for example `D-005 fold simulation-core.md § Random numbers`).
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green. World hashes and render goldens do not move.
