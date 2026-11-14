# Regions, Biomes and Traits

**Owner:** content (`biomes`, `regionTraits`, `civilizations`, `weatherTables`) · **Depends on:** [`../02-systems/01-world-generation.md`](../02-systems/01-world-generation.md), [`../02-systems/06-weather-and-seasons.md`](../02-systems/06-weather-and-seasons.md), [`../02-systems/03-terrain-and-mining.md`](../02-systems/03-terrain-and-mining.md)

## Biome lookup

Rows are temperature bands, columns rain bands; the elevation band overrides: `ocean` below `SEA_LEVEL`; `mountain` (temperate or warmer) and `alpine` (cold or frozen) for `elevation ≥ MOUNTAIN_ELEVATION`; `temperate_hills` replaces `temperate_grassland` and `temperate_forest` in the hills band.

| Temp \ Rain | arid | dry | moderate | wet |
|---|---|---|---|---|
| frozen | `glacier` | `tundra` | `tundra` | `tundra` |
| cold | `cold_steppe` | `cold_steppe` | `taiga` | `taiga` |
| temperate | `cold_steppe` | `temperate_grassland` | `temperate_forest` | `wetland` |
| warm | `desert` | `savanna` | `temperate_forest` | `wetland` |
| hot | `desert` | `badlands` | `savanna` | `tropical_forest` |

`dark_forest` is painted around the Gloam home (01). The civilisation species wildcard `gloam_*` uses `gloam_warrior` as its representative species.

## Biomes

Columns: `seasonTemp` spring / summer / autumn / winter in °C at the biome's `referenceTempC`; `soil` depth in z-levels and materials with weights; `trees`, `shrubs` densities as probability per eligible surface tile at generation; `wildlife` multiplier on species caps; `glyph`/`color` for the world map.

| id | name | referenceTempC | seasonTemp | soil depth | soil materials | trees | shrubs | wildlife | glyph | color | embark |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `ocean` | ocean | 10 | — | — | — | 0 | 0 | 0 | `≈` | `dark_blue` | no |
| `glacier` | glacier | −15 | −10 / −2 / −8 / −20 | 0 | — | 0 | 0 | 0.2 | `▒` | `ice_blue` | no |
| `tundra` | tundra | −6 | −2 / 8 / 0 / −16 | 1 | silt 60, peat 40 | 0.01 | 0.03 | 0.6 | `.` | `tundra_gray` | yes |
| `taiga` | taiga | 0 | 4 / 14 / 4 / −12 | 2 | loam 50, peat 30, silt 20 | 0.18 | 0.05 | 1.0 | `♠` | `pine_green` | yes |
| `cold_steppe` | cold steppe | 3 | 6 / 18 / 6 / −8 | 2 | loam 40, silt 40, sand 20 | 0.02 | 0.04 | 0.8 | `"` | `grass_dry` | yes |
| `temperate_grassland` | grassland | 10 | 10 / 22 / 12 / 0 | 3 | loam 70, clay 30 | 0.04 | 0.06 | 1.0 | `"` | `grass_green` | yes |
| `temperate_forest` | forest | 10 | 10 / 21 / 11 / 0 | 3 | loam 60, clay 40 | 0.22 | 0.08 | 1.2 | `♣` | `forest_green` | yes |
| `wetland` | wetland | 12 | 12 / 22 / 13 / 2 | 4 | silt 50, peat 30, clay 20 | 0.10 | 0.10 | 1.1 | `~` | `wetland_teal` | yes |
| `temperate_hills` | hills | 8 | 8 / 19 / 9 / −2 | 2 | loam 50, clay 30, sand 20 | 0.12 | 0.06 | 1.0 | `∩` | `hill_olive` | yes |
| `mountain` | mountain | 4 | 4 / 15 / 5 / −8 | 1 | sand 50, silt 50 | 0.06 | 0.03 | 0.7 | `▲` | `granite_gray` | yes |
| `alpine` | alpine | −4 | −2 / 9 / −1 / −16 | 0 | — | 0.02 | 0.02 | 0.5 | `▲` | `alpine_white` | yes |
| `savanna` | savanna | 22 | 22 / 30 / 24 / 14 | 2 | loam 40, sand 40, clay 20 | 0.03 | 0.05 | 1.1 | `"` | `savanna_gold` | yes |
| `desert` | desert | 26 | 24 / 36 / 26 / 12 | 1 | sand 90, silt 10 | 0.005 | 0.01 | 0.4 | `∙` | `sand_yellow` | yes |
| `badlands` | badlands | 20 | 18 / 32 / 20 / 6 | 1 | clay 60, sand 40 | 0.01 | 0.02 | 0.5 | `≡` | `badlands_red` | yes |
| `tropical_forest` | tropical forest | 26 | 25 / 29 / 26 / 22 | 4 | clay 50, loam 50 | 0.28 | 0.12 | 1.4 | `♣` | `jungle_green` | yes |
| `dark_forest` | dark forest | 8 | 7 / 17 / 8 / −3 | 3 | peat 40, loam 40, clay 20 | 0.26 | 0.06 | 1.0 | `♣` | `dark_forest_green` | yes |

