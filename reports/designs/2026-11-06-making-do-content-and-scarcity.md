# Making Do

**A design for more content in Deepholm: scarce materials, substitutes, longer chains, and things worth messing with.**

Status: proposal, not in the repository. Every number is *unmeasured* unless it quotes an existing table. Ids are `snake_case` as the content tables want them; a new row is a row, never a special case in code.

---

## 1. What this design is for

The game has one metal ladder, one cloth ladder, one way to make a bed, one way to light a glowcap and one way to keep meat. Every site has the same shopping list, and the list is short. This design adds materials, plants, animals, recipes and a handful of mechanics so that:

- **a site has a character.** A desert fortress is made of glass and salt; a wetland one of reeds, peat and bog iron; a taiga one of ice, rye and horn. The site summary names what a site lacks before you embark.
- **there is more than one way to make anything that matters.** Every essential has a natural route, at least one substitute route, and a merchant route at a price.
- **chains get longer because each link is interesting**, not because they are long. Sand becomes glass becomes a skylight becomes a winter strawberry bed warmed by a magma channel.
- **the new things are tricks, not chores.** Each is set up once and then watched. Racks dry, hives hum, cellars age, spiders spin. Refills are `maintain` orders and hauling, which the game already does.

### The two tests

A new row earns its place by passing one of these, and the best pass both.

1. **It has a face.** A line in the log, a thought in a diary, a sight on the map. "Stung. The bees were not consulted."
2. **It has a trick.** A one-sentence rule that combines with rules already in the game. "A skylit tile is lit but not outdoors."

Trade-offs are welcome and are logged in `docs/fun-features.md` as before: spirits make dwarves sing and work slower; a spider ranch spins webs across your own corridor; a candle at the gate shows you the thief and the thief the gate.

### What does not change

The design foundations hold: four rating axes and named traits, seven-level fluids, six body parts, three steel damage types and two rune, mood 0–100 with sulks as the ceiling, seven dwarves, three trading civilizations on fixed seasons and the Gloam as the only raider, one hearth, four positions. Nothing here adds a metal above deepsilver. Nothing here makes a fortress fail faster. Rows are appended in `row-order.md`; nothing is removed. New wild plants and terrain features are placed on their own rng streams, as glowcap patches were, so existing maps generate the same rock, trees and shrubs.

---

## 2. Where things come from

Not everything grows everywhere. Each biome and geology gets signatures: materials it has that most sites do not. The site summary on the world map (02 § Site summary) gains a line, **"This site lacks: …"**, and a line, **"This site has: …"**, read from the same rules.

| Place | Has | Lacks |
|---|---|---|
| Temperate forest, hills | wood, honey (flowers), nettle, brambles, clay, smoke | salt, sand |
| Dark forest | ironwood, yew, peat, honey | sand, salt |
| Grassland | honey, flax, barley, clay, horses | wood (thin), sand |
| Wetland | reeds, peat, bog iron, clay, crocodile shell | stone near the surface (deep soil), flux often |
| Taiga | peat, rye, ice in winter, elk horn, bog iron | honey (few flowers), sand |
| Tundra | ice, rye, lichen, mammoth ivory, reindeer, peat | wood, honey, clay |
| Cold steppe | rye, horses, sand, horn | wood, honey |
| Mountain, alpine | stone, sand, lichen, goat horn, ice | wood, soil, clay, honey |
| Savanna | honey, sunfruit, clay, camels at the edge | peat, ice |
| Desert | sand (glass), salt, cactus, camels | wood, clay, honey, peat |
| Badlands | salt flats, clay, sand | wood, honey, peat |
| Tropical forest | wood, honey, clay, crocodile shell | salt, peat, ice |
| Glasslands (trait) | obsidian, ash soil (wyrmtongue grows wild), a volcano: a magma kiln on day one | wood, soil |
| Caverns | fungus wood, silk (spiders), chitin (crawlers), guano (bats), cave ox horn, glowcap | daylight |
| Sedimentary geology | flux, coal, salt (halite) | gold, gems |
| Igneous geology | copper, gems, basalt | flux: steel needs shell or bone ash |

---

## 3. The substitution table

For every essential, three routes. The merchant route always exists, at the scarcity price (§ 10). "New" marks what this design adds.

