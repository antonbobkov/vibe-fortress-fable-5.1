# Caravan Goods

**Owner:** content (`caravanGoods`) · **Depends on:** [`../02-systems/20-trade-and-caravans.md`](../02-systems/20-trade-and-caravans.md), [items.md](items.md), [creatures.md](creatures.md)

## Budget

`budget = CARAVAN_VALUE_BASE + renown × CARAVAN_VALUE_PER_RENOWN + reputation × CARAVAN_VALUE_PER_REP` = `2500 + renown × 150 + reputation × 20` marks of goods at *fortress value*. Requests take `REQUEST_SHARE` = 30% first. The remainder is drawn by weight until the budget is spent (an entry that would exceed the remaining budget by more than 20% is skipped).

Guards: `GUARDS_BASE + peril × GUARDS_PER_PERIL` = `2 + peril`, plus 1 with `twilight_pass`. Pack animals: one per `PACK_VALUE` = 800 marks.

Every entry is available at every reputation. The `Rare` column names only the variant that is added at reputation ≥ 50 (never the whole row), and the deepsilver entry is drawn only at reputation ≥ 75. A live animal travels in a pine cage and is budgeted at its species value plus the cage's item value.

## Mountainhome (spring, from year 2)

Merchants: dwarves. Guards: dwarves with iron axes, helms, mail shirts, shields (steel at reputation ≥ 50). Pack animals: mules.

| Entry | Item | Material pool | Count | Weight | Rare (reputation ≥ 50) |
|---|---|---|---|---|---|
| Bars | `bar` | copper 30, bronze 20, iron 35, steel 10, silver 5 | 5–10 | 25 | steel weight 30 |
| Picks | `pick` | iron 70, steel 30 | 1–2 | 10 | |
| Axes | `axe` | iron 70, steel 30 | 1–2 | 8 | |
| Weapons | `short_sword`, `mace`, `warhammer`, `spear` | iron 70, steel 30 | 1–3 | 8 | |
| Armor | `helm`, `mail_shirt`, `gauntlets`, `greaves`, `metal_boots`, `shield` | iron 70, steel 30 | 1–3 | 8 | `breastplate` added |
| Anvil | `anvil` | iron | 1 | 6 | |
| Crossbows and bolts | `crossbow` (metal) + `bolt` ×50 | iron | 1 | 6 | |
| Ale | `drink` ×20 in `barrel` | ale 50, dimcap_ale 30, hopped_ale 20 | 2–4 barrels | 15 | |
| Cave seeds | `seed` ×10 in `bag` | dimcap, cavewheat, sweetroot, pale_bell, sporecloth | 2–4 bags | 12 | |
| Cave crops | `plant_food` ×20 | dimcap, sweetroot | 1–2 | 8 | |
| Crafts | `craft` | stone, bone, metal | 3–6 | 8 | |
| Cut gems | `cut_gem` | quartz 40, amethyst 30, garnet 20, emerald 10 | 1–3 | 5 | ruby, sapphire added |
| Mechanisms | `mechanism` | granite | 1–3 | 6 | |
| Animals | `dog`, `cat`, `mule`, `yak` (cold regions) | — | 1–3 | 8 | `cave_ox` (tame) |
| Cloth | `cloth` | sporecloth_cloth | 2–4 | 5 | |
| Deepsilver | `bar` | deepsilver | 1 | 1 | only at reputation ≥ 75, weight 4 |

Extra goods sit outside the draw by weight. After the budget is spent, each rolls once with its permille and adds one good on top of the budget, on the runecraft stream. They add no pack animal. A request can still name one. The permilles are *unmeasured*.

| Entry | Item | Material pool | Count | Permille | Reputation |
|---|---|---|---|---|---|
| Glowcap seeds | `seed` ×10 in `bag` | glowcap | 2–4 bags | 700 | — |
| Glowstone | `rough_gem` | glowstone | 1–2 | 500 | — |
| Rune vials | `rune_vial` ×5 | rune | 1 | 400 | ≥ 50 |

## Hillfolk (summer, from year 1)

Merchants: humans. Guards: humans with iron spears, caps, leather jerkins, bucklers. Pack animals: mules.

