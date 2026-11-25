# T-735 — Every row of a scrolling table ends in "»": Units, Jobs and the other tables at scale

**Closed:** 2026-11-25, in b339b6e5,655e0f3c.

**Source:** playtest 2026-11-25 (mid game) ([report](../../../reports/data/2026-11-25-playtest-3.md), finding 2) · **Size:** S · **Needs:** — · **Status:** open

## Why

With 13 dwarves the Units list reads "Birna Hollowcrown ☺ Idle". From 22 dwarves on, when the list is longer than the panel and the scrollbar column appears, every row ends in "»": "Melkorka Frosthall ☺ Eating »", "Ragnhild Stormpick ☺ On duty »" (`17-d153-units.png`, `31-y3-hurt.png`, 34 to 54 dwarves). Nothing is cut: the activity fits. The Jobs table does the same once it scrolls ("Craft still  -  »", "Haul straw  open 16 da»", `48-y4-jobs.png`), so every row of a mid-game Jobs list looks cut, and the reasons that really are cut cannot be told from the rest.

The cause is in the table widget (`src/ui/widgets/table.ts`): `table` lays each row out with `tableRow(columns, r, rect.cols)`, the full width, and hands the rows to `list`, which draws them in `rect.cols − 1` cells when it shows a scrollbar (`src/ui/widgets/list.ts`), so `label` cuts one cell off every row and marks it. The tooltip loop in `table` already uses `listWidth`. Every panel that draws through `table` is affected: Units, Jobs, Animals, Civilizations, Military lists, Orders' picker, Zones, Building, and the Look views that use it.

Reproduce: any fortress with more dwarves than the Units list has rows (at 1280 × 800, about 29), or the save `reports/data/2026-11-25-playtest-3/frostvault-y3-summer9.bin`.

## What to do

Decisions:

- **`table` lays its rows out in the list's width**: `rect.cols − 1` when the rows do not fit `rect.rows − 1`, else `rect.cols`, the same `listWidth` its tooltip loop uses. The last column takes what is left of that width.
- No other change: a cell that does not fit still ends in `»` with its tooltip (24 § Panels).

Spec: none (24 § Panels already says a list shows a scrollbar glyph column, and a cell that fits is not cut).

Decided while doing it:

- **Done by T-719**: its fix to `table` (rows laid out in `rect.cols − 1` cells while the scrollbar shows) is this task's decision. Every panel of the Year 3 save (`frostvault-y3-summer9.bin`, 52 dwarves) was drawn headlessly at 80 × 50: no row of a scrolling table ends in `»` for a cell that fits. The `»` that remain are names (a dwarf in Jobs' Who column and the Units All tab, a stockpile's name, Military's member list, Civilizations' "Last brought" entries), the Labors grid's mark, and a Units activity longer than its column (`Visiting the hearth`, `Craft: lavish meal`), which `fortress-screen.md` § Sidebar open lets end in `»`. No panel builds a table's rows outside `table` (Orders' material picker, the stockpile editor and the world map's filter pass bare text to `list`, which cuts only what does not fit).
- **The tests pin it per table** that scrolls at scale: Units (both tabs), Jobs (a batch of sixty digs opened to its rows, so T-739's batching does not change the case) and Animals (forty named dogs). Military's squad table is as tall as its squads and never scrolls.

## Done

- [x] Tests (`describe` with the task id): `test/unit/ui/t735-scrolling-tables.test.ts`: a `table` with more rows than fit draws no `»` on a row whose cells fit, and one on a row whose last cell does not; Units with 40 dwarves at 36 columns reads "Eating" with no `»`, on both tabs; Jobs with 60 jobs the same; Animals with 40 rows the same. Each fails with the widget as it was before T-719.
- [x] T-703's panel test still passes. UI only: no world hash moves; no render golden moved (none draws a scrolling table).

**Note at merge (orchestrator):** T-719 (merged next) found the same cause: the table widget laid rows out one cell too wide while a scrollbar showed, and fixed it. Check whether anything of this task is left after T-719 before working on it.
