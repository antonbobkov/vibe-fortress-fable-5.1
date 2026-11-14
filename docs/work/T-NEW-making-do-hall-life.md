# T-NEW — Making Do C6: feasts, the Thane's whims and mugs at the table

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 11); the flavour report's item 26; T-546, split from T-561 · **Size:** M · **Needs:** T-546, T-547, T-551, T-553, T-554, T-555, T-557, T-NEW (candles) · **Status:** blocked (needs those)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

In the spec this task is `T-NEW (hall life)`. It is the last of the bundle: its whims name a lantern, mead, an ivory statue, spirits and a featherbed, and its mugs use T-551's building wants.

## What to do

The blocks and rows marked T-NEW (hall life):

- **10 § Planned:** Feasts, mugs and the Thane's whim (the feast eaten first, `MealEaten`'s `feast` and `mug`, the whim drawn on `rngFor('10.whims')` each season and judged at the next, `WhimSet`, `WhimJudged`, `whim`).
- **12 § Planned:** `cook_feast`; **14 § Planned:** a dining table wants a mug per adjacent chair (the `table` row's `wants`).
- **15 § Planned:** the whim is all face.
- **24 § Planned:** the units panel's Thane line.
- **Rows:** `feast`, `cook_feast`, the Whims table, the thoughts `feasted`, `held_a_feast`, `drank_from_a_mug`, `thane_pleased`, `thane_grumbled`, the three whim announcements.

## Decisions

- A feast is a stack of servings eaten before any other meal; it is hauled and served as meals are, with no placement of its own.
- Mugs are held by the dining tables, one per chair beside them, through the building wants mechanism.
- A missed whim grumbles once, for the Thane alone: no spiral.


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

- A feast at midwinter feeds the hall for a day and lifts everyone; a hall with its mugs gives its thought; the Thane wishes for a lantern in spring, and the hall is pleased in summer when it is there.
- The sweep and instrument verdicts pass (mood moves a little).
