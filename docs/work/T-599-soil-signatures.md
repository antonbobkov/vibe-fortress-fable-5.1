# T-599 — Two site signatures disagree with their biome's soil

**Source:** [T-587-shallow-soil-loads](T-587-shallow-soil-loads.md) (its sites probe, `test/perf/t583_making_do_sites.test.ts`, counting the soil floors and walls of each biome) · **Size:** S · **Needs:** — · **Status:** open

## Why

`regions-biomes-and-traits.md` § Signatures says what the site summary tells the player a site has and lacks. Against the soil of § Biomes, as the generator lays it, two rows are wrong:

- **`alpine` has sand.** Its row is the mountain's (*has* `stone, sand, lichen, horn, ice`; *lacks* `wood, soil, clay, honey`), but its soil depth is 0: an alpine map has no soil tile at all, and nothing on it yields a `soil_load`. Three alpine maps of the probe: no sand floor, no sand wall. A mountain map has sand (sand 50, silt 50, one level: about 900 sand floors a 48 × 48 map), so the mountain row is right.
- **`temperate_hills` lacks sand.** Its soil is loam 50, clay 30, sand 20, two levels: three maps of the probe had 1019 sand floors and 1359 sand walls. The summary tells the player to expect no sand and prices it as lacking (20 § The scarcity price).

## What to do

Make each row say what its map holds: take `sand` off the alpine *has* line (alpine is bare rock by design), and take `sand` off the temperate hills *lacks* line, or take sand out of the hills' soil if the design wants a sandless hill (the Making Do design gives temperate forest and hills one row, lacking sand). The second changes what a hills caravan's sand costs; no fixture embarks on hills or alpine, so the sweep should not move, but check the instrument's biomes.

## Done

The two rows agree with the soil table, a test that pins each signature's soil goods against its biome's soil materials (a soil material on a *has* line is in the biome's soil; one on a *lacks* line is not), and the checks.
