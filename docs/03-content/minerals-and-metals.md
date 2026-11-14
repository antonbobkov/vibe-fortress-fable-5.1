# Minerals and Metals

**Owner:** content (`minerals`, `metals`) · **Depends on:** [materials.md](materials.md), [`../02-systems/03-terrain-and-mining.md`](../02-systems/03-terrain-and-mining.md), [`../02-systems/12-workshops-and-professions.md`](../02-systems/12-workshops-and-professions.md)

## Geology layer templates

Each geology class is a template of layers from the surface down, applied as described in 03 stage 4. Thickness is in z-levels, rolled once per map. The template repeats when the column is deeper than the stack.

### Sedimentary

| Order | Material | Thickness |
|---|---|---|
| 1 | `sandstone` | 3–5 |
| 2 | `shale` | 2–4 |
| 3 | `limestone` | 3–6 |
| 4 | `siltstone` | 2–3 |
| 5 | `conglomerate` | 2–3 |
| 6 | `dolomite` | 2–4 |
| 7 | `chalk` | 1–2 |
| 8 | `granite` | 6–10 (the basement; repeats with `gneiss` 4–6 below it) |

### Igneous

| Order | Material | Thickness |
|---|---|---|
| 1 | `rhyolite` | 2–3 |
| 2 | `andesite` | 2–3 |
| 3 | `basalt` | 3–5 |
| 4 | `granite` | 5–8 |
| 5 | `diorite` | 4–6 |
| 6 | `gabbro` | 5–8 |
| 7 | `granite` | 6–10 |

### Metamorphic

| Order | Material | Thickness |
|---|---|---|
| 1 | `slate` | 3–4 |
| 2 | `phyllite` | 2–3 |
| 3 | `schist` | 3–5 |
| 4 | `marble` | 3–5 |
| 5 | `gneiss` | 4–6 |
| 6 | `quartzite` | 3–4 |
| 7 | `granite` | 6–10 |

### Mixed

Alternates: `sandstone` 2–3, `slate` 2–3, `limestone` 3–4, `basalt` 2–3, `marble` 2–3, `granite` 4–6, `schist` 3–4, `gabbro` 4–6.

On `glasslands` the top `soilDepth` levels are `obsidian` instead of soil and the first rock layer is `basalt` 4–6.

## Ores

Columns: `hosts` are the layer materials a vein or cluster may start in; `shape` is `vein` (random walk) or `cluster` (blob); `count` is the expected number per standard map at wealth 2, scaled by the wealth multiplier row below; `length` for veins, `radius` for clusters; `yields` are bars per ore item at the smelter (fuel per job); `value` is the ore item's value.