Region `tempC` shifts every seasonal value by `tempC − referenceTempC`.

Daylight hours per season and temper are in 06.

## Biome surface

How the local map's surface looks and lies, beyond its soil and plants. Columns: `boulders`, the probability per dry surface floor of a loose boulder at generation from relief 1 (03 stage 9; three times as likely on bare rock); `outcrops` and `crags`, the counts per 96 × 96 map at relief 1 (03 stage 1 adds more with relief; level ground, relief 0, has none); `snow`, the share of the exposed dry surface under snow when the map is generated; `grass tints`, the colours grass leans toward in patches; `flowers`, the share of grass tiles drawn as flowers, and their colours; `rock tints`, the lichen and moss colours of bare rock floors (23 § Compositor step 2).

| id | boulders | outcrops | crags | snow | grass tints | flowers | flower colors | rock tints |
|---|---|---|---|---|---|---|---|---|
| `ocean` | 0 | 0 | 0 | 0 | — | 0 | — | — |
| `glacier` | 0.01 | 2 | 2 | 0.9 | — | 0 | — | `lichen_gray` |
| `tundra` | 0.006 | 4 | 0 | 0 | `grass_pale`, `moss_green` | 0.01 | `flower_white`, `flower_violet` | `lichen_gray`, `lichen_orange` |
| `taiga` | 0.004 | 3 | 0 | 0 | `grass_deep`, `moss_green` | 0.006 | `flower_white`, `flower_blue` | `lichen_gray`, `moss_green` |
| `cold_steppe` | 0.004 | 4 | 0 | 0 | `grass_pale`, `grass_olive` | 0.01 | `flower_violet`, `flower_yellow` | `lichen_gray`, `lichen_orange` |
| `temperate_grassland` | 0.002 | 3 | 0 | 0 | `grass_light`, `grass_deep`, `grass_olive` | 0.03 | `flower_yellow`, `flower_white`, `flower_violet`, `flower_red` | `lichen_gray`, `moss_green` |
| `temperate_forest` | 0.003 | 3 | 0 | 0 | `grass_deep`, `moss_green`, `grass_light` | 0.012 | `flower_white`, `flower_blue`, `flower_yellow` | `moss_green`, `lichen_gray` |
| `wetland` | 0.001 | 1 | 0 | 0 | `moss_green`, `grass_deep` | 0.015 | `flower_yellow`, `flower_white` | `moss_green` |
| `temperate_hills` | 0.006 | 6 | 0 | 0 | `grass_olive`, `grass_light`, `grass_deep` | 0.02 | `flower_violet`, `flower_yellow`, `flower_white` | `lichen_gray`, `lichen_orange`, `moss_green` |
| `mountain` | 0.012 | 8 | 3 | 0 | `grass_olive`, `grass_pale` | 0.01 | `flower_blue`, `flower_white` | `lichen_gray`, `lichen_orange`, `lichen_yellow` |
| `alpine` | 0.012 | 8 | 4 | 0.55 | — | 0 | — | `lichen_gray`, `lichen_orange`, `lichen_yellow` |
| `savanna` | 0.003 | 3 | 0 | 0 | `grass_olive`, `grass_pale` | 0.01 | `flower_red`, `flower_yellow` | `lichen_orange` |
| `desert` | 0.005 | 5 | 0 | 0 | — | 0 | — | `lichen_orange` |
| `badlands` | 0.012 | 8 | 2 | 0 | `grass_olive` | 0.004 | `flower_red` | `lichen_orange`, `lichen_yellow` |
| `tropical_forest` | 0.002 | 2 | 0 | 0 | `grass_deep`, `moss_green` | 0.02 | `flower_red`, `flower_violet`, `flower_yellow` | `moss_green` |
| `dark_forest` | 0.003 | 3 | 0 | 0 | `moss_green`, `grass_deep` | 0.004 | `flower_white` | `moss_green`, `lichen_gray` |

