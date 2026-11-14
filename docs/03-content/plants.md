# Plants

**Owner:** content (`plants`) · **Depends on:** [`../02-systems/07-plants-and-farming.md`](../02-systems/07-plants-and-farming.md), [materials.md](materials.md), [regions-biomes-and-traits.md](regions-biomes-and-traits.md)

Columns: `stageDays` are days per stage at 100% growth (crops have four stages; the total is the cycle); `seasons` where surface species grow (cave species: all); `light` `sun` / `dark` / `any` / `glow` (dark, under a glowstone lamp); `minC`/`maxC` growth range; `yield` items per harvest `[min, max]` of `yieldItem` with the species as material unless stated; `seed` is always 1 per harvest; `value` is the plant material value per unit; `edible` raw; `cookable`; `brew` gives the drink material and the units per 4 plants at the still (always 20); `biomes` with spawn weights for wild shrubs and trees.

## Surface crops

| id | name | stageDays | seasons | light | minC | maxC | yield | yieldItem | value | edible | cookable | brew | secondary | straw | tags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `barley` | barley | 7 (28) | spring, summer | sun | 4 | 30 | 3–5 | `plant_food` | 1 | no | yes | `ale` | `flour` at the farmer's workshop (1 → 1) | 1 | — | `"` | `barley_gold` |
| `turnip` | turnip | 5 (20) | spring, summer, autumn | sun | 2 | 28 | 3–5 | `plant_food` | 1 | yes | yes | — | — | — | — | `"` | `turnip_violet` |
| `cabbage` | cabbage | 6 (24) | spring, autumn | sun | 0 | 24 | 3–5 | `plant_food` | 1 | yes | yes | — | — | — | — | `"` | `cabbage_green` |
| `strawberry` | strawberry | 7 (28) | spring, summer | sun | 6 | 30 | 3–5 | `plant_food` | 2 | yes | yes | `strawberry_wine` | — | — | — | `"` | `berry_red` |
| `flax` | flax | 6 (24) | spring, summer | sun | 4 | 28 | 2–4 | `fiber` (`flax_fiber`) | 2 | no | no | — | 1 `plant_food` (flax seed cake, edible) | — | — | `"` | `flax_straw` |
| `pumpkin` | pumpkin | 8 (32) | summer, autumn | sun | 8 | 32 | 2–4 | `plant_food` | 2 | yes | yes | — | — | — | — | `"` | `pumpkin_orange` |
| `hops` | hops | 7 (28) | summer | sun | 6 | 30 | 3–5 | `plant_food` | 2 | no | no | improves ale: brewing barley with 1 hops per batch yields `hopped_ale` | — | — | — | `"` | `hops_green` |
| `rye` | rye | 6 (24) | spring, summer, autumn | sun | −2 | 26 | 2–4 | `plant_food` | 1 | no | yes | `black_ale` | `flour` at the farmer's workshop (1 → 1) | 1 | — | `"` | `rye_gold` |
| `nettle` | nettle | 5 (20) | spring, summer | sun | 4 | 28 | 2–3 | `fiber` (`nettle_fiber`) | 1 | no | no | — | — | — | — | `"` | `nettle_green` |
| `wyrmtongue` | wyrmtongue | 6 (24) | spring, summer, autumn | any | 4 | 45 | 2–3 | `plant_food` | 8 | no | yes | `emberwine` | — | — | `ash`, `seasoning` | `"` | `wyrmtongue_red` |

`straw`: the `straw` items of the crop's own material each harvest drops beside the seed, whatever recipes exist (07 § Farm plots). `tags`: `ash`, the crop is sown only on an ash tile (07 § Ash); `seasoning`, its material carries the tag `seasoning`, so a meal with it is seasoned (12 § Operation). Rye is the cold region's grain: it grows from −2 °C, where barley's 4 °C fails. A meal with wyrmtongue gives `ate_wyrmtongue` and keeps out `bitter_cold` for a day (15).

## Cave crops

| id | name | stageDays | light | minC | maxC | yield | yieldItem | value | edible | cookable | brew | secondary | straw | tags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `dimcap` | dimcap | 4 (16) | dark | 2 | 40 | 3–5 | `plant_food` | 1 | yes | yes | `dimcap_ale` | — | — | — | `♠` | `dimcap_violet` |
| `cavewheat` | cavewheat | 5 (20) | dark | 2 | 40 | 3–5 | `plant_food` | 1 | no | yes | `cavewheat_beer` | `flour` (1 → 1) | 1 | — | `"` | `cavewheat_pale` |
| `pale_bell` | pale bell | 6 (24) | dark | 2 | 40 | 2–4 | `plant_food` | 3 | yes | yes | `bellwine` | — | — | — | `♣` | `bell_white` |
| `sweetroot` | sweetroot | 5 (20) | dark | 2 | 40 | 3–5 | `plant_food` | 2 | yes | yes | `rootwine` | — | — | — | `"` | `root_amber` |
| `sporecloth` | sporecloth | 6 (24) | dark | 2 | 40 | 2–4 | `fiber` (`sporecloth_fiber`) | 3 | no | no | — | — | — | — | `"` | `spore_violet` |
| `glowcap` | glowcap | 6 (24) | glow | 2 | 40 | 2–3 | `glowcap` | 6 | no | no | — | — | — | — | `♠` | `rune_cyan` |

