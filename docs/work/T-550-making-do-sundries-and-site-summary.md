# T-550 — Making Do A4: sundries, the scarcity price and the site summary

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 2, 10); the owner, 2026-11-13 · **Size:** M · **Needs:** T-547, T-548 · **Status:** blocked (needs T-547, T-548)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

The blocks and rows marked T-550:

- **02 § Planned:** What a site has and lacks (the Signatures table; the two summary rows).
- **20 § Planned:** Sundries (the entries whose goods exist by now: the rows marked T-550; later tasks add theirs), the scarcity price (`SCARCITY_MARKUP`, `trade.isScarce`, "scarce here"), never sold, the preferences marked T-550.
- **24 § Planned:** the world map's two rows and the trade screen's mark.
- **Rows:** `regions-biomes-and-traits.md`'s Signatures, `caravan-goods.md`'s rows marked T-550.


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- The region panel says what a desert lacks before embarking, and a merchant's logs cost two and a half times as much there; the never-sold goods are refused in the requests editor.
- Tests for the summary rule and the price; an e2e for the summary lines.
- The sweep verdict passes (every caravan's draw changes).
