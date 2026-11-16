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
| `tallow` | tallow | food/tallow | 1 | 20 | bin | 0 | light | `%` | `tallow_yellow` | trade good; made into candles |
| `salt` | salt | food/salt | 1 | 20 | bag | 0 | light | `:` | `salt_white` | material `salt`; a meal ingredient |
| `cured_meat` | cured meat | food/meat/cured | 2 | 10 | barrel | 0 | light | `%` | material | material `<species>_meat`; smoked, salted or dried: never rots |
| `cured_fish` | cured fish | food/fish/cured | 2 | 10 | barrel | 0 | light | `%` | material | material `<fish>_meat`; smoked, salted or dried: never rots |
| `honeycomb` | honeycomb | food/honeycomb | 1 | 10 | barrel | 0 | light | `#` | `honey_amber` | material `honey`; pressed to honey and beeswax |
| `honey` | honey | food/honey | 1 | 20 | barrel | 0 | light | `≈` | `honey_amber` | material `honey`; a meal ingredient; brews mead; a wound dressing |
| `beeswax` | beeswax | food/wax | 1 | 20 | bin | 0 | light | `%` | `wax_yellow` | material `beeswax`; not edible |

Raw meat, fish and plants are edible (`ate_raw_food` thought), and so are honey and a honeycomb. Flour, salt and beeswax are not edible raw. Cured meat and fish are worth twice their raw form and never rot ([13](../02-systems/13-items-and-storage.md) § Curing); they are eaten as raw meat is, and cook as it does. An item of a cured or salted form names itself so: "cured boar meat", "salted boar hide".

## Drink

| id | name | category | mult | stack | container | rotDays | glyph | fg |
|---|---|---|---|---|---|---|---|---|
| `drink` | drink | drink | 1 | 20 | barrel | 0 | `☼` | material |

One item type; the material (`ale`, `dimcap_ale`, `cavewheat_beer`, `bellwine`, `rootwine`, `strawberry_wine`, `hopped_ale`, `black_ale`, `cactus_wine`, `emberwine`, `mead`, `deepfire`) gives name and value. `drink` is always inside a barrel; a unit is one drink. Categories for stockpile filters: `drink/ale` (ale, dimcap_ale, cavewheat_beer, hopped_ale, black_ale), `drink/wine` (bellwine, rootwine, strawberry_wine, cactus_wine, emberwine, mead), `drink/spirits` (deepfire). A drink aged in a cellar names its stage before its material: "a barrel of aged bellwine", "vintage deepfire"; so does a cheese, "a wheel of vintage cheese" ([13](../02-systems/13-items-and-storage.md) § Aging in a cellar).

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
| `soil_load` | load | stone/soil | 1 | 5 | none | medium | `≈` | material |
| `fossil` | fossil | stone/fossil | 1 | 1 | none | heavy | `•` | material |
| `giant_skull` | giant skull | textile/skull | 10 | 1 | none | heavy | `☻` | `bone_white` |

A `soil_load` is a load of dug soil, of its tile's material (`clay`, `sand` or `peat`: the soils tagged `soil_drop`). A `fossil` is a dug tile of class `bone`, of its material (`giant_bone`) ([03](../02-systems/03-terrain-and-mining.md) § Tile transitions); a dug tusk of a tundra boneyard's skull, of `ivory`, drops a `tusk`. A `giant_skull`, of `giant_bone`, drops once from the last dug tile of a boneyard's skull, beside its fossil; the mason mounts it as a statue (`mount_skull`), and no merchant buys or sells one.

## Wood and bars

| id | name | category | mult | stack | container | weight | glyph | fg | tags |
|---|---|---|---|---|---|---|---|---|---|
| `log` | log | wood/log | 1 | 1 | none | heavy | `≡` | material | |
| `wood_block` | wooden block | wood/block | 1.5 | 5 | none | medium | `▪` | material | |
| `bar` | bar | bar/metal | 1 | 5 | bin | medium | `▬` | material | |
| `coal_bar` | coal | bar/coal | 1 | 5 | bin | medium | `▬` | `coal_black` | |
| `charcoal_bar` | charcoal | bar/charcoal | 1 | 5 | bin | medium | `▬` | `charcoal_gray` | |
| `peat_brick` | peat brick | bar/peat | 1 | 5 | bin | medium | `▬` | `peat_black` | `fuel_half`, `smoky` |
| `dung_cake` | dung cake | bar/dung | 1 | 5 | bin | medium | `▬` | `dung_brown` | `fuel_half`, `smoky` |

Coal and charcoal carry the tag `fuel`. A peat brick (of `peat`, a peat load dried on a rack) and a dung cake (of `dung`, three dung dried) are half fuels: a fuel job burns two of them in place of one bar, and their smoke fills the hall ([12](../02-systems/12-workshops-and-professions.md) § Fuel, [05](../02-systems/05-materials-and-temperature.md) § Smoke).

