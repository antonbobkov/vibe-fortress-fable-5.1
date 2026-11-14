# T-555 — Making Do B5: hives, honey, beeswax and mead

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 6 (hives), 7 (honey)); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-549, T-553 · **Status:** blocked (needs T-546, T-549, T-553)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

Compost, fertilizer and soap moved to T-NEW (compost).

## What to do

The blocks and rows marked T-555:

- **07 § Planned:** Flowers (`plants.flowerAt`, the compositor's test moved to `core/`).
- **08 § Planned:** Hives (flowers in reach, a comb every `HIVE_DAYS` from spring to autumn, `collect_honey`, the collector's and passers-by's stings, `Stung`, the hive panel).
- **14 § Planned:** Beehives (outdoors on soil, refused elsewhere).
- **17 § Planned:** Honey (for cloth in `dress_burn`, a honeyed burn cleaned; for water in `clean_wound`; the supply kind).
- **Rows:** `honey`, `beeswax` (materials and items), `honeycomb`, `beehive`, `mead` and `brew_mead`, the three hive recipes (wood, clay, wicker), `press_honeycomb`, `make_candles_wax`, `collect_honey`, `stung`, `hint_hive`, the honey and beeswax sundries and preferences, the colours.


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

- A hive by a meadow fills with comb in summer and is silent in winter; its keeper is stung now and then, and so is anyone who walks past it; honey brews mead and cleans a wound where there is no well.
- The three-year fixture's food margin before and after; the sweep and instrument verdicts pass.
