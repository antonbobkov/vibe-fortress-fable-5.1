# Workshops and Recipes

**Detail level:** W3 · **Owner:** content (`workshops`, `recipes`) · **Depends on:** [`../02-systems/12-workshops-and-professions.md`](../02-systems/12-workshops-and-professions.md), [items.md](items.md), [minerals-and-metals.md](minerals-and-metals.md), [weapons-and-armor.md](weapons-and-armor.md)

## Workshops

All are 3×3. `inputs` to build; `fuel` whether its fuel recipes consume a fuel bar; `magma` whether a magma variant exists.

| id | name | inputs | labor | ticks | fuel | magma | glyph pattern |
|---|---|---|---|---|---|---|---|
| `carpenter` | carpenter's workshop | 2 `log` | carpentry | 200 | no | no | `carpenter` |
| `mason` | mason's workshop | 2 `raw_stone` or `stone_block` | masonry | 200 | no | no | `mason` |
| `craftdwarf` | craftsdwarf's workshop | 1 `raw_stone` + 1 `log` | construction | 200 | no | no | `craftdwarf` |
| `jeweler` | jeweler's workshop | 2 `stone_block` | masonry | 200 | no | no | `jeweler` |
| `mechanic` | mechanic's workshop | 2 `raw_stone` | masonry | 200 | no | no | `mechanic` |
| `wood_furnace` | wood furnace | 3 `raw_stone` or `stone_block` (fireproof: not peat) | masonry | 250 | no | no | `furnace` |
| `smelter` | smelter | 3 `raw_stone` or `stone_block` | masonry | 300 | yes | `magma_smelter` | `smelter` |
| `forge` | forge | 1 `anvil` + 3 `stone_block` | masonry | 300 | yes | `magma_forge` | `forge` |
| `kitchen` | kitchen | 1 `table` + 1 `raw_stone` | construction | 200 | no | no | `kitchen` |
| `still` | still | 1 `barrel` + 1 `raw_stone` | construction | 200 | no | no | `still` |
| `tannery` | tannery | 2 `log` + 1 `bucket` | carpentry | 200 | no | no | `tannery` |
| `leatherworks` | leatherworks | 1 `table` + 1 `log` | carpentry | 200 | no | no | `leatherworks` |
| `loom` | loom | 2 `log` | carpentry | 200 | no | no | `loom` |
| `clothier` | clothier's shop | 1 `table` + 1 `chest` | carpentry | 200 | no | no | `clothier` |
| `farmers_workshop` | farmer's workshop | 1 `table` + 1 `bucket` | carpentry | 150 | no | no | `farmers` |
| `butcher` | butcher's shop | 1 `table` + 1 `raw_stone` | construction | 150 | no | no | `butcher` |
| `kennel` | kennel | 2 `log` + 1 `chain` or `rope` | carpentry | 200 | no | no | `kennel` |
| `bowyer` | bowyer's workshop | 2 `log` | carpentry | 200 | no | no | `bowyer` |

Magma variants require `MAGMA_POWER_LEVEL` magma directly below at least one footprint tile at build time and at every job start, and every input must be magma-safe (the anvil is iron or steel; blocks must be magma-safe stone or obsidian).

| id | name | variant of | inputs | labor | ticks |
|---|---|---|---|---|---|
| `magma_smelter` | magma smelter | `smelter` | 3 `stone_block` (magma-safe) | masonry | 350 |
| `magma_forge` | magma forge | `forge` | 1 `anvil` (iron or steel) + 3 `stone_block` (magma-safe) | masonry | 350 |
| `magma_kiln` | magma kiln | — | 3 `stone_block` (magma-safe) | masonry | 300; reserved for glass in a later version; it has no recipes and is hidden from the build menu until one exists |

## Recipe columns

`inputs` as `count × (item | tag | class)` with material constraints in parentheses; `outputs` as `count × item (material source)`; `skill`; `ticks` base; `fuel`; `Q` quality-bearing; `xp`. `from_input` means the output takes the material of the first input; `container` means an empty container of that class is an input and holds the output.

