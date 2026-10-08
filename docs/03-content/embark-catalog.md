# Embark Catalog

**Owner:** content (`embarkCatalog`) · **Depends on:** [`../02-systems/02-embark-and-loadout.md`](../02-systems/02-embark-and-loadout.md), [items.md](items.md), [creatures.md](creatures.md), [`../01-architecture/constants.md`](../01-architecture/constants.md)

Price = item value × (100 + `EMBARK_MARKUP_PERCENT`) / 100, rounded up, for common quality. Quantities are per unit unless the entry is a stack. `max` is the most that can be bought of an entry.

## Tools and weapons

| id | entry | item | material | price | max |
|---|---|---|---|---|---|
| `e_pick_copper` | copper pick | `pick` | copper | 72 | 7 |
| `e_pick_iron` | iron pick | `pick` | iron | 108 | 7 |
| `e_axe_copper` | copper axe | `axe` | copper | 96 | 7 |
| `e_axe_iron` | iron axe | `axe` | iron | 144 | 7 |
| `e_crossbow` | crossbow | `crossbow` | oak | 36 | 3 |
| `e_bolts_copper` | 25 copper bolts | `bolt` ×25 | copper | 60 | 8 |
| `e_bolts_iron` | 25 iron bolts | `bolt` ×25 | iron | 90 | 8 |
| `e_quiver` | quiver | `quiver` | leather | 22 | 3 |
| `e_anvil` | iron anvil | `anvil` | iron | 270 | 1 |
| `e_short_sword_iron` | iron short sword | `short_sword` | iron | 144 | 3 |
| `e_mace_iron` | iron mace | `mace` | iron | 126 | 3 |
| `e_spear_iron` | iron spear | `spear` | iron | 108 | 3 |
| `e_shield_wood` | wooden shield | `shield` | oak | 22 | 4 |
| `e_helm_iron` | iron helm | `helm` | iron | 108 | 4 |
| `e_mail_iron` | iron mail shirt | `mail_shirt` | iron | 270 | 4 |
| `e_leather_jerkin` | leather jerkin | `leather_jerkin` | leather | 44 | 7 |
| `e_cap` | leather cap | `cap` | leather | 22 | 7 |
| `e_bucket` | bucket | `bucket` | pine | 5 | 6 |
| `e_splints` | 4 splints | `splint` ×4 | pine | 10 | 3 |
| `e_crutch` | crutch | `crutch` | pine | 8 | 2 |

## Food

| id | entry | item | material | price | max |
|---|---|---|---|---|---|
| `e_meals` | 10 easy meals | `easy_meal` ×10 | meal | 120 | 6 |
| `e_meat` | 10 boar meat | `raw_meat` ×10 | boar_meat | 60 | 6 |
| `e_fish` | 10 trout | `raw_fish` ×10 | trout_meat | 24 | 6 |
| `e_turnips` | 20 turnips | `plant_food` ×20 | turnip | 24 | 6 |
| `e_cabbages` | 20 cabbages | `plant_food` ×20 | cabbage | 24 | 6 |
| `e_dimcaps` | 20 dimcaps | `plant_food` ×20 | dimcap | 24 | 6 |
| `e_cheese` | 5 cheese | `cheese` ×5 | cheese | 30 | 4 |
| `e_flour` | 10 flour (in a bag) | `flour` ×10 + `bag` | flour, flax_cloth | 43 | 4 |

## Drink (each entry is a barrel with 20 units)

| id | entry | item | material | price | max |
|---|---|---|---|---|---|
| `e_ale` | barrel of ale | `drink` ×20 in `barrel` | ale, pine | 55 | 8 |
| `e_dimcap_ale` | barrel of dimcap ale | `drink` ×20 in `barrel` | dimcap_ale, pine | 55 | 8 |
| `e_bellwine` | barrel of bellwine | `drink` ×20 in `barrel` | bellwine, pine | 103 | 4 |
| `e_empty_barrel` | empty barrel | `barrel` | pine | 8 | 10 |

## Seeds (bags of 10)

