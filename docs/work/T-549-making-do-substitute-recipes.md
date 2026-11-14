# T-549 — Making Do A3: substitute recipes, wicker, scale armour and bows

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 3, 7 (wicker, scale, fletching)); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-547 · **Status:** blocked (needs T-546, T-547)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## The owner on pallets and stone beds (2026-11-13)

"make stone bed to be just stone + pallet materials. Pallet should be very easy to construct - no specialized workshop, labor (think dwarf just sleeping covering with cloth)." Then: "Stone bed should take a mason. Adjust resting percentages, pallet and stone bed should be less comfortable."

- **A pallet needs no workshop, no recipe and no skill.** It is laid straight from its materials, 2 cloth or wool, or 3 fiber, straw or reeds, by any dwarf, with no labor and the shortest build the game has. Think of a dwarf lying down under a cloth. It rests at **60%**, with `slept_on_a_pallet` (−1).
- **A stone bed is a mason's job:** 1 raw stone + a pallet's materials, at the mason's workshop (skill `masonry`), no `bedding`. It rests at **75%**.
- The wooden bed rests at 100% and the dressed bed at 125%, as the design says. All four are *unmeasured*.
- These numbers replace the design's 80% and 90%.

For this task: drop `weave_pallet`; reeds are simply one of a pallet's materials (T-551).

## What to do

- Pallets and wicker from reeds (baskets as bins and bags, reed rope, wicker shields, hives as items), cloth from reed, cactus and nettle fiber at 2 fiber a thread, leather-strip rope.
- Bone splints and crutches; metal crutches.
- Scale armour: the one new layer in 16's table and its constant, `scale_shirt` and `scale_skirt` at the leatherworks.
- Horn bows at the bowyer; fletching as a bowyer transform recipe (the enchant row's `workshop` column, 25 § Enchantments).
- The workshop-inputs rule: every workshop but the carpenter's accepts stone blocks or bricks for its logs, 2 a log, at 1.5 times the build.

## Common rules for every Making Do task

- Build on the spec as T-546 wrote it, not on the design alone. Where the two disagree, the spec wins; where the spec is silent, decide, write it in the spec, and say so.
- Rows are appended (`docs/03-content/row-order.md`, then `npm run content:export`); none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- New wild plants, features and terrain go on their own rng streams, so existing maps keep their rock, trees and shrubs. Name any golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every substitute route costs more inputs, more work or a worse result than the regular route (design § 3). T-547's content check enforces this once it lands; keep it green.
- Faces and tricks are part of the task: the thoughts, log lines and announcements the design names. Trade-offs and goofy rules go in `docs/fun-features.md` § In the game (stings, spit, tipsy dwarves, webs across your own corridor, and so on).
- Measure as the design's § 13 says for the bundle: rows against the content checks; mechanisms against the three-year fixture's food and wealth, the sleep audit, and the pooled sweep and instrument verdicts; terrain against the annual instrument.

## Done

- Each recipe and rule is in the spec and content with a test; the substitute check passes for every one.
- The sweep and instrument verdicts pass; the defence seeds verdict passes if scale armour reaches the scripts' squads.
