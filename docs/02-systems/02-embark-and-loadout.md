# 02 Embark & Loadout

**Owner:** `systems/embark` · **Depends on:** [01-world-generation.md](01-world-generation.md), [03-terrain-and-mining.md](03-terrain-and-mining.md), [06-weather-and-seasons.md](06-weather-and-seasons.md), [08-animals-and-domestication.md](08-animals-and-domestication.md), [10-dwarves.md](10-dwarves.md), [`../01-architecture/constants.md`](../01-architecture/constants.md)

## Purpose

Take the chosen region and the player's spending decisions and produce the starting fortress: seven dwarves, their supplies and animals, and the wagon on the surface. Also produce the `LocalMapSpec` that 03 uses to generate the local map.

## Concepts

- **Budget**: marks available to spend. `EMBARK_BUDGET_BASE + EMBARK_BUDGET_PER_PERIL × region.peril`. Harder regions grant more, so the trade is more supplies now for more danger later.
- **Party**: the seven dwarves. Each has a generated name, rolled attributes and personality, and player-assigned skills.
- **Catalog**: the list of purchasable items and animals with prices (`embark-catalog.md`). Prices are the item value plus a fixed markup, and animal values.
- **Preset**: a named fill of skills and supplies that fits the base budget.
- **Wagon**: a 3×3 building placed on arrival, containing the supplies, deconstructable for logs.

## Rules

### Party generation

The party and the default fortress name are drawn from the embark's party stream, made afresh for the embark screen from the world seed and the number of fortresses that have ended on the world: `RngStream.forStream(worldSeed, 'embark.party')` for the first embark of a world, and `'embark.party.<n>'` when `n` fortresses have ended on it. The app counts them as the world map's ruins (`WorldMap.ruins`, § Ruins) or the Legends' records of the world's seed, whichever are more (a world generated again from its seed has no ruins, and a fortress played on from a save made before another ended adds a record the world map lacks). So every embark on a world brings its own seven, and the first is the world seed's. An embark made without the embark screen (the scenarios' and tests' preset embark) draws as a first embark. Below, "the `embark.party` stream" is this stream.

For each of `EMBARK_DWARF_COUNT` dwarves, from the `embark.party` rng stream:

- Name: given name and hall-name from the names table; sex random; age uniform in `EMBARK_AGE_MIN..EMBARK_AGE_MAX` years.
- Attributes: each of the seven rolled as `ATTRIBUTE_BASELINE + sum of three rolls in −8..8` (a bell shape from 26 to 74), then clamped.
- Personality: three distinct traits from the personality table, weighted by their frequency.
- Skills: all zero. The player distributes `EMBARK_SKILL_POINTS_PER_DWARF` points, at most `EMBARK_SKILL_MAX_PER_SKILL` in any skill. Unspent points are lost; the screen warns. A skill with `embark: no` in `skills-and-professions.md` is not offered, and `SetSkill` refuses it with `not_found`.
- A dwarf can be re-rolled (new name, attributes, personality; skills kept) for `EMBARK_REROLL_COST` marks.
- Names are editable.

### Supplies

- The catalog is grouped: tools (picks, axes, crossbows and bolts, fishing rods, anvils), food (meals, meat, fish, plants, cheese), drink (ale, wine, bellwine), seeds, cloth and leather, bars, stone blocks, furniture (beds, tables, chairs), medical (thread, cloth, splints), animals.
- Quantities are set per line; the running total updates; the total cannot exceed the budget.
- Rules of thumb are shown as hints, not enforced: "Two picks, one axe, food and drink for the first week, and water or a still soon after, seeds for two plots."

### Presets

| Preset | Skills emphasis | Supplies emphasis |
|---|---|---|
| `balanced` | 2 miners, 1 carpenter/woodcutter, 1 mason/builder, 1 farmer/brewer, 1 cook/herbalist, 1 medic/hunter | 2 picks, 1 axe, 1 crossbow, a week of food and half a week of drink, seeds, 2 dogs, 1 cat |
| `miners_guild` | 3 miners, 1 smelter/smith, 1 mason, 1 brewer, 1 farmer | 3 picks, more drink, an anvil, iron bars |
| `farmstead` | 2 farmers, 1 herbalist, 1 cook, 1 brewer, 1 carpenter, 1 miner | Seeds of every kind, 2 cows, 4 chickens, 2 sheep, fewer tools |
| `warband` | 2 soldiers (axe, shield), 1 crossbow hunter, 1 armorsmith, 1 miner, 1 farmer, 1 medic | Iron weapons and mail for two, bolts, 3 war dogs, less food |

