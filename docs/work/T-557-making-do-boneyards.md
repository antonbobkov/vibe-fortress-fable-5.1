# T-557 — Making Do C1: boneyards and fossils

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 4.1); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546, T-547, T-553 · **Status:** blocked (needs T-546, T-547, T-553)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

- `giant_bone` material; boneyard skeletons stamped on their own stream (`terrain.giant_bones`) in desert, badlands, wetland and tundra; tusks of ivory in tundra.
- Bone recipes: bone blocks, bone furniture, `carve_fossil`, `mount_skull` and the `giant_skull`; the thoughts `stood_in_the_ribs` and `first_fossil` and the first-fossil log line.

## Common rules for every Making Do task

- Build on the spec as T-546 wrote it, not on the design alone. Where the two disagree, the spec wins; where the spec is silent, decide, write it in the spec, and say so.
- Rows are appended (`docs/03-content/row-order.md`, then `npm run content:export`); none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- New wild plants, features and terrain go on their own rng streams, so existing maps keep their rock, trees and shrubs. Name any golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every substitute route costs more inputs, more work or a worse result than the regular route (design § 3). T-547's content check enforces this once it lands; keep it green.
- Faces and tricks are part of the task: the thoughts, log lines and announcements the design names. Trade-offs and goofy rules go in `docs/fun-features.md` § In the game (stings, spit, tipsy dwarves, webs across your own corridor, and so on).
- Measure as the design's § 13 says for the bundle: rows against the content checks; mechanisms against the three-year fixture's food and wealth, the sleep audit, and the pooled sweep and instrument verdicts; terrain against the annual instrument.

## Done

- The rules are in 03 and the content with tests; only the four biomes' maps change, named in `golden:`.
- The annual instrument's rows do not move (it plays forest, taiga and grassland).