## Carpenter (`carpentry`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_bed` | Bed | 1 log | 1 bed (from_input) | 150 | yes | 8 |
| `make_table_wood` | Table | 1 log | 1 table | 120 | yes | 6 |
| `make_chair_wood` | Chair | 1 log | 1 chair | 100 | yes | 6 |
| `make_door_wood` | Door | 1 log | 1 door | 120 | yes | 6 |
| `make_hatch_wood` | Hatch | 1 log | 1 hatch | 120 | yes | 6 |
| `make_cabinet_wood` | Cabinet | 2 log | 1 cabinet | 180 | yes | 8 |
| `make_chest_wood` | Chest | 1 log | 1 chest | 120 | yes | 6 |
| `make_coffin_wood` | Coffin | 2 log | 1 coffin | 150 | yes | 6 |
| `make_barrel` | Barrel | 1 log | 1 barrel | 100 | no | 5 |
| `make_bin` | Bin | 1 log | 1 bin | 100 | no | 5 |
| `make_bucket` | Bucket | 1 log | 1 bucket | 80 | no | 4 |
| `make_wood_block` | Wooden blocks | 1 log | 2 wood_block | 60 | no | 3 |
| `make_cage_wood` | Cage | 2 log | 1 cage | 150 | no | 6 |
| `make_nest_box` | Nest box | 1 log | 1 nest_box | 80 | no | 4 |
| `make_weapon_rack_wood` | Weapon rack | 1 log | 1 weapon_rack | 100 | yes | 5 |
| `make_armor_stand_wood` | Armor stand | 1 log | 1 armor_stand | 100 | yes | 5 |
| `make_archery_target` | Archery target | 1 log | 1 archery_target | 80 | no | 4 |
| `make_splint` | Splints | 1 log | 4 splint | 80 | no | 4 |
| `make_crutch` | Crutch | 1 log | 1 crutch | 80 | no | 4 |
| `make_training_axe` | Training axe | 1 log | 1 training_axe | 80 | no | 4 |
| `make_training_sword` | Training sword | 1 log | 1 training_sword | 80 | no | 4 |
| `make_training_spear` | Training spear | 1 log | 1 training_spear | 80 | no | 4 |
| `make_buckler_wood` | Buckler | 1 log | 1 buckler | 100 | yes | 5 |
| `make_shield_wood` | Shield | 1 log + 1 bar | 1 shield (wood) | 150 | yes | 6 |
| `make_club` | Club | 1 log | 1 club | 60 | no | 3 |
| `make_spike_wood` | Wooden spikes | 1 log | 3 spike (wood) | 100 | no | 4 |
| `make_bolts_wood` | Wooden bolts | 1 log | 20 bolt (wood) | 80 | no | 4 |

## Mason (`masonry`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_stone_block` | Blocks | 1 raw_stone | 2 stone_block | 60 | no | 3 |
| `make_table_stone` | Table | 1 raw_stone | 1 table | 150 | yes | 6 |
| `make_chair_stone` | Chair | 1 raw_stone | 1 chair | 120 | yes | 6 |
| `make_door_stone` | Door | 1 raw_stone | 1 door | 150 | yes | 6 |
| `make_hatch_stone` | Hatch | 1 raw_stone | 1 hatch | 150 | yes | 6 |
| `make_cabinet_stone` | Cabinet | 2 raw_stone | 1 cabinet | 200 | yes | 8 |
| `make_chest_stone` | Chest | 1 raw_stone | 1 chest | 150 | yes | 6 |
| `make_coffin_stone` | Coffin | 2 raw_stone | 1 coffin | 200 | yes | 6 |
| `make_statue` | Statue | 3 raw_stone | 1 statue | 400 | yes | 15 |
| `make_floodgate` | Floodgate | 2 raw_stone | 1 floodgate | 200 | no | 8 |
| `make_nest_box_stone` | Nest box | 1 raw_stone | 1 nest_box | 100 | no | 4 |
| `make_memorial_slab` | Memorial slab (for a dead dwarf) | 1 raw_stone | 1 memorial_slab | 300 (skill `engraving`) | yes | 15 |
| `make_sling_stones` | Sling stones | 1 raw_stone | 30 sling_stone | 60 | no | 2 |

