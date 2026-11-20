# T-646 — The Workshop panel's recipes say where a missing input comes from

**Source:** [T-641](../archive/tasks/T-641-making-do-chains-say-where-from.md), found while giving Add order its step back · **Size:** S · **Needs:** — · **Status:** open

## Why

Add order now names a missing input one step back and wraps a long row ("○ Soap · no tallow: render fat at a kitchen (needs fat from butchering)"). The Workshop panel's recipe list, opened by a click on a kitchen or a craftsdwarf's workshop, still reads "○ Soap · no tallow" on one row, cut with `»` at sidebar width when the recipe name is long. A player who looks at the workshop first, the more natural place, gets the shorter answer.

## What to do

Give the Workshop panel's `○` rows the same note as Add order (the `chainNote` of `src/ui/panels/orders.ts`) and the same wrapping list (`wrappedList`), so the two lists read alike. Keep the panel's foot rows (orders, actions, the idle reason) where they are: the recipe list's window only shrinks.

Spec: `ui-screens/panels.md` § Workshop (the sentence on `○` recipes).

## Done

A test that a built kitchen's panel reads the soap row with its step back, whole at 36 cells.

- [x] **Step back and wrap**, `test/unit/ui/t646-workshop-recipes-where-from.test.ts`: a built kitchen's panel at 36 cells reads "○ Soap · no tallow: render fat at a kitchen (needs fat from butchering)" over several lines of at most 34 cells, with no `»`; with fat in stock, "· no tallow: render fat at a kitchen"; the Orders rule and the action rows keep their rows. The panel calls Add order's `chainNote` and `wrappedList` in `src/ui/panels/orders.ts`, the same module, so nothing moved; `wrappedList` now says whether it drew its scrollbar, which keeps the panel's scrollbar click when rows fit but their lines do not.
- [x] Spec: `panels.md` § Workshop.
