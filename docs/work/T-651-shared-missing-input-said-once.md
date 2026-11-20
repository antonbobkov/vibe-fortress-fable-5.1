# T-651 — A workshop whose recipes all lack the same input says so once

**Source:** [T-646](../archive/tasks/T-646-workshop-recipes-say-where-from.md), found while giving the Workshop panel's recipes their step back · **Size:** S · **Needs:** — · **Status:** open

## Why

With the step back and wrapping, a carpenter's workshop with no log in stock reads "○ Barrel · no log (from felling trees)", "○ Bed · no log (from felling trees)", … for every recipe, each over two lines at sidebar width. At 32 rows the panel shows about nine recipes where it showed eighteen, and the same note fills half of them. Add order's list, opened from that workshop, reads the same. The note is right; said once it would leave room for the recipes.

## What to do

When every `○` recipe of the list lacks the same input with the same note, say it once, above the list or as the Recipes rule's caption ("── Recipes · no log (from felling trees) ──"), and leave each row its short "· no log", one line. A recipe that lacks something else keeps its own note. Decide whether Add order opened from a workshop does the same.

Spec: `ui-screens/panels.md` § Workshop, § Add order.

## Done

A test that a woodless carpenter's panel at 36 cells names "no log (from felling trees)" once and shows its recipes one row each.