| Essential | Natural route | Substitute routes | Merchant |
|---|---|---|---|
| **Fuel** | charcoal from logs; coal seams; magma | **peat bricks** (dried peat, new); **dung cakes** (dried dung, new); fungus wood from caverns | Mountainhome: coal and charcoal |
| **Flux for steel** | limestone, dolomite, marble, chalk | **shell** tagged `flux` (cave crab, crocodile, crawler chitin, new); **bone ash** from the kiln (new) | Mountainhome: flux stone |
| **Blocks** | stone blocks | **bricks** from clay at the kiln (new); metal blocks; **glass blocks** (new) | Hillfolk: bricks; Mountainhome: blocks |
| **A bed** | a wooden bed | **pallet** of cloth, fiber or wool (new); **bone cot** (new); **stone bed with a mattress** (new) | Hillfolk: beds |
| **A barrel** | a wooden barrel | metal barrel; **clay pot** holding 10 (new) | Hillfolk: barrels, pots |
| **A bucket** | wooden | metal; **clay jug** (new) | Hillfolk |
| **A bin** | wooden | metal; **wicker basket** of reeds (new) | Hillfolk |
| **A bag** | cloth, leather | **wicker basket** (new) | Hillfolk, Wildwood |
| **Rope** | 2 thread | **2 reeds**; **1 leather** cut to strips (new) | Hillfolk |
| **Cloth** | flax, wool, sporecloth | **reed**, **cactus**, **nettle** fiber (new); **silk** from a spider ranch (new); yak and camel wool (new animals) | Hillfolk, Wildwood |
| **Leather** | tanned hide | cloth gambeson (exists); **scale armor** of shell, bone or horn (new layer) | Hillfolk |
| **Splints, crutches** | wood | **bone splints**, **bone crutch** (new); metal crutch (new) | Hillfolk |
| **A lamp for glowcap** | a glowstone lamp | **a caged glow beetle** lights the four tiles beside it (new) | Mountainhome: glowstone |
| **Light for a room** | the hearth | **candle stands** (tallow or beeswax, new); **lanterns** (glass and a candle, new) | Hillfolk: candles |
| **Iron** | hematite, magnetite, limonite | **bog iron** in peat (new, 1 bar an ore); **star iron** (trait, new) | Mountainhome: bars |
| **Steel** | iron + flux + fuel | **star steel**, smelted without flux (new, rare) | Mountainhome |
| **A good bow** | yew | **horn bow** of any wood and a horn (new) | Wildwood |
| **Keeping meat** | barrels in a cold stockpile | **smoked** (fuel), **salted** (salt), **dried** (a rack), **an ice larder** (new) | Hillfolk: cured meat, salt |
| **Infection** | brightleaf cures | **soap** and **honey** prevent (new) | Wildwood: brightleaf, honey |
| **Fertility of a plot** | nothing | **dung, compost, guano, bone ash** (new) | Hillfolk: dung, in sacks, with no apology |
| **Workshops** | each needs logs | **every workshop's build inputs accept 2 stone blocks or 2 bricks in place of its logs**, except the carpenter's (new rule) | — |

The rule for workshops is the one general change: a treeless site can build a loom, a tannery or a kennel from stone. The carpenter's workshop keeps its logs, because without logs there is nothing for it to do.

---

## 4. New materials and minerals