## Rating thresholds

| Rating | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| wealth score → | 0–2 | 3–4 | 5–6 | 7–8 | ≥ 9 |
| peril score → | 0 | 1 | 2 | 3 | ≥ 4 |
| temper score → | 0 | 1 | 2 | 3 | ≥ 4 |

## Region traits

Columns: `freq` permille among eligible regions; `companion` whether a second trait may be rolled; hooks are implemented by the named systems.

| id | name | requirements | freq | companion | hooks |
|---|---|---|---|---|---|
| `serene_vale` | Serene Vale | peril 0; `temperate_grassland`, `temperate_forest`, `temperate_hills`, `wetland`; river | 60 | no | 03: soil depth +2, `loam` only; 06: no storm, heatwave, cold snap; 08: herbivore caps ×2, no wolves, bears, snow leopards; 18: thieves only |
| `wyrm_roost` | Wyrm Roost | wealth ≥ 3; `mountain`, `alpine`, `temperate_hills` | 80 | yes | 03: 9×9 chamber in cavern 3 with a deepsilver vein adjacent; 18: one `magma_wyrm` asleep in the chamber, wakes on cavern 3 breach or when a dwarf enters within 12 tiles |
| `fungal_depths` | Fungal Depths | deepness ≥ 160 | 120 | yes | 03: cavern open fraction +0.15; 07: cavern shrub density ×2; 08 and 18: cavern caps ×1.5 |
| `glasslands` | Glasslands | volcano | 1000 (every volcano region) | yes | 03: surface soil replaced by `obsidian`, pipe radius 3, two shallow magma pools; 07: `treeDensity` 0.01; 01: temper +1 |
| `frostmarrow` | Frostmarrow | frozen or cold band | 100 | yes | 06: winter values in autumn and spring, summer growth 80%, snow whenever precipitation; 08: adds `yak` (wild, tameable, group 2–4) and `snow_leopard` cap +2; 07: surface crops grow only in summer |
| `old_battlefield` | Old Battlefield | peril ≥ 2; not `ocean`, `glacier` | 90 | yes | 03: `BATTLEFIELD_ITEM_COUNT` rusted (poor quality) iron weapons and armor plus 40 `bone_pile` and 6 `skull` on the surface band; 18: `restless_dead` on autumn nights |
| `sunken_halls` | Sunken Halls | `temperate_hills`, `mountain`, `alpine`, `taiga` | 70 | yes | 03: the hall template (entrance, 6 rooms 3×3, stairwell 2 levels, vault 5×5 sealed by walls) with 12 common furniture items and, in the vault, `VAULT_TREASURE` deepsilver items (1 axe, 1 helm, 1 breastplate) and one sleeping `blind_stalker` |
| `ironheart` | Ironheart | geology igneous or metamorphic | 80 | yes | minerals: `hematite` 12, `magnetite` 6 regardless of wealth; 01: wealth +1 |
| `gemsprings` | Gemsprings | wealth ≥ 2; river | 70 | yes | minerals: gem clusters ×2, half within 6 levels of the surface; 03: three 2×2 warm springs on the surface; 05: springs never freeze |
| `thunderhead` | Thunderhead | temper ≥ 2 | 100 | yes | 06: storm weight ×2; `LIGHTNING_PER_HOUR_PERMILLE` ×1.5 |
| `beastwood` | Beastwood | `temperate_forest`, `taiga`, `dark_forest`, `tropical_forest` | 100 | yes | 08: `wolf` and `bear` groups ×2, caps ×2; all wildlife caps ×1.5 |
| `twilight_pass` | Twilight Pass | peril ≥ 3 | 150 | yes | 18: all intervals halved; thief frequency ×2; caravans bring +1 guard |
| `deep_well` | Deep Well | deepness ≥ 120 | 80 | yes | 03: cavern 1 open fraction 0.7 with 60% of its floor as lake; 09: cavern 1 lake fish ×2 |

