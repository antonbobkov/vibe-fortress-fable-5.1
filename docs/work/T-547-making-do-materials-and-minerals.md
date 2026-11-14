# T-547 — Making Do A1: new materials, minerals and butchering products

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 2, 4, 6); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546 · **Status:** blocked (needs T-546)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

The blocks and rows marked T-547:

- **03 § Planned:** Soil that drops something (`soil_load`, `SOIL_DROP_PERMILLE`, its own stream); Bone tiles (a dug bone tile drops a `fossil`; `FossilFound` and its note; the boneyards themselves are T-557's).
- **09 § Planned:** Butcher parts, the new content table (horn, tusks of ivory, feathers, the crawler's chitin), and the crawler made butcherable for them.
- **12 § Planned:** Substitutes are worse (the unit test that compares each `substitute for` pair; it covers only the pairs whose rows exist, and each later task adds its own); Steel without flux stone (`make_steel_shell`, `make_steel_bone_ash`); `crush_halite` at the kitchen.
- **Rows:** materials (`salt`, `chitin`, `horn`, `ivory`, `feather`; the `soil_drop` tags), minerals (`halite`, `bog_iron`, `giant_bone`), the metal `pewter` (its alloy recipe is generated), items (`soil_load`, `fossil`, `horn`, `tusk`, `feather`, `salt`), the butcher-parts rows, the recipes marked T-547 (`make_mug_horn`, `craft_ivory` too), `first_fossil`, `announce.first_fossil`, the colours, the pewter preference, and the item edits (mugs of horn).
- `halite` has no yields, so the generated smelting must skip an ore with none.

## Decisions

- Sand, clay and peat are the soil materials that exist; the design's soil items are one item type, `soil_load`, of those materials.
- Fossils are the mineral `giant_bone` (class `bone`), in sedimentary hosts only: a mineral row has one count.
- Chitin is the cave crawler's shell only; crabs and crocodiles keep their species shells. Horn, ivory, feathers and chitin come from a butcher-parts table, not from `remains` (remains are recovered by `strip_corpse` and flagged foreign).


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

- Digging clay, sand or peat drops a load about half the time, on its own stream; digging a fossil drops a fossil and the first one is announced; butchering a yak gives horns and a chicken feathers; steel is made with shells or bone ash; halite is crushed to salt.
- The substitute check runs in the unit tests.
- `content:check` and the six static checks pass. Soil loads add hauling to every fortress that digs soil: run the sweep and the instrument on GitHub, and explain any move by the loads.
