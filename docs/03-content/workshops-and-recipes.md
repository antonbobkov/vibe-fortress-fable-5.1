# Workshops and Recipes

**Owner:** content (`workshops`, `recipes`) · **Depends on:** [`../02-systems/12-workshops-and-professions.md`](../02-systems/12-workshops-and-professions.md), [items.md](items.md), [minerals-and-metals.md](minerals-and-metals.md), [weapons-and-armor.md](weapons-and-armor.md)

## Workshops

All are 3×3. `inputs` to build; `fuel` whether its fuel recipes consume a fuel bar; `magma` whether a magma variant exists; `tags` any function tags.

| id | name | inputs | labor | ticks | fuel | magma | glyph pattern | tags |
|---|---|---|---|---|---|---|---|---|
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
| `bowyer` | bowyer's workshop | 2 `log` | carpentry | 200 | no | no | `bowyer` | |
| `alchemist` | laboratory | 1 `table` + 2 `stone_block` + 1 `bucket` | construction | 250 | no | no | `alchemist` | `rune_work` |
| `runeforge` | runeforge | 1 `anvil` + 3 `stone_block` + 1 `cut_gem` | masonry | 300 | no | no | `runeforge` | `rune_work` |

Magma variants require `MAGMA_POWER_LEVEL` magma directly below at least one footprint tile at build time and at every job start, and every input must be magma-safe (the anvil is iron or steel; blocks must be magma-safe stone or obsidian).

| id | name | variant of | inputs | labor | ticks |
|---|---|---|---|---|---|
| `magma_smelter` | magma smelter | `smelter` | 3 `stone_block` (magma-safe) | masonry | 350 |
| `magma_forge` | magma forge | `forge` | 1 `anvil` (iron or steel) + 3 `stone_block` (magma-safe) | masonry | 350 |
| `magma_kiln` | magma kiln | — | 3 `stone_block` (magma-safe) | masonry | 300; reserved for glass in a later version; it has no recipes, so it is not offered in the build menu |