## Craftsdwarf (`crafting`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `craft_stone` | Stone crafts | 1 raw_stone | 3 craft (random of figurine, ring, amulet; from_input) | 150 | yes | 8 |
| `craft_wood` | Wood crafts | 1 log | 3 craft | 150 | yes | 8 |
| `craft_bone` | Bone crafts | 1 bone_pile | 2 craft (bone) | 150 | yes | 8 |
| `craft_shell` | Shell crafts | 1 shell_piece | 2 craft (shell) | 150 | yes | 8 |
| `make_mug_stone` | Stone mugs | 1 raw_stone | 3 mug | 120 | yes | 6 |
| `make_mug_wood` | Wooden mugs | 1 log | 3 mug | 120 | yes | 6 |
| `make_totem` | Totem | 1 skull | 1 totem | 200 | yes | 10 |
| `make_bolts_bone` | Bone bolts | 1 bone_pile | 15 bolt (bone) | 100 | no | 5 |
| `make_arrows_bone` | Bone arrows | 1 bone_pile | 15 arrow (bone) | 100 | no | 5 |

## Jeweler (`gem_cutting`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `cut_gem` | Cut gem | 1 rough_gem | 1 cut_gem (from_input) | 200 | yes | 12 |
| `make_glowstone_lamp` | Glowstone lamp | 1 rough_gem (glowstone) + 1 stone_block | 1 statue (glowstone; lights 3×3) | 300 | yes | 15 |

## Mechanic (`mechanics`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_mechanism` | Mechanism | 1 raw_stone | 1 mechanism | 200 | yes (affects trap and plate reliability: poor mechanisms jam +50‰) | 10 |
| `make_mechanism_metal` | Metal mechanism | 1 bar (magma-safe metal) | 1 mechanism | 250 | yes | 12 |

## Wood furnace (`smelting`)

| id | name | inputs | outputs | ticks | fuel | xp |
|---|---|---|---|---|---|---|
| `make_charcoal` | Charcoal | 1 log | 1 charcoal_bar | 100 | no | 3 |

## Smelter (`smelting`)

Generated per ore and alloy (see [minerals-and-metals.md](minerals-and-metals.md)). Base: `smelt_*` 150 ticks, xp 6; `alloy_*` 200 ticks, xp 8; `melt_metal_item` 120 ticks, xp 3. `smelt_bituminous_coal` and `smelt_lignite` have `fuel: false`.

## Forge (`weaponsmithing`, `armorsmithing`, `metalcrafting`)

Bars per item from [weapons-and-armor.md](weapons-and-armor.md) and [items.md](items.md); all `Q` yes unless noted; `fuel` yes.

