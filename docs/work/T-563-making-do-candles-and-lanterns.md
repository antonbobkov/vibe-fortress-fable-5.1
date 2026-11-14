# T-563 — Making Do B3b: candles, candle stands, lanterns and what light does

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 (candles, stands and lanterns)); T-546, split from T-553 · **Size:** M · **Needs:** T-551, T-552, T-553, T-554 · **Status:** blocked (needs T-551, T-552, T-553, T-554)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

In the spec this task is `T-563`. It needs T-551's building wants, T-552's `smoky_hall`, T-553's glass and kiln, and T-554's `comfortLightAt`, which it extends.

## What to do

The blocks and rows marked T-563:

- **14 § Planned:** Comfort light, candle stands and lanterns (stands want candles and burn them by days; lanterns forever; `comfortLightAt` gains both; `ate_by_candlelight`; the spotting bonus; tallow smoke on 10's stream, drawn only for a dwarf in tallow light).
- **18 § Planned:** Candle light shows the thief (`CANDLE_SPOT_BONUS` both ways).
- **23 § Planned:** the `light` overlay.
- **Rows:** `candle`, `lantern`, `candle_stand`, `make_candles_tallow`, `make_lantern`, `ate_by_candlelight`, the Hillfolk's candles, the item edit to `tallow`'s note.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- A stand keeps five candles fed by a `maintain` order and lights its 3×3; a meal in its light gives its thought; a thief at a candle-lit gate is spotted two tiles sooner; a room lit only by tallow is smoky now and then; a cellar beside a stand stops working.
- E2e: build a candle stand and see it lit. The sweep and instrument verdicts pass.
