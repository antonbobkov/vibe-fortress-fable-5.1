# T-559 — Making Do C3: ice harvesting, ice walls and fire on purpose

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 (ice, fire on purpose)); the owner, 2026-11-13 · **Size:** M · **Needs:** — · **Status:** open

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

The blocks and rows marked T-559:

- **03 § Planned:** Ice harvesting (`harvest_ice`, cut from beside or above, the tile left frozen, `iceCut`); Setting a fire (`ignite`, a firebrand, `TileIgnited`, `ConfirmIgnite`, `igniteConfirmed`).
- **05 § Planned:** Ice constructions cool (`ICE_OVERRIDE`, `iceBuilt`, melting underground after `ICE_CONSTRUCTION_DAYS`, outdoors by the thaw, `IceMelted`); Fire on purpose (the ignition queued as lightning's).
- **13 § Planned:** Ice blocks melt (`ICE_MELT_DAYS` on the rot queue); **14 § Planned:** Ice.
- **24 § Planned:** the two designations and the confirmation.
- **Rows:** `firebrand` and `make_firebrand`, the job rows, `set_a_fire`, `c_first_ignite`, `announce.ice_melted`, the `I` and `F` keys.

## Decisions

- Ice is cut, not dug: the tile stays frozen water and can be cut again after three days. An ice block is a `stone_block` of `ice`, so the construction rows take it with no new row.
- `ignite` takes the `woodcutting` labor: clearing land is a woodcutter's work, and children never light fires.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- A larder walled in winter ice keeps its meat until the walls melt; a gate of ice opens itself in spring.
- A designated fire asks once, then lights by 05's rules; e2e for the first-fire confirmation.
- The sweep and instrument verdicts pass.
