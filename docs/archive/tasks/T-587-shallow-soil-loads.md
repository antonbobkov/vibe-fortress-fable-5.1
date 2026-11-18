# T-587 — A site one soil level deep yields no sand, clay or peat

**Closed:** 2026-11-18, in 0cdf16bb.

**Source:** [T-583's audit of Making Do's reach](../../../reports/audits/2026-11-17-t583-making-do-reach.md) § Issues, 1 · **Size:** M · **Needs:** — · **Status:** open

## Why

Making Do's soils (sand for glass, clay for bricks, pots, jugs, mugs and hives, peat for peat bricks) come only from digging a soil **wall** (03 § Tile transitions: `dig` of a soil tagged `soil_drop` drops a `soil_load` with `SOIL_DROP_PERMILLE`). The generator makes the top tile of each column the surface **floor** of the biome's soil and the `soilDepth − 1` tiles under it soil walls. A biome with `soilDepth` 1 therefore has its soil only as surface floors, and no designation turns a floor into a `soil_load`: `channel` drops what the tile below would drop (the rock), and nothing digs a floor.

T-583's site probe (`test/perf/t583_making_do_sites.test.ts`, three 48 × 48 maps a biome and geology) found no soil wall at all in the `desert` (sand), `badlands` (clay, sand), `mountain` (sand, silt) and `tundra` (peat, silt) maps: thousands of soil floors, no soil wall. So the desert, whose signature the design gives as "sand (glass)", can make no glass but from the Mountainhome's sand sundries; the badlands make no brick, pot or clay hive from their own clay; the tundra has no peat to dry. Alpine and glasslands have no soil at all, as their rows say.

03 § Local map generation, step 3 also says "the top `soilDepth` tiles of each column … are `wall` of a soil material": the code makes the top one a floor, so the spec and the code differ by one level.

## What to do

Decide one of these, write it into 03 (§ Local map generation step 3, or § Tile transitions) and test it:

1. **Channel a soil floor for its soil.** A `channel` on a floor of a soil tagged `soil_drop` rolls the soil's own drop (`SOIL_DROP_PERMILLE`, on `03.soil_drop`) beside the drop from below. The plainest: a desert fortress channels its sand floors as it digs in, and a stockpile of sand follows. Only a channel of such a floor draws on the soil stream, so other draws are unchanged; but the three-year fixture's temperate forest has clay floors, and if its script channels any, its items move: measure the sweep.
2. **Keep a soil wall under every surface floor.** The generator lays `soilDepth` soil walls under the surface floor, so every soil biome has at least one diggable soil level. This changes every map's rock below the surface, so world hashes, the instrument and the sweep all move.

Option 1 is preferred: it keeps every generated map as it is. Either way, fix the one-level difference in 03 step 3's wording.

## Done

The rule in 03, a test that a desert site yields sand by the chosen route, the sites probe showing a soil source in every biome whose signature names one, and the gates the change needs (the sweep if the fixture channels a `soil_drop` floor).
