# U-02 — Paused input takes effect at once

**Closed:** implemented by the closing commit `U-02: apply commands immediately while paused` on branch `codex-a`.

**Source:** [`../../../reports/audits/ui-audit.md`](../../../reports/audits/ui-audit.md) issue 2, M1, S2 · **Size:** M · **Needs:** — · **Status:** open

Split out of [`../ui-fixes/README.md`](../ui-fixes/README.md), which holds the full list of UI decisions and the closed tasks. The decisions below are copied from it word for word and are final: implement them, do not redesign them.

## Why

The game starts paused, and commands are applied only at the next tick. A dig drag, a building or a zone shows nothing until the player unpauses, and a refusal appears only then, possibly for a click made much earlier. The first hint leads the player straight into this.

## Decisions

- **D-U1. Paused input takes effect at once (S2, M1).** While the host is paused, the host runs the command phase for the queued commands immediately. It is the same code as the start-of-tick command phase, stamped with the next tick's number, and nothing else of the tick runs. Determinism holds, because no system runs between "now" and the next tick's command phase. Designations, placements and zones then appear while paused, and rejections are reported at once.
- **D-U4. Every failure says what and why (S7, S8, Q3–Q6, §4).**
  - Rejections go to the log as an `alert`, with the command's focus tile, as well as to the status row (shown for 4 s).
  - Every reject reason and job/workshop block reason has a player-facing string that names the thing. Block reasons name the missing item and the count, and say where to get it when one workshop makes it ("waiting: 1 door — order at a carpenter's workshop").
  - The 33 `precondition_failed` and the frequent `not_found` sites get specific strings where the site knows the cause.
  - UI-layer no-ops (§4.2) get a status message.
  - No raw content id, entity id, reason code or action id ever reaches the screen (§4.5, Q3). Use content names and ordinals ("Carpenter's workshop #1"), and the help wording for actions.

D-U4 was implemented by U-01. It is here because this task changes *when* a rejection is reported, and must keep *how*.

## Audit items

From the audit's § 6, word for word:

| # | Change | File / spec | Size |
|---|---|---|---|
| M1 | **Apply UI commands immediately while paused** (run the command phase without advancing the tick), or at least draw a pending preview layer for queued designations, placements and zones and report rejections at once. The trade screen already works around this with `commandTick` (`game.ts:1067`) | `sim-host.ts`, `core/commands.ts`; `simulation-core.md` § Commands; `24` | M |

| # | Spec text | Problem | Proposed change | Size |
|---|---|---|---|---|
| S2 | `simulation-core.md`/`command-catalog.md`: "Commands are applied at the start of a tick"; `sim-host` "begins … paused" | Together these mean that a paused game, which is the default state, ignores input visibly | "While paused, the host applies pending commands immediately (a zero-length command phase)." | M |

D-U1 chose the first alternative of M1 (apply at once), not the preview layer.

## Scope

- This task touches the host and the core command phase (`src/app/sim-host.ts`, `src/core/commands.ts`); the other UI tasks do not.
- The trade screen works around the problem today with `commandTick` (`src/app/game.ts`). It may be replaced by the general mechanism if no trade test's assertions change; if it stays, the final message says so.
- Replays and saves: a command applied while paused is recorded with the tick it was stamped with (the next tick), so a replay applies it in that tick's command phase and reaches the same hash. Add a test that proves it.

## Spec to edit

`01-architecture/simulation-core.md` § Commands, `04-implementation/command-catalog.md` (the sentence on when commands apply), `04-implementation/tick-order.md` if it restates the rule, and `02-systems/24-ui-and-input.md`. Write the decided behaviour as plain spec text, in each document's own style.

## Rules for every UI task

- Cite the audit's ids (M1, S2) in commits and tests. Tag tests `U-02`.
- Render goldens may move. Regenerate them in the same commit, with a `golden:` paragraph that names the screens and why. World hashes must not move: with no command issued while paused, behaviour is unchanged.
- Never loosen a test to make a commit green.

## Done

- A designation, a placement and a zone issued while paused are visible before unpausing; a rejected one is reported at once, in the status row and the log.
- A run with commands issued while paused replays to the same world hash.
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with `npm run test:e2e` (the task touches `app/` and `ui/`).
- Closed as the workflow says: the spec edits are in the commit body, this file moves to `docs/archive/tasks/`, and the row leaves [`../../backlog.md`](../../backlog.md).
