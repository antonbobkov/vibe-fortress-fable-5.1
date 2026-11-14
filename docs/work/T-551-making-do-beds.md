# T-551 — Making Do B1: beds that rest differently, bedding and pillows

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 Beds); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-547, T-548 · **Status:** blocked (needs T-546, T-547, T-548)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

- The bed `rest` column and its effect on 10's sleep errand; `pallet` (80%), `stone_bed` (90%, refused bare), the wooden bed (100%), the dressed bed (125%) and the featherbed.
- `bedding` and `pillow` at the clothier from cloth and any `stuffing` (straw, wool, feathers); a built bed wants its bedding and pillow as a hospital chest wants supplies, and a hauler makes it up.
- The thoughts: `slept_on_a_pallet`, `slept_in_a_soft_bed`, `slept_in_a_featherbed`.

## Common rules for every Making Do task

- Build on the spec as T-546 wrote it, not on the design alone. Where the two disagree, the spec wins; where the spec is silent, decide, write it in the spec, and say so.
- Rows are appended (`docs/03-content/row-order.md`, then `npm run content:export`); none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- New wild plants, features and terrain go on their own rng streams, so existing maps keep their rock, trees and shrubs. Name any golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every substitute route costs more inputs, more work or a worse result than the regular route (design § 3). T-547's content check enforces this once it lands; keep it green.
- Faces and tricks are part of the task: the thoughts, log lines and announcements the design names. Trade-offs and goofy rules go in `docs/fun-features.md` § In the game (stings, spit, tipsy dwarves, webs across your own corridor, and so on).
- Measure as the design's § 13 says for the bundle: rows against the content checks; mechanisms against the three-year fixture's food and wealth, the sleep audit, and the pooled sweep and instrument verdicts; terrain against the annual instrument.

## Done

- 10, 13 and 14 say it, the code does it, with tests.
- The sleep audit before and after (design § 12: about 3% more working time), and the sweep and instrument verdicts pass.
