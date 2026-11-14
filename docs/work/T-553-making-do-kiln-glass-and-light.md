# T-553 — Making Do B3: the kiln, pottery, bricks, pots and glass

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 (kiln)); the owner, 2026-11-13 · **Size:** M · **Needs:** T-547 · **Status:** blocked (needs T-547)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

Candles, candle stands, lanterns and their light moved to T-563.

## What to do

The blocks and rows marked T-553:

- **12 § Planned:** The kiln and pottery (the `kiln` workshop; `magma_kiln` becomes its magma variant and buildable; the `pottery` skill, labor `crafts`, profession Potter).
- **13 § Planned:** Clay pots (a barrel-class container of 10 that breaks with its contents when its carrier is hit; the earthenware jug breaks too); **16 § Planned:** Pots break.
- **Rows:** `brick`, `earthenware`, `glass`, `potash` (materials), `bone_ash`, `potash` (items), `pot`, the kiln and its pattern, the recipes marked T-553 (bricks, pot, jug, clay and glass mugs, glass blocks with and without potash, potash, bone ash, `crush_fossil`), the `pottery` skill, the Hillfolk's bricks and pots, the glass preference, the colours, and the item edits (buckets and mugs of earthenware and glass).
- `make_steel_bone_ash` comes here from T-547 (its `bone_ash` item is this task's): add its row (12 § Planned, Steel with bone ash; `workshops-and-recipes.md` § Planned rows) and its pair to the substitute check (`test/unit/workshops/substitutes.test.ts`), and test it end to end.

## Decisions

- Glass comes out of the kiln as blocks: there is no glass item in between (2 sand → 1 block; with potash, 2 sand + 1 potash → 2).
- Fired clay is its own material, `earthenware`; a brick is `brick`.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- A kiln built of blocks (or on magma, with no fuel) fires bricks, pots and glass blocks; a pot holds 10 drinks and breaks when a hauler carrying it is struck.
- E2e: build a kiln and fire a brick. The sweep and instrument verdicts pass.
