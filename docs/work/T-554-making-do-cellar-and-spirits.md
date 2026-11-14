# T-554 — Making Do B4: the cellar, aging and spirits

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 (cellar, spirits)); the owner, 2026-11-13 · **Size:** M · **Needs:** — · **Status:** open

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

The blocks and rows marked T-554:

- **14 § Planned:** `buildings.comfortLightAt` (the hearth's square and lamps; T-563 adds stands and lanterns).
- **13 § Planned:** Aging in a cellar (`SetStockpileCellar`, the daily judgement and its reason, cellar days, stages, the oak's `fine_cask`, the value factors, names, stack identity).
- **12 § Planned:** Spirits (`distill`).
- **10 § Planned:** Tipsy (`tipsyUntil`, speed and work rate, the doubled talk, `DrankAlcohol`'s `group` and `aged`).
- **24 § Planned:** the stockpile inspector's cellar line, the stocks panel's stages, "Tipsy".
- **Rows:** `deepfire`, `distill`, the thoughts `drank_strong_drink`, `drank_aged_drink`, `drank_vintage_drink`, `hint_cellar`, the `C` key, the `cellar` setting, `fine_cask` on oak, the spirits preference.

## Decisions

- Dark means no `lit` tile and no comfort light; the temperature is 05's, judged once a day. Aging counts days in a working cellar, so a cellar that warms for a week only pauses.
- Tipsy is a timed field of 10's, not a rune effect: 10 owns speed, productivity and talks. The slowdown is the owner's call: keep it.
- Distilling uses the container rule as it is: twenty units taken from one barrel, ten made into an empty one.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- A barrel of bellwine in an oak barrel in a dark cellar at 10 °C is aged after a year and vintage after two; in a pot it never ages. A dwarf who drinks spirits walks and works 10% slower for two hours and sings.
- Report how much spirits slow a fortress that drinks them (the three-year fixture with a still making spirits). The sweep and instrument verdicts pass.
