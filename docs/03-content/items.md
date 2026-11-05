# Items

**Owner:** content (`items`) · **Depends on:** [`../02-systems/13-items-and-storage.md`](../02-systems/13-items-and-storage.md), [materials.md](materials.md), [glyphs-and-colors.md](glyphs-and-colors.md)

Columns: `category` is the three-level path; `mult` is the value multiplier (`value = material value × mult × quality`); `stack` is the maximum stack size (1 = not stackable); `container` is the container class the type wants in a stockpile; `rotDays` 0 means it never rots; `weight` is the carry weight class used by 10 (`light` no penalty, `medium` slows children, `heavy` halves speed for anyone; density-derived for stone and logs); `glyph`/`fg` per [glyphs-and-colors.md](glyphs-and-colors.md) (`fg = material` means the material's color).

Weapons, ammunition and armor are in [weapons-and-armor.md](weapons-and-armor.md). The `figurine`, `ring` and `amulet` types carry the tag `craft`; the meal ingredient types carry `ingredient`. Recipe inputs and outputs can refer to these tags.

## Food

| id | name | category | mult | stack | container | rotDays | weight | glyph | fg | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `raw_meat` | raw meat | food/meat/raw | 1 | 10 | barrel | 6 | light | `%` | material | material `<species>_meat` |
| `raw_fish` | raw fish | food/fish/raw | 1 | 10 | barrel | 4 | light | `%` | material | material `<fish>_meat` |
| `plant_food` | plant | food/plant/raw | 1 | 20 | barrel | 20 | light | `%` | material | material = plant species; edible raw if the species says so |
| `flour` | flour | food/plant/processed | 1 | 20 | bag | 60 | light | `%` | `flour_white` | |
| `easy_meal` | easy meal | food/meal/easy | 10 | 10 | barrel | 14 | light | `%` | `meal_brown` | quality-bearing |
| `fine_meal` | fine meal | food/meal/fine | 25 | 10 | barrel | 14 | light | `%` | `meal_gold` | quality-bearing |
| `lavish_meal` | lavish meal | food/meal/lavish | 60 | 10 | barrel | 14 | light | `%` | `meal_red` | quality-bearing |
| `egg` | egg | food/egg | 1 | 10 | barrel | 12 | light | `o` | `egg_cream` | |
| `cheese` | cheese | food/cheese | 1 | 10 | barrel | 40 | light | `%` | `cheese_yellow` | |
| `milk` | milk | food/milk | 1 | 10 | barrel | 5 | light | `≈` | `milk_white` | liquid |
| `fat` | fat | food/fat | 1 | 10 | barrel | 6 | light | `%` | `tallow_yellow` | rendered to tallow |
| `tallow` | tallow | food/tallow | 1 | 20 | bin | 0 | light | `%` | `tallow_yellow` | trade good; candles are not in version 1 |

Raw meat, fish and plants are edible (`ate_raw_food` thought). Flour is not edible raw.

## Drink

| id | name | category | mult | stack | container | rotDays | glyph | fg |
|---|---|---|---|---|---|---|---|---|
| `drink` | drink | drink | 1 | 20 | barrel | 0 | `☼` | material |

One item type; the material (`ale`, `dimcap_ale`, `cavewheat_beer`, `bellwine`, `rootwine`, `strawberry_wine`, `hopped_ale`) gives name and value. `drink` is always inside a barrel; a unit is one drink. Categories for stockpile filters: `drink/ale` (ale, dimcap_ale, cavewheat_beer, hopped_ale), `drink/wine` (bellwine, rootwine, strawberry_wine).

## Seeds

| id | name | category | mult | stack | container | glyph | fg |
|---|---|---|---|---|---|---|---|
| `seed` | seed | seed | 1 | 50 | bag | `,` | material |

Material = plant species (`barley`, `dimcap` …). Value 1 × species value.

## Stone, ore, gems

| id | name | category | mult | stack | container | weight | glyph | fg |
|---|---|---|---|---|---|---|---|---|
| `raw_stone` | stone | stone/raw | 1 | 1 | none | heavy | `•` | material |
| `stone_block` | block | stone/block | 1.5 | 5 | none | medium | `▪` | material |
| `rough_gem` | rough gem | stone/gem_rough | 1 | 5 | bin | light | `*` | material |
| `cut_gem` | cut gem | stone/gem_cut | 3 | 5 | bin | light | `♦` | material |
| `ore` | ore | ore | 1 | 1 | none | heavy | `£` | material |

## Wood and bars

| id | name | category | mult | stack | container | weight | glyph | fg |
|---|---|---|---|---|---|---|---|---|
| `log` | log | wood/log | 1 | 1 | none | heavy | `≡` | material |
| `wood_block` | wooden block | wood/block | 1.5 | 5 | none | medium | `▪` | material |
| `bar` | bar | bar/metal | 1 | 5 | bin | medium | `▬` | material |
| `coal_bar` | coal | bar/coal | 1 | 5 | bin | medium | `▬` | `coal_black` |
| `charcoal_bar` | charcoal | bar/charcoal | 1 | 5 | bin | medium | `▬` | `charcoal_gray` |

## Furniture (items that become buildings when placed)

| id | name | category | mult | stack | weight | glyph | fg | materials allowed |
|---|---|---|---|---|---|---|---|---|
| `bed` | bed | furniture/bed | 5 | 1 | heavy | `Θ` | material | wood |
| `table` | table | furniture/table | 4 | 1 | heavy | `╥` | material | wood, stone, metal |
| `chair` | chair | furniture/chair | 3 | 1 | medium | `╫` | material | wood, stone, metal |
| `door` | door | furniture/door | 4 | 1 | heavy | `+` | material | wood, stone, metal |
| `hatch` | hatch | furniture/hatch | 4 | 1 | medium | `¤` | material | wood, stone, metal |
| `cabinet` | cabinet | furniture/cabinet | 6 | 1 | heavy | `π` | material | wood, stone, metal |
| `chest` | chest | furniture/chest | 5 | 1 | medium | `▄` | material | wood, stone, metal; also a container (20) |
| `coffin` | coffin | furniture/coffin | 6 | 1 | heavy | `▬` | material | wood, stone, metal |
| `statue` | statue | furniture/statue | 12 | 1 | heavy | `Ω` | material | stone, metal, glowstone |
| `cage` | cage | furniture/cage | 6 | 1 | medium | `▒` | material | wood, metal |
| `mechanism` | mechanism | furniture/mechanism | 5 | 1 | medium | `‼` | material | stone, metal |
| `floodgate` | floodgate | furniture/floodgate | 6 | 1 | heavy | `╪` | material | stone, metal |
| `anvil` | anvil | furniture/anvil | 15 | 1 | heavy | `Ξ` | material | iron, steel |
| `nest_box` | nest box | furniture/nest_box | 3 | 1 | medium | `∩` | material | wood, stone |
| `weapon_rack` | weapon rack | furniture/weapon_rack | 4 | 1 | medium | `╨` | material | wood, metal |
| `armor_stand` | armor stand | furniture/armor_stand | 4 | 1 | medium | `╧` | material | wood, metal |
| `memorial_slab` | memorial slab | furniture/memorial_slab | 8 | 1 | heavy | `╤` | material | stone |
| `archery_target` | archery target | furniture/archery_target | 2 | 1 | medium | `◙` | material | wood |
| `spike` | spike | furniture/trap_part | 4 | 5 | medium | `↑` | material | metal, wood (0.4) |
| `chain` | chain | furniture/chain | 4 | 1 | medium | `§` | material | metal |
| `rope` | rope | furniture/chain | 2 | 1 | light | `§` | material | cloth; equivalent to chain for buildings |

## Containers

| id | name | category | mult | capacity | weight | glyph | fg | materials |
|---|---|---|---|---|---|---|---|---|
| `barrel` | barrel | container/barrel | 3 | 20 units | heavy when full | `Ю` | material | wood, metal |
| `bag` | bag | container/bag | 2 | 25 | light | `ð` | material | cloth, leather |
| `bin` | bin | container/bin | 3 | 30 | heavy when full | `▐` | material | wood, metal |
| `bucket` | bucket | container/bucket | 2 | 1 | light | `u` | material | wood, metal |

## Tools

| id | name | category | mult | stack | weight | glyph | fg | materials | notes |
|---|---|---|---|---|---|---|---|---|---|
| `pick` | pick | tool/pick | 6 | 1 | medium | `¶` | material | metal (copper or better) | also a weapon of class `pick` |
| `axe` | axe | tool/axe | 8 | 1 | medium | `Ρ` | material | metal | also a weapon of class `axe` (the same item as the battle axe) |
| `fishing_rod` | fishing rod | tool/fishing_rod | 3 | 1 | light | `⌠` | material | wood | not required for fishing in version 1; trade good |
| `crutch` | crutch | tool/crutch | 3 | 1 | light | `⌡` | material | wood | |
| `splint` | splint | medical/splint | 2 | 5 | light | `‖` | material | wood | |
| `quiver` | quiver | tool/quiver | 3 | 1 | light | `∫` | material | leather | holds up to 50 ammunition |

## Crafts and gems

| id | name | category | mult | stack | glyph | fg | materials |
|---|---|---|---|---|---|---|---|
| `figurine` | figurine | craft/figurine | 3 | 5 | `♀` | material | stone, bone, wood, metal, shell |
| `ring` | ring | craft/ring | 2 | 5 | `○` | material | as figurine |
| `amulet` | amulet | craft/amulet | 3 | 5 | `♀` | material | as figurine |
| `mug` | mug | craft/mug | 2 | 5 | `∂` | material | stone, wood, metal |
| `totem` | totem | craft/totem | 5 | 1 | `♀` | material | skull |

## Textiles and animal parts

| id | name | category | mult | stack | container | rotDays | glyph | fg |
|---|---|---|---|---|---|---|---|---|
| `fiber` | fiber | textile/fiber | 1 | 10 | bin | 0 | `~` | material |
| `thread` | thread | textile/thread | 1 | 10 | bin | 0 | `~` | material |
| `cloth` | cloth | textile/cloth | 1 | 10 | bin | 0 | `≈` | material |
| `wool_raw` | wool | textile/wool | 1 | 10 | bin | 0 | `~` | `wool_cream` |
| `raw_hide` | raw hide | textile/hide | 1 | 5 | bin | 10 | `≈` | material |
| `leather_piece` | leather | textile/leather | 1 | 10 | bin | 0 | `≈` | `leather_brown` |
| `bone_pile` | bones | textile/bone | 1 | 10 | bin | 0 | `%` | `bone_white` |
| `shell_piece` | shell | textile/shell | 1 | 10 | bin | 0 | `%` | `shell_pink` |
| `skull` | skull | textile/skull | 1 | 1 | bin | 0 | `☻` | `bone_white` |

## Clothing

| id | name | category | slot | mult | glyph | fg | materials |
|---|---|---|---|---|---|---|---|
| `tunic` | tunic | clothing/body | body | 3 | `[` | material | cloth, leather |
| `trousers` | trousers | clothing/legs | legs | 3 | `[` | material | cloth, leather |
| `boots` | boots | clothing/feet | feet | 2 | `[` | material | leather, cloth |
| `cloak` | cloak | clothing/body | body (over) | 4 | `[` | material | wool cloth: halves cold injury; worn over a tunic |

## Medical and herbs

| id | name | category | mult | stack | container | rotDays | glyph | fg | tags |
|---|---|---|---|---|---|---|---|---|---|
| `brightleaf` | brightleaf | medical/brightleaf | 4 | 20 | bag | 60 | `♣` | `bright_green` | |
| `bandage` | bandage | medical/bandage | 1 | 20 | bin | 0 | `~` | `linen_cream` | |
| `glowcap` | glowcap | medical/glowcap | 1 | 20 | bag | 40 | `♠` | `rune_cyan` | |
| `rune_vial` | rune vial | medical/vial | 1 | 20 | bag | 0 | `¡` | `rune_cyan` | `rune_fuel` |
| `mending_draught` | draught of mending | medical/draught | 2 | 5 | bag | 0 | `!` | `bright_green` | `draught` |
| `stout_draught` | draught of stoutness | medical/draught | 2 | 5 | bag | 0 | `!` | `bell_white` | `draught` |
| `quick_draught` | draught of quickness | medical/draught | 2 | 5 | bag | 0 | `!` | `root_amber` | `draught` |
| `calm_draught` | calming draught | medical/draught | 2 | 5 | bag | 0 | `!` | `hops_green` | `draught` |
| `murky_draught` | murky draught | medical/draught | 0.07 | 5 | bag | 0 | `!` | `cave_umber` | `draught` |
| `wyrmscale` | wyrmscale | medical/wyrmscale | 1 | 10 | bag | 0 | `§` | `wyrm_red` | |
| `hollow_ichor` | hollow ichor | medical/ichor | 1 | 5 | bag | 0 | `¡` | `hollow_violet` | |
| `spider_venom` | spider venom | medical/venom | 1 | 5 | bag | 0 | `¡` | `lizard_green` | |
| `ember_gland` | ember gland | medical/gland | 1 | 10 | bag | 0 | `♥` | `ember_orange` | |
| `hollowsight_draught` | draught of hollowsight | medical/draught | 2 | 5 | bag | 0 | `!` | `hollow_violet` | `draught` |
| `wyrmblood_draught` | draught of wyrmblood | medical/draught | 2 | 5 | bag | 0 | `!` | `wyrm_red` | `draught` |

Bandages are cloth cut at the clothier (1 cloth → 4 bandages); `stop_bleeding` and `dress_burn` accept a bandage or a cloth.

Glowcap is its own item and not `plant_food`, because `plant_food` of any material is eaten and is an ingredient. So no dwarf eats a glowcap and no kitchen takes one. A rune vial holds the material `rune`.

Wyrmscale, hollow ichor, spider venom and the ember gland are not made: they are the remains of a dead magma wyrm (4 wyrmscale), of a dead hollow stalker or the Hollow Maw (1 ichor), of a dead giant cave spider (1 venom) and of a dead ember newt (1 gland), recovered from the corpse by `strip_corpse` ([creatures.md](creatures.md) § Remains). Each is made of the material that shares its id ([materials.md](materials.md) § Rune), so one is worth 80, 60, 20 and 25. Venom is set in a `venomed` weapon, and a gland in a weapon of embers in place of a garnet ([weapons-and-armor.md](weapons-and-armor.md) § Enchantments).

A draught holds the material `rune` of its vial, so a draught is worth 30 at common quality and a murky draught 1 (*unmeasured*). The brewed draughts bear quality, which scales how long they last; a murky draught bears none. A draught is not `drinkable`: no thirsty dwarf takes one.

## Draughts

What each draught does when drunk ([25](../02-systems/25-runecraft.md) § Draughts). An effect with a number is a timed effect of that value on the drinker, for `DRAUGHT_TICKS` times the draught's quality multiplier; `mend` bandages and closes wounds at once, as the Mend spell does; `ease` gives the thought `eased`, at half its value for a calming draught within 7 days of the last, with `dosed_again` beside it. The trigger says when it is drunk: `wounded` by a soldier on duty whose blood is below half when a hit lands, or given by a medic to a patient with a serious or grievous wound; `raid` by every soldier on duty when a raid, siege or ambush arrives; `miserable` given by a medic to a Miserable dwarf; `deep` by every soldier on duty when the Deep stirs or Hollow-born come up through the rock while the Deep is at level 2 or more; `fire` by a soldier on duty that a creature with a ranged fire attack (the magma wyrm's breath) comes near; `never` is the spoiled batch, after which the laboratory stinks for the day (`lab_stink`).

