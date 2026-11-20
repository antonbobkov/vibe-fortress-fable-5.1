# T-651 — A workshop whose recipes all lack the same input says so once

**Source:** [T-646](../archive/tasks/T-646-workshop-recipes-say-where-from.md), found while giving the Workshop panel's recipes their step back · **Size:** S · **Needs:** — · **Status:** open

## Why

With the step back and wrapping, a carpenter's workshop with no log in stock reads "○ Barrel · no log (from felling trees)", "○ Bed · no log (from felling trees)", … for every recipe, each over two lines at sidebar width. At 32 rows the panel shows about nine recipes where it showed eighteen, and the same note fills half of them. Add order's list, opened from that workshop, reads the same. The note is right; said once it would leave room for the recipes.

## What to do

When every `○` recipe of the list lacks the same input with the same note, say it once, above the list or as the Recipes rule's caption ("── Recipes · no log (from felling trees) ──"), and leave each row its short "· no log", one line. A recipe that lacks something else keeps its own note. Decide whether Add order opened from a workshop does the same.

Spec: `ui-screens/panels.md` § Workshop, § Add order.

## Done

A test that a woodless carpenter's panel at 36 cells names "no log (from felling trees)" once and shows its recipes one row each.

- [x] **Said once**, `test/unit/ui/t651-shared-missing-input.test.ts`: a woodless carpenter's panel at 36 cells by 32 rows reads "No log (from felling trees)" once, on the state row under the worker, so the Recipes rule stays on row 3 and the list keeps the 19 rows it had before T-646, every recipe one row with "· no log"; in a 20-cell panel the note wraps and the rule moves down under it; with one log the shield keeps "· no bar: made at a smelter" and the cabinet "· no log (from felling trees)" on their own rows. The rule: every `○` recipe, two or more, lacks the same input with the same `chainNote`, and the note has a step back (a shared "· no fuel" is not repeated). On a suspended workshop every recipe is "suspended", which has no note, so nothing is shared. T-646's two test accommodations (the 100-row panel in `t248-pickers.test.ts`, the scroll to the door in `u03-orders.test.ts`) are reverted: the rows are one line again.
- [x] **Add order**: opened from a workshop it does the same, a line above the list, the list giving that row; a filter leaving one such recipe gives it its full note again. Opened from the Orders panel it lists every workshop's recipes, and computing every row's note each draw over the whole recipe table is the cost T-645 trimmed elsewhere, so it keeps each row's note.
- [x] Spec: `panels.md` § Workshop, § Add order.