## Civilizations

| id | name | species | home preference | caravan season | raids | color | glyph | notes |
|---|---|---|---|---|---|---|---|---|
| `mountainhome` | the Mountainhome | `dwarf` | `mountain`, `alpine` near the largest mountain cluster | spring (from year 2) | no | `trader_mountainhome` | `☺` | immigration source |
| `hillfolk` | the Hillfolk | `human` | `temperate_grassland`, `savanna` with a river | summer | bandits only | `trader_hillfolk` | `☺` | |
| `wildwood` | the Wildwood | `elf` | largest `temperate_forest` or `tropical_forest` | autumn | no | `trader_wildwood` | `☺` | dislikes wood goods |
| `gloam` | the Gloam | `gloam_*` | `badlands`, `taiga`; paints `dark_forest` | none | yes | `hostile` | `G` | the raider civilization |

## Weather

### State durations (hours)

| State | min | max |
|---|---|---|
| `clear` | 8 | 36 |
| `overcast` | 6 | 24 |
| `rain` | 4 | 16 |
| `storm` | 3 | 8 |
| `snow` | 4 | 18 |
| `fog` | 3 | 10 |
| `heatwave` | 24 | 72 |
| `cold_snap` | 24 | 72 |

### Transition weights by season

Weights (not probabilities) from the row state to the column state; the draw normalizes after the constraints in 06. `heatwave` and `cold_snap` columns apply only when allowed; the temper rule multiplies the `storm`, `fog`, `heatwave` and `cold_snap` columns by `(1 + temper × 0.5)` and the `clear` column by `(1 − temper × 0.1)`.

**Spring**

| from \ to | clear | overcast | rain | storm | snow | fog | heatwave | cold_snap |
|---|---|---|---|---|---|---|---|---|
| clear | 40 | 30 | 20 | 3 | 2 | 5 | 0 | 0 |
| overcast | 30 | 25 | 30 | 6 | 3 | 6 | 0 | 0 |
| rain | 25 | 35 | 25 | 8 | 2 | 5 | 0 | 0 |
| storm | 20 | 30 | 40 | 5 | 0 | 5 | 0 | 0 |
| snow | 30 | 40 | 15 | 0 | 15 | 0 | 0 | 0 |
| fog | 40 | 30 | 20 | 0 | 0 | 10 | 0 | 0 |
| heatwave | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| cold_snap | 60 | 30 | 0 | 0 | 10 | 0 | 0 | 0 |

**Summer**

| from \ to | clear | overcast | rain | storm | snow | fog | heatwave | cold_snap |
|---|---|---|---|---|---|---|---|---|
| clear | 55 | 20 | 12 | 5 | 0 | 3 | 5 | 0 |
| overcast | 40 | 20 | 25 | 10 | 0 | 5 | 0 | 0 |
| rain | 35 | 30 | 20 | 10 | 0 | 5 | 0 | 0 |
| storm | 30 | 30 | 30 | 5 | 0 | 5 | 0 | 0 |
| snow | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| fog | 60 | 25 | 10 | 0 | 0 | 5 | 0 | 0 |
| heatwave | 70 | 20 | 5 | 5 | 0 | 0 | 0 | 0 |
| cold_snap | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Autumn**

| from \ to | clear | overcast | rain | storm | snow | fog | heatwave | cold_snap |
|---|---|---|---|---|---|---|---|---|
| clear | 35 | 30 | 20 | 4 | 3 | 8 | 0 | 0 |
| overcast | 25 | 25 | 30 | 6 | 5 | 9 | 0 | 0 |
| rain | 25 | 35 | 25 | 6 | 4 | 5 | 0 | 0 |
| storm | 20 | 35 | 35 | 5 | 0 | 5 | 0 | 0 |
| snow | 25 | 40 | 10 | 0 | 20 | 0 | 0 | 5 |
| fog | 35 | 30 | 20 | 0 | 0 | 15 | 0 | 0 |
| heatwave | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| cold_snap | 50 | 30 | 0 | 0 | 15 | 0 | 0 | 5 |

**Winter**

