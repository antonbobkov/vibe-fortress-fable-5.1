# T-547 — Making Do A1: new materials, minerals and butchering products

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 2, 4, 6); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546 · **Status:** blocked (needs T-546)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

- Materials and minerals as rows: `sand`, `clay` and `peat` drops from digging their walls; `halite` clusters and `salt` (the kitchen crushes 1 → 5); `bog_iron` in peat; `pewter` (1 tin + 1 lead → 2) with mugs and crafts; `chitin`, `horn`, `ivory`, `feather` from butchering the species the design names; fossil clusters as a mineral row (the `fossil` item; its recipes come with T-557 and T-553).
- Flux substitutes for steel: shell or chitin at 3 a bar; bone ash at 1 a bar (bone ash is made at the kiln in T-553; the flux rule lands here).
- The substitute content check (design § 12): a test that compares value per input unit and work per output of each substitute recipe against its regular one, and fails if a substitute is ever better.

## Common rules for every Making Do task

- Build on the spec as T-546 wrote it, not on the design alone. Where the two disagree, the spec wins; where the spec is silent, decide, write it in the spec, and say so.
- Rows are appended (`docs/03-content/row-order.md`, then `npm run content:export`); none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- New wild plants, features and terrain go on their own rng streams, so existing maps keep their rock, trees and shrubs. Name any golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every substitute route costs more inputs, more work or a worse result than the regular route (design § 3). T-547's content check enforces this once it lands; keep it green.
- Faces and tricks are part of the task: the thoughts, log lines and announcements the design names. Trade-offs and goofy rules go in `docs/fun-features.md` § In the game (stings, spit, tipsy dwarves, webs across your own corridor, and so on).
- Measure as the design's § 13 says for the bundle: rows against the content checks; mechanisms against the three-year fixture's food and wealth, the sleep audit, and the pooled sweep and instrument verdicts; terrain against the annual instrument.

## Done

- The rows, recipes and flux rule are in the spec, the content and the code, with tests; the substitute check runs in `content:check` or the unit tests.
- `content:check` and the six static checks pass; the instrument verdict passes.
