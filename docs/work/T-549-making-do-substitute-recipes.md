# T-549 — Making Do A3: wicker, coarse cloth, bone and metal splints, and workshops of stone

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 3, 7 (wicker)); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-547, T-548 · **Status:** blocked (needs T-546, T-547, T-548)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

Pallets are T-551's (no recipe: a pallet is laid from its materials, reeds among them). Scale armour, horn bows and fletching moved to T-NEW (scale).

## What to do

The blocks and rows marked T-549:

- **14 § Planned:** Workshops of stone (the carpenter's `logs_only` tag; `materialChoice: 'blocks'`, 2 blocks a log, `STONE_WORKSHOP_TICKS_PERCENT`).
- **13 § Planned:** the `basket` (a bin of 15, of reed, burns).
- **17 § Planned:** bone and metal splints and crutches.
- **24 § Planned:** the build menu's "of logs" and "of blocks".
- **Rows:** the recipes marked T-549 (`spin_coarse_thread`, `weave_basket`, `twist_reed_rope`, `cut_leather_rope`, `weave_wicker_shield`, `make_splint_bone`, `make_crutch_bone`, `forge_crutch`), the `basket` container, the item edits (crutch, splint, buckler and rope materials), the Wildwood's reed preference; each recipe's `substitute for` pair in the check.


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

- A treeless fortress builds a loom of blocks, spins nettle thread, weaves a basket and splints a leg with bone; each substitute is worse than its regular recipe by the check.
- `content:check` and the six static checks pass; the sweep runs (the workshop rule can change what the scripts build).
