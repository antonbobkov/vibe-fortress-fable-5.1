# T-562 — Making Do A3b: scale armour, horn bows and fletching

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 3, 7 (armor between leather and mail, fletching)); T-546, split from T-549 · **Size:** M · **Needs:** T-547 · **Status:** blocked (needs T-547)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

In the spec this task is `T-562`.

## What to do

The blocks and rows marked T-562:

- **16 § Planned:** The scale layer (the layer enumeration, the damage column, `armorMult` 1.0, no metal penalty); The horn bow.
- **12 § Planned** and **25 § Planned:** Fletching at the bowyer (the `enchants` table's `workshop` column; the `set_ammo_fletched` setting generated at the bowyer with `carpentry`).
- **Rows:** `scale_shirt`, `scale_skirt`, the `scale` column of § Damage type versus layer, `horn_bow`, `make_scale_shirt`, `make_scale_skirt`, `make_horn_bow`, the `fletched` enchantment and the `workshop` column.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- A hunter's fortress with no metal makes scale shirts of shell or horn: they stop an edge better than leather and worse than mail; a horn bow of pine shoots as a yew bow; 25 fletched bolts hit 5 more often and cannot also take a rune.
- The `armorReduction` worked numbers in 16 gain a scale line. The defence-seeds verdict passes if scale reaches the scripts' squads; the sweep verdict passes.
