# Materials

**Detail level:** W3 · **Owner:** content (`materials`) · **Depends on:** [`../02-systems/05-materials-and-temperature.md`](../02-systems/05-materials-and-temperature.md), [glyphs-and-colors.md](glyphs-and-colors.md)

Every material the game knows. Ores, metals and gems have their own extended rows in [minerals-and-metals.md](minerals-and-metals.md) and are listed here only for completeness of ids and base properties. Plant, meat and hide materials are generated from species rows as described at the end.

Columns: `value` is marks per unit; `density` is relative (water 100; used for carry weight and stone-fall damage); `hardness` scales dig time (100 = one `DIG_BASE_TICKS`) and blunt resistance; `meltsAtC` is the melting or burning point (materials with `meltsAtC ≤ MAGMA_C` = 1200 are destroyed by magma); `burnTicks` applies to burnable materials as the burn duration of a tile made of it; `color` names a palette entry.

## Stone (natural layers)

| id | name | class | value | density | hardness | color | meltsAtC | notes |
|---|---|---|---|---|---|---|---|---|
| `sandstone` | sandstone | stone | 1 | 230 | 80 | `sand_tan` | 1400 | sedimentary |
| `limestone` | limestone | stone | 1 | 250 | 90 | `bone_white` | 1300 | sedimentary; `flux` |
| `shale` | shale | stone | 1 | 240 | 70 | `slate_gray` | 1300 | sedimentary |
| `conglomerate` | conglomerate | stone | 1 | 240 | 85 | `pebble_gray` | 1300 | sedimentary |
| `dolomite` | dolomite | stone | 1 | 260 | 95 | `pale_gray` | 1300 | sedimentary; `flux` |
| `chalk` | chalk | stone | 1 | 200 | 50 | `chalk_white` | 1300 | sedimentary |
| `siltstone` | siltstone | stone | 1 | 230 | 75 | `dust_brown` | 1300 | sedimentary |
| `granite` | granite | stone | 2 | 270 | 150 | `granite_gray` | 1300 | igneous intrusive |
| `diorite` | diorite | stone | 2 | 280 | 150 | `diorite_gray` | 1300 | igneous intrusive |
| `gabbro` | gabbro | stone | 2 | 300 | 160 | `dark_gray` | 1300 | igneous intrusive |
| `basalt` | basalt | stone | 2 | 290 | 140 | `basalt_black` | 1300 | igneous extrusive; Sea of Fire pillars and roof |
| `rhyolite` | rhyolite | stone | 2 | 250 | 120 | `rose_gray` | 1300 | igneous extrusive |
| `andesite` | andesite | stone | 2 | 260 | 130 | `ash_gray` | 1300 | igneous extrusive |
| `obsidian` | obsidian | obsidian | 3 | 240 | 110 | `obsidian_black` | 1500 | magma-safe; sharp: obsidian short swords allowed (tier 0.7 edge) |
| `marble` | marble | stone | 3 | 270 | 130 | `marble_white` | 1400 | metamorphic; `flux` |
| `slate` | slate | stone | 2 | 270 | 100 | `slate_blue` | 1300 | metamorphic |
| `gneiss` | gneiss | stone | 2 | 280 | 150 | `banded_gray` | 1300 | metamorphic |
| `schist` | schist | stone | 2 | 270 | 120 | `glitter_gray` | 1300 | metamorphic |
| `quartzite` | quartzite | stone | 2 | 260 | 170 | `quartz_white` | 1600 | metamorphic |
| `phyllite` | phyllite | stone | 2 | 270 | 110 | `sheen_gray` | 1300 | metamorphic |

## Soil

| id | name | class | value | density | hardness | color | notes |
|---|---|---|---|---|---|---|---|
| `loam` | loam | soil | 0 | 150 | 30 | `loam_brown` | best farming soil |
| `clay` | clay | soil | 0 | 180 | 40 | `clay_red` | |
| `sand` | sand | soil | 0 | 160 | 20 | `sand_yellow` | deserts, riverbanks |
| `silt` | silt | soil | 0 | 150 | 25 | `silt_gray` | wetlands |
| `peat` | peat | soil | 0 | 100 | 20 | `peat_black` | burnable (tile burns 200 ticks, leaves ash) |
| `cave_loam` | cave loam | soil | 0 | 160 | 30 | `cave_umber` | cavern floors; grows cave moss |
| `ash_soil` | ash | soil | 0 | 120 | 20 | `ash_gray` | `glasslands` surface patches |

Soil tiles never drop items when dug.

## Ice

| id | name | class | value | density | hardness | color | meltsAtC |
|---|---|---|---|---|---|---|---|
| `ice` | ice | ice | 0 | 90 | 40 | `ice_blue` | 0 |

## Wood (one per tree species; the material of logs, blocks, furniture and charcoal input)

| id | name | class | value | density | hardness | color | burnTicks | notes |
|---|---|---|---|---|---|---|---|---|
| `oak` | oak | wood | 3 | 75 | 60 | `oak_brown` | 600 | |
| `pine` | pine | wood | 2 | 55 | 40 | `pine_yellow` | 400 | |
| `birch` | birch | wood | 2 | 60 | 45 | `birch_pale` | 400 | |
| `willow` | willow | wood | 2 | 50 | 35 | `willow_green` | 350 | riverbanks |
| `yew` | yew | wood | 5 | 70 | 65 | `yew_red` | 500 | best bow wood: bows of yew get +10% power |
| `ash` | ash | wood | 3 | 68 | 55 | `ash_pale` | 500 | |
| `maple` | maple | wood | 3 | 70 | 58 | `maple_amber` | 500 | |
| `tower_shroom` | tower shroom | wood | 2 | 40 | 30 | `shroom_gray` | 300 | cavern fungus wood |
| `stalk_fern` | stalk fern | wood | 1 | 35 | 25 | `fern_teal` | 250 | cavern fungus wood |

