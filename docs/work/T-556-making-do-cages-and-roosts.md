# T-556 — Making Do B6: the spider ranch, the beetle jar and bat roosts

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 6); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546 · **Status:** blocked (needs T-546)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

The blocks and rows marked T-556:

- **18 § Planned:** A caged spider's lair is its cage (webs around a built cage; out of the cavern's count).
- **09 § Planned:** Gathering webs (a gather zone designates web tiles daily).
- **07 § Planned** and **14 § Planned:** The beetle jar (`buildings.beetleLitAt`, `BEETLE_GROWTH_PERCENT`, glow plots).
- **03 § Planned:** Bat roosts at generation (`terrain.roosts`, `LocalMapResult.roosts`); **08 § Planned:** Bat roosts (guano every `ROOST_DAYS` by day and index, `RoostFound`).
- **Rows:** `silk_cloth` and its stage, `guano` (material and item), the `G` flag on `glow_beetle`, the spider's note, `announce.roost_found`, `hint_spider_ranch`, the silk preferences.


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

- A spider caught in cavern one and caged in a side room webs it daily, a gather zone collects the silk and the loom weaves silk; a hauler who walks into the room is caught for 100 ticks. A caged beetle grows four glowcap at half speed. Roosts drop guano.
- Cavern generation is unchanged but for the roosts' own stream (the local-map hash does not move: roosts are not tiles). The instrument verdict passes.