| id | entry | material | price | max |
|---|---|---|---|---|
| `e_seed_dimcap` | 10 dimcap seeds | dimcap | 15 | 6 |
| `e_seed_cavewheat` | 10 cavewheat seeds | cavewheat | 15 | 6 |
| `e_seed_sweetroot` | 10 sweetroot seeds | sweetroot | 27 | 6 |
| `e_seed_pale_bell` | 10 pale bell seeds | pale_bell | 39 | 4 |
| `e_seed_sporecloth` | 10 sporecloth seeds | sporecloth | 39 | 4 |
| `e_seed_barley` | 10 barley seeds | barley | 15 | 6 |
| `e_seed_turnip` | 10 turnip seeds | turnip | 15 | 6 |
| `e_seed_cabbage` | 10 cabbage seeds | cabbage | 15 | 6 |
| `e_seed_strawberry` | 10 strawberry seeds | strawberry | 27 | 4 |
| `e_seed_flax` | 10 flax seeds | flax | 27 | 4 |
| `e_seed_pumpkin` | 10 pumpkin seeds | pumpkin | 27 | 4 |
| `e_seed_hops` | 10 hops seeds | hops | 27 | 4 |

Seed bag prices include a linen bag (value 2 × 2 = 4 → 5) plus 10 × species value × 1.2.

## Materials

| id | entry | item | material | price | max |
|---|---|---|---|---|---|
| `e_logs` | 5 pine logs | `log` ×5 | pine | 12 | 6 |
| `e_blocks` | 5 granite blocks | `stone_block` ×5 | granite | 18 | 6 |
| `e_bars_copper` | 5 copper bars | `bar` ×5 | copper | 60 | 4 |
| `e_bars_iron` | 5 iron bars | `bar` ×5 | iron | 90 | 4 |
| `e_charcoal` | 5 charcoal | `charcoal_bar` ×5 | charcoal | 18 | 6 |
| `e_leather` | 5 leather | `leather_piece` ×5 | leather | 36 | 4 |
| `e_cloth` | 5 linen | `cloth` ×5 | flax_cloth | 48 | 4 |
| `e_thread` | 5 flax thread | `thread` ×5 | flax_thread | 18 | 4 |
| `e_rope` | rope | `rope` | flax_cloth | 20 | 4 |
| `e_mechanism` | mechanism | `mechanism` | granite | 12 | 4 |
| `e_brightleaf` | 5 brightleaf | `brightleaf` ×5 | brightleaf | 24 | 4 |

## Furniture

| id | entry | item | material | price | max |
|---|---|---|---|---|---|
| `e_bed` | pine bed | `bed` | pine | 12 | 7 |
| `e_table` | pine table | `table` | pine | 10 | 4 |
| `e_chair` | pine chair | `chair` | pine | 8 | 8 |
| `e_door` | pine door | `door` | pine | 10 | 6 |
| `e_chest` | pine chest | `chest` | pine | 12 | 3 |
| `e_bag` | linen bag | `bag` | flax_cloth | 20 | 10 |
| `e_bin` | pine bin | `bin` | pine | 8 | 6 |

## Animals

| id | entry | species | price | max | notes |
|---|---|---|---|---|---|
| `e_dog` | dog | `dog` | 36 | 6 | pairs breed |
| `e_war_dog` | war dog | `dog` (trained war) | 72 | 3 | |
| `e_cat` | cat | `cat` | 12 | 4 | |
| `e_cow` | cow | `cow` | 72 | 2 | needs pasture |
| `e_bull` | bull | `cow` (male) | 72 | 1 | |
| `e_sheep` | sheep | `sheep` | 36 | 6 | pairs breed; wool |
| `e_goat` | goat | `goat` | 30 | 6 | |
| `e_chickens` | 3 chickens and a rooster | `chicken` ×4 | 29 | 2 | needs a nest box |
| `e_pig` | pig | `pig` | 42 | 4 | |
| `e_yak` | yak | `yak` | 84 | 2 | only when the region is frozen or cold |
| `e_mule` | mule | `mule` | 60 | 3 | |

Animals of a breeding species are sold as one sex per entry; the UI shows the sex and lets the player pick pairs.

Catalog entries retain their section as `category` and any non-condition note as `note`. A condition naming temperature bands is checked against the region's temperature using [01 World generation](../02-systems/01-world-generation.md)'s bands; a failing entry remains visible, dim, with its reason, and cannot be bought.

## Presets (`EMBARK_BUDGET_BASE` = 1500)

Preset supplies are matched to catalog entries by their unit count and exact price. Among valid candidates, the entry sharing the most words with the phrase wins, then the one with the fewest extra words; no match or an unresolved tie fails export. Each preset's parsed supplies must sum to its stated total.

### Balanced (1,480)

Skills: two dwarves mining 5 + building 3 + axe 2; one woodcutting 5 + carpentry 5; one masonry 5 + mechanics 3 + building 2; one farming 5 + brewing 5; one cooking 5 + herbalism 3 + fishing 2; one medicine 4 + crossbow 3 + hunting 3.