| id | class | from | notes |
|---|---|---|---|
| `sand` | soil item | digging `sand` walls drops 1 with 500‰ (soil drops nothing today; sand and clay are the exceptions) | the glass chain |
| `clay` | soil item | digging `clay` walls drops 1 with 500‰ | bricks, pots, jugs, mugs, hives |
| `peat` | soil item | digging `peat` walls drops 1 with 500‰ | dries to `peat_brick`, a fuel |
| `brick` | stone | kiln: 1 clay + fuel → 2 blocks of `brick` | value 1, hardness 90, magma-safe; a constructed brick wall draws smooth, in `brick_red` |
| `glass` | glass | kiln: 1 sand + fuel → 2 `glass`; 1 sand + 1 potash + fuel → 3 | value 6, melts at 1400: **magma-safe**. A glass floor over the Sea of Fire is a thing a dwarf will admire |
| `halite` | ore (rock salt) | clusters in limestone, shale, sandstone, chalk; count 2 | a dug tile drops a halite stone; the kitchen crushes 1 → 5 `salt` |
| `salt` | plant-class item | halite; **salt crusts** gathered on desert and badlands surfaces | cures meat and hides; Hillfolk pay 150% |
| `bog_iron` | ore | clusters hosted in `peat` layers; count 3; yields 1 iron | the wetland's iron, half a hematite's |
| `star_iron` | ore | only with the `starfall` trait | smelts 1 → 1 `star_steel`, fuel but no flux |
| `star_steel` | metal | — | tier 4, weapon 1.30, armor 1.25, rune 1.4, magma-safe, value 90, summon `stone_warden`. Steel the sky made. Never sold |
| `pewter` | metal | 1 tin + 1 lead → 2 | tier 0, value 9; mugs, crafts, tableware. Tin and lead get a use |
| `ironwood` | wood | a rare tree | hardness 120 (chops at twice the time), value 6, burns 1200 ticks and spreads fire at a quarter chance; weapons at 0.60 (a club of ironwood out-hits a copper mace's wood), bolts at 0.60, a wicker-free shield that blocks +5 |
| `reed` | plant item | reed beds | wicker: baskets, rope, shields, hives, pallets |
| `chitin` | shell | butchering any crawler-plan species (cave crawler, cave crab already; crawlers were butcherable, they just gave nothing of their shell) | `flux`; scale armor |
| `horn`, `ivory` | bone | butchering horned species (yak, mountain goat, elk, cave ox, reindeer); mammoth gives ivory | horn bows, drinking horns; ivory crafts at value 40 |
| `feather` | bone-class | butchering birds | fletching |
| `silk_cloth` | cloth | 2 `silk_web` thread at the loom | value 20, density 20: a silk gambeson weighs 1. Mountainhome 150% |
| `reed_cloth`, `cactus_cloth`, `nettle_cloth` | cloth | their fibers through the loom | value 6: cloth for sites with no flax and no sheep |
| `honey`, `beeswax`, `honeycomb` | plant, liquid | hives | mead, candles, wound dressing |
| `tallow` | existing | — | gains uses: candles, soap, firebrands |
| `potash` | plant-class | kiln: 1 log → 2 | glass, soap |
| `soap` | liquid | kitchen: 1 tallow + 1 potash → 2 | a hospital supply |
| `bone_ash` | stone-class | kiln: 1 bone pile → 2 | `flux` and `fertilizer` both |
| `dung`, `dung_cake`, `guano`, `compost` | refuse, fuel, fertilizer | pastures, racks, bat roosts, compost heaps | § 7 |
| `ice_block` | ice | `harvest_ice` on frozen water | builds; melts in a season underground |
| `spirits` (`deepfire`), `mead`, `black_ale`, `cactus_wine`, `emberwine` | liquid | the still | § 8 |
| `wyrmtongue` | plant | a crop that grows on ash | a spice; emberwine |

---

## 5. New plants

| id | kind | where | what it is for | the trick |
|---|---|---|---|---|
| `reed_bed` | shrub, regrows 14 days | wetland; any riverbank within 2 of water, in shallow water too | 2–4 `reed` | the wetland's wood: a treeless marsh builds baskets, rope and pallets from the bank |
| `barrel_cactus` | shrub, 28 days | desert, badlands | 1–2 `cactus_pulp` (food, brews `cactus_wine`), 1 `cactus_fiber` | cactus pulp is also **drinkable**: a thirsty dwarf with nothing else eats one and drinks it. "Drank cactus. Cactus." (−1, half of water) |
| `wild_nettle` | shrub, 28 days | temperate forest, hills, dark forest, wetland | 1–2 `nettle_fiber`, seed of `nettle` (a surface crop) | fiber without a farm or a sheep; gathering stings 100‰: "Nettles. Of course." (−1) |
| `rye`, `wild_rye` | crop and shrub | taiga, tundra, cold steppe, alpine | food, flour, `black_ale` (value 3) | grows at −2 °C in spring and autumn: the cold region's grain, where barley (4 °C) does not |
| `rock_lichen` | shrub, 56 days | bare rock in tundra, alpine, mountain; outcrops and crags everywhere cold | 1 `lichen` (food, value 1) | a lichen tile is **grazing**: yaks, goats and reindeer eat it as grass, so an alpine pasture needs no soil |
| `wyrmtongue` | crop, light `any`, 24 days | plantable only on `ash` tiles; a planted ash tile keeps its ash | 2–3 `wyrmtongue` (a spice, value 8, cookable, not edible raw); brews `emberwine` (6) | ash is a nuisance today. This flips it: burn a field to farm it. Glasslands have ash soil and grow it wild. A meal with it: "Ate something that fought back." (+2) and the eater ignores `bitter_cold` for a day |
| `ironwood` | tree, 5 years | dark forest 6, temperate forest 3 | 1–2 logs of `ironwood` | the carpenter's steel. Hard to chop, hard to burn |
| `salt_crust` | shrub, 28 days | desert, badlands surfaces, 2‰ of dry floors | 2 `salt` | a shrub that is not a plant: reuses gather and regrowth whole |
| `hop_vine`, `flower_meadow` | none | — | flowers already exist in the content as a share of grass tiles | hives read them (§ 6) |

Reed beds, nettles, lichen and salt crusts are placed by a conversion pass on their own stream, as rare cave patches are: an eligible shrub or floor turns into one, and every other stream draws the same numbers.

---

## 6. Animals and their products

### New products from old animals

| Product | From | Rule |
|---|---|---|
| `dung` | every tame grazer on a pasture, one every 7 days, on its tile | a refuse item; haulers take it to a refuse pile or a compost heap; it dries on a rack into a fuel. "Only the yak's contribution is in any way abundant." |
| `horn` | butchering yak, mountain goat, elk, cave ox, reindeer | horn bow (bowyer: 1 log + 1 horn → power 1.15, the steppe's yew); drinking horns (3 mugs at ×3); horn scales |
| `ivory` | butchering a mammoth (2) | crafts and statues at value 40: the tundra's gold |
| `feather` | butchering chickens (2) | fletching: 25 arrows or bolts + 1 feather → "fletched", to-hit +5, a transform recipe at the bowyer |
| `chitin` | butchering cave crawlers, cave crabs, crocodiles (in place of hide where they have none) | flux; scale armor |

### New animals

| id | where | size, temper | products | the trick |
|---|---|---|---|---|
| `reindeer` | tundra, taiga; wild herds 4–8; tameable | 70, timid grazer | milk 6, horn, meat 4, hide 7 | a cold-region cow that walks in on its own. Pulls nothing: sleds are not in this version |
| `camel` | desert, badlands, savanna; wild 2–4; tameable; Hillfolk sell them in hot regions | 110, neutral grazer | milk 5, wool 28 (camel hair), meat 4 | a milking job has 50‰ to end with "The camel spat on Ketil Ironvein." (−1). It grazes salt crust and cactus too |
| `honeybee` (a hive, not a creature) | § below | — | honeycomb | — |

### Hives

A `beehive` is a building: 1 clay pot, or 2 wooden blocks, or 1 wicker basket. It stands outdoors on soil with at least 8 flower tiles within 6 (the biome's `flowers` share already paints them). From spring to autumn it fills with 1 `honeycomb` every 14 days, as a nest box fills with eggs; `collect_honey` (animal care) empties it. At the farmer's workshop 1 honeycomb → 1 `honey` + 1 `beeswax`.

- Honey is an ingredient (value 6) and brews `mead` (value 5, a fine drink).
- Honey is a hospital supply: `clean_wound` and `dress_burn` take honey in place of nothing, and a honeyed wound is never rolled for infection. It does not cure one; brightleaf still does that.
- Beeswax makes candles that burn twice as long as tallow, and firebrands.
- The collector is stung 100‰: `stung` −2, "Stung. The bees were not consulted." A hive beside the hall's door stings passers-by at 20‰ an hour in summer. Place it somewhere else.
- A hive in winter is silent. A hive with fewer than 8 flower tiles makes nothing and the panel says so.

Deserts, tundra and alpine have no flowers. Honey is a temperate and savanna good; the Wildwood brings it everywhere else.

### The spider ranch

A giant cave spider spins webs on the 8 tiles around its lair every day (18 § Cavern monsters). **A caged spider's lair is its cage.** Catch one in a cage trap in cavern one, place the cage in a side room, and gather the webs: `gather` on a web tile yields 1 `silk_web` thread already; a gather zone over the room designates them daily. Two silk threads weave `silk_cloth`, the finest cloth in the game.

The trick is the room. Webs entangle whoever walks into them for 100 ticks, your haulers included. A ranch wants its own door and its own dwarf. The spider is never tamed, never fed and never happy. "The spider does not need feeding. Nobody has asked it."

### The beetle jar

A glow beetle lights its own tile (its row says so today). **A caged creature whose species lights its tile lights the four tiles beside its cage as a lamp does.** Four glowcap tiles per beetle, against eight per glowstone lamp, and a beetle costs a cage trap in cavern one instead of a gem the embark cannot buy. A runecraft start without a Mountainhome caravan becomes possible. A tame beetle in a cage lives its ordinary life; it does not leave.

### Bat roosts

No flying. A `bat_roost` is a ceiling feature of caverns one and two, placed by its own stream at generation (1‰ of ceiling tiles over open cavern floor; `fungal_depths` doubles it). Every 7 days a roost drops 1 `guano` on the floor below. The first roost a dwarf discovers announces: "Bats. Hundreds of them. Brynja Coldhammer counted." Guano is the best fertilizer. The bats are never drawn, never fought and never leave.

---

## 7. New workshops, buildings and the chains through them

### The kiln

A new workshop `kiln`: 3 stone blocks or bricks, masonry, fuel. The reserved `magma_kiln` becomes its magma variant, which gives the Glasslands a fuel-free glassworks on day one. Skill `pottery` (labor `crafts`, profession Potter).

| recipe | inputs | outputs |
|---|---|---|
| `fire_bricks` | 1 clay | 2 blocks (`brick`) |
| `make_pot` | 1 clay | 1 `pot` (a barrel-class container of 10) |
| `make_jug` | 1 clay | 1 bucket (clay) |
| `make_mugs_clay` | 1 clay | 3 mugs |
| `make_glass` | 1 sand (+ 1 potash) | 2 (3) `glass` |
| `make_glass_block` | 1 glass | 2 blocks (`glass`) |
| `make_lantern` | 1 glass + 1 candle | 1 `lantern` |
| `burn_potash` | 1 log | 2 `potash` |
| `burn_bone_ash` | 1 bone pile | 2 `bone_ash` |

Bricks are a wetland's walls, a smelter on a soil-deep site, and a fireproof furnace where there is no stone within reach. Pots are the barrel of a treeless site: half the drink, twice the hauling. Jugs are buckets.

### Glass, skylights and the greenhouse

`glass_block` builds three things:

- **A glass wall**: a wall that passes light and sight. Daylight spreads through it into the room behind (`lit`, for comfort and surface crops), archers see through it, nothing passes it. A hall with a glass wall onto the valley is a fine hall.
- **A skylight**: a floor built over open space that passes light downward. *Rule:* a tile whose column above is all open or skylight is `lit` but not `outdoor`. It takes the indoor temperature (05 reads `outdoor`, not `lit`, for the surface temperature from now on), no weather and no frost kill, and a surface crop on it ignores its growing seasons and uses a growth modifier of 100, as cave crops do. It still needs its `minC`.
- **A glass floor**: a floor over magma or water that one can see through. Room value as a statue. No rule beyond that; the point is the view.

The greenhouse is the rules combining. One level under a skylight in a temperate winter the air is 3 °C: cabbage grows, barley does not. Put the plot inside the hearth's 5×5 and it is 5 °C: barley and flax grow. Run a magma channel along the wall and it grows anything, all year, under the snow. Three levels down a light well is 10 °C in every climate and every season, and every surface crop grows there, which is a lot of glass and a deep shaft and worth it. Strawberries in midwinter are a wine, and the wine goes in the cellar (§ 8).

### The drying rack

A building, 1×1, 2 logs, 2 blocks or 2 bone piles: a rack that holds 5 items and wants them like a hospital chest wants supplies. Nobody works it. **An item on a rack becomes its dried form after its drying days.** Under a roof it dries; outdoors it dries twice as fast in clear weather and not at all in rain or snow.

| on the rack | becomes | days |
|---|---|---|
| `peat` | `peat_brick` (fuel) | 7 |
| `dung` | `dung_cake` (fuel) | 7 |
| raw fish | `cured_fish` (rot 0, value ×2) | 5 |
| raw meat | `cured_meat` (rot 0, value ×2) | 7 |
| raw hide | `salted_hide` (rot 0), if a salt is on the rack with it | 5 |
| `wyrmtongue` | nothing; it is dry already | — |

Peat and dung fuels are **smoky**: a job that burns one gives dwarves within 3 tiles of the workshop `smoky_hall` (−1, 12 hours). A taiga fortress smells of peat and knows it. The smoke itself is a chunk tint, like mist, drawn gray.

### The smokehouse

A workshop, 3×3, 3 blocks or bricks, fuel, skill `cooking`. `smoke_meat`: 1 fuel + 5 raw meat or fish → 5 cured. Faster than the rack and needs wood; the forest's way. Dwarves passing a working smokehouse: "Smells of smoked boar. Hungry now." (+1 and hunger +5). The third way is salt: the kitchen's `salt_meat`, 1 salt + 5 raw → 5 cured, no fuel: the desert's way.

### The compost heap

A zone type like a dump. **Rotten food on a compost heap turns to compost in 14 days instead of vanishing.** It still makes miasma: it goes outside. Dung thrown on it turns in 7. Compost is a fertilizer. The refuse pile earns its keep.

### Fertilizer

A farm plot setting, `fertilize`. When it is on, the `plant` job takes one item tagged `fertilizer` (dung, compost, guano, bone ash) as a second input, and **the crop's harvest is one larger**. Legible and bounded: a 10×10 plot wants 100 fertilizer a cycle and gives 100 more plants. Guano is the only fertilizer the caverns make; compost is the only one a vegetarian fortress makes.

### Candles, stands and lanterns

- `make_candles`: 1 tallow → 4 `candle` (7 days each) or 1 beeswax → 4 (14 days). At the kitchen or the craftsdwarf's.
- A `candle_stand` is a building: 1 stone block or 1 bar; it holds 5 candles and wants them like a hospital chest, so haulers keep it full and a `maintain` order keeps the candles coming. While it holds a burning candle it lights its 3×3 for comfort (as the hearth's square is lit) and adds room value as furniture of its candles' value.
- **A lit tile reveals:** a dwarf standing in candle light spots a hidden creature 2 tiles farther (as a `spot_radius` piece does). Candles at the gate catch thieves. Candles at the gate also show the gate.
- A `lantern` (glass and a candle at the kiln) is a placed building that never burns out and lights its 3×3 the same way: the permanent version, at the price of glass.
- Tallow candles smoke: a room lit only by tallow gives `smoky_hall` at 20‰ an hour to those in it. Beeswax does not. The hall knows which it has.

A lit room matters to dwarves: `slept_in_candlelight` and `ate_by_candlelight` are +1 each, and the Thane's hall by lantern light is a credit to everyone.

### The cellar and aging

A stockpile setting, `cellar`. A stockpile is a cellar when every tile is dark, between 2 and 14 °C, and the setting is on. **A barrel of drink or a cheese in a cellar ages one stage a year: young, aged, vintage.** Aged is value ×1.5 and the drink's thought +2; vintage is ×2.5 and +4. Aged cheese stops rotting. Nothing else ages. Oak barrels age in a year; pine and every other wood in two; a metal barrel or a clay pot never. The item's name says it: "a barrel of aged bellwine", "a wheel of vintage cheese". The stocks panel shows the cellar's years.

The trick is patience. Wealth from a cellar raises renown, and renown sizes raids. A fortress that hoards vintage is a fortress worth raiding. That is the trade-off, and it is the right one.

### Spirits

At the still: `distill`, 1 barrel of 20 ale, beer or wine + 1 fuel → 10 `spirits` in the barrel. One material, `deepfire`, value 8 a unit, the Mountainhome's favorite at 150%, category `drink/spirits`, which the item tree has waited for. **A dwarf who drinks spirits is tipsy for two hours:** speed −10%, and a chat relieves social twice over. The thought is `drank_strong_drink`, +5, "Sang at the hearth. Everyone heard." Dwarves take the nearest drink, so where the spirits stand is where the singing is. A cellar with a locked door is a wine cellar; a barrel by the forge is a mistake the forge will tell you about.

### Beds without wood

| item | made of | at | sleeping on it |
|---|---|---|---|
| `pallet` | 2 cloth, or 3 fiber, or 2 raw wool | clothier or leatherworks | `slept_on_a_pallet` −1; counts as a bed for the room |
| `bone_cot` | 3 bone piles + 1 cloth or leather | craftsdwarf | no thought either way; a hunter's camp in its own words |
| `stone_bed` | 1 raw stone + 1 cloth or wool as a mattress | mason | −1 at common quality, nothing at fine, +1 at superior: a stone bed is a good bed if the mason is |

The wooden bed stays the bed that gives room value. The others are for the start, the steppe and the mountain.

### Armor between leather and mail

A new armor layer, `scale`: plates of shell, bone, horn or chitin sewn on leather or cloth. Damage against the scale layer: edge 1.0, pierce 0.7, blunt 0.8, ember 0.6, frost 0.7. Rows: `scale_shirt` (torso 100, arms 40, armor 8, weight 7; 3 shell or bone or horn + 1 leather or cloth), `scale_skirt` (legs 100, armor 6, weight 5). Made at the leatherworks. A hunter's fortress with no metal has a second line; a fortress with crawlers at its gate wears them afterwards.

This is the one change to the combat tables: a column in the layer table and its constant. The three steel types and two rune types are untouched.

### Ice

`harvest_ice` is a designation on outdoor frozen water: a miner with a pick cuts an `ice_block`. Ice blocks are items of material `ice`, which melt (a rot timer of 7 days that the cold stops, as rot stops below freezing today), so they are cut in winter and used in winter. **A constructed ice wall or floor cools its 3×3 by 10 °C and melts away after 84 days underground; outdoors it follows the thaw rule like any ice.** Build the larder's walls of ice in winter and nothing in it rots until midsummer, since rot stops below 0 °C and the cellar is 10 °C before the ice. A gate of ice holds a raid in winter and opens itself in spring, which is a story. Cold regions get one thing warm ones envy.

### Fire on purpose

The spec says fire is a hazard, not a tool, and keeps a `torch` as an extension point. This takes it. A `firebrand` is 1 log or bone pile + 1 tallow or beeswax, at the craftsdwarf's. An `ignite` designation on a burnable tile makes a job that walks a dwarf there with a firebrand and lights it through 05's ordinary ignition. Everything else is the fire that exists: it spreads at 150‰ a neighbor, rain puts it out, peat burns, ash is left, dwarves step off burning ground.

Uses: clear brush and trees without an axe (and get ash for wyrmtongue); burn a spider's webs; fire a peat field across a raid's approach and watch it think about it; burn the refuse. Costs: it is fire. The dwarf who lights it: "Set a fire. On purpose, this time." The announcement is the same alert as any fire, and the first deliberate one gets a confirmation, like the first deepsilver.

### Salt

Halite clusters in sedimentary rock; salt crusts on desert and badlands surfaces. The kitchen crushes halite (1 → 5 salt), salts meat (1 salt + 5 raw → 5 cured, no fuel) and salts hides on the rack. Salt is an ingredient: a meal whose first ingredient is salt is "salted …" and worth one tier's thought more (easy +2 → +3, and so on), never more than lavish. Hillfolk pay 150%. A desert with a salt flat and a herd of camels is a cured-meat exporter.

### Wicker

At the craftsdwarf's, from reeds: `weave_basket` (2 reeds → 1 `basket`, a bin of 20 or a bag of 25, the player's choice of recipe), `twist_reed_rope` (2 reeds → 1 rope), `weave_wicker_shield` (3 reeds → 1 buckler, wood-class, 0.8 of a wooden one), `weave_pallet` (3 reeds → 1 pallet), `weave_hive` (3 reeds → 1 beehive). Wicker burns like wood. The marsh fortress is made of it.

### Soap

Kitchen: 1 tallow + 1 potash → 2 `soap`. A hospital supply. **A patient washed with soap on admission has no wound rolled for infection for the rest of that admission.** A `wash_patient` job (medicine, priority 3, 1 soap) does it. Soap prevents, brightleaf cures, honey prevents a wound at a time: three medicines where there was one. A fortress with a herd and a wood furnace is a clean fortress.

### Fletching

A transform recipe at the bowyer, as the runeforge's settings are: 25 arrows or bolts + 1 feather → fletched, to-hit +5. The enchant row carries a `workshop` column so a row can name the bowyer instead of the runeforge; "seeking" (emerald) stays the rune version at +10. Chickens are suddenly a military asset.

---

## 8. Tiers, old and new

| Ladder | Rungs, low to high |
|---|---|
| Fuel | dung cake (smoky) · peat brick (smoky) · charcoal · coal · magma |
| Light | hearth (5×5) · candle stand (3×3, burns down, refilled) · lantern (3×3, forever) · glowstone lamp (crops too) · beetle jar (crops, four tiles; a cheap side rung) |
| Drink containers | clay pot (10) · barrel (20; oak ages best) · metal barrel (20; magma-safe, never ages) |
| Beds | pallet (−1) · bone cot · stone bed (quality decides) · wooden bed (room value) |
| Armor layers | padding · leather · **scale** · mail · plate · ward |
| Drink | ale, beer, black ale (2–3) · wine, cactus wine (3–4) · mead (5) · emberwine (6) · spirits (8) · aged ×1.5 · vintage ×2.5 |
| Cloth | reed, cactus, nettle (6) · linen (8) · wool (10) · sporecloth (12) · silk (20) |
| Keeping food | a barrel in a cold stockpile · dried, salted or smoked (rot 0) · an ice larder (nothing rots) · a vintage cellar (it gets better) |
| Blocks | brick · stone · metal · glass (light) |
| Metal | unchanged ladder; bog iron and star steel enter it from the side, pewter below it. Nothing above deepsilver |
| Bows | wood · yew or horn (1.10–1.15) · fletched ammunition on any |
| Medicine | bandage · soap and honey (prevent) · brightleaf (cure) · draughts and Mend (rune) |

---

## 9. Region trait: Starfall

`starfall`: any land biome, freq 40‰, companion yes. A crater of bare rock, radius 3–5, at least 20 tiles from the arrival edge, its floor one level down and scorched (ash tiles that never clear: wyrmtongue grows there wild). At its centre, in the rock below, a cluster of 3–6 `star_iron`. A dwarf who first stands in the crater: `saw_the_star` +3, "Stood where the star fell." Star steel is the only steel that needs no flux and comes in a handful, enough for a captain's axe and helm, never for a squad. It is never sold: a merchant who sees star steel in the depot pays 200% and asks where you got it.

---

## 10. Merchants and the price of scarcity

Everything in the substitution table has a merchant row, and the merchant knows what you lack.

- **Sundries.** Each civilization's goods list gains a `sundries` entry drawn like any other: raw materials in small lots. Mountainhome: flux stone, coal, charcoal, glowstone, sand. Hillfolk: logs, leather, salt, clay, bricks, dung in sacks, candles, pots, cured meat, honey when the Wildwood is far. Wildwood: honey, beeswax, reeds, nettle fiber, feathers, brightleaf, saplings. The lots are 5 to 10 units at weight 6.
- **The scarcity price.** A material the region lacks (§ 2, the same rule that writes the site summary) is priced at `SCARCITY_MARKUP` = 250% on top of the merchant's markup and preference. Logs on a steppe cost two and a half times what they cost in a forest. Requests can name a scarce material and the request share brings it.
- **Never sold:** deepsilver below reputation 75 (as now), star steel, vintage anything, spider silk cloth (they buy it), wyrmscale and ichor. Some things a fortress makes or does without.
- **Preferences:** Mountainhome spirits 150%, silk 150%, pewter 110%; Hillfolk salt 150%, cured meat 120%, glass 130%; Wildwood honey and wax 100%, silk 140%, wicker 100% (it is reed, not wood: the elves have thought about this and decided reeds are fine).

The three civilizations and their seasons do not change. The depot does not change. What changes is that a desert fortress can buy a bed, dearly, and knows before embark that it will have to.

---

## 11. Hall life (smaller, later)

- **A feast.** Kitchen: 6 distinct ingredients + 1 salt, honey or wyrmtongue → 1 `feast`, placed on a floor beside a table in a dining hall, eaten by anyone for a day. Each eater: `feasted` +8; everyone: `held_a_feast` +3. Midwinter has a reason.
- **The Thane's whim.** Once a season the Thane wishes for one thing in the hall by season's end: a lantern in the dining hall, a barrel of mead, a statue of ivory. Met: everyone `thane_pleased` +3. Missed: the Thane `thane_grumbled` −1, nobody else anything. All face, no spiral. (The flavour report's item 26.)
- **Mugs at the table.** A dining hall with a mug per chair, of pewter, horn or glass, gives `drank_from_a_mug` +1 instead of nothing. Mugs have waited a long time for a job.

---

## 12. Balance notes and risks

- **Food gets easier** (greenhouses, fertilizer, curing). Cave crops already feed a winter, so the gain is variety and value, not survival. The costs are real: glass is sand and fuel, fertilizer is a job per tile, curing needs salt, fuel or days. The three-year fixture's food margin should be measured before and after bundle B.
- **Wealth gets easier** (vintage, spirits, silk, ivory, glass). Wealth is renown and renown is raids. This is intended; the panel says so already. Watch the peril-2 raid sizes in year 3.
- **Fire** is the one new way to hurt yourself. The confirmation on the first firebrand and the existing fire rules are the floor. Dwarves already leave burning tiles.
- **Determinism.** New wild plants, roosts, salt crusts and the crater are placed by conversion passes on their own streams. Existing maps keep their rock, trees and shrubs, and the annual instrument should stay within its bounds; the fixture has no bees, racks or cellars unless its script builds them.
- **Rows.** About 120 new rows across materials, plants, items, recipes, buildings, thoughts and traits, all appended. Two new skills (`pottery`, and none else: smoking is cooking, wicker is crafting, hives are animal care). One new armor layer. One new zone type (`compost`), one new stockpile setting (`cellar`), one plot setting (`fertilize`), two designations (`harvest_ice`, `ignite`).
- **Spiders and bees are the two things that can go wrong in a hall.** Both are opt-in, both are placed by the player, both are announced the first time, and neither kills: webs hold for 100 ticks, stings are −2.

---

## 13. Suggested order

**Bundle A: rows only, a week of agent time.** Peat, dung and their fuels on a rack is a building, so it goes in B; everything here is a table edit. Salt and halite, bog iron, pewter, shell and bone-ash flux, scale armor (one constant), pallets, cots and stone beds, bone splints and crutches, rye, nettle, cactus, reeds and wicker, horn and horn bows, ivory, feathers and fletching, the workshop-inputs rule, the sundries entries and the lacks line in the site summary.

**Bundle B: one mechanism each.** The drying rack and smoky fuel; the kiln with bricks, pots, glass, potash, bone ash and lanterns; candle stands; the cellar and aging; fertilizer and the compost heap; hives; the spider ranch and the beetle jar (two rules on cages); spirits and tipsy; soap; the smokehouse and salting; glass walls.

**Bundle C: terrain and systems.** Skylights and the indoor-lit temperature rule; ice harvesting and ice constructions; firebrands and `ignite`; Starfall; bat roosts; the scarcity price; reindeer and camels; feasts and whims.

Each bundle is a measurement: A against the content checks alone, B against the three-year fixture's food and wealth, C against the annual instrument.

---

## 14. Questions for the owner

1. **Fire on purpose:** the spec was firm that fire is not a tool. Firebrands reverse that, with a confirmation. Yes or no decides whether wyrmtongue needs the Glasslands or any field.
2. **Spirits that slow dwarves:** a fortress that brews only spirits works 10% slower and sings. Is that the trade-off you want, or should tipsy be mood only?
3. **How much glass:** a skylight tile per plot tile is a lot of sand. Is the greenhouse meant for a strawberry bed, or for a whole farm?
4. **Star steel:** a handful of steel for free on a lucky map, or too much of a gift? It could be a hard metal with a flaw instead (brittle: weapons lose a quality tier on a masterwork roll).
5. **Camels that spit and bees that sting:** two small negative thoughts for two small animals. Fun, or noise in the mood panel?
