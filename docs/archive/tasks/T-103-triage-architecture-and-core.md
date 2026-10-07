# T-103 — Triage D-rows: architecture and core

**Source:** [`docs-restructure.md`](../../work/docs-restructure.md) § Where deltas are accumulating (item 1), § The triage tasks · **Size:** M · **Needs:** — · **Status:** open

**Closed:** implemented by commits `6bb82fb` and `bd5c1d1` on branch `t-103`.

## Why

[`../../05-plan/DECISIONS.md`](../../05-plan/DECISIONS.md) holds about 240 `D-` rows. Many are normative and exist nowhere else, so the effective specification is the spec plus this log. This task empties the part of the log that belongs to its scope.

## Scope

Rows that govern `docs/00-vision/` and `docs/01-architecture/`: the simulation core (tick loop, scheduler, rng, fixed-point math, calendar, event and command queues), the data model (`Map3D`, entities, components), module interfaces, the content pipeline, persistence, and the performance budget. Rows about the platform or renderer contract in `01-architecture/` are here; rows about what is drawn belong to T-107.

A row belongs to the task whose scope holds the spec section the row governs (see its *Spec consulted* cell, then its *Choice*). A row that governs sections in two scopes belongs to the task that holds the first section it names. That task folds it into every section it governs, including one outside its scope, and says so in the commit body. Every row outside this scope is left untouched.

## What to do

For each row in scope, do exactly one of these, then delete the row from the log:

- **Fold it.** Write the rule into the spec section it governs, as plain spec text in that document's own style, with no id and no date. If the section already says it, there is nothing to write.
- **Move it.** A tooling or test-harness choice goes to `docs/process/tooling.md` (create it if it does not exist; one short entry per choice), or into [`../../process/testing-strategy.md`](../../process/testing-strategy.md) when it is about a test tier.
- **Archive it.** A superseded or purely historical row goes to `docs/archive/decisions-archive.md` (create it if it does not exist; keep the row whole).

A row whose rejected alternative is worth remembering stays in the log as one short line.

Targets: `docs/00-vision/*.md`, `docs/01-architecture/*.md`, and the matching `docs/04-implementation/` files (`tick-order.md`, `save-format.md`, `schemas/components.md`).

Known examples from the review: D-005 (the rng hash and seeding) and D-006 (fixed-point rounding) are not in `simulation-core.md`.

Rules:

- No game rule changes. If a row and the code disagree, stop on that row and report it. Do not pick a side.
- Tests and comments that name a folded row (`it('D-007: …')`, `// D-090`) keep the id. It is a label that git history explains, not a link. Do not rename tests.
- A spec sentence that cites a row ("(D-090)") loses the citation once the row is folded.
- Another triage task may be running in parallel on its own rows of the same file. Delete rows only. Do not reflow, renumber or re-sort the table.

## Done

- No row of this scope is left in the log, except the one-line records kept on purpose.
- The commit body lists every spec file edited and, per row, which of the three it was (a compact list, for example `D-005 fold simulation-core.md § Random numbers`).
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green. World hashes and render goldens do not move.