A preset fills the party skills and the supply list to `EMBARK_BUDGET_BASE`; any extra peril budget stays unspent for the player. The embark screen opens with `balanced` applied, or, after the first embark, with the preset the last embark used (the testing preset when it was in testing mode), which is saved with the settings (T-672; `ui-screens/embark.md` § Presets menu).

### Testing mode

A start for trying features without reaching them in play (the owner, T-532). It is off by default; the embark screen says so on its bottom line (`[t] Testing mode: off`), and a fortress started in it is marked as testing for good.

- **No budget.** The budget is unlimited; rerolls are free; Embark needs only a name and one dwarf.
- **Any party.** Dwarves are added (`AddDwarf`, from the `embark.party` stream, with no skills) and removed (`RemoveDwarf`), from 1 to `EMBARK_TESTING_MAX_DWARVES`.
- **Any skill at any level.** Every skill is offered, the `embark: no` ones (runecraft, runesmithing, alchemy) included, from 0 to `SKILL_MAX_LEVEL`, per dwarf (`SetSkill`) or for the whole party at once (`SetSkillAll`). There is no point limit.
- **Any item.** A catalog line goes to `EMBARK_TESTING_MAX_COUNT`, ignoring its `max` and its temperature condition. Free item lines (`AddItem`, `SetItemCount`) bring anything else: an `items` row in any material (the materials that suit the item's `materials` column are offered first; any other is allowed and marked unusual), a quality from poor to masterwork (common when absent), a count to `EMBARK_TESTING_MAX_COUNT`, and for a wand or a staff (a launcher with no ammunition) a stone that carries a spell (`Item.stone`), or for a weapon, an armor piece or ammunition an enchantment of its slot (`Item.enchant`, its tier the line's quality). Two lines of the same item, material, quality, stone and enchantment merge. At arrival the free lines go into the wagon after the catalog's supplies, in stacks of the item's `stack`, a drink in a pine barrel per stack.
- **Rune at arrival.** A dwarf who arrives with `runecraft` 1 or more holds its `Rune`, full (25 § Rune of one's own); no `SkillLevelUp` is emitted, so `FirstRunecaster` waits for a dwarf who earns level 10.
- **Switching.** Turning testing mode on keeps the loadout and lifts the limits. Turning it off goes back to seven dwarves with no skills and nothing bought, and the screen applies `balanced` (asking first when anything was edited). A normal preset leaves testing mode; the testing preset enters it.
- **The testing preset** (`testing_fortress`, "Testing fortress", defined with the session in `systems/embark/testing.ts` because it names free item lines the preset table cannot hold): twelve dwarves at level 15 covering every labour that has a skill (mining, masonry, carpentry, farming, brewing, cooking, smithing, runecraft, runesmithing, alchemy, medicine, the combat skills and the rest); plenty of food, drink, logs, blocks, bars (iron, copper, steel, silver, gold) and charcoal; seeds of every kind; beds and furniture; a squad's kit (helms, mail, swords, spears, shields, crossbows and bolts) and two war dogs; for runecraft 40 glowcap, 20 glowcap seed, rough glowstone and two glowstone statues to place as lamps, 60 rune vials, a cut gem of every spell's stone, staffs of embers, of warding and of mending, wands of stillness and of calling, an axe of blaze, a keen sword, a stout mail shirt, 25 ember bolts, two runed robes and two silver circlets, and mending and stout draughts. Runecraft, smithing, farming and combat can be tried on the first day.
- **The mark.** `FortressState.testing` is `true` (absent for a normal fortress, so no normal world hash moves). The save header carries `testing: true` and the Load screen marks the row "(testing)". The legend record carries `testing`; its screen names the fortress "(testing)", says "A testing fortress: it began with an unlimited loadout, so its milestones were not earned in normal play.", and heads its milestones "Milestones (testing start)". Milestones are still recorded, since testing them is a use of the mode.

### Loadouts

The player can save the current loadout under a name and load it on a later embark, on any site and any world.

- **A loadout** is the supply list (catalog entry and count) and each dwarf's skills by party position (the first dwarf's, the second's, …). It does not hold the party's names, attributes or rerolls, or the fortress name: those belong to the world and the site.
- **Saved loadouts** are kept by the app outside any world, beside the settings (`01-architecture/persistence.md` § Storage), so they survive a reload and serve every new world. A name is 1 to `EMBARK_LOADOUT_NAME_MAX` characters (24 § Tuning constants); names compare without case, and saving under a name that is taken asks before it replaces that loadout (`c_overwrite_loadout`). Saved loadouts can be listed, loaded, renamed (not to a taken name) and deleted (`c_delete_loadout`).
- **Loading** replaces every skill and supply line with the loadout's, through the session's own `SetSupply` and `SetSkill`; after edits it asks first (`c_load_loadout`). A loadout is stored by content id, so it survives a content change: a catalog entry or skill that no longer exists, or is no longer offered at embark, is left out; an entry whose temperature condition fails on this site is left out; a count or level above its current limit is lowered to the limit; skills for dwarves beyond the party are left out. The screen names each of them after the load.
- **The budget is never changed by a load.** A loadout that costs more than the site's budget loads whole; the screen says what it costs and by how much it is over, Embark stays disabled with its reason ("Over budget by 44 ☼"), and the player trims it. The same holds for a dwarf with more skill points than `EMBARK_SKILL_POINTS_PER_DWARF`.
- **A testing loadout** (saved in testing mode, § Testing mode) also holds `mode: testing` and the free item lines, and its party size is the number of dwarves whose skills it holds. It loads in testing mode: the party grows or shrinks to that size (new dwarves from the `embark.party` stream), then the skills, supplies and free lines are set; a free line whose item, material, stone or enchantment no longer exists is left out and named. A normal loadout loaded in testing mode goes back to normal play first (seven dwarves). The saved loadouts list marks a testing loadout "testing" instead of "over budget".

### Fortress name

Text field with a generated default from the names table, drawn from the `embark.party` stream after the party (§ Party generation). A default that names a fortress of the world, one of its ruins or of the Legends' records of its seed (in any case), is drawn again, at most once for each name the table can make, so a new embark on a world does not repeat an old fortress's name. Used in announcements, saves and the legend.

### Local map specification

On Embark, produce:

```
LocalMapSpec {
  seed: hash(worldSeed, regionId),
  biome, elevation, relief (0–3 from neighbor elevation differences; 0 is level), soilDepth (from biome),
  geology, wealth, peril, temper, deepness, traits, volcano,
  river: { inflowEdges, outflowEdge, class } | null, lake,
  civEdges: nearestEdgeTo, arrivalEdge: nearestEdgeTo.mountainhome
}
```

`relief = maxDiff = 0 ? 0 : min(3, 1 + floor(maxDiff / RELIEF_DIFF_STEP))`, where `maxDiff` is the largest absolute elevation difference to the eight neighbouring regions that exist. Relief 0 is level ground, which a region has only when every neighbour shares its elevation; every other site has at least the gentle relief 1 (03 stage 1).

03 generates the map from this and the ruins on the site (§ Ruins) and nothing else, so a region always generates the same local map, and a site no fortress has ended on is the map it always was.

### Site summary

Before the player chooses a site, the world map's region panel summarises what its local map will have (`04-implementation/ui-screens/menus-and-world.md` § World map). The summary is computed from the region's `LocalMapSpec` and the content tables 03 reads, by the rules of 03 § Local map generation, so it never says what the map will not have. What generation rolls is given as an estimate and says so ("about", "likely").

| Row | What it says | Rule |
|---|---|---|
| Soil | the soil materials, most common first, and the depth in levels; or none, on bare rock or obsidian | 03 stage 3: `soilDepth` of the biome (+2 and `loam` only on `serene_vale`); none where it is 0 (`alpine`) and on `glasslands`, whose surface is obsidian |
| Trees | about `treeDensity × LOCAL_MAP_W × LOCAL_MAP_H` trees, and the species by weight (willows too when a river is carved), then the trees a conversion names for the biome (ironwood); or none | 03 stage 9: trees grow only on soil; `glasslands` density; 03 stage 10, the conversions |
| Shrubs | about `(1 − treeDensity) × shrubDensity × LOCAL_MAP_W × LOCAL_MAP_H` shrubs and their species, then the converted shrubs of the biome (and reed beds where there is a river or a lake), each adding its permille of the open soil (by the sand share for a sand row) or, on bare rock, of every surface tile; or none; grass to graze, or no grass and cave moss below | 03 stage 9: shrubs and grass only on soil; cave loam floors carry grass (07 § Grass); 03 stage 10, the conversions (`plants.md` § Conversions) |
| Water | the river carved (its class, its inflow edges or the spring it rises from, and its outflow edge or a lake at its end), the region's lake, `gemsprings`' warm springs; "likely frozen in winter" when the winter value below is under `FREEZE_C`; or none on the surface | 03 stage 2: every river region carves its river, a river's source region from a spring; the springs need dry surface soil (stage 10) |
| Stone | the geology class and its layers, top down (basalt first on `glasslands`) | 03 stage 4 and the layer templates |
| Ores | likely: every ore (a mineral row of class `ore`: fossils are not listed) whose expected count (03 stage 7, with the `ironheart` and `glasslands` changes) is at least one and whose host is a layer the map must reach, most expected first; deepsilver when the wealth gives deepsilver veins | a layer is reached when its deepest possible top (the maximum thicknesses above it) lies above the lowest rock level under the lowest possible surface (stage 1's base minus the relief amplitude, less the soil) |
| Climate | the temperature band of the region's `tempC`, the mean, and summer and winter as `seasonBase + temperSpread`; under `frostmarrow`, spring and autumn as cold; frostbite on the nights of the first season after the arrival's whose coldest night is below 17's `COLD_INJURY_C`, with that night's temperature (when the arrival's own season has it, it is a missing essential instead, below) | 01 § Biomes bands; 06 § Surface temperature; 05's snow cover; 17 § Wound creation |
| Wildlife | the biome's surface species by weight: the aggressive and territorial ones as dangerous, then the rest; `serene_vale` removes its banned species; `frostmarrow` adds the wild yak | 08 § Wild spawning |
| This site has: | the site's has (§ What a site has and lacks), in its order, on a line of its own | `regions-biomes-and-traits.md` § Signatures; the Soil row's materials |
| This site lacks: | the site's lacks, in table order, on a line of its own in the alert colour | the same |

The missing essentials come first, in the alert colour, each with its consequence and workaround: no surface soil (farm in a cavern or on mud, graze in a cavern), no trees (wood only from the wagon, logs brought, caravans and cavern fungus), no water on the surface (drink only what is brought or brewed; dig to a cavern lake), and frostbite from the first night (the nights' temperature, the frostbite mark, and the workaround: dig a room underground on the first day, where the dwarves idle and sleep, 10 § Behavior selection). Water is missing when there is no carved river, no lake and no spring.

A season's coldest night is its coldest hour of the day (06's `DAY_CURVE_C`) under snow on a tile with snow cover (05's `SNOW_OVERRIDE`), or under a cold snap where the season and temper allow one and `serene_vale` does not remove it, whichever is colder (`coldestNightC`). The seasons are looked at from the arrival's, spring, in calendar order. Frostbite on a site's first nights is a warning a player cannot learn any other way before the first dwarf is wounded, and the site the world map starts on is often a mountain one: of the default sites of thirty worlds (`probe-1` … `probe-30`), fourteen were alpine, eight had frostbite from the first night, and thirteen more in a later season; of all 44,126 embarkable regions of those worlds, 4,986 have it from the first night and 19,127 later. A later season's frostbite is a note in the Climate row and not an essential, since half the sites have it and a fortress has a season to dig in.

### What a site has and lacks

- The content table `regions-biomes-and-traits.md` § Signatures has one row per biome, per geology class and per region trait, each with the goods it *has* and the goods it *lacks*. A good is a material id (`salt`, `sand`, `peat`), a material class (`wood`, `stone`, `soil`), or one of the words `honey`, `flux`, `fossils`, `giant_bones`, `horses`, `camels`, `reindeer`, `ice`, which name what the rules of 03, 07 and 08 give a map. The `mixed` geology has no row.
- A site's *has* is its soil goods, then the union of its biome's, its geology's and its traits' *has* (in that order, the traits in the spec's order); its *lacks* is the union of their *lacks* less anything in its *has* (a `volcano` site of the Glasslands has obsidian whatever its biome says). Its soil goods are the materials of its surface soil (the Soil row: 03 stage 3) tagged `soil_drop`, the soils it yields as loads, most common first: clay and sand on hills, none on an alpine site (soil depth 0), on a `serene_vale` (loam alone) or in the Glasslands (obsidian). No row of the table names them as had, and no biome's row names its own soil as lacking, so the two lines always agree with the soil the map is laid with.
- A good the game does not have yet (a word whose item, material or species does not exist, as `camels` before there is a `camel` species) is left out of both lists, and so out of the price.
- The site summary's last two rows, after Wildlife, are **This site has:** and **This site lacks:**, each the list in its order, the lacks in the alert colour; a list with nothing in it reads "none". The `salt` good is named "salt crust" in both, for the salt crusts (07) that are the only salt a map gives on its surface, apart from the rock salt (`halite`) a sedimentary site has in its layers: a desert reads "This site has: sand, salt crust, …", and a sedimentary forest that has rock salt and lacks salt reads "This site has: … rock salt …" over "This site lacks: salt crust, …". Like the other rows they are about the map the generator will make: a good that the map's rules give only by chance (`fossils` in the sedimentary layers, `giant_bones` on a boneyard biome) reads "likely" ("likely giant bones").
- 20 prices a merchant good whose material the site lacks at the scarcity price (20 § The scarcity price): the summary's lacks line is the same list, so the player knows before embarking what will be dear. A material is lacking when a good of the lacks names it more closely than any good of the has: by its id most closely, then by a word (`flux` for a `flux`-tagged stone, `giant_bones` and `fossils` for `giant_bone`, `honey` and `ice` for theirs), then by its class. A mountain lacks soil but has sand, so its sand is not dear; an igneous mountain has stone but lacks flux, so its limestone is; a sedimentary wetland lacks stone but has flux, so its limestone is not.
- The missing essentials (no soil, no trees, no water) still come first, as before.

### Arrival

1. Generate the local map (03), with the ruins on the site (§ Ruins).
2. Find the wagon site: the 3×3 patch of walkable surface tiles with no trees, nearest to the midpoint of the `arrivalEdge`, searching inward up to `ARRIVAL_SEARCH_DEPTH` tiles; if none, clear trees from the first candidate patch. Each cleared tree leaves its own species’ `logs` range, clamped by `TREE_LOGS_MIN` and `TREE_LOGS_MAX`, drawn from the `02` stream; the logs are of its wood and lie on its tile. A tree tile’s material id identifies the species; plants and materials have independent numeric indices.
3. Place the wagon building (function tag `container`, capacity unlimited, deconstructable, yields `WAGON_LOGS` pine logs; the wagon is made of pine).
4. Spawn every purchased item inside the wagon's container, using the catalog material for each item and its container (pine barrels and flax-cloth bags). The wagon may hold these item containers; their contents lie at its centre and are found and unloaded as on the ground. Spawn animals on walkable tiles around the wagon after the dwarves’ tiles. An explicit sex wins; a purchased unit of several animals is females followed by one male; single animals from one line alternate female, male. Each is `Tame` with no pasture, condition 0 and the training bought.
5. Spawn the dwarves through the creature spawn API, using the party records to build 10's dwarf components, adjacent to the wagon with all labors enabled except that dwarves with a combat skill ≥ 3 also get `Soldier`-ready flags (no squad yet). Needs start at 20 (mildly hungry, thirsty, rested).
6. Assign the title Thane to the dwarf with the highest Charm (ties by id). No Warden, Broker or Chief Medic yet.
7. Set the fortress name, embark tick and region. The calendar is set to `START_SEASON`, day 1, `START_HOUR`, year 1 before any arrival spawn, so supplies and creatures carry the arrival tick.
8. Emit `Embarked { fortressName, regionId }`. The app switches to the fortress screen, paused, centered on the wagon at the surface z-level, and shows the first hint.

Arrival consumes item entries of the local map’s trait spawn list; an entry's `stone`, when present, is set as the item's `Item.stone`, and its `count`, when present, is the stack's count (a ruin's items, § Ruins). Creature entries are consumed by 08 and 18 after arrival.

### Ruins

A fortress that ends on a world's site (retired, abandoned, or fallen silent: 24 § Game menu) leaves a ruin there, and the next embark on that site finds it (T-686). When the fortress ends, the app tells its ruin and adds it to the world map the next embark is made from (`WorldMap.ruins`, 01 § State), so a later fortress on the world saves it with its world and leaves its own after it. The Legends record names the fortress as before (`ui-screens/menus-and-world.md` § World map).

The ruin record is `{ fortress, regionId, endedTick, tileCount, materials, tiles, items, buildings?, wrecks? }`, small whatever the map: the tiles the fortress changed, not the map.

- **Tiles.** The site is generated again as the fortress found it (its spec and the ruins it already had), and every tile of the fortress's map is compared with it. A tile is kept when it was dug or carved from natural ground (a `wall`, `floor`, `ramp` or stairs that became a `floor`, `ramp`, stairs, `open` or `fortification`; a tree, shrub or boulder cleared is not kept, so the woods grow back), when it is `constructed` and differs from the site, or when it is smoothed or engraved where the site's tile was not. Each keeps its kind, its material, its `constructed` flag and a `smoothed` flag (an engraving wears to smooth). A constructed tile has fallen with `RUIN_COLLAPSE_PERMILLE`, and always where the site holds water: it is left out, so the site's own tile stands there. Fluids, designations, grass and snow are not kept. The tiles are packed in ascending index order: the step from the previous index (a varint), the kind (a byte), the material's place in the record's palette of material ids `materials` (a varint), and the flags (a byte: 1 constructed, 2 smoothed), as base64 (`tiles`), with their number (`tileCount`).
- **Items.** Each item of a lasting kind that lies on the map or in a container there is kept with `RUIN_ITEM_KEEP_PERMILLE` (furniture, raw stone, blocks, fossils, wood, containers, tools, fuel bars, ore), or with `RUIN_ITEM_VALUABLE_PERMILLE` when looters would want it (metal bars, gems, crafts, weapons, armor, ammunition), in id order. Every other item (food, drink, seeds, cloth and clothing, medicine, refuse, corpses) has rotted or gone. An item carried, and the wagon and its load, leave with the expedition, so a fortress ended on its embark tick leaves none of its supplies. Over `RUIN_ITEMS_MAX` kept items, items drawn uniformly are dropped until it fits. A kept item is weathered: a stack keeps half its count (at least one) and its quality is one level worse (not below 0); it loses an enchantment, a set stone and a memorial's name. A testing fortress (§ Testing mode) leaves its tiles and no items. Each is recorded by its tile, type and material ids, count and quality. An installed item (furniture standing as a building) is not among them.
- **Furniture** (T-690). Each built piece of furniture that links its item (a door, a hatch, a bed, a table, a chair, a cabinet or chest, a statue, a lantern, a rack, a target), in id order, still stands with `RUIN_FURNITURE_STAND_PERMILLE`; the rest are broken up and gone. Cages, hives, nest boxes, chain posts, coffins and memorial slabs held something living or a name and are gone too, and so is the furniture laid from counted materials (the pallets): their cloth and straw rotted as loose cloth does. Over `RUIN_FURNITURE_MAX` standing pieces, pieces drawn uniformly go until it fits. A piece is recorded by its origin tile, building type id, orientation, and its item's type and material ids and quality, a level worse (not below 0): weathered as a kept item is. A testing fortress leaves none (`buildings`, absent when none stands).
- **Wrecks.** Each built workshop, hearth, trade depot and well, and each wreck the fortress found and left standing, in id order, stands as a wreck (14 § Wrecks). It holds every second unit of what it was built of (the 2nd, the 4th …, in the order its inputs were consumed: the first, an anvil or a table as often as not, went with the looters), so a wreck of a wreck holds half again. Over `RUIN_WRECKS_MAX` wrecks, wrecks drawn uniformly go until it fits. A wreck is recorded by its origin tile, building type id, orientation and material id, and its units grouped by item type and material ids with their counts, in the order of their first unit. The other buildings laid from materials (candle stands, drying racks, rune circles) are broken up and gone. A testing fortress leaves none (`wrecks`, absent when none stands).
- **Mechanisms and traps.** After the wrecks, each built lever, pressure plate, floodgate, drawbridge and trap, and each such wreck the fortress found and left standing, in id order, stands too, its links lost (a lever pulls nothing, a plate springs nothing). A lever, plate, floodgate or drawbridge is a wreck as above, holding every second unit (a lever's, plate's or floodgate's one unit is the first, so it holds nothing; a drawbridge holds its second block, its fourth …), and a drawbridge keeps its size (`width` and `height`, unturned). A trap is a wreck that holds nothing: its mechanism was its first unit, and the looters took the weapons, stone or cage it was loaded with. But a weapon, cage or stone-fall trap that is armed and holds everything it was loaded with is still armed with `RUIN_TRAP_ARMED_PERMILLE`, drawn in id order: it is recorded with its loaded items (`loaded`: each one's item type and material ids and its quality, a level worse, not below 0: weathered as a kept item is), and the next embark finds it built and armed, owned by no faction (14 § Wrecks, 19 § Trap targeting). A spike trap is extended only by a link, so it is always a wreck, and so is a spent or jammed trap. Over `RUIN_MECHANISMS_MAX` mechanisms and traps, those drawn uniformly go until it fits; they are recorded in `wrecks` after the workshops' wrecks.
- **Randomness.** The choices draw on their own stream, seeded by `hash(worldSeed, 'ruins', regionId, endedTick)`: tiles first in index order, then items, then furniture, then the wrecks' trim, then each armable trap's chance in id order, then the mechanisms' trim. The same end leaves the same ruin.

On the next embark on the site, 03 lays the site's ruins over the generated map in the order the fortresses ended (03 § Local map generation, stage 10b), and the last ruin's items join the spawn list where they still have a floor to lie on. At arrival, after the trait items, 14 builds the last ruin's standing furniture again where its tiles still stand (14 § Placement): a door whose wall has fallen, or a bed whose floor has, is not there. Then 14 places its wrecks the same way, `ruined` and not built (14 § Wrecks): the old hearth stands cold, is not the new fortress's hearth and does not light, so the new expedition builds its own. Its mechanisms and traps follow, wrecks the same way, except that a trap recorded with its loaded items stands built and armed: it springs on anyone who steps on it, the new expedition's first miner or the first goblin through the old gate, until the fortress chooses its mode or takes it apart. Nothing is drawn there, so the map is the world seed's and the records'. Lighting and discovery (stage 11) run after, so a ruin open to the sky is outdoor and its halls are found by digging into them or walking down the old stairs.

Balance: the halls save digging, the items are a few dozen worn, ordinary things, a wreck taken apart gives back half of what built it and works as nothing until then, an armed old trap is a hazard until it is found and gives back its mechanism and its worn load when it is taken apart, and an expedition cannot carry its supplies over by abandoning and embarking again. The civilizations' standing is not carried over: it is the old fortress's (20 § Reputation effects), and a new expedition comes as strangers, so a war a fortress lost does not lock its successor into it and the world record stays the ruins alone.

## State

Embark state exists only during the embark screen: `budget`, `party[]`, `supplies[]`, `preset`, `fortressName`, `mode` (`normal` or `testing`) and `items[]` (testing mode's free item lines). After arrival nothing of it persists except through the world (the wagon, items, dwarves), for a testing embark `FortressState.testing`, and the saved loadouts, which the app keeps outside every world (§ Loadouts). The `LocalMapSpec` is saved with the world for reference.

## Interfaces

### Reader

Not applicable: there is no embark reader. The app constructs the embark session before the world exists and the embark screen holds it directly. The session's fields (the party, the supplies, the preset, the fortress name) are state, not reader methods.

### Commands (embark session, handled by the app before the world exists)

`SetSkill { dwarf, skill, level }`, `RerollDwarf { dwarf }`, `RenameDwarf { dwarf, name }`, `SetSupply { entry, count }`, `ApplyPreset { preset }`, `SetFortressName { name }`, `ConfirmEmbark`; and for testing mode (§ Testing mode) `SetEmbarkMode { mode }`, `AddDwarf`, `RemoveDwarf { dwarf }`, `SetSkillAll { skill, level }`, `AddItem { line }`, `SetItemCount { index, count }`. The testing commands are refused with `not_testing` in normal mode.

### Events emitted

`Embarked { fortressName, regionId }`.

## Player-facing behavior

The site is chosen on the world map, whose region panel carries the site summary (§ Site summary). The embark screen has three tabs and a footer:

- **Dwarves**: list of seven, each with its skills beside its name; selecting one shows name (editable), age, attributes as bars, personality words, and the skill list with +/− controls, remaining points and a find field. Reroll button.
- **Supplies**: catalog grouped by category with quantity fields, unit price, line total; a find field that searches every entry, animals too, by name or group; and a view of every chosen line, supplies and animals, to review and trim the loadout in one place.
- **Animals**: species with price and count.
- **Items** (testing mode only): the free item lines and the form that makes one (§ Testing mode); its find field narrows the selected field's choices.
- Footer: budget remaining, preset menu (each preset with its total and its dwarves' main skills), fortress name, Embark button; below it the testing mode switch. Embark is disabled while over budget and shows why; otherwise, outside testing mode, the footer names any dwarf whose skill points are unspent. Leaving the screen after edits asks first (`c_leave_embark`, default No), since the edits are lost. Embarking with no pick, no axe, no food item or no drink item asks first, one question for each, in that order ("Embark without a pick?", "Embark without an axe?", "Embark with no food?", "Embark with no drink?"; confirmations `c_embark_no_pick`, `c_embark_no_axe`, `c_embark_no_food`, `c_embark_no_drink`, default No).

Nothing chosen here is irreversible in the fortress: skills grow, items are consumed, animals breed.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `EMBARK_AGE_MIN` / `EMBARK_AGE_MAX` | 18 / 65 | Years (*unmeasured*) |
| `EMBARK_REROLL_COST` | 25 | Marks (*unmeasured*) |
| `EMBARK_MARKUP_PERCENT` | 20 | Added to item value for catalog price (*unmeasured*) |
| `ARRIVAL_SEARCH_DEPTH` | 20 | Tiles inward from the edge to search for a wagon site (*unmeasured*) |
| `WAGON_LOGS` | 3 | Logs from deconstructing the wagon (*unmeasured*) |
| `RELIEF_DIFF_STEP` | 96 | Elevation difference to a neighbour per relief level above 1 (*unmeasured*) |
| `EMBARK_TESTING_MAX_DWARVES` | 50 | Most dwarves a testing embark brings (*unmeasured*) |
| `EMBARK_TESTING_MAX_COUNT` | 999 | Most units of one catalog entry or one free item line in a testing embark (*unmeasured*) |
| `RUIN_COLLAPSE_PERMILLE` | 250 | Chance a ruin's constructed tile has fallen by the next embark (*unmeasured*) |
| `RUIN_ITEM_KEEP_PERMILLE` | 500 | Chance a ruin keeps an ordinary item (*unmeasured*) |
| `RUIN_ITEM_VALUABLE_PERMILLE` | 200 | Chance a ruin keeps a valuable item the looters missed (*unmeasured*) |
| `RUIN_ITEMS_MAX` | 60 | Most items one ruin keeps (*unmeasured*) |
| `RUIN_FURNITURE_STAND_PERMILLE` | 500 | Chance a ruin's piece of furniture still stands (*unmeasured*) |
| `RUIN_FURNITURE_MAX` | 40 | Most pieces of furniture one ruin keeps standing (*unmeasured*) |
| `RUIN_WRECKS_MAX` | 20 | Most wrecks (workshops, hearths, depots, wells) one ruin keeps (*unmeasured*) |
| `RUIN_TRAP_ARMED_PERMILLE` | 250 | Chance an armed weapon, cage or stone-fall trap is still armed on the next embark (*unmeasured*) |
| `RUIN_MECHANISMS_MAX` | 20 | Most mechanisms and traps (wrecked or armed) one ruin keeps (*unmeasured*) |

## Extension points

- New catalog entries and presets are content rows.
- A different party size is `EMBARK_DWARF_COUNT`; the screen lays out any count up to 12.
- A "reclaim" mode (arriving at a fallen fortress) would reuse arrival steps 2–8 with an existing local map.
