# Caravan Goods

**Detail level:** W3 · **Owner:** content (`caravanGoods`) · **Depends on:** [`../02-systems/20-trade-and-caravans.md`](../02-systems/20-trade-and-caravans.md), [items.md](items.md), [creatures.md](creatures.md)

## Budget

`budget = CARAVAN_VALUE_BASE + renown × CARAVAN_VALUE_PER_RENOWN + reputation × CARAVAN_VALUE_PER_REP` = `2500 + renown × 150 + reputation × 20` marks of goods at *fortress value*. Requests take `REQUEST_SHARE` = 30% first. The remainder is drawn by weight until the budget is spent (an entry that would exceed the remaining budget by more than 20% is skipped).

Guards: `GUARDS_BASE + peril × GUARDS_PER_PERIL` = `2 + peril`, plus 1 with `twilight_pass`. Pack animals: one per `PACK_VALUE` = 800 marks.

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
| creatures (caged) | 120 (exotic cave beasts 200) | 100 | 150 |
| any item with material class `wood` | 100 | 100 | 20 (and −2 reputation per item offered) |
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