| Entry | Item | Material pool | Count | Weight | Rare (reputation ≥ 50) |
|---|---|---|---|---|---|
| Meals | `easy_meal` ×10 | meal | 2–4 | 15 | `fine_meal` |
| Meat | `raw_meat` ×10 | cow_meat, pig_meat, sheep_meat | 2–3 | 10 | |
| Cheese | `cheese` ×5 | cheese | 2–4 | 10 | |
| Flour | `flour` ×10 in `bag` | flour | 1–3 | 8 | |
| Surface seeds | `seed` ×10 in `bag` | barley, turnip, cabbage, strawberry, flax, pumpkin, hops | 3–5 bags | 15 | |
| Surface crops | `plant_food` ×20 | turnip, cabbage, pumpkin | 2–4 | 10 | |
| Wine and ale | `drink` ×20 in `barrel` | strawberry_wine 40, ale 60 | 2–4 barrels | 12 | |
| Cloth | `cloth` | flax_cloth 60, wool_cloth 40 | 3–6 | 12 | |
| Thread | `thread` | flax_thread, wool_thread | 3–6 | 8 | |
| Leather | `leather_piece` | leather | 4–8 | 10 | |
| Clothing | `tunic`, `trousers`, `boots`, `cloak` | flax_cloth, wool_cloth, leather | 3–6 | 8 | |
| Bags and rope | `bag`, `rope` | flax_cloth | 2–4 | 6 | |
| Livestock | `cow`, `sheep`, `goat`, `pig`, `chicken` ×4 | — | 1–3 | 12 | `horse` |
| Wooden goods | `barrel`, `bin`, `bucket`, `bed`, `chair`, `table` | pine, oak | 2–4 | 8 | |
| Bandages and splints | `bandage` ×4, `splint` ×4 | flax_cloth, pine | 1–2 | 5 | |

## Wildwood (autumn, from year 1)

Merchants: elves. Guards: elves with yew bows and 30 wooden arrows, daggers, leather jerkins. Pack animals: `wildwood_bearer` (carrying capacity as a mule).

| Entry | Item | Material pool | Count | Weight | Rare (reputation ≥ 50) |
|---|---|---|---|---|---|
| Seeds | `seed` ×10 in `bag` | strawberry, flax, hops, barley, pumpkin | 2–4 bags | 12 | |
| Saplings | `log` (yew; sold as "yew sapling" and planted by placing: a `plant_sapling` designation is not in version 1, so this entry is yew logs) | yew | 2–4 | 8 | |
| Herbs | `brightleaf` ×5 | brightleaf | 2–4 | 15 | |
| Bows | `bow` | yew 60, ash 40 | 1–2 | 10 | |
| Arrows | `arrow` ×25 | wood 70, bone 30 | 2–4 | 10 | |
| Cloth | `cloth` | flax_cloth | 3–5 | 10 | |
| Fruit | `plant_food` ×10 | sunfruit, bramble_berry, strawberry | 2–4 | 10 | |
| Wine | `drink` ×20 in `barrel` | strawberry_wine, bellwine | 1–3 barrels | 10 | |
| Quivers and bags | `quiver`, `bag` | leather, flax_cloth | 2–3 | 6 | |
| Tame animals | `dog` (hunting-trained), `cat` | — | 1–2 | 6 | `bear` (tame, war-trained), `lynx` (tame) |
| Crafts | `craft` | bone, shell | 3–6 | 6 | |

## Preferences (valuation multipliers, percent)

Applied to `value(item)` to get the merchant's valuation when buying from the fortress, and inversely when selling to it (`price = value × preference / 100 × MERCHANT_MARKUP / 100`, so a civ that values metal at 150% also charges 150% for it).

| Category or material class | Mountainhome | Hillfolk | Wildwood |
|---|---|---|---|
| default | 100 | 100 | 100 |
| `bar/*` | 90 | 150 | 60 |
| `weapon/*`, `armor/*` (metal) | 100 | 150 | 40 |
| `craft/*` | 130 | 100 | 90 |
| `stone/gem_cut` | 140 | 110 | 120 |
| `stone/raw`, `stone/block` | 60 | 80 | 80 |
| `food/*` | 70 | 80 | 110 |
| `drink/*` | 120 | 100 | 100 |
| `textile/cloth`, `clothing/*` | 100 | 100 | 120 |
| `textile/leather`, `armor/*` (leather) | 100 | 110 | 60 |
| `medical/brightleaf` | 100 | 100 | 130 |
| `medical/vial`, `medical/draught` | 150 | 100 | 100 |
| creatures (caged) | 120 (exotic cave beasts 200) | 100 | 150 |
| any item with material class `wood` | 100 | 100 | 20 (and −2 reputation per item offered); for the Wildwood a wand or staff counts as wooden |
| `bar` deepsilver, deepsilver items | 300 | 200 | 150 |
| `furniture/*` | 100 | 110 | 80 (wood: 20) |

## Reputation events