All wood is burnable and melts (burns) at 300 °C for the melting rule.

## Animal products

| id | name | class | value | density | color | notes |
|---|---|---|---|---|---|---|
| `bone` | bone | bone | 1 | 120 | `bone_white` | crafts, bolts |
| `shell` | shell | shell | 3 | 130 | `shell_pink` | crafts |
| `skull_bone` | skull | bone | 2 | 120 | `bone_white` | totems |
| `leather` | leather | leather | 6 | 90 | `leather_brown` | one material for all tanned hides; the hide's species affects only the raw hide value |
| `wool` | wool | cloth | 4 | 30 | `wool_cream` | fiber |
| `tallow` | tallow | liquid | 2 | 90 | `tallow_yellow` | soapless; sold |
| `milk` | milk | liquid | 2 | 100 | `milk_white` | |
| `cheese` | cheese | meat | 5 | 110 | `cheese_yellow` | food; rots slowly |
| `egg` | egg | meat | 2 | 100 | `egg_cream` | food |

## Cloth and fiber

| id | name | class | value | density | color | notes |
|---|---|---|---|---|---|---|
| `flax_fiber` | flax fiber | cloth | 2 | 30 | `flax_straw` | from flax plants |
| `flax_thread` | flax thread | cloth | 3 | 30 | `flax_straw` | |
| `flax_cloth` | linen | cloth | 8 | 30 | `linen_cream` | |
| `wool_thread` | wool thread | cloth | 4 | 30 | `wool_cream` | |
| `wool_cloth` | wool cloth | cloth | 10 | 35 | `wool_cream` | warmer: halves cold injury risk when worn |
| `sporecloth_fiber` | sporecloth fiber | cloth | 3 | 25 | `spore_violet` | from sporecloth plants |
| `sporecloth_thread` | sporecloth thread | cloth | 4 | 25 | `spore_violet` | |
| `sporecloth_cloth` | sporecloth | cloth | 12 | 25 | `spore_violet` | |
| `silk_web` | web silk | cloth | 8 | 20 | `silk_white` | collected from cave spider webs (`gather` on a web tile) |

Cloth burns (300 ticks) and melts at 300 °C.

## Gems (rough and cut share the material; the item type differs)

See [minerals-and-metals.md](minerals-and-metals.md) for placement. Base rows:

| id | name | class | value | density | hardness | color |
|---|---|---|---|---|---|---|
| `quartz` | quartz | gem | 4 | 265 | 170 | `quartz_white` |
| `amethyst` | amethyst | gem | 10 | 265 | 170 | `amethyst_violet` |
| `garnet` | garnet | gem | 12 | 380 | 180 | `garnet_red` |
| `emerald` | emerald | gem | 40 | 280 | 190 | `emerald_green` |
| `ruby` | ruby | gem | 50 | 400 | 210 | `ruby_red` |
| `sapphire` | sapphire | gem | 45 | 400 | 210 | `sapphire_blue` |
| `diamond` | diamond | gem | 90 | 350 | 250 | `diamond_white` |
| `glowstone` | glowstone | gem | 25 | 200 | 120 | `glow_green` | cavern only; a placed glowstone (statue recipe) lights its 3×3 |

Gems melt at 1600 °C or above (magma-safe).

## Ores and metals

Ids fixed here; properties in [minerals-and-metals.md](minerals-and-metals.md).

Ores: `hematite`, `magnetite`, `limonite`, `malachite`, `native_copper`, `cassiterite`, `galena`, `sphalerite`, `tetrahedrite`, `native_gold`, `native_silver`, `native_platinum`, `bismuthinite`, `bituminous_coal`, `lignite`, `deepsilver_ore`.

Metals: `copper`, `tin`, `bronze`, `iron`, `steel`, `silver`, `gold`, `lead`, `zinc`, `brass`, `platinum`, `electrum`, `bismuth_bronze`, `deepsilver`.

Fuels (bar materials): `coal` (value 5, density 130, burns), `charcoal` (value 3, density 60, burns).

## Meal, drink and plant materials

- `meal` — class `meat` (edible), value 1; meal item types carry the value multiplier.
- Drink materials, class `liquid`, value per unit: `ale` 2, `dimcap_ale` 2, `cavewheat_beer` 2, `bellwine` 4, `rootwine` 3, `strawberry_wine` 4, `hopped_ale` 3.
- `flour` — class `plant`, value 2 (from barley or cavewheat at the farmer's workshop).
- Each plant species is a material of class `plant` with the value in [plants.md](plants.md).

## Generated per species

For every species with `butcherable: true` in [creatures.md](creatures.md), the loader creates:

- `<species>_meat` — class `meat`, value `meatValue` from the species row (2–6), density 100, color `meat_red`, rots (see items).
- `<species>_hide` — class `leather`, value `hideValue` (3–12), density 90, color `hide_brown`; tanning produces the single `leather` material.
- `<species>_shell` for shelled species instead of hide (value 4).

For fish: `trout_meat`, `perch_meat`, `blindfish_meat` are created from the three fish rows with value 2, 2, 3.

## Material colors summary

Every `color` value above must exist in [glyphs-and-colors.md](glyphs-and-colors.md).
