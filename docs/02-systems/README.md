# Systems Index

**Owner:** systems · **Depends on:** [`../01-architecture/architecture-overview.md`](../01-architecture/architecture-overview.md), [`../01-architecture/constants.md`](../01-architecture/constants.md)

This page fixes the list of systems, their numbering, their tick order and cadence, and for each one its purpose, what state it owns, its key rules, what it reads, what it emits, and where the player meets it. Wave 2 writes the full design document for each; the file names below are the ones those documents will have.

Documents 22–24 describe a core service (pathfinding) and the presentation layer (rendering, UI). They are not L3 systems and do not tick in the order below, but they are specified with the same rigor and are listed here so that every part of the game has one home.

## Order, cadence and ownership

The tick order is also the dependency order for readers that are needed *within the same tick*: a system may rely on the fresh state of any system above it in this table. Any system may read any other's reader; the order only guarantees freshness.

| # | System | id | Cadence (ticks) | Owns |
|---|---|---|---|---|
| 01 | World Generation | `worldgen` | on demand | The world map: regions, biomes, ratings, traits, civilizations, rivers |
| 02 | Embark & Loadout | `embark` | on demand | Budget, party, supplies, arrival; the bridge from world map to local map |
| 03 | Terrain & Mining | `terrain` | 1 | Local map generation; tile mutation; designations; discovery; support of constructions |
| 04 | Fluids | `fluids` | 2 (water) / 4 (magma) | Fluid levels and types; active set; sources; mist and mud; freezing state |
| 05 | Materials & Temperature | `materials` | 10 | Temperature function; hot and cold sources; fire; melting and freezing triggers |
| 06 | Weather & Seasons | `weather` | 50 | Weather state; daylight; snow cover; seasonal modifiers |
| 07 | Plants & Farming | `plants` | 50 | Trees, shrubs, crops, cave flora; growth; farm plots; seeds |
| 08 | Animals & Domestication | `animals` | 1 | Non-dwarf, non-hostile creature behavior; wild spawning; pastures; breeding; products |
| 09 | Hunting, Gathering & Fishing | `foraging` | 10 | Hunt targets; gather designations; fishing spots; butchery flow |
| 10 | Dwarves | `dwarves` | 1 | Dwarf entities: attributes, skills, needs, personality, schedule, positions, behavior |
| 11 | Jobs & Labor | `jobs` | 1 | Job board; labors; priorities; assignment; hauling; reservations |
| 12 | Workshops & Professions | `workshops` | 1 | Workshop operation; recipes; work orders; quality rolls; profession titles |
| 13 | Items & Storage | `items` | 10 | Item entities; stacks; containers; stockpiles; decay; value; stock counts |
| 14 | Buildings & Rooms | `buildings` | 10 | Constructions; furniture; mechanisms; zones; rooms and their quality; ownership; the hearth |
| 15 | Happiness & Morale | `morale` | 50 | Thoughts; mood; tiers; hall spirit; sulks |
| 16 | Combat | `combat` | 1 | Attacks; projectiles; squads; training; alerts; stances; hostility |
| 17 | Health & Medicine | `health` | 5 | Wounds; bleeding; pain; infection; healing; hospital jobs; death and burial hooks |
| 18 | Threats | `threats` | 50 | Threat schedule; thieves, ambushes, raids, sieges; cave spawns; Deep pressure; hostile AI |
| 19 | Defense & Traps | `defense` | 1 | Traps; lever and plate links; bridges, hatches, floodgates; hearth alert behavior |
| 20 | Trade & Caravans | `trade` | 50 | Caravan schedule and parties; depot; trade session; pricing; reputation; requests |
| 21 | Immigration | `immigration` | 1200 | Wave evaluation; wave composition; arrival; families and children |
| 22 | Pathfinding & Spatial | core service | 1 | Path requests and budget; connectivity labels; spatial index; line of sight |
| 23 | Rendering | presentation | per frame | Glyph atlas; palette; compositor; overlays; z-level view |
| 24 | UI & Input | presentation | per frame | Screens; panels; widgets; keymap; mouse; announcements and log |

Creature behavior is split by owner: dwarves are driven by 10 (which defers to 11 for work and to 16 for military duty), animals by 08, hostiles by 18. Movement along a path is a core helper used by all three.

---

## 01 World Generation — [`01-world-generation.md`](01-world-generation.md)

**Purpose.** Produce a world map of regions with everything the player needs to choose a site and everything the local map generator needs to build it.

**Owns.** The `WorldMap`: for each region, elevation, temperature band, rainfall, biome, river segments, volcano flag, geology class, wealth, peril, temper, traits, and distances to each civilization's home.

