# Plants

**Owner:** content (`plants`) · **Depends on:** [`../02-systems/07-plants-and-farming.md`](../02-systems/07-plants-and-farming.md), [materials.md](materials.md), [regions-biomes-and-traits.md](regions-biomes-and-traits.md)

Columns: `stageDays` are days per stage at 100% growth (crops have four stages; the total is the cycle); `seasons` where surface species grow (cave species: all); `light` `sun` / `dark` / `any` / `glow` (dark, under a glowstone lamp); `minC`/`maxC` growth range; `yield` items per harvest `[min, max]` of `yieldItem` with the species as material unless stated; `seed` is always 1 per harvest; `value` is the plant material value per unit; `edible` raw; `cookable`; `brew` gives the drink material and the units per 4 plants at the still (always 20); `biomes` with spawn weights for wild shrubs and trees.

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
| `sweetroot` | sweetroot | 5 (20) | dark | 2 | 40 | 3–5 | `plant_food` | 2 | yes | yes | `rootwine` | — | `"` | `root_amber` |
| `sporecloth` | sporecloth | 6 (24) | dark | 2 | 40 | 2–4 | `fiber` (`sporecloth_fiber`) | 3 | no | no | — | — | `"` | `spore_violet` |
| `glowcap` | glowcap | 6 (24) | glow | 2 | 40 | 2–3 | `glowcap` | 6 | no | no | — | — | `♠` | `rune_cyan` |

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

Tropical forest and savanna use `oak` (as "broadleaf") with weight 40 and `ash` 20; desert and badlands use only `pine`, weight 1, with `treeDensity` from the biome table in `regions-biomes-and-traits.md`; glacier none.

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

Every still recipe: 4 plant units + 1 empty barrel → 20 units of drink in the barrel; skill `brewing`; 200 ticks base.

## Growth arithmetic

