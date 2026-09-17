# Plants

**Detail level:** W3 · **Owner:** content (`plants`) · **Depends on:** [`../02-systems/07-plants-and-farming.md`](../02-systems/07-plants-and-farming.md), [materials.md](materials.md), [regions-biomes-and-traits.md](regions-biomes-and-traits.md)

Columns: `stageDays` are days per stage at 100% growth (crops have four stages; the total is the cycle); `seasons` where surface species grow (cave species: all); `light` `sun` / `dark` / `any`; `minC`/`maxC` growth range; `yield` items per harvest `[min, max]` of `yieldItem` with the species as material unless stated; `seed` is always 1 per harvest; `value` is the plant material value per unit; `edible` raw; `cookable`; `brew` gives the drink material and the units per 4 plants at the still (always 20); `biomes` with spawn weights for wild shrubs and trees.

## Surface crops

| id | name | stageDays | seasons | light | minC | maxC | yield | yieldItem | value | edible | cookable | brew | secondary | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `barley` | barley | 7 (28) | spring, summer | sun | 4 | 30 | 3–5 | `plant_food` | 1 | no | yes | `ale` | `flour` at the farmer's workshop (1 → 1) | `"` | `barley_gold` |
| `turnip` | turnip | 5 (20) | spring, summer, autumn | sun | 2 | 28 | 3–5 | `plant_food` | 1 | yes | yes | — | — | `"` | `turnip_violet` |
| `cabbage` | cabbage | 6 (24) | spring, autumn | sun | 0 | 24 | 3–5 | `plant_food` | 1 | yes | yes | — | — | `"` | `cabbage_green` |
| `strawberry` | strawberry | 7 (28) | spring, summer | sun | 6 | 30 | 3–5 | `plant_food` | 2 | yes | yes | `strawberry_wine` | — | `"` | `berry_red` |
| `flax` | flax | 6 (24) | spring, summer | sun | 4 | 28 | 2–4 | `fiber` (`flax_fiber`) | 2 | no | no | — | 1 `plant_food` (flax seed cake, edible) | `"` | `flax_straw` |
| `pumpkin` | pumpkin | 8 (32) | summer, autumn | sun | 8 | 32 | 2–4 | `plant_food` | 2 | yes | yes | — | — | `"` | `pumpkin_orange` |
| `hops` | hops | 7 (28) | summer | sun | 6 | 30 | 3–5 | `plant_food` | 2 | no | no | improves ale: brewing barley with 1 hops per batch yields `hopped_ale` | — | `"` | `hops_green` |

## Cave crops

| id | name | stageDays | light | minC | maxC | yield | yieldItem | value | edible | cookable | brew | secondary | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `dimcap` | dimcap | 4 (16) | dark | 2 | 40 | 3–5 | `plant_food` | 1 | yes | yes | `dimcap_ale` | — | `♠` | `dimcap_violet` |
| `cavewheat` | cavewheat | 5 (20) | dark | 2 | 40 | 3–5 | `plant_food` | 1 | no | yes | `cavewheat_beer` | `flour` (1 → 1) | `"` | `cavewheat_pale` |
| `pale_bell` | pale bell | 6 (24) | dark | 2 | 40 | 2–4 | `plant_food` | 3 | yes | yes | `bellwine` | — | `♣` | `bell_white` |
| `sweetroot` | sweetroot | 5 (18) | dark | 2 | 40 | 3–5 | `plant_food` | 2 | yes | yes | `rootwine` | — | `"` | `root_amber` |
| `sporecloth` | sporecloth | 6 (24) | dark | 2 | 40 | 2–4 | `fiber` (`sporecloth_fiber`) | 3 | no | no | — | — | `"` | `spore_violet` |

## Wild shrubs (gatherable; regrow)