**Key rules.**
- Deterministic from a seed; separate rng streams for elevation, climate, rivers, civilizations, traits.
- Elevation is layered value noise shaped by a continental mask; temperature falls with latitude and elevation; rainfall comes from noise plus a rain shadow east of mountains.
- Biome is a lookup on temperature band × rainfall band × elevation band.
- Rivers start in high, wet regions and follow descending elevation to the sea; each region records inflow and outflow edges.
- Geology class (sedimentary, igneous, metamorphic, mixed) is noise-driven; wealth rises with igneous and metamorphic rock, volcanoes and a random bonus.
- Civilizations occupy territories seeded on suitable biomes: Mountainhome on mountains, Hillfolk on grassland, Wildwood on forest, Gloam on badlands and dark forest. Peril rises with proximity to the Gloam and with cavern richness; temper rises with biome extremity and elevation.
- Traits are assigned to a small percentage of regions with biome and rating requirements.

**Reads.** Content: regions-biomes-and-traits. **Emits.** `WorldGenerated`.

**Player touchpoints.** World generation screen (seed, size, progress); world map screen (cursor inspection, filters, embark selection).

## 02 Embark & Loadout — [`02-embark-and-loadout.md`](02-embark-and-loadout.md)

**Purpose.** Turn a chosen region and a spent budget into a starting fortress.

**Owns.** The embark budget, the party (seven dwarves with names, attributes rolled, skills assigned by the player), the supply list, the animals, presets, the fortress name, and the arrival: wagon placement, unloading, initial stockpile suggestion.

**Key rules.**
- Budget is `EMBARK_BUDGET_BASE + EMBARK_BUDGET_PER_PERIL × peril`.
- Each dwarf has `EMBARK_SKILL_POINTS_PER_DWARF` points, at most `EMBARK_SKILL_MAX_PER_SKILL` in one skill; attributes and personality are rolled and shown, and can be re-rolled at a small cost in marks.
- Supplies are priced from item value; animals from creature value; the list is limited to the embark catalog in the content tables.
- Presets fill the party and supplies to fit the budget; custom editing is always allowed.
- Arrival is on the surface at the map edge nearest the Mountainhome, on a walkable tile cluster; the wagon is a building that can be deconstructed for logs.

**Reads.** 01 (region), content: items, creatures, skills. **Emits.** `Embarked`.

**Player touchpoints.** Embark screen with tabs for dwarves, supplies, animals; presets; fortress name.

## 03 Terrain & Mining — [`03-terrain-and-mining.md`](03-terrain-and-mining.md)

**Purpose.** Generate the local map from a region and keep the map correct as dwarves dig, build and the world changes.

**Owns.** Local map generation (surface heightmap and soil depth from the region; rock layers by geology; ore veins and gem clusters by wealth; three caverns with their flora and lakes; the Sea of Fire; rivers, brooks and lakes; volcano pipe if any; trait features such as buried battlefields). Tile mutation rules for dig, channel, stairs, ramps, smoothing, engraving, construction placement and removal, collapse of unsupported constructions, and discovery.

**Key rules.**
- Tile kinds and what each designation does to them: dig turns a wall into a floor; channel removes a floor (tile becomes open) and turns a wall below into a ramp; stairs and ramps are carved in place; smooth and engrave raise a tile's room value; remove construction returns its material.
- Mining a wall yields a stone or ore item with a probability that depends on the material class; gems always drop.
- Natural rock never collapses. A construction must have a supporting neighbor (wall, floor or construction) on at least one of its six faces; otherwise it collapses when its last support is removed.
- Discovery: a tile becomes discovered when it is adjacent to a discovered walkable tile, when it is dug, or when it is on the surface.
- Caverns are generated with noise-carved chambers and passages within the bands in `constants.md`, each with a floor type, lakes, fungal growth and a species list.

**Reads.** 01 region data; content: materials, minerals, plants (for surface vegetation), regions traits. **Emits.** `TilesChanged`, `TilesDiscovered`, `VeinFound`, `CavernBreached`, `ConstructionCollapsed`, `MineralMined`.

**Player touchpoints.** Designation menu (dig, channel, stairs, ramp, smooth, engrave, remove, chop, gather), priority setting, undo, the look cursor showing tile material and state.

## 04 Fluids — [`04-fluids.md`](04-fluids.md)

**Purpose.** Move water and magma through the map cheaply and believably: rivers, lakes, waterfalls, channels, floods, drains, obsidian.

**Owns.** The fluid byte of every tile; the active set; sources; per-tile settle counters; mist emitters; mud marking; freezing and thawing of water tiles with 05 and 06.

