# T-250 — The refusals, idle alerts and hints the first audit asked for that are still missing

Closed by `T-250: refusals, idle-workshop notes, seed-plot names and the two missing hints` (9faf505 began it; the commit that moved this file finished it).

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../../reports/audits/2026-10-10-ui-audit-follow-up.md) (§4.1, §4.3, §4.4, §4.6, 7.19) · **Size:** M · **Needs:** — · **Status:** open

## Why

U-01 named most failures, but five pieces of the audit's § 4 are still missing: some refusals fall back to "that cannot be done here", an undo that keeps designations does not say how many, an idle workshop is never announced, the farm-without-seeds note does not say which plot, and two hints the spec promises have no trigger.

## Reproduction

- Idle workshop: seed `audit-1`, default embark; build a carpenter's workshop, order five doors, run three days. Orders shows `x3 Door · waiting for log (0)`, but the Log has no line about the idle workshop (report shots 10j, 10k).
- The rest is read in code at `26b6b86`: the fallback `reject.precondition_failed` "that cannot be done here" (`src/ui/strings.ts:777`); the undo line "work has begun there, so those designations are kept" with no count (`src/ui/strings.ts:808`); `WorkshopBlocked` announced for `no_magma` only (`src/systems/workshops/index.ts:40`) though it is emitted on every change of reason (`src/systems/workshops/operate.ts:433`); "A farm plot has no {species} seeds." (`src/ui/strings.ts:962`); no hint for "No one has mining enabled" or "Jobs are blocked: no path" in `src/content/hints.json`. The idle-hauler hint (`hint_haulers`) exists since T-177.

## What the spec says

- [`24-ui-and-input.md`](../../02-systems/24-ui-and-input.md) § Rules: a refusal "names the thing and why".
- [`11-jobs-and-labor.md`](../../02-systems/11-jobs-and-labor.md) § Player-facing behavior: 'Hints: "No one has mining enabled", "Jobs are blocked: no path (check for doors and water)".'
- [`ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md) § Hints and § Announcement strings: the tables these rows join.

## What to do

**Decisions.**
- Every command in [`command-catalog.md`](../../04-implementation/command-catalog.md) whose handler can refuse with `precondition_failed` gets a `ui.reject.precondition_failed.<Command>` string that says what was wrong. A unit test lists the commands that can return that reason and fails on any without its own string; the generic line stays only for a malformed command.
- An undo that keeps some designations says "{n} designations kept: work has begun there" (the UI counts the batch's tiles still designated after the command).
- `WorkshopBlocked` with `missing_input` is announced as a note, once per workshop and reason until that workshop next finishes a job: "Carpenter's workshop #1 is idle: no log." The event gains the missing input's type (`input`), so the line can name it; [`event-catalog.md`](../../04-implementation/event-catalog.md) is amended.
- The seeds note names the plot: "Farm plot #2 has no {species} seeds."
- Two hints join the table: `hint_no_miners`, when a dig designation exists and no living dwarf has mining enabled, "No one has mining enabled. Turn it on in Labors [l]."; `hint_no_path`, when a job has been blocked `unreachable` for a whole day, "Jobs are blocked: no path. Check for doors, water and undug rock." Both are checked on the hourly hint pass, like the others.

1. Amend 24 § Rules if needed, `ui-keymap-and-screens.md` § Hints and § Announcement strings, 12 § Interfaces (the announcement), `event-catalog.md` (`WorkshopBlocked.input`), and 11 § Player-facing behavior to name the hint ids.
2. Implement in `src/ui/strings.ts`, `src/ui/messages.ts`, `src/ui/hints.ts`, `src/content/hints.json` (through `npm run content:export`), `src/systems/workshops/`.
3. Tests, `describe('T-250 …')`: each of the five pieces.

## Done

- The reproduction logs the idle carpenter once; the other pieces have tests.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green.
