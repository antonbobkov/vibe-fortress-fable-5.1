# T-553 — Making Do B3: the kiln, pottery, glass, candles and lanterns

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 (kiln, candles)); the owner, 2026-11-13 · **Size:** L · **Needs:** T-546, T-547 · **Status:** blocked (needs T-546, T-547)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

- The `kiln` workshop, the `magma_kiln` variant, the `pottery` skill and Potter profession.
- Bricks, pots (a barrel of 10 that breaks when its holder is struck), jugs, clay mugs, glass, glass blocks, potash, bone ash, crushed fossils, lanterns.
- Candles from tallow or beeswax; candle stands that hold 5 and want refilling; lit tiles for comfort and room value; a lit tile reveals hidden creatures 2 tiles farther; tallow smoke; `ate_by_candlelight`.

## Common rules for every Making Do task

- Build on the spec as T-546 wrote it, not on the design alone. Where the two disagree, the spec wins; where the spec is silent, decide, write it in the spec, and say so.
- Rows are appended (`docs/03-content/row-order.md`, then `npm run content:export`); none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- New wild plants, features and terrain go on their own rng streams, so existing maps keep their rock, trees and shrubs. Name any golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every substitute route costs more inputs, more work or a worse result than the regular route (design § 3). T-547's content check enforces this once it lands; keep it green.
- Faces and tricks are part of the task: the thoughts, log lines and announcements the design names. Trade-offs and goofy rules go in `docs/fun-features.md` § In the game (stings, spit, tipsy dwarves, webs across your own corridor, and so on).
- Measure as the design's § 13 says for the bundle: rows against the content checks; mechanisms against the three-year fixture's food and wealth, the sleep audit, and the pooled sweep and instrument verdicts; terrain against the annual instrument.

## Done

- The kiln's recipes and the light rules are in the spec with tests; e2e for building a kiln and a candle stand.
- The sweep and instrument verdicts pass.
