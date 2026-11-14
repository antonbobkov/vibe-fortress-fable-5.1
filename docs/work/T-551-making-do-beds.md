# T-551 — Making Do B1: beds that rest differently, bedding and pillows

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 7 Beds); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-547, T-548 · **Status:** blocked (needs T-546, T-547, T-548)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## The owner on pallets and stone beds (2026-11-13)

"make stone bed to be just stone + pallet materials. Pallet should be very easy to construct - no specialized workshop, labor (think dwarf just sleeping covering with cloth)." Then: "Stone bed should take a mason. Adjust resting percentages, pallet and stone bed should be less comfortable."

- **A pallet needs no workshop, no recipe and no skill.** It is laid straight from its materials, 2 cloth or wool, or 3 fiber, straw or reeds, by any dwarf, with no labor and the shortest build the game has. Think of a dwarf lying down under a cloth. It rests at **60%**, with `slept_on_a_pallet` (−1).
- **A stone bed is a mason's job:** 1 raw stone + a pallet's materials, at the mason's workshop (skill `masonry`), no `bedding`. It rests at **75%**.
- The wooden bed rests at 100% and the dressed bed at 125%, as the design says. All four are *unmeasured*.
- These numbers replace the design's 80% and 90%.

## What to do

- The bed `rest` column and its effect on 10's sleep errand; `pallet` (60%, laid from its materials with no workshop or labor), `stone_bed` (75%, a mason's job: a raw stone + a pallet's materials), the wooden bed (100%), the dressed bed (125%) and the featherbed.
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
