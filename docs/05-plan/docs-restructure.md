# Docs restructure: from a one-time build to a continuous stream

**Detail level:** plan · **Owner:** implementation · **Status:** accepted, in progress (see § Decisions and tasks) · **Written:** 2026-10-05

This is a review of how the specification, plan and reports are organised, and a proposal for reshaping them. The project will keep running audits, fixes and feature work with no end date. The question is whether the documents are organised for that, and whether deltas are piling up beside the base spec instead of being merged into it.

Nothing here changes a game rule. It is about where text lives.

## Verdict

The base spec (`docs/00-` … `docs/04-`) is in good shape, and the fix workflow already merges deltas into it. The structure around it is not ready for an unending stream. It is still shaped like a one-time build (four waves, then M0–M8, then done), and everything since has been bolted onto that shape.

## What works

- **Fix tasks amend the base spec in place.** F-14, for example, carries the exact old and new text for `21-immigration.md` and `balance.md`. The base spec contains no dates and almost no task ids.
- **The machine checks keep spec and code from drifting silently.** These are `interface:check`, `content:check`, `strings:check` and the golden files.

## Where deltas are accumulating

1. **`DECISIONS.md` is a shadow spec.** It holds 233 `D-` rows in 265 KB, with single lines up to 3.6 KB, and is too big to read in one pass. Many rows are normative and exist nowhere else. A spot check found that D-005 (the rng hash and seeding) and D-006 (fixed-point rounding) are not in `simulation-core.md`. The effective spec is the base plus this log.
2. **The 27 `Implementation note:` lines in `02-systems/` are deltas pinned next to the text they amend.** Most list "reader additions … audited in DECISIONS D-220" instead of adding those readers to the Interfaces section above them.
3. **Balance findings B-001 … B-012 are a measurement journal inside the decision log.** B-008 alone has about ten dated "Re-measured after …" lines. Only the latest state matters.
4. **Fix and UI task documents mix two things.** The durable part (the decision and the spec amendment) is already merged into the spec. The rest is a work order that is dead once the task ships: the commit list, the measured bounds, the golden instructions. `ui-fixes/README.md` also keeps its own decision series (D-U1 … D-U10) outside the log.
5. **Build-era scaffolding is still presented as current.**
   - `docs/README.md` says the repository holds "no code", and describes wave status and "123 tasks".
   - `roadmap.md` is entirely wave history.
   - Every document header carries a `W1`–`W4` detail level (134 mentions in 85 files).
   - `fixes/README.md` is titled "between M5 and M6" but holds F-12 … F-17 from after M8, and says the log "ends at D-152".
   - `PROGRESS.md` files post-release work under "M5.5".
6. **`reports/` mixes three kinds of file.** There are frozen gate snapshots, living diagnoses (`M8-mood-diagnosis.md` is 996 lines with twelve appended "After …" sections), and a 34,000-line data file.

## Proposed structure

```
docs/
  spec/        00-vision … 04-implementation   always current; no history, no W-levels
  process/     agent workflow, testing strategy, ambiguity protocol
  backlog.md   open items only: one table (id, title, source, needs, status)
  work/        one file per OPEN task; removed or archived on merge
  balance.md   living model-versus-measured table, one row per measure, latest only
  archive/     build plan M0–M8, roadmap, closed F and U tasks, old PROGRESS, old DECISIONS
reports/
  gates/       frozen, dated
  audits/      frozen, dated
```

Large data files either leave git or move under a `data/` folder.

Moving `00-` … `04-` under `spec/` breaks every relative link and the scripts that parse the docs (`parse-constants.mjs`, `parse-catalogs.mjs`, `interface-check.mjs` and others). It is optional. The rules below deliver most of the benefit without the move.

## Rules that keep it steady

- **Closing a task means folding it.** Every decision lands in the spec section it governs, written as plain spec text. The task file then leaves `work/`. Git and the commit id are the history.
- **The decision log holds only what is pending.** A row is deleted when it is folded into the spec. It is kept as a short record only when the rejected alternative is worth remembering.
- **One id series for all work.** This replaces `T-M`, `F-`, `U-` and "owner Task n". Each item has a `source:` field pointing at the audit or report that produced it.
- **Audits are inputs and are never updated.** A re-measure is a new dated report, and the matching row of `balance.md` is overwritten.
- **Agent permission flips.** Today agents may not touch `docs/00-` … `docs/04-`, with a per-folder exception for fixes. The new rule is that spec edits are required, and are listed in the commit body.

## One-time migration

1. **Triage D-001 … D-249 into three piles.**
   - A spec gap that was filled: write it into the spec.
   - A tooling or test-harness choice: move it to `tooling.md` or the testing strategy.
   - Historical or superseded: archive it.
2. **Replace the 27 implementation notes with real Interfaces entries.** Then make `interface:check` fail on any such note.
3. **Collapse the B-rows to their current state.** Move the open ones (B-008 … B-012, and C-009) to the backlog.
4. **Archive the build-era documents.** These are the M-files, `roadmap.md`, the closed F and U documents and `PROGRESS.md`. Rewrite `docs/README.md` as a description of a living product, and strip the W-level headers.

Step 1 is the bulk of the work and pays off most. It is mechanical but touches most spec files, so it should be split per system (24 small tasks) rather than done in one pass. Steps 2 to 4 are each one task.

## Open choices

- Whether to move the spec folders under `docs/spec/`, given the link and script churn.
- Whether closed task files are deleted or kept under `archive/`.
- Whether the new id series renumbers open items (U-02, U-04, U-05, U-07, F-17) or starts after them.

