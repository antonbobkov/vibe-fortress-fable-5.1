# T-558 — Making Do C2: glass walls, skylights and greenhouses

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 (glass, skylights)); the owner, 2026-11-13 · **Size:** L · **Needs:** T-546, T-553 · **Status:** blocked (needs T-546, T-553)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

The blocks and rows marked T-558:

- **03 § Planned:** Glass passes light (the `skylit` flag, bit 14, in the outdoor column pass; light spreads through glass walls).
- **05 § Planned:** A skylit tile is lit but not outdoors (`temperatureAt`).
- **07 § Planned:** Under a skylight (seasons, weather and frost ignored, `minC` kept).
- **22 § Planned:** Sight through glass (`lineOfSight` passes glass; `lineOfFire` does not); **16 § Planned:** firing uses `lineOfFire`.
- **14 § Planned:** Glass (walls, floors, fortifications of glass blocks; no new row); **23 § Planned:** glass drawn.
- **Rows:** `data-model.md`'s flag table gains bit 14 `skylit`; `hint_skylight`.

## Decisions

- A skylight is any constructed glass floor: there is no separate skylight row.
- 05 keeps the surface temperature for every tile that is `lit` today and excludes only a `skylit` one, so no cave mouth changes temperature.
- Glass walls pass sight, not fire: 22 has two lines.


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

- A greenhouse scenario: a plot one level under glass floors in a temperate winter grows cabbage and not barley; inside the hearth's square it grows barley; three levels down it grows strawberries in winter.
- An archer behind a glass wall sees a raider and does not shoot. A glass floor over magma is magma-safe.
- The annual instrument and sweep verdicts pass; the per-system budgets of 03 and 05 hold (the column pass is per column, cached as `outdoor` is).