| from \ to | clear | overcast | rain | storm | snow | fog | heatwave | cold_snap |
|---|---|---|---|---|---|---|---|---|
| clear | 40 | 25 | 5 | 1 | 20 | 4 | 0 | 5 |
| overcast | 25 | 25 | 8 | 2 | 30 | 5 | 0 | 5 |
| rain | 30 | 35 | 15 | 2 | 15 | 3 | 0 | 0 |
| storm | 25 | 35 | 10 | 5 | 20 | 5 | 0 | 0 |
| snow | 25 | 30 | 5 | 0 | 30 | 3 | 0 | 7 |
| fog | 35 | 30 | 5 | 0 | 20 | 10 | 0 | 0 |
| heatwave | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| cold_snap | 40 | 30 | 0 | 0 | 20 | 0 | 0 | 10 |

The initial state at embark is `clear`.

## Names of places

Region names are generated from [names.md](names.md) with the biome's flavor list.

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. Each names the task that adds it: that task moves the row into its table above (without `task`), or makes the new table, adds its lines to [row-order.md](row-order.md) and runs `npm run content:export`. Every number is *unmeasured*.

### Planned region trait

| id | name | requirements | freq | companion | hooks | task |
|---|---|---|---|---|---|---|
| `starfall` | Starfall | any land biome (not `ocean`, `glacier`) | 15 | yes | 01: rolled on its own stream after the other traits; 03: a crater of radius 3–5, its floor one level down and of `ash_soil`, wild wyrmtongue on it, one `star_iron` boulder one level below its centre | T-560 |

### Signatures (a new table)

What a site has and lacks, for the site summary and the scarcity price ([02](../02-systems/02-embark-and-loadout.md) § Planned, [20](../02-systems/20-trade-and-caravans.md) § Planned). A row is a biome, a geology class (`geology:`) or a trait (`trait:`). Goods are material ids, material classes, or the words `honey`, `flux`, `fossils`, `giant_bones`, `horses`, `camels`, `reindeer`, `ice`. Every site has caverns, so the caverns have no row.

| key | has | lacks | task |
|---|---|---|---|
| `temperate_forest` | wood, honey, `nettle_fiber`, clay | salt, sand | T-550 |
| `temperate_hills` | wood, honey, `nettle_fiber`, clay | salt, sand | T-550 |
| `dark_forest` | wood, `ironwood`, `yew`, peat, honey | sand, salt | T-550 |
| `temperate_grassland` | honey, flax, barley, clay, horses | wood, sand | T-550 |
| `wetland` | `reed`, peat, `bog_iron`, clay, giant_bones | stone, flux | T-550 |
| `taiga` | peat, rye, ice, horn, `bog_iron`, reindeer | honey, sand | T-550 |
| `tundra` | ice, rye, lichen, `ivory`, reindeer, peat, giant_bones | wood, honey, clay | T-550 |
| `cold_steppe` | rye, horses, sand, horn | wood, honey | T-550 |
| `mountain` | stone, sand, lichen, horn, ice | wood, soil, clay, honey | T-550 |
| `alpine` | stone, sand, lichen, horn, ice | wood, soil, clay, honey | T-550 |
| `savanna` | honey, `sunfruit`, clay, camels | peat, ice | T-550 |
| `desert` | sand, salt, `cactus_fiber`, camels, giant_bones | wood, clay, honey, peat | T-550 |
| `badlands` | salt, clay, sand, giant_bones | wood, honey, peat | T-550 |
| `tropical_forest` | wood, honey, clay | salt, peat, ice | T-550 |
| `trait:glasslands` | `obsidian`, `ash_soil`, wyrmtongue | wood, soil | T-550 |
| `geology:sedimentary` | flux, coal, `halite`, fossils | gold, gem | T-550 |
| `geology:igneous` | copper, gem, `basalt` | flux | T-550 |
| `geology:metamorphic` | copper, gem | flux | T-550 |

In the lists, a word such as `wood`, `stone`, `soil` or `gem` is a material class; `salt`, `sand`, `clay`, `peat` and the backticked ids are materials; the rest are the words above. A good on a *lacks* line that is also on a *has* line of the same site is not lacking (a sedimentary wetland has flux). The rows are written in the site summary's words: "This site lacks: salt, sand."
