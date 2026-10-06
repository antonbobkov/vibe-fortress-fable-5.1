# Agent Workflow

**Owner:** implementation · **Depends on:** [`../README.md`](../README.md), [`../backlog.md`](../backlog.md), [testing-strategy.md](testing-strategy.md), [ambiguity-protocol.md](ambiguity-protocol.md)

Deepholm is released and keeps changing: audits find things, and fixes and features follow, with no end date. This document says how one piece of work goes from a finding to a merged change, and what it must leave behind.

## How work flows

```
report or audit ──► backlog row ──► work file ──► code + tests + spec edit ──► archive
(reports/audits/)   (backlog.md)    (docs/work/)   (one or more commits)       (docs/archive/tasks/)
```

1. **A source produces an item.** The source is an audit, a measurement, a gate report or an owner request. Sources live under `reports/` and are never edited afterwards (§ Reports and audits).
2. **The item gets a row in [`../backlog.md`](../backlog.md)**, with the next free id and its source.
3. **The item gets a work file in `docs/work/`** before anyone starts it: what to do, the decisions already made, the spec sections it will change, and what "done" means. A work file contains decisions, not open questions. If a decision is needed, it is made before the work starts and written into the file.
4. **The work is done**: code, tests, and the spec edits that make the specification describe the new behaviour.
5. **The task is closed** (§ Closing a task): its decisions are in the spec, its work file is in the archive, and its row is gone from the backlog.

After a task closes, the specification alone says how the game behaves. Nobody should need the work file, the decision log or the commit history to learn a rule.

## Ids and the backlog

- **One id series for all work: `T-101`, `T-102`, ….** A new item takes the next free number, whatever kind of work it is. Take the number in the commit that adds the backlog row.
- **Every item has a source.** The backlog's *Source* column and the work file's `Source:` field name the report, audit or plan that produced it. This replaces a separate id series for each kind of work.
- **Older ids are not reused or extended.** `T-M<n>-<nn>` (the build), `F-nn` (audit fixes), `U-nn` (UI fixes), `D-Un` and "owner Task n" belong to closed work, which is in [`../archive/`](../archive/README.md). The items that were open when the series changed keep their ids until they close: U-02, U-07, F-17, C-009, B-008 … B-012.
- **The backlog holds open items only.** It is one table: id, title, source, needs, status. A closed item's row is deleted, not ticked.
- **Test and commit labels carry the task id**: `describe('T-123 …')`, commit subject `T-123: …`. Labels of closed work in existing tests (`T-M4-06`, `F-12`, `U-03`, `D-007`) stay as they are.

## Picking up a task

1. Open [`../backlog.md`](../backlog.md). Take an item whose *Needs* are all closed and whose status is `open`. Set its status to `in progress (<agent or branch>)` in the first commit of the work.
2. Read, in this order: the work file; its source (the audit items or report sections it cites); every spec section it names, whole and not only the one sentence; the algorithm file for the subsystem if `04-implementation/algorithms/` has one; the schemas in `04-implementation/schemas/` for the types you will touch; the acceptance tests it lists.
3. Read the code of the modules you will change, and their tests. Do not read the whole repository.
4. Work on a branch or worktree named for the task. Do not merge or push unless the task says so.

## Working