| id | effects | trigger |
|---|---|---|
| `mending_draught` | `mend`, `heal_rate` 200 | `wounded` |
| `stout_draught` | `pain_half` 1 | `raid` |
| `quick_draught` | `haste` 25 | `raid` |
| `calm_draught` | `ease` | `miserable` |
| `murky_draught` | — | `never` |
| `hollowsight_draught` | `spot_radius` 10 | `deep` |
| `wyrmblood_draught` | `fire_immune` 1 | `fire` |

## Refuse

| id | name | category | stack | rotDays | glyph | fg | notes |
|---|---|---|---|---|---|---|---|
| `corpse` | corpse | refuse/corpse | 1 | 14 | `%` | `corpse_red` | material = species meat material, or skull_bone for dwarves; carries worn items |
| `skeleton` | skeleton | refuse/skeleton | 1 | 0 | `%` | `bone_white` | from a rotted corpse; animal skeletons yield `bone_pile` when butchered |
| `rotten` | rotten food | refuse/rotten | 10 | 0 | `%` | `rot_green` | any food past rotting; destroyed at "gone" |

## Wagon

The wagon is a building (see [buildings-and-furniture.md](buildings-and-furniture.md)); it is not an item.

## Meal ingredients

Any item in `food/meat/raw`, `food/fish/raw`, `food/plant/raw` (species `cookable: true`), `food/egg`, `food/cheese`, `food/plant/processed`, `food/fat` is an ingredient. Meals inherit the quality roll of the cook; their names in the UI are generated as "{ingredient} {dish}" from the first ingredient ("turnip stew", "boar roast", "dimcap pie") using the dish word table in [names.md](names.md).

## Value examples

| Item | Computation | Marks |
|---|---|---|
| Common oak bed | 3 × 5 × 1.0 | 15 |
| Fine granite door | 2 × 4 × 1.5 | 12 |
| Masterwork steel breastplate | 40 × 20 × 5.0 (see weapons-and-armor) | 4,000 |
| Stack of 25 copper bolts | 10 × 0.2 × 25 | 50 |
| Barrel of 20 dimcap ale | 2 × 1 × 20 | 40 |
| Cut emerald | 40 × 3 | 120 |
| Deepsilver bar | 250 | 250 |