A workshop that no recipe names and no job is worked at (`jobs.md`: the butcher's shop and the kennel have jobs and no recipes) is not offered in the build menu, and `PlaceBuilding` refuses it; the magma kiln is the one example. A kiln that an older save already holds loads and is shown, its panel reads "No recipes in this version.", and it can only be taken apart.

## Recipe columns

`inputs` as `count × (item | tag | class)` with material constraints in parentheses (a `fuel` input is fuel taken into the product, steel's carbon, on top of the fuel the job burns); `outputs` as `count × item (material source)`; `skill`; `ticks` base; `fuel`; `Q` quality-bearing; `xp`; `spoilable`, in a table that has the column, a batch a low-skill worker can spoil. `from_input` means the output takes the material of the first input; `container` means an empty container of that class is an input and holds the output. Parenthesised constraints are data: "(a or b)" and "(a, b)" list the allowed materials; "(brewable species)" and "(magma-safe metal)" name a material property; "(same material)" makes every unit of the input share one material; "(matching thread material)" and "(matching cloth material)" take the next stage of the input's material (`materials.md` § Cloth and fiber); a work order's material filter constrains only the input the first output takes its material from.

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
| `knap_dagger_obsidian` | Obsidian dagger | 1 raw_stone (obsidian) | 1 dagger (from_input) | 120 | yes | 6 |
| `knap_short_sword_obsidian` | Obsidian short sword | 2 raw_stone (obsidian) | 1 short_sword (from_input) | 180 | yes | 8 |
| `knap_dagger_bone` | Bone dagger | 1 bone_pile | 1 dagger (from_input) | 120 | yes | 6 |
| `knap_short_sword_bone` | Bone short sword | 2 bone_pile | 1 short_sword (from_input) | 180 | yes | 8 |
| `make_mug_horn` | Drinking horns | 1 horn | 3 mug (from_input) | 120 | yes | 6 |
| `craft_ivory` | Ivory crafts | 1 tusk | 2 craft (from_input) | 150 | yes | 8 |

The knapped blades are the primitive tier of the dagger and the short sword, for a fortress with no metal: obsidian cuts at 0.70 and bone at 0.50 of the blade's damage ([weapons-and-armor.md](weapons-and-armor.md) § Melee), made by a crafter with no forge and no fuel.

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

Generated per ore and alloy (see [minerals-and-metals.md](minerals-and-metals.md)). Base: `smelt_*` 150 ticks, xp 6; `alloy_*` 200 ticks, xp 8; `melt_metal_item` 120 ticks, xp 3. `smelt_bituminous_coal` and `smelt_lignite` have `fuel: false`. Authored beside them, with fuel and no quality as the alloys:

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_steel_shell` | Steel (shell flux) | 1 bar (iron) + 3 shell_piece + 1 fuel | 1 bar (steel) | 200 | no | 8 |

Shells of any shell material (`chitin` included) stand in for `alloy_steel`'s flux stone, three for one: a substitute ([12](../02-systems/12-workshops-and-professions.md) § Substitutes).

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
| `crush_halite` | Crush rock salt | 1 ore (halite) | 5 salt (`salt`) | 60 | no | 3 |

Ingredients: the items tagged `ingredient` ([items.md](items.md) § Meal ingredients), which leaves out meals, tallow and milk. Each recipe consumes one unit from each input stack.

## Still (`brewing`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `brew` | Brew drink | 4 plant_food (brewable species) + container barrel | 20 drink (species' drink material) in the barrel | 200 | no | 8 |
| `brew_hopped` | Brew hopped ale | 4 plant_food (barley) + 1 plant_food (hops) + container barrel | 20 drink (hopped_ale) | 220 | no | 10 |

## Laboratory (`alchemy`)

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `distill_rune` | Distill rune | 2 glowcap | 1 rune_vial (rune) | 150 | no | 6 |
| `grind_glowstone` | Grind glowstone | 1 rough_gem (glowstone) | 4 rune_vial (rune) | 200 | no | 8 |
| `quench_deepsilver` | Quench deepsilver | 1 bar (deepsilver) | 12 rune_vial (rune) | 250 | no | 12 |
| `render_ichor` | Render ichor | 1 hollow_ichor | 6 rune_vial (rune) | 200 | no | 10 |

One lamp over eight tiles grows 0.83 glowcap a day, which is 0.42 vials a day (*unmeasured*). A year is 112 days, so four lamps give 1.7 vials a day and 190 a year.

Quenching a deepsilver bar wakes the Hollow as mining a tile of it does ([25](../02-systems/25-runecraft.md) § Deepsilver).

### Draughts

Each brews two draughts ([items.md](items.md) § Draughts). `spoilable`: an alchemist below level 10 can spoil the batch, and every output is then a murky draught ([12](../02-systems/12-workshops-and-professions.md) § Operation).

| id | name | inputs | outputs | ticks | Q | xp | spoilable |
|---|---|---|---|---|---|---|---|
| `brew_mending_draught` | Brew draught of mending | 1 rune_vial + 2 brightleaf | 2 mending_draught | 150 | yes | 8 | yes |
| `brew_stout_draught` | Brew draught of stoutness | 1 rune_vial + 2 plant_food (pale_bell) | 2 stout_draught | 150 | yes | 8 | yes |
| `brew_quick_draught` | Brew draught of quickness | 1 rune_vial + 2 plant_food (sweetroot) | 2 quick_draught | 150 | yes | 8 | yes |
| `brew_calm_draught` | Brew calming draught | 1 rune_vial + 2 plant_food (hops) | 2 calm_draught | 150 | yes | 8 | yes |
| `brew_hollowsight_draught` | Brew draught of hollowsight | 1 rune_vial + 1 hollow_ichor | 2 hollowsight_draught | 150 | yes | 8 | yes |
| `brew_wyrmblood_draught` | Brew draught of wyrmblood | 1 rune_vial + 1 wyrmscale | 2 wyrmblood_draught | 150 | yes | 8 | yes |

## Runeforge (`runesmithing`)

No fuel. Authored:

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_rune_robe` | Runed robe | 3 cloth (sporecloth_cloth) + 2 rune_vial | 1 rune_robe (from_input) | 250 | yes | 12 |
| `make_circlet` | Circlet | 1 bar (silver, gold, electrum, platinum or deepsilver) + 1 cut_gem + 2 rune_vial | 1 circlet (from_input) | 220 | yes | 10 |

Generated per row of `spells` ([weapons-and-armor.md](weapons-and-armor.md) § Spells): `make_wand_<stone>` is 1 log + 1 cut_gem (the stone) → 1 wand of the log's wood, 200 ticks, `Q` yes, xp 10; `make_staff_<stone>` is 1 log + 1 cut_gem (the stone) + 1 bar → 1 staff of the bar's metal, 300 ticks, `Q` yes, xp 12. The output's stone is the gem's material. A work order's material filter picks the wand's wood and the staff's metal.

Generated per row of `enchants` ([weapons-and-armor.md](weapons-and-armor.md) § Enchantments): `set_<slot>_<enchant>` sets the row's stone in an item, `Q` yes. It is a transform recipe: it has no outputs, input 0 is kept and gains the enchantment, and an order for it is `once` only ([12-workshops-and-professions.md](../02-systems/12-workshops-and-professions.md) § Work orders). Its name is the slot's word with the row's suffix ("Keen weapon", "Ammunition of rime"); a row whose slot and suffix an earlier row in the table already has adds its stone in brackets, with spaces for underscores ("Weapon of embers (ember gland)").

| slot | input 0, kept | then | ticks | xp |
|---|---|---|---|---|
| weapon | 1 of every melee weapon type (`weapons` rows with no launcher that are not for training), as alternatives | the stone + the row's vials in rune_vial | 300 | 15 |
| armor | 1 of every `armor` row with a layer (of the row's `only` slot when it has one), as alternatives | the same | 300 | 15 |
| ammo | 25 of bolt or arrow (units) | the same | 200 | 10 |

The stone is 1 cut_gem of a gem material, 1 bar of a metal (`deep`: a deepsilver bar) and 1 of the item for an item id (`wyrmscale`, `hollow_ichor`, `spider_venom`, `ember_gland`).

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
| `spin_thread` | Spin thread | 1 fiber or 1 wool_raw (flax_fiber, sporecloth_fiber, wool) | 1 thread (matching thread material) | 80 | no | 4 |
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

Carpenter 27, mason 13, craftsdwarf 15, jeweler 2, mechanic 2, wood furnace 1, smelter (generated: 17 ores + 6 alloys + 1 melt = 24; authored 1), forge 40, kitchen 5, still 2, tannery 1, leatherworks 11, loom 2, clothier 8, farmer's workshop 4, bowyer 3, laboratory 10 (6 of them draughts), runeforge 2 (and generated: 2 per spell = 16, and 1 per enchantment = 22). Total 211.

## Time arithmetic

A level-6 carpenter (factor 148%) makes a bed in 150 × 100/148 ≈ 101 ticks, about five seconds at 1×; a legendary one in 58 ticks. A level-0 armorsmith needs 400 ticks for a breastplate; a level-12 one 205 ticks. Meals: a level-4 cook makes 4 easy meals in 91 ticks; twenty dwarves eat about 30 meals a day, which is 8 cooking jobs or 12 minutes of a cook's day.

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. Each names the task that adds it: that task moves the row into its workshop's table above (in that table's columns, without `workshop`, `substitute for` and `task`; a new workshop gets its own section and its line in `RECIPE_SECTIONS`), adds its line to [row-order.md](row-order.md) and runs `npm run content:export`. The rules are in [12](../02-systems/12-workshops-and-professions.md) § Planned. Every number is *unmeasured*. *Substitute for* names the regular recipe a substitute must stay worse than (12 § Planned, Substitutes are worse).

### Planned workshops

| id | name | inputs | labor | ticks | fuel | magma | glyph pattern | tags | task |
|---|---|---|---|---|---|---|---|---|---|
| `kiln` | kiln | 3 `stone_block` | masonry | 250 | yes | `magma_kiln` | `kiln` | | T-553 |
| `smokehouse` | smokehouse | 3 `stone_block` | masonry | 250 | yes | no | `smokehouse` | | T-552 |

Edits: `magma_kiln` becomes the magma variant of `kiln` (`variant of` `kiln`), with the kiln's recipes; its note "reserved for glass in a later version" goes, and so does the paragraph on a workshop with no recipes for it (T-553). `carpenter` gains the tag `logs_only`: every other workshop may be built of blocks in place of logs (14 § Planned, Workshops of stone) (T-549).

### Planned recipes

| workshop | id | name | inputs | outputs | ticks | fuel | Q | xp | substitute for | task |
|---|---|---|---|---|---|---|---|---|---|---|
| smelter | `make_steel_bone_ash` | Steel (bone ash flux) | 1 bar (iron) + 1 bone_ash + 1 fuel | 1 bar (steel) | 200 | yes | no | 8 | `alloy_steel` | T-553 |
| loom | `spin_coarse_thread` | Spin coarse thread | 2 fiber or reed (reed, cactus_fiber, nettle_fiber; same material) | 1 thread (matching thread material) | 100 | no | no | 4 | `spin_thread` | T-549 |
| craftsdwarf | `weave_basket` | Basket | 3 reed | 1 basket (from_input) | 100 | no | no | 4 | `make_bin` | T-549 |
| craftsdwarf | `twist_reed_rope` | Reed rope | 3 reed | 1 rope (from_input) | 80 | no | no | 3 | `make_rope` | T-549 |
| leatherworks | `cut_leather_rope` | Leather rope | 2 leather_piece | 1 rope (from_input) | 80 | no | no | 3 | `make_rope` | T-549 |
| craftsdwarf | `weave_wicker_shield` | Wicker buckler | 3 reed | 1 buckler (from_input) | 120 | no | yes | 5 | `make_buckler_wood` | T-549 |
| craftsdwarf | `make_splint_bone` | Bone splints | 1 bone_pile | 2 splint (from_input) | 80 | no | no | 4 | `make_splint` | T-549 |
| craftsdwarf | `make_crutch_bone` | Bone crutch | 2 bone_pile | 1 crutch (from_input) | 100 | no | no | 4 | `make_crutch` | T-549 |
| forge | `forge_crutch` | Metal crutch | 1 bar | 1 crutch | 120 | yes | no | 4 | `make_crutch` | T-549 |
| leatherworks | `make_scale_shirt` | Scale shirt | 3 shell_piece or bone_pile or horn (same material) + 1 leather_piece or cloth | 1 scale_shirt (from_input) | 330 | no | yes | 12 | — | T-562 |
| leatherworks | `make_scale_skirt` | Scale skirt | 2 shell_piece or bone_pile or horn (same material) + 1 leather_piece or cloth | 1 scale_skirt (from_input) | 270 | no | yes | 10 | — | T-562 |
| bowyer | `make_horn_bow` | Horn bow | 1 log + 1 horn | 1 horn_bow (from_input) | 220 | no | yes | 9 | `make_bow` | T-562 |
| mason | `make_stone_bed` | Stone bed | 1 raw_stone + 2 cloth or wool_raw | 1 stone_bed (from_input) | 120 | no | no | 5 | `make_bed` | T-551 |
| mason | `make_stone_bed_straw` | Stone bed (straw) | 1 raw_stone + 3 fiber or straw or reed | 1 stone_bed (from_input) | 120 | no | no | 5 | `make_bed` | T-551 |
| clothier | `make_bedding` | Bedding | 2 cloth + 2 straw or wool_raw or feather (same material) | 1 bedding (from_input) | 150 | no | yes | 6 | — | T-551 |
| clothier | `make_pillow` | Pillow | 1 cloth + 1 straw or wool_raw or feather | 1 pillow (from_input) | 80 | no | yes | 4 | — | T-551 |
| smokehouse | `smoke_meat` | Smoke meat | 5 raw_meat (same material) | 5 cured_meat (from_input) | 150 | yes | no | 6 | — | T-552 |
| smokehouse | `smoke_fish` | Smoke fish | 5 raw_fish (same material) | 5 cured_fish (from_input) | 150 | yes | no | 6 | — | T-552 |
| kitchen | `salt_meat` | Salt meat | 5 raw_meat (same material) + 1 salt | 5 cured_meat (from_input) | 100 | no | no | 5 | — | T-552 |
| kitchen | `salt_fish` | Salt fish | 5 raw_fish (same material) + 1 salt | 5 cured_fish (from_input) | 100 | no | no | 5 | — | T-552 |
| kiln | `fire_bricks` | Bricks | 1 soil_load (clay) | 1 stone_block (brick) | 80 | yes | no | 4 | `make_stone_block` | T-553 |
| kiln | `make_pot` | Pot | 1 soil_load (clay) | 1 pot (earthenware) | 100 | yes | no | 4 | `make_barrel` | T-553 |
| kiln | `make_jug` | Clay jug | 1 soil_load (clay) | 1 bucket (earthenware) | 80 | yes | no | 4 | `make_bucket` | T-553 |
| kiln | `make_mugs_clay` | Clay mugs | 1 soil_load (clay) | 3 mug (earthenware) | 120 | yes | yes | 6 | `make_mug_stone` | T-553 |
| kiln | `make_glass_block` | Glass block | 2 soil_load (sand) | 1 stone_block (glass) | 150 | yes | no | 6 | — | T-553 |
| kiln | `make_glass_block_potash` | Glass blocks (potash) | 2 soil_load (sand) + 1 potash | 2 stone_block (glass) | 200 | yes | no | 8 | — | T-553 |
| kiln | `make_mugs_glass` | Glass mugs | 1 stone_block (glass) | 3 mug (glass) | 120 | yes | yes | 6 | — | T-553 |
| kiln | `burn_potash` | Potash | 1 log | 2 potash | 80 | yes | no | 3 | — | T-553 |
| kiln | `burn_bone_ash` | Bone ash | 2 bone_pile | 1 bone_ash | 80 | yes | no | 3 | — | T-553 |
| kiln | `crush_fossil` | Crush fossil | 1 fossil | 2 bone_ash | 100 | yes | no | 4 | — | T-553 |
| still | `distill` | Distil spirits | 20 drink (ale or wine group; same material) + container barrel | 10 drink (deepfire) in the barrel | 250 | yes | no | 10 | — | T-554 |
| carpenter | `make_hive_wood` | Beehive | 1 log | 1 beehive (from_input) | 100 | no | no | 4 | — | T-555 |
| kiln | `make_hive_clay` | Clay beehive | 1 soil_load (clay) | 1 beehive (earthenware) | 100 | yes | no | 4 | `make_hive_wood` | T-555 |
| craftsdwarf | `weave_hive` | Wicker beehive | 3 reed | 1 beehive (from_input) | 100 | no | no | 4 | `make_hive_wood` | T-555 |
| farmer's workshop | `press_honeycomb` | Press honeycomb | 1 honeycomb | 1 honey + 1 beeswax | 80 | no | no | 4 | — | T-555 |
| still | `brew_mead` | Brew mead | 4 honey + container barrel | 20 drink (mead) in the barrel | 200 | no | no | 8 | — | T-555 |
| craftsdwarf | `make_candles_wax` | Wax candles | 1 beeswax | 4 candle (from_input) | 80 | no | no | 3 | — | T-555 |
| craftsdwarf | `make_candles_tallow` | Tallow candles | 1 tallow | 4 candle (from_input) | 80 | no | no | 3 | — | T-563 |
| kiln | `make_lantern` | Lantern | 1 stone_block (glass) + 1 candle | 1 lantern (from_input) | 150 | yes | yes | 8 | — | T-563 |
| mason | `cut_bone_blocks` | Bone blocks | 1 fossil | 2 stone_block (from_input) | 80 | no | no | 3 | `make_stone_block` | T-557 |
| mason | `make_table_bone` | Bone table | 1 fossil | 1 table (from_input) | 150 | no | yes | 6 | — | T-557 |
| mason | `make_chair_bone` | Bone chair (a throne) | 1 fossil | 1 chair (from_input) | 120 | no | yes | 6 | — | T-557 |
| mason | `make_door_bone` | Bone door | 1 fossil | 1 door (from_input) | 150 | no | yes | 6 | — | T-557 |
| mason | `make_coffin_bone` | Bone coffin | 2 fossil | 1 coffin (from_input) | 200 | no | yes | 6 | — | T-557 |
| mason | `make_statue_bone` | Bone statue | 3 fossil | 1 statue (from_input) | 400 | no | yes | 15 | — | T-557 |
| mason | `mount_skull` | Mount the skull | 1 giant_skull | 1 statue (from_input) | 300 | no | yes | 15 | — | T-557 |
| craftsdwarf | `carve_fossil` | Carve fossil | 1 fossil | 1 figurine (from_input) | 150 | no | yes | 8 | — | T-557 |
| craftsdwarf | `carve_ivory_statue` | Ivory statue | 3 tusk | 1 statue (from_input) | 400 | no | yes | 15 | — | T-557 |
| craftsdwarf | `make_firebrand` | Firebrands | 1 log or bone_pile + 1 tallow or beeswax | 2 firebrand (from_input) | 60 | no | no | 2 | — | T-559 |
| kitchen | `make_soap` | Soap | 1 tallow + 1 potash | 2 soap | 100 | no | no | 4 | — | T-564 |
| kitchen | `cook_feast` | Feast | 6 ingredient (distinct stacks) + 1 salt or honey or plant_food (wyrmtongue) | 1 feast (20 servings) | 400 | no | yes | 20 | — | T-565 |

The kiln's skill is `pottery`, the smokehouse's `cooking`. The fletching recipe `set_ammo_fletched` is generated at the bowyer from the `fletched` enchantment ([weapons-and-armor.md](weapons-and-armor.md) § Planned rows). Silk needs no recipe: `weave_cloth` takes 2 `silk_web` thread to 1 `silk_cloth` by the new stage (T-556).

A substitute pair the check reads: a brick is 1 clay load + a fuel and a job for 1 block against 1 stone for 2; a pot holds 10 against a barrel's 20 for the same input and a fuel; a basket 3 reeds for 15 against a log for 30; a bone splint 1 bone for 2 against a log for 4; coarse thread 2 fiber against 1.
