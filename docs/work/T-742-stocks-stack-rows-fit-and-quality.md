# T-742 — Stocks: a deep stack row cuts its units, and stacks of two qualities read the same

**Source:** T-738 (its check of `reports/data/2026-11-25-playtest-3/frostvault-y3-summer9.bin` with the filter `bar` and `steel`) · **Size:** S · **Needs:** — · **Status:** open

## Why

The tree's name column is at most 18 cells (`tree` in `src/ui/widgets/tree.ts`), and a stack row's name carries its units: `barley ×1`. Five levels down (`food › plant › raw › plant › barley ×1`) the indent leaves eight cells and the row reads `barley »`: the units, a fact, are cut, against 24 § Input model's rule that a fact is never cut. T-703's scan does not open stacks, so it does not see it. The units are also in the row's count column, so the `×1` in the name repeats them.

Under `greaves` (filter `steel`), two rows read `► steel` (2 units, 400 ☼; 3 units, 1,200 ☼): their stacks differ by quality, which no Stocks row names. Before T-738 the same was true of single stacks (`steel ×1` three times).

## What to do

Decisions:

- A stack row whose name does not fit with its units drops the `×N` from the name (the count column gives the units), as 24's rule allows a redundant word to go; the line under the tree keeps naming the stack with its units (`turnip ×20 · stale, rots in 4 days`).
- A row whose stacks have a quality (a type with quality, 12's tiers) names it, with the word Look's item view uses (24 § Inspection, `Furniture · common · 10 ☼`), so the two greaves rows read apart; where the name column cannot hold it, the line under the tree does.
- The T-703 scan opens a type with deep stacks and a type with stacks of two qualities.

Spec: `ui-screens/panels.md` § Stocks, 24 § Panels if it names the stack row.

Decided while doing it:

- **The tier comes first and the plain one goes unnamed**: `poor steel`, `masterwork steel ×1`, and `steel` for common, the tier of an ordinary make (`STOCKS_PLAIN_QUALITY`, 24's constants). Naming common on every row filled a Year 3 meal list with "common »", and a tier after the material (`steel (poor)`) does not fit three levels down, where the greaves' rows are. With the tier first, a name too long is cut in its material, a name; only the three long tiers are cut themselves, four or more levels down (`superio»` under a meal type), where the tooltip and the line under the tree give them.
- **The tree takes a short name** (`TreeNode.short`): a stack row whose name does not fit with its units draws the name without them; one still too long is cut with `»` as before.
- **The line under the tree names any selected stack whole** (`masterwork steel ×1`), not only a perishable one; a row of like stacks puts their tier first (`fine · 2 stacks`). The line wraps under itself when it is longer than its row (`masterwork · 4 stacks · 52 rot within 3 days`), the tree giving up a row, as Jobs' line under its list does.

## Done

- [x] Tests (`describe` with the task id): `test/unit/ui/t742-stocks-stack-rows.test.ts`: a single barley stack five levels down reads `barley` with no `»`, two levels down `barley ×1`, and the line under the tree `barley ×1 · …`; greaves of two qualities read `poor steel` and `steel`, their lines `poor · 2 stacks` and `3 stacks`, a masterwork one `masterwork steel ×1`; a long line under the tree wraps. T-703's scan (`T-742 the scan opens Stocks to its stacks`) opens a deep type to its single stack and the greaves to their stacks.