## Decisions and tasks (accepted 2026-10-05)

**Status:** accepted by the owner on 2026-10-05 ("incorporate into the workstreams, early if possible"). The open choices were decided by the parent under the owner's standing instruction to use judgement.

### The open choices, decided

- **The spec folders stay where they are.** `docs/00-` … `docs/04-` are not moved under `docs/spec/`. The link and script churn buys nothing that the rules do not already give. "The spec" means those five folders.
- **Closed task files are archived, not deleted.** They move to `docs/archive/`. Nothing links into the archive from the spec.
- **One id series from now on: `T-101`, `T-102`, …** The items already open keep their ids until they close (U-02, U-04, U-05, U-07, F-17, C-009, B-008 … B-012). Nothing new gets an `F-`, `U-`, `D-U` or "owner Task" id.
- **The decision log stays at `docs/05-plan/DECISIONS.md` until the triage is done.** Branches in flight still append to it. T-110 then moves what is left to `docs/decisions.md`.

### Tasks

| Id | Title | Size | Needs | Estimate |
|---|---|---|---|---|
| T-101 | Foundation: `docs/process/`, `docs/backlog.md`, `docs/work/`, `docs/archive/`, the new rules, a rewritten `docs/README.md`, W-levels stripped, `reports/` sorted | M | — | 60–90 min |
| T-102 | Interfaces: replace the 27 `Implementation note:` lines with real Interfaces entries; `interface:check` fails on any such note | S | T-101 | 30–45 min |
| T-103 | Triage D-rows: architecture and core (`00-`, `01-`, simulation core, data model, persistence, rendering, performance) | M | T-101 | 45–75 min |
| T-104 | Triage D-rows: systems 01–07 (world, embark, terrain, fluids, materials, weather, plants) | M | T-101 | 45–75 min |
| T-105 | Triage D-rows: systems 08–13 (animals, foraging, dwarves, jobs, workshops, items) | M | T-101 | 45–75 min |
| T-106 | Triage D-rows: systems 14–19 (buildings, morale, combat, health, threats, defense) | M | T-101 | 45–75 min |
| T-107 | Triage D-rows: systems 20–24 and content (trade, immigration, pathing, rendering, UI, `03-content`, `04-implementation`) | M | T-101 | 45–75 min |
| T-108 | Triage D-rows: tooling and tests (to `docs/process/tooling.md` and the testing strategy), plus the C- rows | S | T-101 | 30–45 min |
| T-109 | Balance: `docs/balance-status.md`, one row per measure with the latest figure; B-rows collapsed; open ones to the backlog | S | F-17 | 20–30 min |
| T-110 | Close the migration: what is left of the log moves to `docs/decisions.md` (pending only); archive the rest; large data files leave git or move under `reports/data/` | S | T-102 … T-109 | 20–30 min |

**About the estimates.** Size is the plan's grading and is unchanged; the estimate is wall-clock time for one agent, added from measured runs on 2026-10-03 to 2026-10-05. No docs-only task has been measured, so these are extrapolated from the nearest ones:
- T-M8-08 (documentation sync, a script plus 23 spec files): 27 min.
- UI tasks of size M: 46–75 min.
- A size-L UI task: 73 min.

None of these tasks needs the performance tier, which adds about 40 minutes per run.

**T-101 in detail.**

Folders and files:
- `docs/process/` takes `00-agent-workflow.md`, `01-testing-strategy.md` and the ambiguity protocol, rewritten for continuous work.
- `docs/backlog.md` is one table of open items only (id, title, source, needs, status), seeded with every item open today.
- `docs/work/` holds one file per open task. F-17 moves there. U-02, U-04, U-05 and U-07 are split out of `ui-fixes/README.md`, carrying the D-U decisions each one needs.
- `docs/archive/` takes the build plan (M0–M8 files, `README.md`, `roadmap.md`), the closed F and U documents, and `PROGRESS.md`.

The rules, written into the workflow:
- Spec edits are required, and are listed in the commit body.
- Closing a task folds its decisions into the spec and archives the task file.
- Audits are never updated.
- There is one id series.

Clean-up:
- `docs/README.md` is rewritten to describe a living product.
- The `W1`–`W4` detail levels come out of every header.
- `reports/` is sorted into `gates/` and `audits/`.
- Every script and test that reads a moved file is updated (`scripts/gate.mjs`, `test/scenarios/runner.ts`, `agents/*.md`, CI). The `current-milestone` header goes away with `PROGRESS.md`: every scenario runs, and the gate takes its milestone as an argument.

**The triage tasks (T-103 … T-108).** For each `D-` row in scope, do exactly one of these and then delete the row from the log:
- **Fold it:** write the rule into the spec section it governs, as plain spec text with no id and no date.
- **Move it:** a tooling or harness choice goes to `docs/process/tooling.md`.
- **Archive it:** a superseded or purely historical row goes to `docs/archive/decisions-archive.md`.

A row whose rejected alternative is worth remembering stays as one short line. No game rule changes: if a row and the code disagree, the task stops on that row and reports it. `npm run gate`'s static checks and `npm test` stay green. World hashes do not move.

**Order with the other workstreams.** T-101 goes first and early, because it changes where every later task writes. Branches already in flight (U-04/U-05, F-17) were cut before T-101. The parent resolves their `PROGRESS.md` and decision-log edits when it merges them. The triage tasks run two at a time between the remaining UI tasks.