| id | name | hosts | shape | count | length / radius | yields | value | color | notes |
|---|---|---|---|---|---|---|---|---|---|
| `hematite` | hematite | `sandstone`, `limestone`, `shale`, `siltstone`, `dolomite` | vein | 6 | 25 | 2 `iron` | 8 | `hematite_red` | the common iron ore |
| `magnetite` | magnetite | `granite`, `diorite`, `gabbro`, `gneiss` | cluster | 3 | 3 | 2 `iron` | 9 | `magnetite_black` | deeper iron |
| `limonite` | limonite | `sandstone`, `shale`, `conglomerate`, `chalk` | cluster | 3 | 2 | 2 `iron` | 7 | `limonite_yellow` | |
| `malachite` | malachite | `limestone`, `marble`, `dolomite`, `schist` | vein | 5 | 20 | 2 `copper` | 6 | `malachite_green` | |
| `native_copper` | native copper | `basalt`, `andesite`, `rhyolite`, `gabbro` | vein | 3 | 18 | 2 `copper` | 8 | `copper_orange` | |
| `cassiterite` | cassiterite | `granite`, `rhyolite`, `quartzite`, `schist` | vein | 3 | 16 | 2 `tin` | 8 | `tin_gray` | tin for bronze |
| `galena` | galena | `limestone`, `dolomite`, `marble`, `slate` | vein | 3 | 18 | 1 `lead` + 50% 1 `silver` | 6 | `galena_gray` | |
| `sphalerite` | sphalerite | `limestone`, `dolomite`, `marble` | cluster | 2 | 2 | 2 `zinc` | 5 | `sphalerite_brown` | zinc for brass |
| `tetrahedrite` | tetrahedrite | `granite`, `diorite`, `phyllite`, `schist` | vein | 2 | 14 | 1 `copper` + 50% 1 `silver` | 8 | `tetra_gray` | |
| `native_gold` | native gold | `granite`, `quartzite`, `gneiss` | vein | 1 | 8 | 2 `gold` | 30 | `gold_yellow` | |
| `native_silver` | native silver | `granite`, `gneiss`, `andesite` | vein | 1 | 8 | 2 `silver` | 15 | `silver_white` | |
| `native_platinum` | native platinum | `gabbro`, `diorite` | cluster | 0.5 | 1 | 2 `platinum` | 40 | `platinum_white` | |
| `bismuthinite` | bismuthinite | `granite`, `quartzite` | cluster | 1 | 2 | 2 `bismuth` | 10 | `bismuth_pink` | bismuth bronze |
| `bituminous_coal` | bituminous coal | `sandstone`, `shale`, `siltstone` | vein | 4 | 22 | 2 `coal` | 5 | `coal_black` | fuel |
| `lignite` | lignite | `sandstone`, `chalk`, `conglomerate` | vein | 3 | 20 | 1 `coal` | 3 | `lignite_brown` | fuel |
| `deepsilver_ore` | deepsilver | any rock at `z ≤ DEEPSILVER_Z_MAX` within 2 of magma | vein | see below | 6 | 1 `deepsilver` | 120 | `deepsilver_blue` | wakes the Hollow |

`bismuth` is a metal used only in `bismuth_bronze` (below); it is not a bar players use directly.

### Wealth multiplier

| Wealth | Ore count multiplier | Gem count multiplier | Deepsilver veins |
|---|---|---|---|
| 0 | 0.4 | 0.3 | 0 |
| 1 | 0.7 | 0.6 | 0 |
| 2 | 1.0 | 1.0 | 1 |
| 3 | 1.5 | 1.5 | 2 |
| 4 | 2.2 | 2.2 | 3 |

Trait adjustments: `ironheart` sets `hematite` count to 12 and `magnetite` to 6 regardless of wealth; `gemsprings` doubles gem clusters and places half of them within 6 levels of the surface; `wyrm_roost` adds one deepsilver vein next to the wyrm chamber; `glasslands` adds one `native_copper` vein and halves coal.

## Gems

Clusters of radius 1–2, count per standard map at wealth 2:

| id | hosts | count |
|---|---|---|
| `quartz` | `sandstone`, `granite`, `quartzite`, `schist` | 8 |
| `amethyst` | `basalt`, `rhyolite`, `granite` | 4 |
| `garnet` | `schist`, `gneiss`, `phyllite` | 4 |
| `emerald` | `granite`, `marble`, `schist` | 1.5 |
| `ruby` | `marble`, `gneiss` | 1 |
| `sapphire` | `basalt`, `gabbro`, `marble` | 1 |
| `diamond` | `gabbro`, `diorite` (z ≤ 10) | 0.5 |
| `glowstone` | cavern walls (any cavern) | 3 |

## Metals

Columns: `tier` for weapons and armor (0 wood and bone, 1 copper, 2 bronze, 3 iron, 4 steel, 5 deepsilver); `weaponMult` scales weapon damage; `armorMult` scales armor value; `bluntBonus` applies to blunt weapons of this metal; `runeMult` scales the power of a staff shod in this metal ([weapons-and-armor.md](weapons-and-armor.md) § Channels); `summon` is the species a Call staff shod in this metal brings; a metal with none brings the `call` spell's own ([creatures.md](creatures.md) § Summons); `runePressure` is the Deep pressure that each bar of it raises when a building tagged `rune_work` consumes it, the same as one mined tile (*unmeasured*; [25](../02-systems/25-runecraft.md) § Deepsilver); `magmaSafe` if `meltsAtC > 1200`.

