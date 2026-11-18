# T-NEW — The alpine site summary says it has sand, and an alpine map has no soil

**Source:** [T-587-shallow-soil-loads](T-587-shallow-soil-loads.md) (found while deciding which biomes yield soil loads) · **Size:** S · **Needs:** — · **Status:** open

## Why

`regions-biomes-and-traits.md` § Signatures gives `alpine` the same row as `mountain`: it *has* `stone, sand, lichen, horn, ice` and *lacks* `wood, soil, clay, honey`. But the alpine biome's soil depth is 0 (§ Biomes), so an alpine map has no soil tile at all, sand included, and no channel or dig on it yields a `soil_load` (03 § Local map generation, stage 3). The site summary therefore tells the player an alpine site has sand it does not have. A mountain map has sand floors (sand 50, silt 50, one level), so the mountain row is right.

## What to do

Take `sand` off the alpine *has* line, or give alpine a soil (the design report groups mountain and alpine, "stone, sand, … ice"). The first is the plain fix: alpine is bare rock by design. Check what the scarcity price (20 § The scarcity price) does with a good that is lacked through its class; no fixture plays an alpine site, so the sweep should not move, but the instrument's biomes should be checked.

## Done

The alpine row says what an alpine map holds, a test that the site summary of an alpine site does not name sand as had, and the checks.
