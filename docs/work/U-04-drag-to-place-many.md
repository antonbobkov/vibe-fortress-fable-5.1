# U-04 — Drag to place many; out-of-stock prompt

**Source:** [`../../reports/audits/ui-audit.md`](../../reports/audits/ui-audit.md) M6, S9, § 3 "Build 5 doors / 5 beds" · **Size:** M · **Needs:** — (U-03, which it needed, is done) · **Status:** in progress on branch `ui-0405`

Split out of [`../archive/ui-fixes/README.md`](../archive/ui-fixes/README.md), which holds the full list of UI decisions and the closed tasks. The decisions below are copied from it word for word and are final: implement them, do not redesign them.

## Decisions

- **D-U6. Placing many buildings is one gesture (S9, M6).** For 1×1 buildings and constructions, a drag places one per valid tile in the rectangle, and the status bar shows the count. When the input is out of stock, the status bar says "0 doors in stock: N will wait · [o] order N", and `o` opens the order picker preset to that item and count.
- **D-U5. Work orders have a quantity (S3, M2, Q2).**
  - **Adding an order** opens a picker with:
    - a type-ahead filter;
    - recipes grouped by output category, with "recent" first;
    - quantity (digits, `+`/`-` ±1, `Shift` ±10);
    - a mode toggle `once N` / `keep ≥ N`;
    - a material filter;
    - for a global order, the workshop.
  - **In the order list**, `+`/`-` change the selected order's count (`remaining`, or the threshold in keep mode), and `n` adds a new order. `[r]` repeats the selected or last finished order. Each order shows its status ("waiting for stone (0)", "no carpenter's workshop", "in progress", "done").
- **D-U4. Every failure says what and why (S7, S8, Q3–Q6, §4).**
  - Rejections go to the log as an `alert`, with the command's focus tile, as well as to the status row (shown for 4 s).
  - Every reject reason and job/workshop block reason has a player-facing string that names the thing. Block reasons name the missing item and the count, and say where to get it when one workshop makes it ("waiting: 1 door — order at a carpenter's workshop").
  - The 33 `precondition_failed` and the frequent `not_found` sites get specific strings where the site knows the cause.
  - UI-layer no-ops (§4.2) get a status message.
  - No raw content id, entity id, reason code or action id ever reaches the screen (§4.5, Q3). Use content names and ordinals ("Carpenter's workshop #1"), and the help wording for actions.

D-U5 was implemented by U-03 and D-U4 by U-01. They are here because `o` opens that order picker, and because a drag with no valid tile is a no-op that must say so.

## Audit items

From the audit's § 6, word for word:

| # | Change | File / spec | Size |
|---|---|---|---|
| M6 | Drag-to-place for 1×1 furniture and constructions (one building per valid tile in the rectangle, with a count in the status bar) and a "0 in stock, order N?" prompt | `panels/build.ts`; `fortress-screen.md` § Build tool | M |

| # | Spec text | Problem | Proposed change | Size |
|---|---|---|---|---|
| S9 | `14` § Player-facing behavior: "Placing several of the same type: the menu stays open" | Click-per-tile only | Add "drag places one per valid tile for 1×1 types" | S |

## Spec to edit

`02-systems/14-buildings-and-rooms.md` § Player-facing behavior, `04-implementation/ui-screens/fortress-screen.md` § Build tool, and `03-content/ui-keymap-and-screens.md` if a key is added. Write the decided behaviour as plain spec text, in each document's own style.

## Rules for every UI task

- Cite the audit's ids (M6, S9) in commits and tests. Tag tests `U-04`.
- Render goldens will move. Regenerate them in the same commit, with a `golden:` paragraph that names the screens and why.
- Never loosen a test to make a commit green.

## Done

- The behaviour of D-U6, with tests.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with `npm run test:e2e`.
- Closed as the workflow says: the spec edits are in the commit body, this file moves to `docs/archive/tasks/`, and the row leaves [`../backlog.md`](../backlog.md). The branch was cut before `docs/05-plan/PROGRESS.md` was archived, so its tick there is replaced by these two steps when it merges.