| id | name | tier | value (bar) | density | weaponMult | armorMult | bluntBonus | runeMult | summon | runePressure | meltsAtC | color | alloy inputs (→ output) | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `copper` | copper | 1 | 10 | 890 | 0.80 | 0.80 | 0 | 0.8 | — | — | 1085 | `copper_orange` | — | |
| `tin` | tin | 0 | 12 | 730 | 0.50 | 0.50 | 0 | 0.7 | — | — | 232 | `tin_gray` | — | alloy input only |
| `bronze` | bronze | 2 | 18 | 880 | 0.90 | 0.90 | 0 | 0.9 | — | — | 950 | `bronze_gold` | 1 `copper` + 1 `tin` → 2 | |
| `bismuth_bronze` | bismuth bronze | 2 | 20 | 870 | 0.92 | 0.92 | 0 | 0.7 | — | — | 900 | `bronze_pale` | 2 `copper` + 1 `tin` + 1 `bismuth` → 4 | |
| `iron` | iron | 3 | 15 | 790 | 1.00 | 1.00 | 0 | 1.0 | — | — | 1538 | `iron_gray` | — | magma-safe |
| `steel` | steel | 4 | 40 | 790 | 1.25 | 1.25 | 0 | 1.1 | `stone_warden` | — | 1500 | `steel_bright` | 1 `iron` + 1 flux stone + 1 fuel → 1 | magma-safe |
| `silver` | silver | 1 | 25 | 1050 | 0.70 | 0.60 | +30% | 1.3 | `stone_warden` | — | 962 | `silver_white` | — | maces and hammers of silver |
| `gold` | gold | 0 | 60 | 1930 | 0.40 | 0.40 | +10% | 0.7 | — | — | 1064 | `gold_yellow` | — | crafts and statues |
| `lead` | lead | 0 | 6 | 1130 | 0.40 | 0.40 | 0 | 0.7 | — | — | 327 | `lead_gray` | — | weights, crafts |
| `zinc` | zinc | 0 | 8 | 710 | 0.50 | 0.50 | 0 | 0.7 | — | — | 420 | `zinc_gray` | — | alloy input |
| `brass` | brass | 1 | 16 | 850 | 0.75 | 0.75 | 0 | 0.7 | — | — | 930 | `brass_gold` | 1 `copper` + 1 `zinc` → 2 | furniture, crafts |
| `platinum` | platinum | 0 | 90 | 2140 | 0.50 | 0.60 | +10% | 0.7 | — | — | 1768 | `platinum_white` | — | magma-safe; crafts |
| `electrum` | electrum | 0 | 45 | 1500 | 0.45 | 0.45 | 0 | 0.7 | — | — | 1000 | `electrum_pale` | 1 `gold` + 1 `silver` → 2 | crafts |
| `bismuth` | bismuth | 0 | 10 | 980 | 0.30 | 0.30 | 0 | 0.7 | — | — | 271 | `bismuth_pink` | — | alloy input |
| `deepsilver` | deepsilver | 5 | 250 | 600 | 1.60 | 1.60 | 0 | 1.6 | `deep_shade` | 10 | 2400 | `deepsilver_blue` | — | magma-safe; light: armor weight halved |

Metal tier for weapon and armor purposes: `wood`, `bone` and `obsidian` items are tier 0 with `weaponMult` 0.40, 0.50 and 0.70. Obsidian and bone are knapped into daggers and short swords at the craftsdwarf's workshop ([workshops-and-recipes.md](workshops-and-recipes.md) § Craftsdwarf): an obsidian short sword deals 12.6 and a bone one 9 against a copper one's 14.4 and an iron one's 18, and a bone dagger's 6 is a dwarf's punch with an edge.