## Furniture (items that become buildings when placed)

| id | name | category | mult | stack | weight | glyph | fg | materials allowed | tags |
|---|---|---|---|---|---|---|---|---|---|
| `bed` | bed | furniture/bed | 5 | 1 | heavy | `Θ` | material | wood | — |
| `table` | table | furniture/table | 4 | 1 | heavy | `╥` | material | wood, stone, metal, bone | — |
| `chair` | chair | furniture/chair | 3 | 1 | medium | `╫` | material | wood, stone, metal, bone | — |
| `door` | door | furniture/door | 4 | 1 | heavy | `+` | material | wood, stone, metal, bone | — |
| `hatch` | hatch | furniture/hatch | 4 | 1 | medium | `¤` | material | wood, stone, metal | — |
| `cabinet` | cabinet | furniture/cabinet | 6 | 1 | heavy | `π` | material | wood, stone, metal | — |
| `chest` | chest | furniture/chest | 5 | 1 | medium | `▄` | material | wood, stone, metal; also a container (20) | — |
| `coffin` | coffin | furniture/coffin | 6 | 1 | heavy | `▬` | material | wood, stone, metal, bone | — |
| `statue` | statue | furniture/statue | 12 | 1 | heavy | `Ω` | material | stone, metal, glowstone, bone | — |
| `cage` | cage | furniture/cage | 6 | 1 | medium | `▒` | material | wood, metal | — |
| `mechanism` | mechanism | furniture/mechanism | 5 | 1 | medium | `‼` | material | stone, metal | — |
| `floodgate` | floodgate | furniture/floodgate | 6 | 1 | heavy | `╪` | material | stone, metal | — |
| `anvil` | anvil | furniture/anvil | 15 | 1 | heavy | `Ξ` | material | iron, steel | — |
| `nest_box` | nest box | furniture/nest_box | 3 | 1 | medium | `∩` | material | wood, stone | — |
| `weapon_rack` | weapon rack | furniture/weapon_rack | 4 | 1 | medium | `╨` | material | wood, metal | — |
| `armor_stand` | armor stand | furniture/armor_stand | 4 | 1 | medium | `╧` | material | wood, metal | — |
| `memorial_slab` | memorial slab | furniture/memorial_slab | 8 | 1 | heavy | `╤` | material | stone | — |
| `archery_target` | archery target | furniture/archery_target | 2 | 1 | medium | `◙` | material | wood | — |
| `spike` | spike | furniture/trap_part | 4 | 5 | medium | `↑` | material | metal, wood (0.4) | — |
| `chain` | chain | furniture/chain | 4 | 1 | medium | `§` | material | metal | — |
| `rope` | rope | furniture/chain | 2 | 1 | light | `§` | material | cloth, plant (reed), leather; equivalent to chain for buildings | — |
| `stone_bed` | stone bed | furniture/stone_bed | 2 | 1 | heavy | `Θ` | material | stone | — |
| `bedding` | bedding | furniture/bedding | 4 | 1 | medium | `≈` | material | cloth; records its stuffing | `stuffed` |
| `pillow` | pillow | furniture/pillow | 2 | 1 | light | `≈` | material | cloth; records its stuffing | `stuffed` |
| `beehive` | beehive | furniture/beehive | 3 | 1 | medium | `∩` | material | wood, stone (earthenware), plant (reed) | — |
| `lantern` | lantern | furniture/lantern | 6 | 1 | medium | `¥` | material | glass | — |

An item tagged `stuffed` records its stuffing, the material of its last input (`Item.stuffing`, [12](../02-systems/12-workshops-and-professions.md) § Operation); a stuffed item whose stuffing is `feather` is worth its type's `mult` × 2 ([13](../02-systems/13-items-and-storage.md) § Value). A built bed holds a bedding and a pillow ([14](../02-systems/14-buildings-and-rooms.md) § Beds).

## Containers

| id | name | category | mult | capacity | weight | glyph | fg | materials |
|---|---|---|---|---|---|---|---|---|
| `barrel` | barrel | container/barrel | 3 | 20 units | heavy when full | `Ю` | material | wood, metal |
| `bag` | bag | container/bag | 2 | 25 | light | `ð` | material | cloth, leather |
| `bin` | bin | container/bin | 3 | 30 | heavy when full | `▐` | material | wood, metal |
| `bucket` | bucket | container/bucket | 2 | 1 | light | `u` | material | wood, metal, stone (earthenware: a clay jug, which breaks as a pot does) |
| `pot` | pot | container/pot | 2 | 10 units (class barrel) | heavy when full | `Ö` | material | stone (earthenware); breaks when its carrier is hit |
| `basket` | basket | container/basket | 2 | 15 (class bin) | heavy when full | `▐` | material | plant (reed); burns |

