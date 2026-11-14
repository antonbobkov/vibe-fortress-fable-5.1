# T-564 — Making Do B5b: the compost heap, fertilizer and soap

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 (compost heap, fertilizer, soap)); T-546, split from T-555 · **Size:** M · **Needs:** T-552, T-553 · **Status:** blocked (needs T-552, T-553)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

In the spec this task is `T-564`. It needs T-552's dung and T-553's potash and bone ash. Guano (T-556) is one more fertilizer when it lands: the rule reads the tag.

## What to do

The blocks and rows marked T-564:

- **13 § Planned:** The compost heap (a zone with fixed slots for rotten food and dung, `compostAt`, one compost a unit).
- **07 § Planned:** Fertilizer (the plot setting, the optional second input of `plant`, `Crop.fertilized`, `FERTILIZER_YIELD_BONUS`).
- **17 § Planned:** Soap (`wash_patient`, `Patient.washed`, the supply kind); **12 § Planned:** `make_soap`.
- **24 § Planned:** the plot panel's toggle.
- **Rows:** `compost` (material, item and zone type), `soap` (material and item), `make_soap`, `wash_patient`, the `fertilize` setting, the `f` key, the colour.

## Decisions

- Straw is not composted: it is a stuffing and a pallet's material. The heap takes rotten food and dung.
- Fertilizer adds to the yield, not to growth, and a plot whose fertilizer runs out keeps planting without it.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- Rotten food on a heap outdoors turns to compost in two weeks; a fertilized plot of ten by ten gives about a hundred more plants a cycle; a patient washed with soap takes no infection for the admission.
- The three-year fixture's food margin before and after; the sweep and instrument verdicts pass.
