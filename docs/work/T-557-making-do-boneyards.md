# T-557 — Making Do C1: boneyards and the bone recipes

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 4.1); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-547 · **Status:** blocked (needs T-546, T-547)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

The fossil drop and `first_fossil` are T-547's; `crush_fossil` is T-553's.

## What to do

The blocks and rows marked T-557:

- **03 § Planned:** Stage 9b, the boneyards (`terrain.giant_bones`; spine, ribs, skull; half sunk in soil, ribs in the bog, tusks of ivory in tundra; `giantSkulls`, `boneyards`, `RibsEntered`).
- **10 § Planned:** Places that make a face (the ribs).
- **23 § Planned:** bone's glyphs.
- **Rows:** `giant_skull`, the bone recipes (`cut_bone_blocks`, the bone table, chair, door, coffin and statue, `mount_skull`, `carve_fossil`, `carve_ivory_statue`), the item edit (statues of bone), `stood_in_the_ribs`, `announce.ribs_entered`, the fossil-craft preference.


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

- A desert, badlands, wetland or tundra map has one to three skeletons; a dwarf standing in the ribs is pleased once; the skull mounts as a statue.
- Only the four biomes' maps change: their local-map hashes move, named in `golden:`. The annual instrument's rows do not move (it plays forest, taiga and grassland).
