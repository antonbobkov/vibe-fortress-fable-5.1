# T-280 — Sidebar text is never cut without a mark; Help wraps and starts with how to begin

**Closed:** 2026-10-16, in 67200a3, 542d5f4.

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../../reports/audits/2026-10-12-ui-ux.md) (issue 10, § 6, § 8 d) · **Size:** M · **Needs:** T-249 and T-270 (both change `src/ui/panels/designate.ts`) · **Status:** open

## Why

At 80 columns the sidebar is 36 columns, and text that does not fit is cut with no mark. Four of Designate's fourteen labels are cut ("Down stai", "Remove cons", "Gather plan", "Traffic ("), and so are its footer lines. Help is 130 key lines, many cut ("k  look cursor at the mouse (or m"), read ten lines at a time, and it has no page that says how to start. The first hint a new player sees is cut at the screen edge. `[S-n]` is explained only on Help's second page.

## Reproduction

Default embark, 1280×800. `d` (capture 4/13, `13-B-designate-1280x800.png`). `?`, `PageDown` ×12 (7/25 to 7/33, `25-Y-help.png`). The log strip at tick 400: "☼ Designate a place to dig with [d]. Dwarves dig into rock faces from the side" with the last character lost (1/19).

## What the spec says

- [`24-ui-and-input.md`](../../02-systems/24-ui-and-input.md) § Rules: cut text is marked with `»` and has a tooltip with the whole text.
- [`panels.md`](../../04-implementation/ui-screens/panels.md) § Designate and § Help; [`fortress-screen.md`](../../04-implementation/ui-screens/fortress-screen.md) § Log strip.

## What to do

**Decisions.**
- **One rule for cells.** A two-column panel draws each cell through the same clipping helper as list rows: text that does not fit ends with `»` and registers a tooltip with the whole text. No panel writes past its last column.
- **Designate labels** are shortened so that none is cut at 36 columns: "Down stair", "Up stair", "Up/down", "Remove", "Gather", "Traffic". The tool prompt in the status row keeps the full name ("Remove construction · priority 5"). The footer becomes two whole lines: "[Ctrl+Z] undo  [Del] clear" and "Drag, or click two corners."
- **Shift captions.** Every panel that shows an `[S-x]` caption ends with one dim footer line, "S- is Shift", when it has a free row. Help writes keys the way panels do (`[S-n]`), with "S- is Shift" as its first line.
- **Help wraps.** Help lines wrap at the panel width with a hanging indent under the description; nothing is cut. `PageDown` and `PageUp` move a whole page less one line. The page mark reads "page 2/7", not "11/130".
- **How to begin.** Help gains a third tab, `[3] Start`, shown first on the first opening in a fortress. Its text, wrapped:
  "1. Dig in: [d], drag over a rock face. Dwarves dig from the side. 2. Storage: [z] Stockpile, drag on floor. 3. Wood: [d] Chop tree. 4. Workshops: [b] Workshops; then orders with [o]. Build a carpenter's workshop and a still first. 5. Food: [z] Farm plot on soil; pick a crop for each season. 6. Beds: order beds, place them [b], draw a Bedroom over each. 7. Safety: a door on your hall set to Lock on alert, and a squad [m] with clubs. 8. Space pauses. [?] opens this help."
  Step 7 is added by this task only if T-273 is closed; otherwise T-273 adds it.
- **Hints wrap.** A hint in the log strip that does not fit one line takes two of the strip's three lines. The hint colour moves from the dimmest grey to `text_value`, so the line a new player most needs is not the faintest on the screen.

1. Amend `panels.md` § Designate and § Help, `fortress-screen.md` § Log strip, `ui-keymap-and-screens.md` (the Help text and the caption form), 23's palette table only if a colour name changes.
2. Implement in `src/ui/panels/designate.ts`, `src/ui/panels/help.ts`, `src/ui/announcements.ts`, the shared two-column helper under `src/ui/widgets/`, and the strings.
3. Tests, `describe('T-280 …')`: no panel in the registry has text in its last column at 80×45 unless it ends with `»` (walk every panel, as the capture's flow 9 did); Help's wrap and paging; the Start tab on first opening; a two-line hint.

## Done

- At 1280×800 no label in Designate or Help is cut, and the first hint is whole.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite; moved render goldens are explained.

## Decisions made in the work

- The one rule for cells is made in the label widget itself: every label that does not fit ends with `»` and keeps its tooltip, so no panel needed its own clipping helper. Labels that draw their own cut turn it off with `mark: false`.
- The Designate columns are not equal: the left is 17 cells (the longest caption is "[S-t] Chop trees"), the right takes the rest, so "[S-j] Down stair" is whole at the real sidebar width, 35 cells.
- Hints are marked in the log with the category `hint`; the strip wraps and colours by that category.
- The note "S- is Shift" is drawn by the sidebar on the last row of the panel body when that row is blank and the panel shows an `[S-` caption; Help has the line at the top of its Keys tab instead.
- Step 7 of Start is included, since T-273 is closed.