A dimcap plot tile at 100% growth completes a cycle in 16 days and yields on average 4 plants plus 1 seed. Twenty dwarves consume about 25 raw plant units per day for food and drink combined (see [balance.md](balance.md)); a 10×10 cave plot of dimcaps yields 100 tiles × 4 / 16 = 25 per day at skill 0. Surface plots produce nothing in winter. A cave plot grows in every season where its tiles are at or above the crop's `minC` (2 °C for dimcap and cavewheat): three levels or more below the surface that is all year in every region, but in a cold region a plot one or two levels down freezes in winter and produces nothing until spring (05 § Temperature model).

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. Each names the task that adds it: that task moves the row into its table above (in that table's columns, without `task`), adds its line to [row-order.md](row-order.md) and runs `npm run content:export`. The rules are in [07](../02-systems/07-plants-and-farming.md) § Planned and [03](../02-systems/03-terrain-and-mining.md) § Planned (the conversions). Every number is *unmeasured*.

### Planned surface crops

| id | name | stageDays | seasons | light | minC | maxC | yield | yieldItem | value | edible | cookable | brew | secondary | straw | glyph | fg | task |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `rye` | rye | 6 (24) | spring, summer, autumn | sun | −2 | 26 | 2–4 | `plant_food` | 1 | no | yes | `black_ale` | `flour` at the farmer's workshop (1 → 1) | 1 | `"` | `rye_gold` | T-548 |
| `nettle` | nettle | 5 (20) | spring, summer | sun | 4 | 28 | 2–3 | `fiber` (`nettle_fiber`) | 1 | no | no | — | — | — | `"` | `nettle_green` | T-548 |
| `wyrmtongue` | wyrmtongue | 6 (24) | spring, summer, autumn | any (ash only) | 4 | 45 | 2–3 | `plant_food` | 8 | no | yes | `emberwine` | — | — | `"` | `wyrmtongue_red` | T-548 |

`barley` and `cavewheat` gain `straw` 1 (T-548). `wyrmtongue` is sown only on ash (07 § Planned) and its material carries `seasoning`: a meal with it gives `ate_wyrmtongue` and keeps out `bitter_cold` for a day.

### Planned wild shrubs

| id | name | product | count | regrowDays | wildSeedPermille | seed of | graze | glyph | fg | task |
|---|---|---|---|---|---|---|---|---|---|---|
| `reed_bed` | reed bed | `reed` (`reed`, value 1) | 2–4 | 14 | 0 | — | no | `"` | `reed_green` | T-548 |
| `barrel_cactus` | barrel cactus | `plant_food` (`cactus_pulp`, value 1, edible, cookable, drinkable, brew `cactus_wine`); and 1 `fiber` (`cactus_fiber`) | 1–2 | 28 | 0 | — | yes | `"` | `cactus_green` | T-548 |
| `wild_nettle` | wild nettle | `fiber` (`nettle_fiber`); stings the gatherer | 1–2 | 28 | 300 | `nettle` | no | `"` | `nettle_green` | T-548 |
| `wild_rye` | wild rye | `plant_food` (`rye`) | 1–2 | 28 | 300 | `rye` | no | `"` | `rye_gold` | T-548 |
| `rock_lichen` | rock lichen | `plant_food` (`lichen`, value 1, edible) | 1 | 56 | 0 | — | yes | `"` | `lichen_orange` | T-548 |
| `salt_crust` | salt crust | `salt` | 2 | 28 | 0 | — | yes | `∙` | `salt_white` | T-548 |
| `wild_wyrmtongue` | wild wyrmtongue | `plant_food` (`wyrmtongue`) | 1–2 | 28 | 300 | `wyrmtongue` | no | `"` | `wyrmtongue_red` | T-548 |

`wild_nettle` carries the tag `stings`. A salt crust is a shrub that is not a plant: it reuses gathering and regrowth whole, burns not, and is grazed by camels (and any tame grazer).

### Planned tree

| id | name | logs | saplingYears | biomes (weight) | glyph | fg | task |
|---|---|---|---|---|---|---|---|
| `ironwood` | ironwood | 1–2 | 5 | — (converted, below) | `♣` | `ironwood_dark` | T-548 |

### Conversions (a new table)

What 03's conversion passes turn into the new plants (03 § Planned, Stage 9 conversions), each pass on its own stream, `terrain.convert.<id>`. *Eligible* is what a tile must be now; *biomes* limits it to those regions (any: every region).

| id | eligible | biomes | permille | task |
|---|---|---|---|---|
| `reed_bed` | a soil floor (grass or shrub) within 2 tiles of surface water, or a soil floor in shallow water (level ≤ 2) | any; wetland ×3 | 150 | T-548 |
| `barrel_cactus` | a dry soil floor of `sand`, or an existing shrub | `desert`, `badlands` | 15 | T-548 |
| `wild_nettle` | an existing shrub | `temperate_forest`, `temperate_hills`, `dark_forest`, `wetland` | 120 | T-548 |
| `wild_rye` | an existing shrub, or a grass floor | `taiga`, `tundra`, `cold_steppe`, `alpine` | 150 shrub, 5 grass | T-548 |
| `rock_lichen` | a bare rock surface floor (outcrop, crag, scree or a soilless surface) | `tundra`, `alpine`, `mountain`, `glacier`, `taiga`, `cold_steppe` | 80 | T-548 |
| `salt_crust` | a dry soil or bare rock surface floor | `desert`, `badlands` | 2 | T-548 |
| `wild_wyrmtongue` | a floor of `ash_soil` | any (the Glasslands' ash) | 30 | T-548 |
| `ironwood` | an existing tree | `dark_forest` 60, `temperate_forest` 30 | as given | T-548 |

### Planned brewing

| Plant | Drink | Value per unit | task |
|---|---|---|---|
| `rye` | `black_ale` | 3 | T-548 |
| `barrel_cactus` (`cactus_pulp`) | `cactus_wine` | 3 | T-548 |
| `wyrmtongue` | `emberwine` | 6 | T-548 |
| `honey` (at the still, 4 honey → 20) | `mead` | 5 | T-555 |