A pot is a container of class `barrel` that holds 10 units: a stockpile that wants barrels takes pots too, and a brew into a pot makes 10 drinks ([13](../02-systems/13-items-and-storage.md) § Containers in play). Fired clay is `earthenware`, a `fragile` material: a pot or a clay jug carried by a creature that is hit breaks ([16](../02-systems/16-combat.md) § Pots break).

A basket is a container of class `bin` that holds 15 items, woven of reeds at the craftsdwarf's workshop: a stockpile that wants bins takes baskets too ([13](../02-systems/13-items-and-storage.md) § Containers in play). It is of `reed` and burns.

## Tools

| id | name | category | mult | stack | container | weight | glyph | fg | materials | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `pick` | pick | tool/pick | 6 | 1 | — | medium | `¶` | material | metal (copper or better) | also a weapon of class `pick` |
| `axe` | axe | tool/axe | 8 | 1 | — | medium | `Ρ` | material | metal | also a weapon of class `axe` (the same item as the battle axe) |
| `fishing_rod` | fishing rod | tool/fishing_rod | 3 | 1 | — | light | `⌠` | material | wood | not required for fishing in version 1; trade good |
| `crutch` | crutch | tool/crutch | 3 | 1 | — | light | `⌡` | material | wood, bone, metal | |
| `splint` | splint | medical/splint | 2 | 5 | — | light | `‖` | material | wood, bone, metal | |
| `quiver` | quiver | tool/quiver | 3 | 1 | — | light | `∫` | material | leather | holds up to 50 ammunition |
| `candle` | candle | tool/candle | 1 | 10 | bin | light | `ì` | material | liquid (tallow, beeswax) | burns in a candle stand: tallow 7 days, beeswax 14 ([14](../02-systems/14-buildings-and-rooms.md) § Candle stands and lanterns) |

## Crafts and gems

| id | name | category | mult | stack | glyph | fg | materials |
|---|---|---|---|---|---|---|---|
| `figurine` | figurine | craft/figurine | 3 | 5 | `♀` | material | stone, bone, wood, metal, shell |
| `ring` | ring | craft/ring | 2 | 5 | `○` | material | as figurine |
| `amulet` | amulet | craft/amulet | 3 | 5 | `♀` | material | as figurine |
| `mug` | mug | craft/mug | 2 | 5 | `∂` | material | stone, wood, metal, bone (horn), glass |
| `totem` | totem | craft/totem | 5 | 1 | `♀` | material | skull |

## Textiles and animal parts

| id | name | category | mult | stack | container | rotDays | weight | glyph | fg | tags |
|---|---|---|---|---|---|---|---|---|---|---|
| `fiber` | fiber | textile/fiber | 1 | 10 | bin | 0 | | `~` | material | |
| `thread` | thread | textile/thread | 1 | 10 | bin | 0 | | `~` | material | |
| `cloth` | cloth | textile/cloth | 1 | 10 | bin | 0 | | `≈` | material | |
| `wool_raw` | wool | textile/wool | 1 | 10 | bin | 0 | | `~` | `wool_cream` | |
| `raw_hide` | raw hide | textile/hide | 1 | 5 | bin | 10 | | `≈` | material | |
| `leather_piece` | leather | textile/leather | 1 | 10 | bin | 0 | | `≈` | `leather_brown` | |
| `bone_pile` | bones | textile/bone | 1 | 10 | bin | 0 | | `%` | `bone_white` | |
| `shell_piece` | shell | textile/shell | 1 | 10 | bin | 0 | | `%` | `shell_pink` | |
| `skull` | skull | textile/skull | 1 | 1 | bin | 0 | | `☻` | `bone_white` | |
| `horn` | horn | textile/horn | 1 | 10 | bin | 0 | light | `%` | `horn_gray` | |
| `tusk` | tusk | textile/tusk | 1 | 5 | bin | 0 | medium | `(` | `ivory_cream` | |
| `feather` | feather | textile/feather | 1 | 20 | bin | 0 | light | `'` | `feather_white` | `stuffing` |
| `straw` | straw | textile/straw | 1 | 10 | bin | 0 | | `"` | material | `stuffing` |
| `reed` | reed | textile/reed | 1 | 10 | bin | 0 | | `\|` | `reed_green` | |
| `salted_hide` | salted hide | textile/hide | 1 | 5 | bin | 0 | light | `≈` | material | |

A `horn` is of `horn`, a `tusk` of `ivory`, a `feather` of `feather`: the butcher parts of [creatures.md](creatures.md) § Butcher parts. A `salted_hide` keeps its raw hide's material: a hide salted on a drying rack, which never rots and tans as a raw hide does.