Supplies: 2 iron picks (216), 1 iron axe (144), 1 crossbow (36), 25 copper bolts (60), 1 quiver (22), 10 easy meals (120), 20 turnips (24), 20 dimcaps (24), 10 boar meat (60), 2 barrels of dimcap ale (110), 1 barrel of ale (55), 2 empty barrels (16), dimcap seeds ×2 (30), cavewheat seeds (15), barley seeds (15), turnip seeds (15), strawberry seeds (27), flax seeds (27), 5 pine logs (12), 5 charcoal (18), 5 iron bars (90), 1 mechanism (12), 5 leather (36), 5 linen (48), 5 thread (18), 5 brightleaf (24), 4 splints (10), 2 buckets (10), 2 linen bags (40), 3 pine beds (36), 1 pine table (10), 2 pine chairs (16), 2 dogs (72), 1 cat (12); **total 1,480**.

### Miner's Guild (1,490)

Skills: three dwarves mining 5 + pick 3 + building 2; one smelting 5 + weaponsmithing 3 + armorsmithing 2; one masonry 5 + mechanics 5; one brewing 5 + cooking 3 + farming 2; one farming 5 + herbalism 3 + medicine 2.

Supplies: 3 iron picks (324), 1 copper axe (96), 1 iron anvil (270), 5 iron bars (90), 5 charcoal (18), 10 easy meals (120), 20 dimcaps (24), 20 turnips (24), 3 barrels of dimcap ale (165), 2 empty barrels (16), dimcap seeds ×2 (30), cavewheat seeds (15), sweetroot seeds (27), 5 pine logs (12), 5 leather (36), 5 linen (48), 5 brightleaf (24), 4 splints (10), 1 bucket (5), 2 linen bags (40), 1 mechanism (12), 2 dogs (72), 1 cat (12); **total 1,490**.

### Farmstead (1,466)

Skills: two farming 5 + animal_care 3 + herbalism 2; one herbalism 5 + fishing 3 + hunting 2; one cooking 5 + brewing 5; one brewing 5 + carpentry 3 + farming 2; one carpentry 5 + woodcutting 5; one mining 5 + building 3 + masonry 2.

Supplies: 1 iron pick (108), 1 iron axe (144), 1 crossbow (36), 25 copper bolts (60), 10 easy meals (120), 20 turnips (24), 20 cabbages (24), 20 dimcaps (24), 5 cheese (30), 2 barrels of ale (110), 1 barrel of dimcap ale (55), 2 empty barrels (16), seeds: dimcap (15), cavewheat (15), sweetroot (27), barley (15), turnip (15), cabbage (15), strawberry (27), flax (27), pumpkin (27), hops (27), 2 cows (144), 2 sheep (72), 2 goats (60), 3 chickens and a rooster (29), 2 dogs (72), 1 cat (12), 5 pine logs (12), 3 linen bags (60), 4 splints (10), 5 brightleaf (24), 2 buckets (10); **total 1,466**.

### Warband (1,495)

Skills: two axe 5 + shield 3 + dodge 2; one crossbow 5 + hunting 3 + dodge 2; one armorsmithing 5 + smelting 3 + weaponsmithing 2; one mining 5 + building 3 + mechanics 2; one farming 5 + brewing 3 + cooking 2; one medicine 5 + herbalism 3 + animal_care 2.

Supplies: 2 iron axes (288), 2 iron helms (216), 2 leather jerkins (88), 2 wooden shields (44), 1 crossbow (36), 50 iron bolts (180), 1 quiver (22), 1 iron pick (108), 10 easy meals (120), 20 dimcaps (24), 20 turnips (24), 2 barrels of dimcap ale (110), dimcap seeds ×2 (30), turnip seeds (15), 2 war dogs (144), 5 brightleaf (24), 4 splints (10), 5 pine logs (12); **total 1,495**.

Peril budget bonus (`EMBARK_BUDGET_PER_PERIL` × peril) stays unspent for the player in every preset.

## Rules of thumb (hints on the embark screen)

- Two picks and one axe are the minimum for a working start.
- A season of food and drink for seven dwarves is about 100 food units and 150 drink units; the presets carry roughly half and expect farming and hunting to cover the rest by autumn.
- Seeds of at least one cave crop keep the fortress fed through winter.
- Two dogs spot thieves; a cat controls nothing (there is no vermin in version 1) but everyone loves it.
