# Glossary

**Owner:** vision · **Depends on:** [vision.md](vision.md)

Every document uses these terms with exactly these meanings. When a later wave introduces a new term it is added here.

### World and map

- **World** — the generated planet: a grid of regions. Generated once per game.
- **Region** — one cell of the world map. A region has a biome, elevation, temperature band, rainfall, rivers, and the four ratings (wealth, peril, temper, plus biome). One region becomes the local map at embark.
- **Rating** — an integer 0–4 shown to the player on the world map: *wealth*, *peril*, *temper*. Biome is the fourth axis but is categorical.
- **Trait (region)** — a named special feature of a region (*Wyrm Roost*, *Serene Vale*) that changes local generation and threats.
- **Local map** — the 3D grid of tiles the fortress lives in. Fixed size (`LOCAL_MAP_W × LOCAL_MAP_H × LOCAL_MAP_Z`).
- **Tile** — one cell of the local map at (x, y, z). Also called a *cell* only when speaking of the screen grid.
- **z-level** — one horizontal layer of the local map. z=0 is the bottom. The screen shows one z-level at a time.
- **Slice** — the z-level currently shown.
- **Surface** — the z-level where a column's ground meets air. Varies by column.
- **Wall** — a solid tile of some material. Cannot be entered. Can be dug.
- **Floor** — a walkable tile with solid ground; the floor is the bottom face of the tile.
- **Open** — a tile with no floor and no wall: air, a shaft, the space above a channel. Things fall through it.
- **Ramp** — a tile that connects its own level to the level above in the direction of an adjacent wall.
- **Stairs** — up, down, or up/down stairs connecting adjacent z-levels within a column.
- **Fortification** — a wall variant that blocks movement but lets projectiles and fluids through.
- **Construction** — a wall, floor, ramp, stairs, or fortification built by dwarves out of blocks, logs or bars rather than dug from rock.
- **Chunk** — a 16×16×1 block of tiles used for dirty tracking, spatial buckets and connectivity; never visible to the player.
- **Discovered** — a tile the player has seen. Undiscovered rock is drawn blank. Tiles become discovered when adjacent to a walkable discovered tile or a dug tile, and when lit by the surface.
- **Cavern** — one of the three natural open layers in the Deep, each with its own flora and fauna.
- **Sea of Fire** — the magma layer at the bottom of every local map (`z ≤ MAGMA_SEA_TOP_Z`).
- **The Deep** — everything below the soil: caverns and the Sea of Fire.

### Time

- **Tick** — the simulation step. All durations are expressed in ticks in code.
- **Hour, day, season, year** — see `constants.md`. Four seasons: spring, summer, autumn, winter.
- **Cadence** — how often a system ticks (every N ticks).
- **Speed** — real-time multiplier: pause, 1×, 2×, 4×.

### Materials and items

- **Material** — a substance with properties (stone, soil, ore, metal, wood, leather, cloth, bone, gem, glass, plant, meat). Tiles and items both have a material.
- **Ore** — a stone material that smelts into one or more metals.
- **Bar** — the item form of a metal (or of coal, charcoal, soap). The input of the forge.
- **Flux** — a stone (limestone, marble) consumed when making steel.
- **Fuel** — coal or charcoal bars, consumed by smelters and forges that are not magma-powered.
- **Item** — an entity that can be carried, stored, and used. Has a type, a material, a quality, wear, and optionally a stack count.
- **Stack** — several identical items tracked as one entity with a count (bolts, seeds, meals).
- **Container** — an item that holds other items: barrel, bag, bin, chest, cage.
- **Quality** — one of six tiers given to a crafted item by the crafter's skill roll: poor, common, fine, superior, exceptional, masterwork.
- **Value** — an item's worth in marks: material value × type value × quality multiplier.
- **Marks** — the currency of the Mountainhome and of trade.
- **Wealth (fortress)** — the sum of the value of all items and constructions in the fortress. Drives raids and immigration.
- **Stockpile** — a zone that accepts items matching a filter. Dwarves haul matching items to it.
- **Refuse** — items marked as garbage (corpses, rotten food, shells). Kept in a refuse stockpile.
- **Miasma** — the stench spread by rotting refuse indoors. Causes unhappy thoughts.

### Dwarves