`straw` is dropped by a grain harvest in its crop's material (`plants.md` § Surface crops, `straw`); `reed` is gathered from reed beds, of `reed`. The tag `stuffing` marks what fills a bed or a pallet.

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

## Farm goods

| id | name | category | mult | stack | container | rotDays | weight | glyph | fg | tags |
|---|---|---|---|---|---|---|---|---|---|---|
| `bone_ash` | bone ash | farm/bone_ash | 1 | 10 | bag | 0 | light | `:` | `bone_white` | `fertilizer`, `flux` |
| `potash` | potash | farm/potash | 1 | 10 | bag | 0 | light | `:` | `ash_gray` | |
| `dung` | dung | farm/dung | 1 | 10 | bag | 0 | light | `%` | `dung_brown` | `fertilizer` |

Bone ash and potash are burned at the kiln: bone ash, of `bone`, from bone piles or a crushed fossil; potash, of `potash`, from a log. Bone ash stands in for the flux stone in steel (`make_steel_bone_ash`); potash doubles a glass batch. Dung, of `dung`, is dropped by pastured grazers ([08](../02-systems/08-animals-and-domestication.md) § Dung); three of it dry to a dung cake on a rack.

## Drying

What a drying rack turns its items into ([14](../02-systems/14-buildings-and-rooms.md) § The drying rack). `count` units are dried together; `with` is a second input held on the same rack and consumed with them. Days are under a roof; outdoors a clear day counts twice and a wet one not at all.

| id | input | count | with | output | days |
|---|---|---|---|---|---|
| `dry_peat` | `soil_load` (peat) | 1 | — | 1 `peat_brick` | 7 |
| `dry_dung` | `dung` | 3 | — | 1 `dung_cake` | 7 |
| `dry_fish` | `raw_fish` | 1 | — | 1 `cured_fish` (its material) | 5 |
| `dry_meat` | `raw_meat` | 1 | — | 1 `cured_meat` (its material) | 7 |
| `salt_hide` | `raw_hide` | 1 | 1 `salt` | 1 `salted_hide` (its material) | 5 |

## Refuse

| id | name | category | stack | rotDays | glyph | fg | notes |
|---|---|---|---|---|---|---|---|
| `corpse` | corpse | refuse/corpse | 1 | 14 | `%` | `corpse_red` | material = species meat material, or skull_bone for dwarves; carries worn items |
| `skeleton` | skeleton | refuse/skeleton | 1 | 0 | `%` | `bone_white` | from a rotted corpse; animal skeletons yield `bone_pile` when butchered |
| `rotten` | rotten food | refuse/rotten | 10 | 0 | `%` | `rot_green` | any food past rotting; destroyed at "gone" |

## Wagon

The wagon is a building (see [buildings-and-furniture.md](buildings-and-furniture.md)); it is not an item.

## Meal ingredients

Any item in `food/meat/raw`, `food/fish/raw`, `food/meat/cured`, `food/fish/cured`, `food/plant/raw` (species `cookable: true`), `food/egg`, `food/cheese`, `food/plant/processed`, `food/fat`, `food/salt`, `food/honey` is an ingredient. Meals inherit the quality roll of the cook; their names in the UI are generated as "{ingredient} {dish}" from the first ingredient ("turnip stew", "boar roast", "dimcap pie") using the dish word table in [names.md](names.md).

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

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. Each names the task that adds it: that task moves the row into the table of its section above (in that table's columns, without `section` and `task`), adds its line to [row-order.md](row-order.md) and runs `npm run content:export`. The rules that use them are in the § Planned sections of the system documents ([13](../02-systems/13-items-and-storage.md) for the category leaves). Every number is *unmeasured*.

### Planned item types

| section | id | name | category | mult | stack | container | rotDays | weight | glyph | fg | materials or notes | task |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Farm goods (a new section) | `guano` | guano | farm/guano | 1 | 10 | bag | 0 | light | `:` | `dung_brown` | `guano`; tag `fertilizer` | T-556 |
| Farm goods (a new section) | `compost` | compost | farm/compost | 1 | 10 | bag | 0 | light | `%` | `loam_brown` | `compost`; tag `fertilizer` | T-564 |
| Tools | `firebrand` | firebrand | tool/firebrand | 1 | 5 | bin | 0 | light | `/` | material | wood, bone | T-559 |
| Medical and herbs | `soap` | soap | medical/soap | 1 | 20 | bag | 0 | light | `▪` | `soap_white` | `soap` | T-564 |
| Food | `feast` | feast | food/meal/feast | 60 | 20 | barrel | 1 | light | `%` | `meal_red` | `meal`; quality-bearing; eaten before any other meal | T-565 |

The glyphs are those the set already has ([glyphs-and-colors.md](glyphs-and-colors.md) § Glyph set); a task may choose another from the set.

