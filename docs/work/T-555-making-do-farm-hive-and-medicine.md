# T-555 — Making Do B5: fertilizer, compost, hives, honey and soap

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 6 (hives), 7 (compost, fertilizer, soap)); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-547, T-548, T-552 · **Status:** blocked (needs T-546, T-547, T-548, T-552)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

- The compost heap zone (rotten food → compost in 14 days, dung and straw in 7); the `fertilize` plot setting (+1 harvest per fertilizer item).
- Beehives (clay pot, wooden blocks or a wicker basket; 8 flower tiles within 6; a honeycomb every 14 days spring to autumn; `collect_honey`); honey, beeswax, mead's input; stings for the collector and passers-by.
- Honey as a wound dressing that prevents infection; soap at the kitchen and the `wash_patient` job.

## Common rules for every Making Do task

- Build on the spec as T-546 wrote it, not on the design alone. Where the two disagree, the spec wins; where the spec is silent, decide, write it in the spec, and say so.
- Rows are appended (`docs/03-content/row-order.md`, then `npm run content:export`); none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- New wild plants, features and terrain go on their own rng streams, so existing maps keep their rock, trees and shrubs. Name any golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every substitute route costs more inputs, more work or a worse result than the regular route (design § 3). T-547's content check enforces this once it lands; keep it green.
- Faces and tricks are part of the task: the thoughts, log lines and announcements the design names. Trade-offs and goofy rules go in `docs/fun-features.md` § In the game (stings, spit, tipsy dwarves, webs across your own corridor, and so on).
- Measure as the design's § 13 says for the bundle: rows against the content checks; mechanisms against the three-year fixture's food and wealth, the sleep audit, and the pooled sweep and instrument verdicts; terrain against the annual instrument.

## Done

- The rules are in the spec with tests.
- The three-year food margin before and after; the sweep and instrument verdicts pass.
