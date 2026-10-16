# T-350 — Dwarves cannot drink from a generated brook or river

**Closed:** 2026-10-16, in 1bf4baf, f59c685, 3f28cd1.

**Source:** T-145's food-chain diagnosis, [`../../reports/audits/2026-10-16-t145-food-chain-diagnosis.md`](../../../reports/audits/2026-10-16-t145-food-chain-diagnosis.md) · **Size:** M · **Needs:** — · **Status:** open

## What was found

In the three-year fortress (seed `three-years`, 48 × 48 map with a brook from west to south) no `DrankWater` event happened in 326 days, though 63 dwarves stood at maximum thirst on days 299 and 300, the alert was `calm` and the brook was on the map.

A probe at tick 0 counted the brook: 53 water tiles, all on z = 31, all at level 7, none frozen. Their 8-neighbours on z = 31 are soil walls (220) or other brook water (192). **None of the 53 has a walkable tile beside it on its own level; all 53 have a walkable bank one level up, on the surface at z = 32**, and the tile over each water tile is `open`.

Two rules meet here:

- `04-implementation/algorithms/local-map-generation.md` § 2 and the surface column rule: a river's bed is carved `depth` levels below the surface (brook 1, river 2, major 2), and the water fills from the bed through `waterTop − 1`, so the water's top level is one level below the bank.
- `02-systems/10-dwarves.md` § Needs, drink search: water is "drunk from any walkable tile 8-adjacent to it on its level". The code does exactly that: `src/systems/dwarves/activities.ts:157-210` (`water()`) looks for stand tiles only on the water tile's own z (lines 191-199).

So no generated brook or river can ever be drunk from: its banks are always one level above its water. Every fortress without a well loses its water fallback (`balance.md` § Drink chain: "Water is the fallback"), and a fortress whose drink runs out dies of thirst beside a brook. The unit tests of the rule (`test/unit/dwarves/activities.test.ts`, "uses alcohol, then a working well, then adjacent surface water", "a dwarf underground drinks from surface water") place their water on a surface floor tile, level with its bank, which generation never produces.

## Decision

The orchestrator's, 2026-10-16: a dwarf may drink from a water tile while standing on a walkable tile one level above it and horizontally adjacent (the bank over a brook cut), as well as from a walkable tile beside it on its own level. The stand tiles are ranked by their own position, as before. Generation does not change.

## What to do

1. Edit `10-dwarves.md` § Needs (drink search) with the rule above, and the same sentence wherever 17 (`water_patient`) or 09 describe where water is taken from, if they do.
2. Change `water()` in `src/systems/dwarves/activities.ts`, and any other water search that uses the same rule (grep `fluidTypeAt` and `FluidType.Water` in `src/systems`).
3. Tests: a unit test with the generated brook's shape (water on z, banks on z + 1) that fails first, and the brook of seed `three-years`: a thirsty dwarf with no drink and no well drinks from it (`DrankWater`). Keep the two existing unit tests.
4. Run the annual instrument before and after (the wildlife cohort): water now serves thirsty dwarves, so the timeline moves; record both rows.

## Done

- A dwarf drinks from a generated brook's bank; the spec says so; the instrument rows are in the commit body.