| id | name | product | count | regrowDays | wildSeedPermille | seed of | biomes (weight) | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|
| `bramble` | bramble | `plant_food` (`bramble_berry`, value 2, edible, cookable, brew `strawberry_wine`) | 2–4 | 28 | 0 | — | temperate_forest 30, temperate_hills 20, wetland 15, taiga 10, temperate_grassland 10 | `"` | `berry_red` |
| `brightleaf` | brightleaf | `brightleaf` | 1–2 | 42 | 0 | — | temperate_forest 15, wetland 20, tropical_forest 25, dark_forest 20, temperate_hills 8 | `♣` | `bright_green` |
| `nutbush` | nutbush | `plant_food` (`nut`, value 2, edible, cookable) | 2–4 | 56 | 0 | — | temperate_forest 20, temperate_hills 15, savanna 10, tropical_forest 15 | `"` | `nut_brown` |
| `wild_barley` | wild barley | `plant_food` (`barley`) | 1–2 | 28 | 400 | `barley` | temperate_grassland 30, cold_steppe 20, savanna 15, temperate_hills 10 | `"` | `barley_gold` |
| `wild_strawberry` | wild strawberry | `plant_food` (`strawberry`) | 1–3 | 28 | 400 | `strawberry` | temperate_forest 20, temperate_grassland 15, temperate_hills 15 | `"` | `berry_red` |
| `wild_flax` | wild flax | `fiber` (`flax_fiber`) | 1–2 | 28 | 400 | `flax` | temperate_grassland 15, wetland 20, temperate_hills 10 | `"` | `flax_straw` |
| `sunfruit` | sunfruit | `plant_food` (`sunfruit`, value 3, edible, cookable, brew `strawberry_wine`) | 2–4 | 35 | 0 | — | savanna 25, tropical_forest 30, desert 5 | `"` | `sun_yellow` |
| `frostberry` | frostberry | `plant_food` (`frostberry`, value 2, edible, cookable, brew `rootwine`) | 2–3 | 42 | 0 | — | tundra 20, taiga 25, cold_steppe 15, alpine 10 | `"` | `frost_blue` |
| `dimcap_patch` | dimcap patch | `plant_food` (`dimcap`) | 1–3 | 20 | 500 | `dimcap` | cavern 1 (40), cavern 2 (30) | `♠` | `dimcap_violet` |
| `cavewheat_patch` | cavewheat patch | `plant_food` (`cavewheat`) | 1–2 | 24 | 500 | `cavewheat` | cavern 1 (20), cavern 2 (30) | `"` | `cavewheat_pale` |
| `pale_bell_patch` | pale bell patch | `plant_food` (`pale_bell`) | 1–2 | 28 | 400 | `pale_bell` | cavern 2 (25), cavern 3 (30) | `♣` | `bell_white` |
| `sweetroot_patch` | sweetroot patch | `plant_food` (`sweetroot`) | 1–3 | 24 | 500 | `sweetroot` | cavern 1 (25), cavern 2 (25), cavern 3 (15) | `"` | `root_amber` |
| `sporecloth_patch` | sporecloth patch | `fiber` (`sporecloth_fiber`) | 1–2 | 30 | 400 | `sporecloth` | cavern 2 (20), cavern 3 (30) | `"` | `spore_violet` |

Wild shrub density per biome is in [regions-biomes-and-traits.md](regions-biomes-and-traits.md) (`shrubDensity`); the weights above choose the species.

## Trees

Columns: `logs` per chop `[min, max]`; `saplingYears`; `biomes (weight)`.

| id | name | logs | saplingYears | biomes (weight) | glyph | fg |
|---|---|---|---|---|---|---|
| `oak` | oak | 2–4 | 3 | temperate_forest 35, temperate_hills 25, temperate_grassland 10, wetland 10, dark_forest 20 | `♣` | `oak_brown` |
| `pine` | pine | 2–3 | 2 | taiga 45, alpine 30, mountain 30, temperate_hills 20, cold_steppe 10, dark_forest 25 | `♠` | `pine_green` |
| `birch` | birch | 1–3 | 2 | taiga 30, temperate_forest 20, tundra 15, cold_steppe 15 | `↑` | `birch_pale` |
| `willow` | willow | 2–3 | 2 | wetland 40, riverbank (any biome, within 2 of a river) 30 | `♣` | `willow_green` |
| `yew` | yew | 1–2 | 4 | temperate_forest 8, temperate_hills 8, dark_forest 12 | `♠` | `yew_red` |
| `ash` | ash | 2–3 | 3 | temperate_forest 20, temperate_grassland 10, wetland 10 | `↑` | `ash_pale` |
| `maple` | maple | 2–3 | 3 | temperate_forest 15, temperate_hills 15 | `♣` | `maple_amber` |
| `tower_shroom` | tower shroom | 1–3 | 2 | cavern 1 (60), cavern 2 (40), cavern 3 (20) | `♠` | `shroom_gray` |
| `stalk_fern` | stalk fern | 1–2 | 1 | cavern 1 (30), cavern 2 (50), cavern 3 (40) | `↑` | `fern_teal` |

Tropical forest and savanna use `oak` (as "broadleaf") with weight 40 and `ash` 20; desert and badlands have `treeDensity` 0.02 with `pine` only; glacier none.

## Grass

One `grass` flag species per surface; drawn `grass_green` outdoors and `moss_teal` in caverns. `cold_steppe`, `tundra` and `savanna` draw grass in `grass_dry` colors.

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

Every still recipe: 4 plant units + 1 empty barrel → 20 units of drink in the barrel; skill `brewing`; 200 ticks base.

## Growth arithmetic

A dimcap plot tile at 100% growth completes a cycle in 16 days and yields on average 4 plants plus 1 seed. Twenty dwarves consume about 25 raw plant units per day for food and drink combined (see [balance.md](balance.md)); a 10×10 cave plot of dimcaps yields 100 tiles × 4 / 16 = 25 per day at skill 0. Surface plots produce nothing in winter; cave plots produce all year.
