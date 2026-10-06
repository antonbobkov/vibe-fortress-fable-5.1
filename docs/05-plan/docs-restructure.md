# Docs restructure: from a one-time build to a continuous stream

**Detail level:** plan · **Owner:** implementation · **Status:** proposal, not started · **Written:** 2026-10-05

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