| id | name | skill | inputs | outputs | ticks | xp |
|---|---|---|---|---|---|---|
| `forge_dagger` | Dagger | weaponsmithing | 1 bar | 1 dagger | 150 | 8 |
| `forge_short_sword` | Short sword | weaponsmithing | 2 bar | 1 short_sword | 220 | 10 |
| `forge_battle_axe` | Battle axe | weaponsmithing | 2 bar | 1 axe | 220 | 10 |
| `forge_great_axe` | Great axe | weaponsmithing | 3 bar | 1 great_axe | 300 | 12 |
| `forge_mace` | Mace | weaponsmithing | 2 bar | 1 mace | 200 | 10 |
| `forge_warhammer` | Warhammer | weaponsmithing | 2 bar | 1 warhammer | 220 | 10 |
| `forge_maul` | Maul | weaponsmithing | 3 bar | 1 maul | 300 | 12 |
| `forge_spear` | Spear | weaponsmithing | 1 bar + 1 log | 1 spear | 180 | 8 |
| `forge_pike` | Pike | weaponsmithing | 2 bar + 1 log | 1 pike | 250 | 10 |
| `forge_pick` | Pick | weaponsmithing | 2 bar | 1 pick | 200 | 10 |
| `forge_crossbow` | Metal crossbow | weaponsmithing | 1 bar + 1 log | 1 crossbow (metal) | 250 | 10 |
| `forge_bolts` | Bolts | weaponsmithing | 1 bar | 25 bolt | 120 | 5 |
| `forge_arrows` | Arrowheads | weaponsmithing | 1 bar | 25 arrow | 120 | 5 |
| `forge_spikes` | Spikes | weaponsmithing | 1 bar | 3 spike | 120 | 5 |
| `forge_helm` | Helm | armorsmithing | 1 bar | 1 helm | 180 | 8 |
| `forge_mail_shirt` | Mail shirt | armorsmithing | 3 bar | 1 mail_shirt | 350 | 14 |
| `forge_breastplate` | Breastplate | armorsmithing | 4 bar | 1 breastplate | 400 | 16 |
| `forge_gauntlets` | Gauntlets | armorsmithing | 1 bar | 1 gauntlets | 180 | 8 |
| `forge_greaves` | Greaves | armorsmithing | 2 bar | 1 greaves | 250 | 10 |
| `forge_metal_boots` | Metal boots | armorsmithing | 1 bar | 1 metal_boots | 180 | 8 |
| `forge_shield` | Shield | armorsmithing | 2 bar | 1 shield | 220 | 10 |
| `forge_buckler` | Buckler | armorsmithing | 1 bar | 1 buckler | 150 | 8 |
| `forge_anvil` | Anvil | metalcrafting | 5 bar (iron or steel) | 1 anvil | 400 | 15 |
| `forge_chain` | Chain | metalcrafting | 1 bar | 1 chain | 150 | 6 |
| `forge_cage` | Metal cage | metalcrafting | 2 bar | 1 cage | 200 | 8 |
| `forge_metal_block` | Metal blocks | metalcrafting | 1 bar | 2 stone_block (metal; used as `block`) | 100 | 4 |
| `forge_table` | Metal table | metalcrafting | 2 bar | 1 table | 200 | 8 |
| `forge_chair` | Metal chair | metalcrafting | 1 bar | 1 chair | 150 | 6 |
| `forge_door` | Metal door | metalcrafting | 2 bar | 1 door | 200 | 8 |
| `forge_hatch` | Metal hatch | metalcrafting | 1 bar | 1 hatch | 150 | 6 |
| `forge_floodgate` | Metal floodgate | metalcrafting | 2 bar | 1 floodgate | 220 | 8 |
| `forge_cabinet` | Metal cabinet | metalcrafting | 2 bar | 1 cabinet | 220 | 8 |
| `forge_chest` | Metal chest | metalcrafting | 2 bar | 1 chest | 200 | 8 |
| `forge_coffin` | Metal coffin | metalcrafting | 3 bar | 1 coffin | 250 | 8 |
| `forge_statue` | Metal statue | metalcrafting | 4 bar | 1 statue | 400 | 15 |
| `forge_crafts` | Metal crafts | metalcrafting | 1 bar | 3 craft | 150 | 8 |
| `forge_mug` | Metal mugs | metalcrafting | 1 bar | 3 mug | 120 | 6 |
| `forge_bucket` | Metal bucket | metalcrafting | 1 bar | 1 bucket | 100 | 4 |
| `forge_barrel` | Metal barrel | metalcrafting | 2 bar | 1 barrel | 150 | 6 |
| `forge_bin` | Metal bin | metalcrafting | 2 bar | 1 bin | 150 | 6 |

Wooden crossbows, bows and shields are made at the bowyer and carpenter. Leather and cloth armor at the leatherworks and clothier.

## Kitchen (`cooking`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `cook_easy_meal` | Easy meal | 2 ingredient (distinct stacks) | 4 easy_meal | 120 | yes | 6 |
| `cook_fine_meal` | Fine meal | 3 ingredient | 6 fine_meal | 180 | yes | 10 |
| `cook_lavish_meal` | Lavish meal | 4 ingredient | 8 lavish_meal | 250 | yes | 15 |
| `render_fat` | Render fat | 1 fat | 1 tallow | 80 | no | 3 |

Ingredients: anything in `food/*` except meals and tallow. Each recipe consumes one unit from each input stack.

## Still (`brewing`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `brew` | Brew drink | 4 plant_food (brewable species) + container barrel | 20 drink (species' drink material) in the barrel | 200 | no | 8 |
| `brew_hopped` | Brew hopped ale | 4 plant_food (barley) + 1 plant_food (hops) + container barrel | 20 drink (hopped_ale) | 220 | no | 10 |

## Tannery (`tanning`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `tan_hide` | Tan hide | 1 raw_hide | 1 leather_piece (`leather`) | 150 | no | 6 |

