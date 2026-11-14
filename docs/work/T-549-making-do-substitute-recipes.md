# T-549 — Making Do A3: substitute recipes, wicker, scale armour and bows

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§§ 3, 7 (wicker, scale, fletching)); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-547 · **Status:** blocked (needs T-546, T-547)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

- Pallets and wicker from reeds (baskets as bins and bags, reed rope, wicker shields, pallets, hives as items), cloth from reed, cactus and nettle fiber at 2 fiber a thread, leather-strip rope.
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
