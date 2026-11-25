# T-NEW — Stocks at scale: a type opens to one row per stack, and a filter opens every type it touches

**Source:** playtest 2026-11-25 (mid game) ([report](../../reports/data/2026-11-25-playtest-3.md), finding 5) · **Size:** M · **Needs:** — · **Status:** open

## Why

In Year 3 the fortress held 770 seeds, 30 coal, 339 meals and 1,400-odd items in all. Looking for the metal bars, the player types `bar` in the Stocks filter. The panel opens `seed` (barley matches) and lists every barley bag as its own row: "barley x4", "barley x8", "barley x4", "barley x9", "barley x9", "barley x9", "barley x10" ×5, "barley x1" ×2, … eighteen rows before the next type, then `bar` opens to "coal x2", "coal x1", "coal x2" … one row per two-unit stack (`32-y3-stocks-bar.png`). The iron and steel bars, which were what the filter was for, are below the panel's foot. A filter of `steel` found three greaves as three rows, "steel x1" each (`33-y3-stocks-steel.png`).

Two rules make this: 13 § Player-facing behavior ("stocked category leaves expand to type rows and individual item stacks") lists stacks one by one, and `panels.md` § Stocks ("Matching descendants keep their ancestors visible and expand while the filter is set") opens every matching type down to its stacks. In a seven-dwarf first year a type has a few stacks; at 50 dwarves a type has dozens, mostly alike.

Reproduce: load `reports/data/2026-11-25-playtest-3/frostvault-y3-summer9.bin`, `s`, `/`, type `bar`, `Enter`.

## What to do

Decisions:

- **Under a type, stacks that read alike are one row**: same material, quality, rot stage, and the same marks (forbidden, dump, melt), with their units and the count of stacks: "barley ×120 · 13 stacks". A stack that differs (stale, forbidden, a masterwork, an aged stack with its years) keeps a row of its own, so the rot and forbid words of 24 § Panels still show. Selecting the merged row acts on all its stacks (forbid, dump, melt, to depot), as a type row does; `Enter` on it opens its stacks one per row, as now.
- **A filter opens matching types to their merged rows**, not further, and a type whose name or category matches is listed before one that matches only by a material label, so `bar` shows the `bar` category first and `seed` (barley) after it.
- The row keeps the 15-cell count and value column of `panels.md` § Stocks.

Spec: 13 § Player-facing behavior (the stocks tree), `ui-screens/panels.md` § Stocks, 24 § Panels if it repeats the leaf rule.

## Done

- [ ] Tests (`describe` with the task id): 13 barley stacks of one stage make one row with "13 stacks"; a forbidden one and a stale one stay apart; forbid on the merged row forbids all 13; the filter `bar` lists the `bar` category before `seed`; `Enter` on a merged row opens its stacks.
- [ ] UI only: no world hash moves; the Stocks render golden updated with a `golden:` paragraph.