- **The specification is the authority.** `docs/00-` … `docs/04-` say how the game behaves. If code and spec disagree and the task does not decide which is right, the code is wrong.
- **Spec edits are required.** A task that changes behaviour, a constant, an interface, a screen or a content row edits the spec sections that govern it, in the same commit as the code. A commit that changes behaviour without the spec edit is not done. There is no permission to ask for and no exception list: any agent edits any spec document that its task makes untrue.
- **Spec text is plain spec text.** Write the rule as the document would have said it from the start, in that document's style and section order. No task id, no decision id, no date, no "changed from", no `Implementation note:`. History is git's job.
- **One definition.** A constant is defined once, in the document that owns it; change it there and nowhere else. Copy constant names from the spec verbatim. Every constant lives in `src/core/constants.ts` (global) or `src/systems/<id>/constants.ts` (system), never inline.
- **Content is data.** Content ids appear in code only in tests and in the content-driven paths the spec names. A system that needs to know "is this a bed" reads the building's `sleep` tag, never the id `bed`. The tables in `docs/03-content/` are the source: `npm run content:export` writes `src/content/*.json` from them.
- **Keep the layer rule.** ESLint enforces it. Do not add exceptions.
- **Tests with the change.** Every task adds or extends tests in the same commit as the code ([testing-strategy.md](testing-strategy.md)). A behaviour change without a test change is not done. A documentation-only task needs no new test, but every check must still pass.
- **Determinism always.** No `Math.random`, `Date.now` or `performance.now` in `src/core`, `src/systems` or `src/content`.
- **Stay inside the task.** Something worth fixing that the task does not cover becomes a backlog row, with this task or its report as the source. It is not fixed in passing.

## Verifying

Before every commit, in the foreground:

```
npm run lint && npm run typecheck && npm run content:check && npm run strings:check && npm run interface:check && npm run docs:check && npm test
```