**Key rules.**
- Levels 0–`FLUID_MAX_LEVEL`. Four movement rules evaluated per active tile in order: fall (into an open or lower-level tile below), spread (equalize with cardinal neighbors that are lower, one unit per neighbor per step), pressure (a full tile connected through full tiles to a higher full tile may push one unit into an adjacent tile at any level up to that height), evaporate (a level-1 water tile with no fluid neighbors has a chance to vanish; magma never evaporates).
- Water at cadence 2, magma at cadence 4; a tile sleeps after a fixed number of steps without change and wakes when a neighbor changes.
- Water meeting magma: the magma tile becomes obsidian (wall if magma level ≥ 4, floor otherwise) and the water loses one level.
- Falling water of two or more levels produces mist in the 3×3 below the landing tile; water resting on a floor marks it mud.
- Sources: river edge tiles and the Sea of Fire refill to full each step.
- Freezing when the tile's temperature is below zero: level ≥ 4 becomes an ice wall, lower levels an ice floor; thaw restores the level.

**Reads.** 03 tile kinds; 05 temperature. **Emits.** `FluidsChanged`, `ObsidianFormed`, `CreatureSubmerged`, `MagmaContact`, `TileFrozen`, `TileThawed`, `MistProduced`.

**Player touchpoints.** Fluid overlay with level digits; channel and floodgate placement; "water source" zone for wells.

## 05 Materials & Temperature — [`05-materials-and-temperature.md`](05-materials-and-temperature.md)

**Purpose.** Provide the shared vocabulary of matter and heat: what things are made of, what that means, and how hot each tile is.

**Owns.** Material property access (from the registry); the temperature function `temperature(x, y, z)` = biome and season base − depth adjustment + local sources; the set of hot and cold source tiles; the fire state machine on burnable tiles; melting and freezing triggers sent to 04 and 07.

**Key rules.**
- Temperature is computed, not stored, except for source overrides. Surface temperature comes from 06; underground temperature converges toward a constant with depth and rises near magma.
- Fire: a burnable tile (grass, tree, wooden construction, plant item on the floor) ignites when adjacent to magma or struck by lightning, burns for a material-specific duration, spreads to adjacent burnables with a chance each step, and leaves ash. Creatures on burning tiles take burn damage each step.
- Materials have: class, value, density, hardness, color, glyph, burnable flag, melting point, and yields (what an ore smelts into).

**Reads.** 06 weather; 04 fluid positions; content: materials, minerals-and-metals. **Emits.** `TemperatureTick`, `FireStarted`, `FireSpread`, `FireOut`, `BurnDamage`, `ItemMelted` (freezing and thawing are applied by 04 on `TemperatureTick`).

**Player touchpoints.** Temperature shown in the look cursor; fire glyphs; the material name of every tile and item.

## 06 Weather & Seasons — [`06-weather-and-seasons.md`](06-weather-and-seasons.md)

**Purpose.** Turn the calendar into changing conditions on the surface.

**Owns.** The current weather state and its remaining duration; daylight hours per season; snow cover flags; seasonal modifiers exposed to 05 (temperature), 07 (growth), 15 (outdoor thoughts), 18 (visibility of scouts).

**Key rules.**
- Weather is a Markov chain per season and temper rating: clear, overcast, rain, storm, snow, fog, heatwave, cold snap, with transition tables in content.
- Rain leaves mud on exposed soil; snow lays snow cover that melts above zero; storms have lightning that can ignite trees; fog shortens raid warning distance.
- Daylight varies by season; night reduces outdoor visibility and makes dwarves prefer to sleep.
- Temper 0 has no storms or heatwaves; temper 4 has long winters and short growing seasons.

**Reads.** Calendar; 01 region (biome, temper). **Emits.** `WeatherChanged`, `SnowCoverChanged`, `LightningStrike`.

**Player touchpoints.** Status bar weather; surface glyph changes (snow, rain); the calendar panel.

## 07 Plants & Farming — [`07-plants-and-farming.md`](07-plants-and-farming.md)

**Purpose.** Grow things: trees for wood, shrubs for gathering, crops for food and drink, cave flora in the dark.

**Owns.** Plant tiles (trees, saplings, shrubs, grass, fungus) and crop entities on farm plots; growth stages and timers; farm plot zones and their planting schedule; seeds; regrowth of grass for grazing.

**Key rules.**
- Surface plants grow only in their seasons and only with light; cave plants grow only in darkness and at any season.
- Trees grow from saplings over years and drop logs when chopped (count by tree size); shrubs regrow after gathering.
- Farm plots need soil or mud; each plot has a crop per season; planting requires seeds; harvest yields produce plus seeds; growth time is per crop and scaled by season and weather.
- Grass regrows on soil at a fixed rate and is consumed by grazers.

