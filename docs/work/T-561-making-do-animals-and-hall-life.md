# T-561 — Making Do C5: reindeer and camels

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 6); the owner, 2026-11-13 · **Size:** S · **Needs:** T-546, T-547, T-548 · **Status:** blocked (needs T-546, T-547, T-548)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

Feasts, the Thane's whims and mugs moved to T-NEW (hall life).

## What to do

The blocks and rows marked T-561:

- **08 § Planned:** Reindeer and camels (domestic rows; wild herds on their own stream, `rngFor('08.herds')`; the camel's spit, `SpatOn`).
- **20 § Planned:** camels from the Hillfolk in hot regions.
- **Rows:** `reindeer`, `camel`, the Wild herds table, the reindeer's horns (butcher parts), `spat_on`, `announce.spat_on`, the colours.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.
- The tasks named `T-NEW (…)` in the spec are those of the new work files: `T-NEW (scale)` is `T-NEW-making-do-scale-armour-and-bows.md`, `T-NEW (candles)` `T-NEW-making-do-candles-and-lanterns.md`, `T-NEW (compost)` `T-NEW-making-do-compost-fertilizer-soap.md`, `T-NEW (hall life)` `T-NEW-making-do-hall-life.md`. Read them by the ids they are given.

## Done

- Reindeer herds walk into a tundra map and camels into a desert one; tamed, they are milked (and the camel sheared), and the camel spits now and then; both graze lichen, salt crust and cactus (T-548's rule).
- The ordinary wild spawning draws as before. The instrument verdict passes; its taiga row may move by the reindeer, which the report explains.
