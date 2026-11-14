# T-551 — Making Do B1: beds that rest differently, bedding, and buildings that want items

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 Beds); the owner, 2026-11-13 · **Size:** L · **Needs:** T-547 · **Status:** blocked (needs T-547)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## The owner on pallets and stone beds (2026-11-13)

"make stone bed to be just stone + pallet materials. Pallet should be very easy to construct - no specialized workshop, labor (think dwarf just sleeping covering with cloth)." Then: "Stone bed should take a mason. Adjust resting percentages, pallet and stone bed should be less comfortable."

- **A pallet needs no workshop, no recipe and no skill.** It is laid straight from its materials, 2 cloth or wool, or 3 fiber, straw or reeds, by any dwarf, with no labor and the shortest build the game has. Think of a dwarf lying down under a cloth. It rests at **60%**, with `slept_on_a_pallet` (−1).
- **A stone bed is a mason's job:** 1 raw stone + a pallet's materials, at the mason's workshop (skill `masonry`), no `bedding`. It rests at **75%**.
- The wooden bed rests at 100% and the dressed bed at 125%, as the design says. All four are *unmeasured*.
- These numbers replace the design's 80% and 90%.

## What to do

The blocks and rows marked T-551:

- **13 § Planned** and **14 § Planned:** Buildings that want items, the shared mechanism (`wants` on a building row, `Building.held`, hauls by `haul_to_stockpile` as a hospital chest's, `ReleaseHeld`). The drying rack (T-552), the candle stand (T-563) and the dining table's mugs (T-565) use it after this task.
- **14 § Planned:** Beds (the `rest` column; `pallet` and `straw_pallet` laid by `hauling` in 20 ticks; the stone bed's two mason recipes and its item; the made-up bed and the featherbed; "a bed" for a room is any `sleep` building).
- **10 § Planned:** Beds rest differently (rest × `rest` / 100, the sleep's cap × 100 / `rest`, `FLOOR_REST_PERCENT`, `Slept`'s `rest` and `bedding`).
- **Rows:** the furniture rows and columns, `stone_bed`, `bedding`, `pillow` (with their stuffing), the recipes marked T-551, the thoughts, `hint_pallet`, the Hillfolk's bedding, the `t` key.

## Decisions

- A pallet is two building rows (cloth 2, straw 3), since a building input has one count. Its labor is `hauling`: any dwarf, children too; there is no job without a labor.
- The floor rests at 50 so that a pallet is worth laying: below every bed.
- A dressed bed is a bed that holds its bedding and pillow through the shared wants mechanism, which is the hospital chest's hauling made general: the plainest fit for the bed, the rack, the stand and the table.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- Seven dwarves on day one sleep on pallets of the wagon's cloth within the hour; a pallet sleeper sleeps longer, a made-up bed's sleeper shorter; a featherbed gives its thought; taking a pallet apart returns its cloth.
- The sleep audit before and after (the floor's rest moves too), with the three-year fixture's working time; the sweep and instrument verdicts pass.
