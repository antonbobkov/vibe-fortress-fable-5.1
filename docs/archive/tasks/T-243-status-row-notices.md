# T-243 — The status row: a notice must not hide the next readout, and long lines must not be cut silently

**Source:** T-111 and its report, [`../../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../../reports/audits/2026-10-10-ui-audit-follow-up.md) (new finding N3; a side effect of Q5) · **Size:** S · **Needs:** — · **Status:** open

## Why

A notice stays on status row 2 for `STATUS_HINT_SECONDS` (4 s). While it stays, it also hides the live readout of the tool (the drag size, the qualifying count, the ghost state) and the result of the next action. A player who makes a bad dig drag and then a good one still reads "No tile here can be dug" for the good one. Long notices are cut at the screen edge with no sign that there is more ("… that no other zone hol", "… build a carpenter's workshop, a for"), and counts read "1 tables in stock".

## Reproduction

Seed `audit-1`, default embark, paused, at 1280×800. `d`, drag over open floor (notice), then at once drag over the rock face at the top left: the row still says "No tile here can be dug: dig marks rock walls and boulders." while dragging and after release, although twelve tiles were designated (report shots 07d–07f). The same happens with a stockpile drag after a refused one (shots 08c, 08d). Build, Furniture, Table, drag five tiles: "Table x5 · 1 tables in stock: 4 will wait · build a carpenter's workshop, a for" (shot 11b).

## What the spec says

- [`24-ui-and-input.md`](../../02-systems/24-ui-and-input.md) § Rules: a refused command shows in the status bar for `STATUS_HINT_SECONDS` and goes to the log.
- [`fortress-screen.md`](../../04-implementation/ui-screens/fortress-screen.md) § Status row 2: "with a tool active it shows the tool name, the priority, the rectangle size while dragging, and `[Esc] cancel`".
- 24 § Rules (input model, hover): clipped labels register their full text as a tooltip.

## What to do

**Decisions.**
- A notice lasts `STATUS_HINT_SECONDS` or until something newer is shown, whichever is first. Starting a drag, a new ghost state and a new notice all replace it at once.
- Status row text that does not fit ends with `…` and registers its full text as a tooltip on the row, like any clipped label.
- Counts in status and panel strings use singular and plural forms ("1 table in stock", "4 tables will wait"). Use the strings table's existing plural mechanism if there is one; otherwise add `{n|table|tables}`-style forms to the few strings that take a count, and document the form in `ui-keymap-and-screens.md` § Strings.

1. Amend 24 § Rules and `fortress-screen.md` § Status row 2.
2. Implement in `src/ui/screens/fortress.ts` (status row) and the strings involved.
3. Tests, `describe('T-243 …')`: a drag after a notice shows the drag readout; a long notice ends with `…` and its tooltip has the full text; "1 table".

## Done

- The reproduction shows the second drag's own readout, and no status line is cut without `…`.
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