**Reads.** 03 tile kinds and materials; 05 temperature; 06 weather and daylight; 13 seed items. **Emits.** `CropPlanted`, `CropHarvested`, `CropDied`, `PlotNeedsSeeds`, `SaplingGrew`.

**Player touchpoints.** Farm plot zone with per-season crop selection; chop and gather designations; the plant name in the look cursor.

## 08 Animals & Domestication — [`08-animals-and-domestication.md`](08-animals-and-domestication.md)

**Purpose.** Populate the map with creatures that are not dwarves and not hostile, and let the fortress keep some of them.

**Owns.** Behavior for wild and tame animals (graze, wander, flee, hunt for predators, sleep, return to pasture); wild spawning at map edges and in caverns by biome and season; pastures; breeding; products (milk, wool, eggs); slaughter designation; training of war and hunting dogs; taming from cages.

**Key rules.**
- Each species has a body plan, size, speed, diet, temperament (timid, neutral, aggressive), products and a value.
- Wild animals spawn at the map edge in groups when the population of their species is below the biome's cap; cavern species spawn in their cavern.
- Tame animals need a pasture if they graze; hungry grazers lose condition and eventually die; non-grazers need no feeding.
- Pairs breed after a gestation time; young grow up after a fixed time.
- Products are collected by farmer jobs on a schedule; slaughter sends the animal to the butcher's workshop.
- Predators attack when hungry or threatened; timid animals flee dwarves.