- **Dwarf** — a creature of the dwarf species under the player's stewardship. The player never controls a dwarf directly.
- **Attribute** — a slow-changing physical or mental score 0–100: Strength, Agility, Toughness, Endurance, Willpower, Wits, Charm.
- **Skill** — a learned ability 0–20 improved by doing. Each job uses one skill.
- **Skill tier** — the named band of a skill level shown to the player (Dabbling … Legendary).
- **Labor** — a category of work a dwarf is allowed to do (Mining, Hauling, Cooking …). Toggled per dwarf.
- **Profession** — the title shown for a dwarf, derived from their highest skill (Miner, Carpenter, Farmer …). Purely descriptive.
- **Need** — a slowly rising pressure that a dwarf acts to relieve: hunger, thirst, rest, social, comfort, purpose, joy.
- **Thought** — a timed, signed contribution to mood with a diary-style text. "Slept in a fine bedroom (+6, 3 days)".
- **Mood** — a dwarf's happiness, 0–100, computed from a baseline plus active thoughts and need pressure.
- **Mood tier** — Ecstatic, Content, Fine, Unhappy, Miserable. Determines productivity and sulking.
- **Hall spirit** — the average mood of all dwarves. Drives immigration and the Thane's bonus.
- **Sulk** — the worst a miserable dwarf does: a day off, a broken piece of furniture, or an argument.
- **Personality** — a small set of traits (Gregarious/Solitary, Brave/Timid, Patient/Restless, Stoic/Sensitive, Tidy/Messy, Greedy/Ascetic) that scale thoughts.
- **Position** — a title the player assigns to a dwarf: Thane, Warden, Broker, Chief Medic.
- **Squad** — a group of up to six dwarves under the Warden with a schedule, equipment and orders.
- **Alert (military)** — a fortress-wide state: *Calm*, *Watchful*, *Hearth alert*. Hearth alert sends civilians inside.

### Jobs

- **Job** — a unit of work: a type, a target, a priority, a required labor, and reserved items. Created by designations, buildings, work orders, needs and orders.
- **Designation** — a player mark on tiles asking for work: dig, channel, stairs, ramp, smooth, engrave, chop, gather, remove.
- **Priority** — an integer 1–9 on a job or designation; 1 is most urgent; 5 is default.
- **Work order** — an instruction to a workshop to make N of a recipe, optionally repeating while stock is below a threshold.
- **Recipe** — inputs, outputs, skill, time and fuel for a workshop task.
- **Hauling** — moving an item to a stockpile, workshop or building site.
- **Claim** — a worker taking a job; the job and its reserved items become unavailable to others.

### Buildings and rooms

- **Building** — a placed structure that occupies tiles: workshop, furniture, mechanism, trap, or the hearth.
- **Workshop** — a building where recipes are executed (carpenter, mason, still, kitchen, smelter, forge …).
- **Furniture** — a placed item with a function: bed, table, chair, door, chest, cabinet, statue, coffin, well.
- **Mechanism** — a lever, pressure plate, or the link between them and a door, hatch, bridge or floodgate.
- **Zone** — a player-drawn set of tiles with a purpose: bedroom, dining hall, hearth hall, hospital, barracks, pasture, farm plot, stockpile, dump, meeting area, tomb.
- **Room** — a zone whose tiles are enclosed; has a quality tier from its size, furniture, smoothing and engravings.
- **Room quality tier** — bare, modest, decent, fine, grand, royal.
- **Hearth** — the unique central building. Placed once. Its hall's quality lifts every dwarf.
- **Depot** — the trade depot building where caravans stop.

### Fluids and weather

- **Fluid level** — 0–7 units of water or magma in a tile. 7 is full.
- **Source** — a tile that refills to full: river inflow, the Sea of Fire.
- **Pressure** — the rule that lets a full connected body of fluid push fluid up to the height of its highest full tile.
- **Mist** — the spray from falling water; a happy thought for dwarves who pass through it.
- **Mud** — a floor flag left by water; allows farming on rock.
- **Weather** — the current sky state: clear, overcast, rain, storm, snow, fog, heatwave, cold snap.

### Threats and defense

- **Raid** — a hostile group arriving at the map edge with a day's warning.
- **Thief** — a single sneaking hostile that steals an item or animal.
- **Ambush** — a small hostile group without warning, only in peril ≥ 2 regions.
- **Siege** — a large raid with trollkin, peril ≥ 3, year ≥ 3.
- **Hollow-born** — the creatures of the Deep that come when deepsilver is mined.
- **Deep pressure** — the gauge raised by mining deepsilver; thresholds release Hollow-born.
- **Trap** — a building that triggers on a hostile stepping on it: stone-fall, spike, cage, weapon.
- **Burrow** — not in Deepholm. The equivalent is the *hearth alert*, which sends civilians to the hearth hall or any indoor tile behind a door.

### Trade and population

- **Caravan** — a trading party from a civilization arriving on a fixed season.
- **Civilization** — Mountainhome, Hillfolk, Wildwood, Gloam.
- **Reputation** — the fortress's standing with each civilization, from trades and events.
- **Immigrant wave** — a group of dwarves arriving when hall spirit and wealth cross thresholds.
- **Population cap** — a player setting that stops immigration.

### Software

- **System** — a package that owns a slice of simulation state and implements the system contract.
- **Reader** — a system's read-only public API.
- **Event** — a typed message queued during a tick and dispatched at its end.
- **Command** — a typed player intent applied at the start of a tick.
- **Registry** — the loaded content tables.
- **View model** — the per-frame snapshot the renderer draws.
- **Compositor** — the rules that choose what glyph and colors a screen cell shows.
- **Glyph atlas** — the pre-rendered texture of every glyph the game draws.