## Wild shrubs (gatherable; regrow)

| id | name | product | count | regrowDays | wildSeedPermille | seed of | biomes (weight) | graze | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|
| `bramble` | bramble | `plant_food` (`bramble_berry`, value 2, edible, cookable, brew `strawberry_wine`) | 2–4 | 28 | 0 | — | temperate_forest 30, temperate_hills 20, wetland 15, taiga 10, temperate_grassland 10 | no | `"` | `berry_red` |
| `brightleaf` | brightleaf | `brightleaf` | 1–2 | 42 | 0 | — | temperate_forest 15, wetland 20, tropical_forest 25, dark_forest 20, temperate_hills 8 | no | `♣` | `bright_green` |
| `nutbush` | nutbush | `plant_food` (`nut`, value 2, edible, cookable) | 2–4 | 56 | 0 | — | temperate_forest 20, temperate_hills 15, savanna 10, tropical_forest 15 | no | `"` | `nut_brown` |
| `wild_barley` | wild barley | `plant_food` (`barley`) | 1–2 | 28 | 400 | `barley` | temperate_grassland 30, cold_steppe 20, savanna 15, temperate_hills 10 | no | `"` | `barley_gold` |
| `wild_strawberry` | wild strawberry | `plant_food` (`strawberry`) | 1–3 | 28 | 400 | `strawberry` | temperate_forest 20, temperate_grassland 15, temperate_hills 15 | no | `"` | `berry_red` |
| `wild_flax` | wild flax | `fiber` (`flax_fiber`) | 1–2 | 28 | 400 | `flax` | temperate_grassland 15, wetland 20, temperate_hills 10 | no | `"` | `flax_straw` |
| `sunfruit` | sunfruit | `plant_food` (`sunfruit`, value 3, edible, cookable, brew `strawberry_wine`) | 2–4 | 35 | 0 | — | savanna 25, tropical_forest 30, desert 5 | no | `"` | `sun_yellow` |
| `frostberry` | frostberry | `plant_food` (`frostberry`, value 2, edible, cookable, brew `rootwine`) | 2–3 | 42 | 0 | — | tundra 20, taiga 25, cold_steppe 15, alpine 10 | no | `"` | `frost_blue` |
| `dimcap_patch` | dimcap patch | `plant_food` (`dimcap`) | 1–3 | 20 | 500 | `dimcap` | cavern 1 (40), cavern 2 (30) | no | `♠` | `dimcap_violet` |
| `cavewheat_patch` | cavewheat patch | `plant_food` (`cavewheat`) | 1–2 | 24 | 500 | `cavewheat` | cavern 1 (20), cavern 2 (30) | no | `"` | `cavewheat_pale` |
| `pale_bell_patch` | pale bell patch | `plant_food` (`pale_bell`) | 1–2 | 28 | 400 | `pale_bell` | cavern 2 (25), cavern 3 (30) | no | `♣` | `bell_white` |
| `sweetroot_patch` | sweetroot patch | `plant_food` (`sweetroot`) | 1–3 | 24 | 500 | `sweetroot` | cavern 1 (25), cavern 2 (25), cavern 3 (15) | no | `"` | `root_amber` |
| `sporecloth_patch` | sporecloth patch | `fiber` (`sporecloth_fiber`) | 1–2 | 30 | 400 | `sporecloth` | cavern 2 (20), cavern 3 (30) | no | `"` | `spore_violet` |
| `reed_bed` | reed bed | `reed` (`reed`, value 1) | 2–4 | 14 | 0 | — | — (converted) | no | `"` | `reed_green` |
| `barrel_cactus` | barrel cactus | `plant_food` (`cactus_pulp`, value 1, edible, cookable, drinkable, brew `cactus_wine`); and 1 `fiber` (`cactus_fiber`) | 1–2 | 28 | 0 | — | — (converted) | yes | `"` | `cactus_green` |
| `wild_nettle` | wild nettle | `fiber` (`nettle_fiber`); stings the gatherer | 1–2 | 28 | 300 | `nettle` | — (converted) | no | `"` | `nettle_green` |
| `wild_rye` | wild rye | `plant_food` (`rye`) | 1–2 | 28 | 300 | `rye` | — (converted) | no | `"` | `rye_gold` |
| `rock_lichen` | rock lichen | `plant_food` (`lichen`, value 1, edible) | 1 | 56 | 0 | — | — (converted) | yes | `"` | `lichen_orange` |
| `wild_wyrmtongue` | wild wyrmtongue | `plant_food` (`wyrmtongue`) | 1–2 | 28 | 300 | `wyrmtongue` | — (converted) | no | `"` | `wyrmtongue_red` |