**Reads.** 03 map; 07 grass and plants; 14 pasture zones; 16 for hostility. **Emits.** `AnimalSpawned`, `AnimalBorn`, `AnimalStarving`, `ProductReady`, `AnimalTamed` (deaths go through 17's `CreatureDied`).

**Player touchpoints.** Pasture zones; the animals panel (assign to pasture, slaughter, train); cages.

## 09 Hunting, Gathering & Fishing — [`09-hunting-gathering-fishing.md`](09-hunting-gathering-fishing.md)

**Purpose.** Provide food and materials from the wild: hunting animals, gathering plants, fishing rivers and lakes.

**Owns.** Hunt targets and hunter behavior (stalk, shoot, retrieve); gather designations on shrubs and trees; fishing spots (river, lake and cavern lake edge tiles) and the fish pool per water body; the butchery flow from corpse to products.

**Key rules.**
- A hunter with the labor and a ranged weapon picks the nearest huntable wild animal, approaches to range, shoots, and hauls the corpse to a butcher's workshop.
- Gathering yields the shrub's product and sometimes a seed.
- Fishing needs an adjacent water tile of level ≥ 4; catches come from a per-water-body pool that regenerates seasonally.
- Butchering yields meat by creature size, plus hide, bones, fat and, for some species, a skull or shell.

**Reads.** 08 animals; 07 shrubs; 04 water; 12 workshops for butchery. **Emits.** `HuntStarted`, `HuntKill`, `FishCaught`, `ButcheryDone`.

**Player touchpoints.** Gather designation; hunt toggles per animal species in the animals panel; fishing zone.

## 10 Dwarves — [`10-dwarves.md`](10-dwarves.md)

**Purpose.** Make dwarves people: bodies with attributes, minds with skills and needs and personalities, and a daily rhythm.

**Owns.** Dwarf entities and their components: attributes, skills with experience, needs, personality traits, relationships (friend, grudge), schedule (sleep window), positions, labor toggles, and the top-level behavior selector that chooses between fulfilling a need, doing a job, military duty, and idling at the hearth.

**Key rules.**
- Seven attributes 0–100 rolled around `ATTRIBUTE_BASELINE`; they drift slowly toward what the dwarf does.
- Skills 0–`SKILL_MAX_LEVEL` gain experience per completed job; levels need increasing experience; skill tier names are content.
- Seven needs rise over time and are relieved by actions: eat, drink, sleep in a bed, talk at a meeting area, sit in a good room, work, and relax. A need past a threshold overrides job selection; a need at maximum produces a strong negative thought and, for hunger and thirst, slow starvation damage through 17.
- Children arrive with families, do light hauling, and become adults after a fixed number of years.
- Positions: Thane (assigned by the player; their bedroom quality gives a small fortress-wide thought), Warden (commands squads), Broker (trades), Chief Medic (diagnoses).

**Reads.** 11 jobs; 14 rooms; 15 mood; 16 orders. **Emits.** `NeedCritical`, `SkillLevelUp`, `DwarfIdle`, `DwarfDied`, `TitleAssigned`.

**Player touchpoints.** Units panel; dwarf inspection (attributes, skills, needs, thoughts, labors, equipment, relationships); position assignment; labor toggles.

## 11 Jobs & Labor — [`11-jobs-and-labor.md`](11-jobs-and-labor.md)

**Purpose.** Turn designations, buildings, orders and needs into work, and match work to workers.

**Owns.** The job board (all open, claimed and blocked jobs), job producers registered by other systems, labor toggles per dwarf, per-labor global priority, per-job priority, item reservations, the hauling subsystem (haul-to-stockpile, haul-to-workshop, haul-to-site), job state machines and cancellation rules.

**Key rules.**
- A job has a type, a target (tile, entity, or building), a priority 1–9, a required labor, an optional minimum skill, and a list of reserved inputs.
- Idle workers evaluate candidate jobs and take the lowest score of `priority × 100 + distance − skill bonus`, where the candidate set is bounded by labor and reachability (connectivity check first).
- Reserved items cannot be taken by another job; a job blocked for missing inputs or unreachability is shown with its reason and retried on a backoff.
- Hauling groups items bound for the same stockpile; containers are moved when it is cheaper.
- A job in progress is dropped if the worker's need becomes critical, the target changes, or the player cancels; partial progress on dig and build is kept.

**Reads.** 10 dwarves; 13 items and stockpiles; 14 buildings; 22 connectivity. **Emits.** `JobCreated`, `JobClaimed`, `JobCompleted`, `JobCancelled`, `JobBlocked`.

**Player touchpoints.** Jobs panel (open jobs with reasons); labor grid (dwarves × labors); priority controls on designations and orders.

## 12 Workshops & Professions — [`12-workshops-and-professions.md`](12-workshops-and-professions.md)

**Purpose.** Convert materials into goods at workshops, and give dwarves the titles the player thinks in.

**Owns.** Workshop operation (input gathering, work timer, output placement), the recipe registry, work orders (count, repeat-while-below-stock), quality rolls, fuel and magma-power rules, and profession titles derived from skills.

**Key rules.**
- Recipes: inputs by item type and material class, outputs, skill, base time, fuel need. Workshops: carpenter, mason, craftdwarf, smelter, forge, kitchen, still, tannery, leatherworks, loom, clothier, farmer's workshop, butcher, kennel, bowyer, jeweler, mechanic, and the wood furnace.
- Work time is base time scaled by skill and by the worker's mood tier productivity multiplier.
- Output quality is a roll on the skill level against the six-tier table; masterworks give the crafter a strong happy thought.
- Smelter and forge need fuel unless built on a tile adjacent to magma of level ≥ 4 below a channel; steel needs iron, fuel and flux.
- Profession title = the highest skill's profession name; ties go to the skill used most recently.

**Reads.** 11 jobs; 13 items; 14 buildings; 05 materials; 04 magma adjacency. **Emits.** `ItemCrafted`, `WorkOrderCompleted`, `WorkshopBlocked`.

**Player touchpoints.** Workshop panel (recipes, work orders, assigned worker); the orders panel listing all work orders; profession shown in the units list.

## 13 Items & Storage — [`13-items-and-storage.md`](13-items-and-storage.md)

**Purpose.** Track every object in the fortress and where it should go.

**Owns.** Item entities (type, material, quality, wear, stack count, container, owner, forbidden flag), stockpile zones and their filters, container rules, decay (food rot, corpse rot, miasma emission), item value, the stock counts used by work orders and the stocks panel.

**Key rules.**
- Item types are content rows with a category tree three levels deep (food › meat › raw), and stockpile filters select subtrees plus material classes and quality ranges.
- Barrels hold liquids and food, bags hold seeds and powders, bins hold crafts and cloth, chests hold personal items; containers in stockpiles are filled by hauling.
- Raw food and corpses rot after a per-type time unless in a container in a food stockpile or a refuse stockpile outdoors; rot indoors emits miasma to adjacent tiles.
- Item value = material value × type value multiplier × quality multiplier, in marks; fortress wealth is the sum.
- Forbidden items are ignored by jobs; the player can forbid and claim.

**Reads.** 05 materials; 14 zones. **Emits.** `ItemCreated`, `ItemDestroyed`, `ItemRotted`, `StocksChanged`, `MiasmaSpread`.

**Player touchpoints.** Stockpile zone with filter editor; stocks panel with counts and values; forbid and dump commands; item inspection.

## 14 Buildings & Rooms — [`14-buildings-and-rooms.md`](14-buildings-and-rooms.md)

**Purpose.** Let the player shape the fortress with constructions, furniture, mechanisms and zones, and reward well-made spaces.

**Owns.** Building entities and their placement rules (footprint, required tiles, required materials, build job); constructions; furniture; mechanisms (levers, pressure plates, links to doors, hatches, bridges, floodgates); zone entities of all types; room detection (enclosed area from a zone) and room quality tiers; ownership assignment; the hearth building and hearth hall.

**Key rules.**
- Placement validates footprint and terrain; a build job hauls materials to the site and then constructs; deconstruction returns materials.
- Doors block hostiles when locked and can be forbidden to pets; hatches cover stairs; drawbridges raise to become walls; floodgates block fluids.
- Room quality = size score + furniture value + smoothed and engraved tile count + hearth proximity, mapped to six tiers; bedrooms give sleep thoughts by tier, dining halls give meal thoughts, the hearth hall gives a fortress-wide baseline bonus.
- One hearth per fortress; building it emits a warm thought to all dwarves; the hearth hall is the default idle spot and the retreat point on hearth alert.
- Constructions need support (rule owned by 03).

**Reads.** 03 map; 13 items; 11 jobs; 10 dwarves for ownership. **Emits.** `BuildingPlaced`, `BuildingCompleted`, `BuildingRemoved`, `RoomQualityChanged`, `HearthLit`, `MechanismToggled`.

**Player touchpoints.** Build menu (constructions, furniture, workshops, mechanisms, traps, hearth, depot); zones menu; room inspection with quality breakdown; ownership assignment; lever pulling.

## 15 Happiness & Morale — [`15-happiness-and-morale.md`](15-happiness-and-morale.md)

**Purpose.** Make dwarves' lives matter to the fortress without letting misery snowball.

**Owns.** Thoughts (a content table of causes with value, duration, decay curve and text), each dwarf's active thoughts, mood computation, mood tiers and their effects, hall spirit, and sulk events.

**Key rules.**
- Mood = `MOOD_BASELINE` + Σ active thought values (positive sum capped, negative sum capped) − need pressure + hearth hall bonus + personality modifier, clamped 0–100.
- Tiers: Ecstatic ≥ 85, Content 65–84, Fine 40–64, Unhappy 20–39, Miserable < 20. Productivity multipliers 115, 105, 100, 90, 80 percent.
- Negative thoughts decay faster than positive ones; the same cause does not stack beyond a per-cause cap; grief is softened by burial and by time.
- A dwarf Miserable for seven consecutive days sulks once: takes a day off, breaks one piece of furniture, or argues with a dwarf (both lose a little mood). No violence. A sulk resets the counter.
- Hall spirit = average mood; used by 21 and shown in the status bar.

**Reads.** 10 needs; 14 rooms; events from many systems (meals, sleep, mist, deaths, crafts, combat). **Emits.** `MoodTierChanged`, `SulkHappened`, `HallSpiritChanged`.

**Player touchpoints.** Mood panel; dwarf inspection thoughts list with values; status bar hearth glyph colored by hall spirit.

## 16 Combat — [`16-combat.md`](16-combat.md)

**Purpose.** Resolve violence between creatures with legible rules.

**Owns.** Hostility determination; attack resolution (hit roll, armor, damage); projectiles; weapons and armor rules; squads, schedules, equipment assignment, training; stances; alert levels; kill and station orders.

**Key rules.**
- Six body parts; three damage types (blunt, edge, pierce); an attack picks a part weighted by size, rolls skill + agility against dodge and parry or block, then applies weapon damage reduced by the armor covering that part (armor material and damage type table), and sends the result to 17 as a wound.
- Melee skills per weapon class, ranged skills per launcher, plus shield, dodge and armor use. Training at a barracks or archery range grants experience without wounds.
- Ranged attacks trace a line; bolts and arrows are items that can be recovered.
- Creatures have a morale check when badly wounded: most animals and goblins flee; dwarves in squads hold; civilians flee.
- Alerts: Calm, Watchful (squads on duty), Hearth alert (civilians retreat, doors lock).

**Reads.** 10 dwarves; 08 animals; 18 hostiles; 13 equipment; 22 line of sight. **Emits.** `AttackResolved`, `ProjectileFired`, `CreatureFled`, `SquadOrderIssued`, `AlertChanged`.

**Player touchpoints.** Military panel (squads, members, equipment sets, schedules); alert selector; kill and station orders; the combat log.

## 17 Health & Medicine — [`17-health-and-medicine.md`](17-health-and-medicine.md)

**Purpose.** Turn wounds into consequences and give the player a way to heal them.

**Owns.** Wounds per body part (cut, bruise, fracture, burn) with severity, bleeding rate and pain; blood level; unconsciousness; infection; healing over time; hospital zones and their supplies; medic jobs (diagnose, stop bleeding, suture, splint, dress, care); permanent injuries; death; corpse creation and the burial hooks used by 14 and 15.

**Key rules.**
- Bleeding lowers blood each step; below a threshold the creature is unconscious, below a lower one dead. Bandaging stops bleeding. Blood regenerates slowly.
- Fractures disable the part (an arm cannot wield, a leg halves speed) until splinted and healed; untreated fractures heal wrong and leave a permanent penalty.
- Untreated open wounds risk infection daily; infection causes fever (no work) and can kill over weeks; cleaning and suturing remove the risk.
- Patients rest in hospital beds; medic jobs need supplies from the hospital chest; care jobs bring food and water.
- Starvation and dehydration damage come from 10 through this system.

**Reads.** 16 attack results; 10 needs; 14 hospital zones; 13 supplies. **Emits.** `WoundInflicted`, `CreatureUnconscious`, `CreatureDied`, `PatientHealed`, `InfectionStarted`.

**Player touchpoints.** Hospital zone; health tab in creature inspection; the medic position; coffins and tombs.

## 18 Threats — [`18-threats-monsters-and-raids.md`](18-threats-monsters-and-raids.md)

**Purpose.** Bring danger on a schedule the player can read, scaled by the region's peril and the fortress's success.

**Owns.** The threat schedule (per peril rating: earliest dates, frequencies, sizes for thieves, ambushes, raids and sieges); the warning event; hostile party generation and arrival; hostile AI (approach, breach if possible, fight, loot, retreat); cavern spawn tables and breach-triggered activation; Deep pressure and Hollow-born releases; wild predator pressure.

**Key rules.**
- Peril 0: thieves only, from year 2. Peril 1: small raids from year 2 autumn. Peril 2: ambushes and raids from year 1 autumn. Peril 3: sieges from year 3. Peril 4: everything, earlier and larger.
- Party size scales with fortress wealth and population with a soft cap; a warning "scouts seen" arrives one day before a raid (shortened by fog).
- Raiders path to the fortress's outermost door or entrance; if no path exists they loiter, take losses from ranged fire, and leave after a fixed time; they retreat when half of them are down.
- Each cavern has a spawn table activated when the layer is breached; spawns respect `MAX_CREATURES`.
- Deep pressure rises per deepsilver tile mined; at thresholds Hollow-born emerge from the rock adjacent to recently mined deepsilver.

**Reads.** 01 region; 13 wealth; 10 population; 06 weather; 03 breaches; 22 paths. **Emits.** `ThreatWarning`, `RaidArrived`, `RaidEnded`, `ThiefSpotted`, `MonsterSpawned`, `DeepStirred`.

**Player touchpoints.** Warning announcements; the threats panel (current parties, next expected pressure level); the Deep gauge.

## 19 Defense & Traps — [`19-defense-and-traps.md`](19-defense-and-traps.md)

**Purpose.** Let the map be a weapon.

**Owns.** Trap buildings and their trigger rules (stone-fall, spike, cage, weapon); mechanism links (lever or pressure plate to door, hatch, bridge, floodgate, spike trap); bridge and floodgate state and their effects on tiles and fluids; the hearth alert's civilian response; war animal stations; fortification firing rules used by 16.

**Key rules.**
- Traps trigger on hostiles and on non-fortress creatures unless a dwarf resets them; traps are re-armed by a mechanic job; cage traps hold one creature; weapon traps use loaded weapons and can jam.
- A lever links to any number of mechanisms; a pressure plate triggers on weight or fluid level; toggling takes effect after a short delay.
- A raised bridge is a wall tile; a lowered one a floor; anything on a bridge when it raises is crushed or thrown. A closed floodgate blocks fluid; an open one is a floor.
- Hearth alert: civilians path to the hearth hall or the nearest indoor tile behind a door; doors set to "lock on alert" lock.

**Reads.** 14 buildings; 16 hostility; 04 fluids; 22 paths. **Emits.** `TrapTriggered`, `TrapSpent`, `MechanismTriggered`, `CreatureCaged`.

**Player touchpoints.** Trap and mechanism building; link editor; lever pull command; alert selector.

## 20 Trade & Caravans — [`20-trade-and-caravans.md`](20-trade-and-caravans.md)

**Purpose.** Bring the outside world to the depot three times a year, and give the fortress a use for its wealth.

**Owns.** Caravan schedule per civilization; caravan parties (merchants, guards, pack animals) and their behavior (arrive, unload at depot, wait, leave); the trade session (goods on both sides, values, merchant margin, broker effect); reputation per civilization; requests for the next caravan; export preferences per civilization.

**Key rules.**
- Mountainhome in spring, Hillfolk in summer, Wildwood in autumn; none in winter. A caravan needs a reachable depot; if none exists it waits at the edge for three days and leaves.
- Merchants accept a trade when the value they receive is at least their margin above the value they give; the margin falls with the broker's skill and with reputation.
- Wildwood values wooden goods at a fraction and lowers reputation when offered them; Hillfolk pay well for metal; Mountainhome pays well for crafts and brings metal, animals and seeds.
- Requests raise the chance that next year's caravan carries the requested goods.
- Caravans are attacked by raids if present; a caravan that dies on the map lowers reputation.

**Reads.** 14 depot; 13 items and values; 10 broker skill; 18 raids. **Emits.** `CaravanArrived`, `CaravanDeparted`, `TradeCompleted`, `ReputationChanged`.

**Player touchpoints.** Trade screen at the depot; request list; reputation shown in the civilizations panel.

## 21 Immigration — [`21-immigration.md`](21-immigration.md)

**Purpose.** Grow the fortress as a reward for keeping it happy and prosperous.

**Owns.** Wave evaluation at season boundaries; wave size and composition; family generation; arrival at the map edge and integration (labors set from professions, beds unassigned).

**Key rules.**
- A wave arrives at the end of a season if hall spirit ≥ the threshold, population < cap, and fortress wealth ≥ the wave's tier requirement; the first two waves are guaranteed small ones in year 1 unless the fortress is dead.
- Wave size grows with wealth and hall spirit; composition is weighted toward the fortress's missing professions; some arrive as families with children and pets.
- Immigrants arrive with basic clothing and a tool for their profession.

**Reads.** 15 hall spirit; 13 wealth; 10 population; content: names, skills. **Emits.** `ImmigrantsArrived`.

**Player touchpoints.** Announcement; population cap setting; the new dwarves in the units panel.

## 22 Pathfinding & Spatial — [`22-pathfinding-and-spatial.md`](22-pathfinding-and-spatial.md)

**Purpose.** Answer "can this creature get there, and how" quickly and deterministically for hundreds of creatures.

**Owns.** Movement rules per tile kind and fluid level; movement classes (walker, small walker that fits through hatches, large creature that cannot use stairs); A* with a per-tick budget and a priority queue keyed by requester urgency; connectivity labels per movement class, recomputed incrementally by chunk on `TilesChanged`; path cache for stockpile and workshop routes; spatial index maintenance; line of sight.

**Key rules.**
- Cardinal and diagonal moves on a level; diagonal moves are forbidden when they would cut a wall corner; vertical moves only through stairs and ramps.
- Water at 1–`FLUID_WADE_LEVEL` doubles cost; water ≥ `FLUID_DEEP_LEVEL` and any magma are impassable; locked doors are impassable to non-owners; forbidden tiles are impassable to dwarves.
- A request is answered with "unreachable" immediately if the start and goal have different connectivity labels.

**Reads.** 03 map; 04 fluids; 14 doors and bridges. **Emits.** none; it is a service with synchronous queries.

**Player touchpoints.** None directly; unreachable jobs show the reason in the jobs panel.

## 23 Rendering — [`23-rendering.md`](23-rendering.md)

**Purpose.** Draw the world and the interface as colored glyphs, fast, on one canvas.

**Owns.** The glyph atlas per zoom; the palette (16 base colors plus named material colors); the compositor's priority rules; overlays (designations, zones, fluid levels, temperature, jobs, paths in debug); z-level see-through and dimming; the undiscovered style; animation of fluids and fire; the cursor.

**Key rules.**
- One glyph, one foreground, one background per cell. Terrain glyph and colors come from the material and tile kind; creatures from the species; items from the type; buildings from the building type; fluids from type and level.
- Open tiles show the highest non-open tile below within `LEVELS_VISIBLE_BELOW`, dimmed per level.
- Undiscovered tiles are drawn as blank rock; the surface is always discovered.
- Overlays draw on top with transparency rules that never hide creatures.

**Reads.** View model. **Emits.** none.

**Player touchpoints.** Everything visible.

## 24 UI & Input — [`24-ui-and-input.md`](24-ui-and-input.md)

**Purpose.** Give the player every action by keyboard and by mouse, and every fact by inspection.

**Owns.** The screen stack; the fortress screen's panel registry; widgets; the keymap table; the mouse model (click selects, drag designates, right-click cancels or inspects, wheel changes z-level, middle-drag pans); the look cursor; announcements and the log with severities; hints; settings; save and load screens.

**Key rules.**
- Every action is reachable with both input methods, and menus show shortcuts.
- Danger announcements pause the game and center the view on the cause.
- Panels are modal only when a decision is required (trade, embark); otherwise the map stays interactive.
- The status bar and the sidebar are text in the same cell grid as the map.

**Reads.** All readers. **Emits.** commands.

**Player touchpoints.** All of them.