## Fuel

| Bar | From | Yield |
|---|---|---|
| `coal` | `bituminous_coal` ore (2 per ore), `lignite` (1 per ore) | smelted without fuel cost (the coal is its own fuel: the `smelt_coal` recipes have `fuel: false`) |
| `charcoal` | 1 log at the wood furnace | 1 per log |

Every smelter and forge job consumes 1 fuel bar unless magma-powered. Steel additionally consumes 1 fuel as an input (carbon). Both fuels carry the item tag `fuel`.

## Flux

Stones tagged `flux`: `limestone`, `dolomite`, `marble`, `chalk`. One raw stone per steel bar.

## Generated recipes

From the tables above the loader generates, per 12:

- `smelt_hematite` … `smelt_deepsilver_ore` (1 ore → yields; fuel true except coal ores).
- `alloy_bronze`, `alloy_bismuth_bronze`, `alloy_brass`, `alloy_electrum`, `alloy_steel` (steel is listed as an alloy for uniformity: 1 iron bar + 1 flux + 1 fuel → 1 steel).
- `melt_metal_item` (any `melt`-flagged metal item → 60% of its bar cost in bars).

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. Each names the task that adds it: that task moves the row into its table above (in that table's columns, without `task`), adds its line to [row-order.md](row-order.md) and runs `npm run content:export`. The rules that use them are in the § Planned sections of the system documents. Every number is *unmeasured*.

### Planned ores and bone

| id | name | hosts | shape | count | length / radius | yields | value | color | notes | task |
|---|---|---|---|---|---|---|---|---|---|---|
| `halite` | rock salt | `limestone`, `shale`, `sandstone`, `chalk` | cluster | 2 | 2 | — | 2 | `salt_white` | no smelt recipe (no yields); the kitchen crushes 1 → 5 `salt` | T-547 |
| `bog_iron` | bog iron | `peat` | cluster | 3 | 2 | 1 `iron` | 4 | `limonite_yellow` | the wetland's iron, half a hematite's | T-547 |
| `giant_bone` | giant bone | `sandstone`, `shale`, `limestone`, `siltstone`, `chalk`, `conglomerate` | cluster | 3 | 2 | — | 3 | `bone_white` | class `bone`, density 140, hardness 70, melts at 1600 (magma-safe); a dug tile always drops a `fossil`; the boneyards are of it too (03) | T-547 |
| `star_iron` | star iron | — | cluster | 0 | 0 | 3 `star_steel` | 30 | `star_silver` | placed only by `starfall` (03 § Planned); smelted without flux | T-560 |

Fossils lie only in the sedimentary layers: an igneous or metamorphic map has fossils only where its mixed template holds a sedimentary layer.

### Planned metals

| id | name | tier | value (bar) | density | weaponMult | armorMult | bluntBonus | runeMult | summon | runePressure | meltsAtC | color | alloy inputs (→ output) | notes | task |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `pewter` | pewter | 0 | 9 | 730 | 0.40 | 0.40 | 0 | 0.7 | — | — | 300 | `pewter_gray` | 1 `tin` + 1 `lead` → 2 | mugs, crafts, tableware | T-547 |
| `star_steel` | star steel | 4 | 90 | 780 | 1.30 | 1.25 | 0 | 1.4 | `stone_warden` | — | 1600 | `star_silver` | — | magma-safe; never sold; merchants pay 200% | T-560 |

### Planned fuel and flux

- Half fuels (T-552): `peat_brick` (a peat load dried on a rack) and `dung_cake` (3 dung dried) carry the item tag `fuel_half`, and `smoky`: a fuel job burns two of them in place of one bar (12 § Planned).
- Flux substitutes (T-547): 3 `shell_piece` (any shell material, chitin included) or 1 `bone_ash` in place of the flux stone, in the smelter's authored `make_steel_shell` and `make_steel_bone_ash` (`workshops-and-recipes.md` § Planned rows). Bone ash is also a fertilizer.