Wild shrub density per biome is in [regions-biomes-and-traits.md](regions-biomes-and-traits.md) (`shrubDensity`); the weights above choose the species. A shrub with no weights, `— (converted)`, is never placed by them: generation places it by converting tiles (§ Conversions), and it never regrows anywhere else.

`graze`: a tame grazer may eat the shrub when it is mature (08 § Pastures and feeding). A product written "and 1 `fiber` (`cactus_fiber`)" is a second product, given with the first at each gathering. `drinkable` puts the tag on the product's material: a thirsty dwarf with nothing else drinks it (10). "stings the gatherer" is the tag `stings` (09 § Gathering).

## Rare cave patches

Columns as the wild shrubs, with `rarePermille` for cavern tiers 1, 2 and 3 in place of the weights. These species take no share of the cave shrub weights. After the cave shrubs are placed, each one takes over that permille of the shrubs of each tier (`rarePermille` *unmeasured*).

| id | name | product | count | regrowDays | wildSeedPermille | seed of | rarePermille | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|
| `glowcap_patch` | glowcap patch | `glowcap` (`glowcap`) | 1–2 | 30 | 400 | `glowcap` | 100, 130, 250 | `♠` | `rune_cyan` |

## Trees

Columns: `logs` per chop `[min, max]`; `saplingYears`; `biomes (weight)`.

| id | name | logs | saplingYears | biomes (weight) | glyph | fg |
|---|---|---|---|---|---|---|
| `oak` | oak | 2–4 | 3 | temperate_forest 35, temperate_hills 25, temperate_grassland 10, wetland 10, dark_forest 20 | `♣` | `oak_leaf` |
| `pine` | pine | 2–3 | 2 | taiga 45, alpine 30, mountain 30, temperate_hills 20, cold_steppe 10, dark_forest 25 | `♠` | `pine_green` |
| `birch` | birch | 1–3 | 2 | taiga 30, temperate_forest 20, tundra 15, cold_steppe 15 | `↑` | `birch_pale` |
| `willow` | willow | 2–3 | 2 | wetland 40, riverbank (any biome, within 2 of a river) 30 | `♣` | `willow_green` |
| `yew` | yew | 1–2 | 4 | temperate_forest 8, temperate_hills 8, dark_forest 12 | `♠` | `yew_red` |
| `ash` | ash | 2–3 | 3 | temperate_forest 20, temperate_grassland 10, wetland 10 | `↑` | `ash_leaf` |
| `maple` | maple | 2–3 | 3 | temperate_forest 15, temperate_hills 15 | `♣` | `maple_amber` |
| `tower_shroom` | tower shroom | 1–3 | 2 | cavern 1 (60), cavern 2 (40), cavern 3 (20) | `♠` | `shroom_gray` |
| `stalk_fern` | stalk fern | 1–2 | 1 | cavern 1 (30), cavern 2 (50), cavern 3 (40) | `↑` | `fern_teal` |
| `ironwood` | ironwood | 1–2 | 5 | — (converted) | `♣` | `ironwood_dark` |

Tropical forest and savanna use `oak` (as "broadleaf") with weight 40 and `ash` 20; desert and badlands use only `pine`, weight 1, with `treeDensity` from the biome table in `regions-biomes-and-traits.md`; glacier none.

`ironwood` has no weights: generation converts existing trees into it (§ Conversions), and no ironwood sapling ever grows by itself, so an ironwood felled is gone. Its wood is the hardest (`materials.md` § Wood): it chops at twice the time and is hard to set alight.

## Conversions

What 03's conversion passes turn into the plants that no biome weight places (03 § Local map generation, the conversions that end stage 10), each pass on its own stream, `terrain.convert.<id>`. Only a column's surface tile is ever eligible, and a tile one pass converted is not eligible for another. *eligible* names what the tile must be now:

- `shrub`: an existing shrub.
- `tree`: an existing tree.
- `grass`: a dry floor of soil with `grass`.
- `sand`: a dry floor of `sand`.
- `dry_soil`: a dry floor of soil.
- `rock`: a dry bare rock floor (an outcrop, a crag, scree or a soilless surface: a floor whose material is of class `stone`).
- `near_water`: a floor of soil with `grass`, or a shrub, within 2 tiles (on its level) of surface water.
- `shallow`: a floor of soil in shallow water (level 1 or 2).
- `ash_soil`: a floor of `ash_soil`.

*Dry* is a floor with no water on it, outside a river's or a lake's columns. *biomes* limits the pass to those regions (`any`: every region; "×3" multiplies the permille there). *permille* is the chance each eligible tile turns, by tile kind where it differs, or by biome where the biomes give it.

| id | eligible | biomes | permille |
|---|---|---|---|
| `reed_bed` | `near_water`, `shallow` | any; `wetland` ×3 | 150 |
| `barrel_cactus` | `sand`, `shrub` | `desert`, `badlands` | 15 |
| `wild_nettle` | `shrub` | `temperate_forest`, `temperate_hills`, `dark_forest`, `wetland` | 120 |
| `wild_rye` | `shrub`, `grass` | `taiga`, `tundra`, `cold_steppe`, `alpine` | 150 `shrub`, 5 `grass` |
| `rock_lichen` | `rock` | `tundra`, `alpine`, `mountain`, `glacier`, `taiga`, `cold_steppe` | 80 |
| `wild_wyrmtongue` | `ash_soil` | any | 30 |
| `ironwood` | `tree` | `dark_forest` 60, `temperate_forest` 30 | by biome |

## Grass

One `grass` flag species per surface; drawn `grass_green` outdoors and `moss_teal` in caverns. `cold_steppe`, `tundra`, `savanna`, `desert` and `badlands` draw grass in `grass_dry` colors.

## Brewing summary

| Plant | Drink | Value per unit |
|---|---|---|
| `barley` | `ale` | 2 |
| `barley` + `hops` | `hopped_ale` | 3 |
| `dimcap` | `dimcap_ale` | 2 |
| `cavewheat` | `cavewheat_beer` | 2 |
| `pale_bell` | `bellwine` | 4 |
| `sweetroot`, `frostberry` | `rootwine` | 3 |
| `strawberry`, `bramble_berry`, `sunfruit` | `strawberry_wine` | 4 |
| `rye` | `black_ale` | 3 |
| `barrel_cactus` (`cactus_pulp`) | `cactus_wine` | 3 |
| `wyrmtongue` | `emberwine` | 6 |

Every still recipe: 4 plant units + 1 empty barrel → 20 units of drink in the barrel; skill `brewing`; 200 ticks base.

## Growth arithmetic

A dimcap plot tile at 100% growth completes a cycle in 16 days and yields on average 4 plants plus 1 seed. Twenty dwarves consume about 25 raw plant units per day for food and drink combined (see [balance.md](balance.md)); a 10×10 cave plot of dimcaps yields 100 tiles × 4 / 16 = 25 per day at skill 0. Surface plots produce nothing in winter. A cave plot grows in every season where its tiles are at or above the crop's `minC` (2 °C for dimcap and cavewheat): three levels or more below the surface that is all year in every region, but in a cold region a plot one or two levels down freezes in winter and produces nothing until spring (05 § Temperature model).

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. Each names the task that adds it: that task moves the row into its table above (in that table's columns, without `task`), adds its line to [row-order.md](row-order.md) and runs `npm run content:export`. The rules are in [07](../02-systems/07-plants-and-farming.md) § Planned. Every number is *unmeasured*.

### Planned salt crust (waits for T-547's `salt`)

The salt crust is the one T-548 plant left out: its product is T-547's `salt` item and material and its colour T-547's `salt_white`, and T-547 had not landed. The task that adds it ([T-NEW salt crusts](../work/T-NEW-making-do-salt-crust.md)) moves these rows into § Wild shrubs (columns of that table: `biomes (weight)` `— (converted)`, `graze` yes) and § Conversions.

| id | name | product | count | regrowDays | wildSeedPermille | seed of | graze | glyph | fg | task |
|---|---|---|---|---|---|---|---|---|---|---|
| `salt_crust` | salt crust | `salt` (`salt`) | 2 | 28 | 0 | — | yes | `∙` | `salt_white` | T-NEW salt crusts |

| id | eligible | biomes | permille | task |
|---|---|---|---|---|
| `salt_crust` | `dry_soil`, `rock` | `desert`, `badlands` | 2 | T-NEW salt crusts |

### Planned brewing

| Plant | Drink | Value per unit | task |
|---|---|---|---|
| `honey` (at the still, 4 honey → 20) | `mead` | 5 | T-555 |