## Leatherworks (`leatherworking`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_cap` | Cap | 1 leather_piece | 1 cap | 120 | yes | 6 |
| `make_leather_jerkin` | Leather jerkin | 3 leather_piece | 1 leather_jerkin | 220 | yes | 10 |
| `make_bracers` | Bracers | 1 leather_piece | 1 bracers | 120 | yes | 6 |
| `make_leggings` | Leather leggings | 2 leather_piece | 1 leggings | 180 | yes | 8 |
| `make_leather_boots` | Leather boots | 1 leather_piece | 1 leather_boots | 120 | yes | 6 |
| `make_quiver` | Quiver | 1 leather_piece | 1 quiver | 100 | no | 5 |
| `make_bag_leather` | Leather bag | 1 leather_piece | 1 bag | 100 | no | 5 |
| `make_sling` | Sling | 1 leather_piece | 1 sling | 80 | yes | 5 |
| `make_tunic_leather` | Leather tunic | 2 leather_piece | 1 tunic | 150 | yes | 6 |
| `make_trousers_leather` | Leather trousers | 2 leather_piece | 1 trousers | 150 | yes | 6 |
| `make_boots_leather` | Boots | 1 leather_piece | 1 boots | 100 | yes | 5 |

## Loom (`weaving`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `spin_thread` | Spin thread | 1 fiber (flax_fiber, sporecloth_fiber) or 1 wool_raw | 1 thread (matching thread material) | 80 | no | 4 |
| `weave_cloth` | Weave cloth | 2 thread (same material) | 1 cloth (matching cloth material) | 150 | no | 6 |
| `collect_web` | not a recipe: `gather` on a web tile yields 1 thread (`silk_web`) | | | | | |

## Clothier (`clothesmaking`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_tunic` | Tunic | 2 cloth | 1 tunic | 120 | yes | 6 |
| `make_trousers` | Trousers | 2 cloth | 1 trousers | 120 | yes | 6 |
| `make_boots_cloth` | Cloth boots | 1 cloth | 1 boots | 100 | yes | 5 |
| `make_cloak` | Cloak | 3 cloth (wool_cloth) | 1 cloak | 180 | yes | 8 |
| `make_gambeson` | Gambeson | 3 cloth | 1 gambeson | 220 | yes | 10 |
| `make_bag_cloth` | Cloth bag | 1 cloth | 1 bag | 80 | no | 4 |
| `make_rope` | Rope | 2 thread | 1 rope | 100 | no | 4 |
| `make_bandages` | Bandages | 1 cloth | 4 bandage | 60 | no | 3 |

## Farmer's workshop (`farming`, `animal_care`)

| id | name | skill | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|---|
| `process_flax` | Process flax | farming | 1 plant_food (flax) | 2 fiber (flax_fiber) | 100 | no | 4 |
| `process_sporecloth` | Process sporecloth | farming | 1 plant_food (sporecloth) | 2 fiber (sporecloth_fiber) | 100 | no | 4 |
| `mill_flour` | Mill flour | farming | 2 plant_food (barley or cavewheat) + container bag | 3 flour in the bag | 120 | no | 5 |
| `make_cheese` | Make cheese | animal_care | 3 milk | 2 cheese | 150 | yes | 6 |
| (`milk_animal`, `shear_animal` are jobs, not recipes) | | | | | | | |

## Butcher (`butchery`)

`butcher` is a job (09); yields are computed from the species. No recipe rows.

## Kennel (`animal_training`)

`train_animal` and `tame_animal` are jobs (08). No recipe rows.

## Bowyer (`carpentry`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_bow` | Bow | 1 log | 1 bow (from_input; yew: power 1.10) | 180 | yes | 8 |
| `make_crossbow_wood` | Crossbow | 1 log | 1 crossbow (wood) | 220 | yes | 10 |
| `make_arrows_wood` | Wooden arrows | 1 log | 20 arrow (wood) | 80 | no | 4 |

## Recipe counts

Carpenter 26, mason 13, craftsdwarf 9, jeweler 2, mechanic 2, wood furnace 1, smelter (generated: 16 ores + 5 alloys + 1 melt), forge 41, kitchen 4, still 2, tannery 1, leatherworks 11, loom 2, clothier 8, farmer's workshop 4, bowyer 3. Total about 150.

## Time arithmetic

A level-6 carpenter (factor 148%) makes a bed in 150 × 100/148 ≈ 101 ticks, about five seconds at 1×; a legendary one in 58 ticks. A level-0 armorsmith needs 400 ticks for a breastplate; a level-12 one 205 ticks. Meals: a level-4 cook makes 4 easy meals in 91 ticks; twenty dwarves eat about 30 meals a day, which is 8 cooking jobs or 12 minutes of a cook's day.
