# T-107 — Triage D-rows: systems 20–24, content and implementation

**Closed:** master groups 07cd47d and 1883ef0, content group 38f10bf, and `T-107: fold UI rules and close implementation triage`; retained rows are recorded in T-121.

**Source:** [`docs-restructure.md`](../../work/docs-restructure.md) § Where deltas are accumulating (item 1), § The triage tasks · **Size:** M · **Needs:** — · **Status:** open

## Why

[`../05-plan/DECISIONS.md`](../../05-plan/DECISIONS.md) holds about 240 `D-` rows. Many are normative and exist nowhere else, so the effective specification is the spec plus this log. This task empties the part of the log that belongs to its scope.

## Scope

Rows that govern systems 20 Trade and caravans, 21 Immigration, 22 Pathfinding and spatial, 23 Rendering, 24 UI and input; and rows that govern `docs/03-content/` or `docs/04-implementation/` as a whole rather than one system (catalogs, schemas, UI screens, keymap, strings). The UI rows added by the U tasks (U-01, U-03, U-06, U-08) are here.

A row belongs to the task whose scope holds the spec section the row governs (see its *Spec consulted* cell, then its *Choice*). A row that governs sections in two scopes belongs to the task that holds the first section it names. That task folds it into every section it governs, including one outside its scope, and says so in the commit body. Every row outside this scope is left untouched.

## What to do

For each row in scope, do exactly one of these, then delete the row from the log:

- **Fold it.** Write the rule into the spec section it governs, as plain spec text in that document's own style, with no id and no date. If the section already says it, there is nothing to write.
- **Move it.** A tooling or test-harness choice goes to `docs/process/tooling.md` (create it if it does not exist; one short entry per choice), or into [`../process/testing-strategy.md`](../../process/testing-strategy.md) when it is about a test tier.
- **Archive it.** A superseded or purely historical row goes to `docs/archive/decisions-archive.md` (create it if it does not exist; keep the row whole).

A row whose rejected alternative is worth remembering stays in the log as one short line.

Targets: `docs/02-systems/20-` … `24-*.md`, `docs/03-content/*.md`, `docs/04-implementation/**`.

Two leftovers from T-101 are in this scope.

- `acceptance-tests.md`, row `year_one`, takes its opening orders from the archived `archive/fixes/F-04-bootstrap-scenario.md`. Write the orders into the row or the scenario's own section, so that the spec does not depend on the archive.
- The decisions D-U1 … D-U10 of [`../archive/ui-fixes/README.md`](../ui-fixes/README.md) are a second decision series. Check that each one a closed task implemented (D-U2 … D-U5, D-U7 … D-U10) is in `24-ui-and-input.md`, `ui-keymap-and-screens.md` or the screen documents, and write in any that is missing. The open tasks carry theirs in their work files.

Rules:

- No game rule changes. If a row and the code disagree, stop on that row and report it. Do not pick a side.
- Tests and comments that name a folded row (`it('D-007: …')`, `// D-090`) keep the id. It is a label that git history explains, not a link. Do not rename tests.
- A spec sentence that cites a row ("(D-090)") loses the citation once the row is folded.
- Another triage task may be running in parallel on its own rows of the same file. Delete rows only. Do not reflow, renumber or re-sort the table.

## Done

- No row of this scope is left in the log, except the one-line records kept on purpose.
- The commit body lists every spec file edited and, per row, which of the three it was (a compact list, for example `D-005 fold simulation-core.md § Random numbers`).
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green. World hashes and render goldens do not move.