| Command | What it checks |
|---|---|
| `npm run lint` | ESLint over `src`, `test` and `scripts`, with the layer boundaries and the determinism bans |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run content:check` | `src/content/*.json` against the schemas and the id cross-references |
| `npm run strings:check` | every string key that is used exists, and every key that exists is used |
| `npm run interface:check` | each system document's Interfaces section against the readers, events and commands in the code |
| `npm run docs:check` | no relative link in `docs/`, `reports/`, `agents/` or the root `README.md` points at a file that does not exist |
| `npm test` | unit, scenario (every scenario), property and golden tests; six to eight minutes |

Several of them read `docs/`, so run all of them even for a documentation-only change. Then, when the task needs it:

```
npm run test:e2e     # tasks that touch src/render, src/ui or src/app
npm run test:perf    # tasks that touch a system's tick, the job board, pathfinding, or anything with a budget in performance-budget.md; about 40 minutes
```

Never run a tool through `npx` unless it is a dependency in `package.json`.

## Committing

- Subject: `T-123: <what changed>`. A task may be several commits, when each is coherent and green on its own.
- Body, in this order:
  1. what changed and why, in a few lines;
  2. **`Spec edits:`** with one line per spec document edited, naming the section (`02-systems/21-immigration.md § Wave size: the winter wave is clamped before it is halved`). A commit with no spec edit says `Spec edits: none` and why (test-only, tooling, documentation layout);
  3. the tests added or changed;
  4. if a golden file moved, a paragraph that starts `golden:` and says which files changed and why.
- Golden files change only through `npm run golden:update -- <name>`, in the same commit as the behaviour change. A golden change that the work file does not predict is a regression: investigate it before committing.

## Closing a task

A task is closed in its last commit, or in the merge that lands it. Closing means folding:

1. **Every decision is in the spec section it governs**, as plain spec text. This covers the decisions the work file made in advance and the choices made under the [ambiguity protocol](ambiguity-protocol.md). Check each one against the spec before closing. "The code does it" is not enough.
2. **The work file moves to `docs/archive/tasks/`** with `git mv`. Add nothing to it except one closing line under its header, naming the commits that implemented it. From then on it is history and is not edited.
3. **The row is deleted from [`../backlog.md`](../backlog.md).** Anything the task found and did not do is a new row with a source.
4. **The decision log keeps nothing of the task**, except what is still pending (§ The decision log).

The specification never links into `docs/archive/` or `docs/work/`. If a spec sentence needs something that a task file says, that something belongs in the spec.

## The decision log

The log is [`../05-plan/DECISIONS.md`](../05-plan/DECISIONS.md). It moves to `docs/decisions.md` when the migration in [`../work/docs-restructure.md`](../work/docs-restructure.md) is complete.

- **It holds only what is pending**: a choice that still needs the owner's confirmation, and a contradiction (`C-nnn`) that is not resolved. A row is deleted when its content is folded into the spec.
- **A row may stay as one short line** when the rejected alternative is worth remembering.
- The rows written during the build are being triaged into the spec by tasks T-103 … T-108. Until a row is triaged it is still in force and is part of the effective specification: search the log when the spec is silent.
- Row ids continue their own numbering (`D-nnn`, `C-nnn`, the next free number). They are not work ids.

## Reports and audits

Reports are inputs. A report is the evidence for a backlog item, frozen at the commit it describes.

- **A report is never updated.** No "After …" section, no corrected figure and no follow-up table is appended. A re-measure, a follow-up or a correction is a **new dated report**, which may link to the earlier one.
- **Audits and measurements** go to `reports/audits/`, named `<YYYY-MM-DD>-<subject>.md`. An audit states what was examined, at which commit, how, and what was found. Each finding that needs work becomes a backlog row.
- **Gate reports** go to `reports/gates/`, written by `npm run gate` (§ The gate). They are frozen as well.
- **Screenshots** are written by the e2e suite to `reports/screenshots/`, and coverage to `reports/coverage/` (not tracked). A large data file does not go into git beside its report: it goes under `reports/data/`, or stays out of git with the command that reproduces it written in the report.
- The older files (`reports/gates/M0-gate.md` … `M8-gate.md`, and those in `reports/audits/` without a date in their name) predate these rules. Some were appended to while they were live. They are frozen now.

## The gate

`npm run gate` runs every check in order (lint, typecheck, content, strings, interface, docs links, the tests with coverage thresholds, e2e, the production build, the performance tier) and writes a report with test counts, scenario results, timings and coverage.

```
npm run gate                      # reports/gates/<YYYY-MM-DD>-gate.md
npm run gate -- T-123             # reports/gates/T-123-gate.md
npm run gate -- v1.1.0 --no-perf  # skips the performance tier; the report says so
```

Run a gate before a release, after a task whose work file asks for one, and whenever the owner asks. A report is never overwritten: a second run with the same label writes `<label>-2-gate.md`.

Before committing a gate report, check:

1. every screenshot it commits has been looked at and shows no raw string keys or visual errors;
2. every statement about a task matches the backlog;
3. every performance number names what its fixture exercises, and a system the fixture does not exercise is reported as "not exercised", not as a timing.

## Ambiguity protocol

When the spec does not decide something a task must decide, follow [ambiguity-protocol.md](ambiguity-protocol.md): search again, choose the most conservative reading, write it into the spec, and pin it with a test.

## Things agents must not do

- Add runtime dependencies. Dev dependencies are only those listed in `04-implementation/tooling.md`.
- Disable, skip or loosen an existing test to make a commit green, except through the contradiction rule of the ambiguity protocol.
- Change a constant's value or a formula to make a test pass.
- Edit a report or an archived document, other than to keep a link working when a file moves.
- Commit generated artifacts other than `src/content/*.json`, golden files under `test/golden/`, gate reports under `reports/gates/` and the screenshots a gate report shows.
- Leave a rule only in a work file, a commit message or the decision log.
- Use `Math.random`, `Date.now` or `performance.now` in `src/core`, `src/systems` or `src/content`.

## Estimating and pacing

Sizes are S (under an hour of agent work), M (one to a few hours) and L (most of a day). An agent that exceeds three times the estimate stops and records what blocked it in the work file. It then either splits the task (new backlog rows with new ids, each with a work file and this task as its source) or reports back.

## Definition of done

- The code implements what the work file decided, and nothing else.
- The specification describes the behaviour as it now is, with no task id and no date in the text, and the commit body lists the spec edits.
- The tests the work file lists exist, pass, and carry the task id in their `describe` name.
- `lint`, `typecheck`, `content:check`, `strings:check`, `interface:check`, `docs:check` and `npm test` pass. `test:e2e` and `test:perf` pass where the task needs them.
- World hashes and render goldens moved only where the work file said they would, with a `golden:` paragraph in the commit.
- The task is closed: decisions folded into the spec, work file archived, backlog row deleted, follow-ups added as new rows.
