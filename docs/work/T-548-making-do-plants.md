# T-548 — Making Do A2: new plants, wild and farmed

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 5); the owner, 2026-11-13 · **Size:** M · **Needs:** T-546 · **Status:** blocked (needs T-546)

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

- Wild shrubs by conversion passes on their own streams: `reed_bed`, `barrel_cactus` (drinkable pulp: "Drank cactus. Cactus."), `wild_nettle` (stings the gatherer), `rock_lichen` (grazing that regrows in 56 days), `salt_crust`.
- Crops: `rye` (grows at −2 °C), `nettle`, `wyrmtongue` (plantable only on ash; a planted ash tile keeps its ash; its meal thought and cold resistance). `straw` from barley, rye and cavewheat harvests.
- The tree `ironwood` (hard to chop, hard to burn) in dark and temperate forest.

## Common rules for every Making Do task

- Build on the spec as T-546 wrote it, not on the design alone. Where the two disagree, the spec wins; where the spec is silent, decide, write it in the spec, and say so.
- Rows are appended (`docs/03-content/row-order.md`, then `npm run content:export`); none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- New wild plants, features and terrain go on their own rng streams, so existing maps keep their rock, trees and shrubs. Name any golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every substitute route costs more inputs, more work or a worse result than the regular route (design § 3). T-547's content check enforces this once it lands; keep it green.
- Faces and tricks are part of the task: the thoughts, log lines and announcements the design names. Trade-offs and goofy rules go in `docs/fun-features.md` § In the game (stings, spit, tipsy dwarves, webs across your own corridor, and so on).
- Measure as the design's § 13 says for the bundle: rows against the content checks; mechanisms against the three-year fixture's food and wealth, the sleep audit, and the pooled sweep and instrument verdicts; terrain against the annual instrument.

## Done

- Each plant is in 07 and the content with a test, and placed only in its biomes; existing maps keep their trees and shrubs.
- The annual instrument verdict passes; the instrument's forest, taiga and grassland rows should not move beyond what the new shrubs explain.