| Event | Delta | Civ |
|---|---|---|
| Trade completed | +clamp(1, 5, value / 500) | trading civ |
| Gift | +value / 100, max +10 per caravan | trading civ |
| Wooden item offered to the Wildwood | −2 per item | Wildwood |
| Caravan member killed by a fortress creature | −50, ban 2 years | that civ |
| Caravan member killed by hostiles or animals on the map | −3 | that civ |
| Caravan left without a depot | −2 | that civ |
| Caravan lost (merchant died) | −10 | that civ |
| Hillfolk bandit killed | −1 | Hillfolk |
| Hillfolk bandit caged (alive when the caravan next arrives; the caravan takes them) | +3 | Hillfolk |
| Yearly drift | ±5 toward 0 | all |

## Immigration bonus

Mountainhome reputation adds `reputation / 25` immigrants per wave (21) and `reputation × 2` permille to the wave chance.

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. Each names the task that adds it: that task moves the row into its civilization's table above (without `civ` and `task`), adds its line to [row-order.md](row-order.md) when the table numbers its entries, and runs `npm run content:export`. The rules are in [20](../02-systems/20-trade-and-caravans.md) § Planned. Every number is *unmeasured*.

### Planned sundries

A sundries entry is an ordinary weighted entry: a lot of 5–10 units, weight 6.

| civ | Entry | Item | Material pool | Count | Weight | task |
|---|---|---|---|---|---|---|
| Mountainhome | Flux stone | `raw_stone` | limestone 40, dolomite 30, marble 30 | 5–10 | 6 | T-550 |
| Mountainhome | Coal | `coal_bar` | coal | 5–10 | 6 | T-550 |
| Mountainhome | Charcoal | `charcoal_bar` | charcoal | 5–10 | 6 | T-550 |
| Mountainhome | Glowstone | `rough_gem` | glowstone | 1–2 | 6 | T-550 |
| Mountainhome | Sand | `soil_load` | sand | 5–10 | 6 | T-550 |
| Hillfolk | Logs | `log` | oak 40, pine 40, birch 20 | 5–10 | 6 | T-550 |
| Hillfolk | Leather | `leather_piece` | leather | 5–10 | 6 | T-550 |
| Hillfolk | Salt | `salt` ×10 in `bag` | salt | 1–2 bags | 6 | T-550 |
| Hillfolk | Clay | `soil_load` | clay | 5–10 | 6 | T-550 |
| Hillfolk | Bedding | `bedding` | flax_cloth | 2–4 | 6 | T-551 |
| Hillfolk | Dung in sacks | `dung` ×10 in `bag` | dung | 1–2 bags | 6 | T-552 |
| Hillfolk | Cured meat | `cured_meat` ×10 | cow_meat, pig_meat, sheep_meat | 1–2 | 6 | T-552 |
| Hillfolk | Bricks | `stone_block` | brick | 5–10 | 6 | T-553 |
| Hillfolk | Pots | `pot` | earthenware | 2–4 | 6 | T-553 |
| Hillfolk | Candles | `candle` | tallow | 5–10 | 6 | T-NEW (candles) |
| Hillfolk | Honey (when the Wildwood's home is farther than the Hillfolk's) | `honey` ×10 in `barrel` | honey | 1 barrel | 6 | T-555 |
| Wildwood | Reeds | `reed` | reed | 5–10 | 6 | T-550 |
| Wildwood | Nettle fiber | `fiber` | nettle_fiber | 5–10 | 6 | T-550 |
| Wildwood | Feathers | `feather` | feather | 5–10 | 6 | T-550 |
| Wildwood | Brightleaf | `brightleaf` | brightleaf | 5–10 | 6 | T-550 |
| Wildwood | Honey | `honey` ×10 in `barrel` | honey | 1 barrel | 6 | T-555 |
| Wildwood | Beeswax | `beeswax` | beeswax | 5–10 | 6 | T-555 |
| Hillfolk | Camels (in `desert`, `badlands`, `savanna`) | `camel` | — | 1–2 | 6 | T-561 |

### Planned preferences

| Category or material class | Mountainhome | Hillfolk | Wildwood | task |
|---|---|---|---|---|
| `drink/spirits` | 150 | | | T-554 |
| material `silk_cloth` | 150 | | 140 | T-556 |
| `craft` of `giant_bone` | 150 | | | T-557 |
| material `pewter` | 110 | | | T-547 |
| material `salt` | | 150 | | T-550 |
| `food/meat/cured`, `food/fish/cured` | | 120 | | T-552 |
| material `glass` | | 130 | | T-553 |
| `food/honey`, `food/wax` | | | 100 | T-555 |
| material `reed` (baskets, wicker) | | | 100 | T-549 |
| material class `bone` | | | 60 | T-550 |
| material `star_steel` | 200 | 200 | 200 | T-560 |

`SCARCITY_MARKUP` multiplies a merchant's price for a good the site lacks (20 § Planned). Never sold: star steel, aged and vintage goods, silk cloth, giant skulls, wyrmscale, ichor, and deepsilver below reputation 75.
