# 08 Animals & Domestication

**Detail level:** W2 · **Owner:** `systems/animals` · **Depends on:** [07-plants-and-farming.md](07-plants-and-farming.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [16-combat.md](16-combat.md), [17-health-and-medicine.md](17-health-and-medicine.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Populate the surface and the caverns with wildlife, let the fortress keep, breed, milk, shear, train and slaughter animals, and make predators a part of the landscape. This system owns every creature that is neither a dwarf nor a hostile.

## Concepts

- **Species**: a row in `creatures.md`. Properties used here: `bodyPlan`, `size` (1–255; a cat is 6, a dog 20, a dwarf 60, a cow 90, a troll 140, a wyrm 220), `speed`, `diet` (`grazer`, `carnivore`, `omnivore`, `none`), `temperament` (`timid`, `neutral`, `territorial`, `aggressive`), `nocturnal`, `movementClass`, `products` (`milk`, `wool`, `eggs` with intervals), `meatBySize`, `value`, `tameable`, `trainable` (`none`, `war`, `hunting`), `biomes` with weights, group size range, `cavern` tier, `attacks`, `naturalArmor`, glyph and color.
- **Wild**: an animal with the `Wild` component; belongs to no one.
- **Tame**: an animal with the `Tame` component; belongs to the fortress.
- **Pasture**: a zone where tame grazers are kept and eat grass.
- **Condition**: a tame grazer's hunger, 0 (fed) to 100 (starving).
- **Kennel**: the workshop where training and taming happen.

## Rules

### Species fixed by this design

Surface domestic (embark and caravans): `dog`, `cat`, `cow`, `sheep`, `goat`, `chicken`, `pig`, `mule`, `yak` (cold biomes), `horse` (Hillfolk caravans only).

Surface wild by biome (weights in content): `deer`, `boar`, `wolf`, `bear`, `fox`, `rabbit`, `elk`, `mountain_goat`, `snow_leopard`, `giant_lizard`, `crocodile`, `wild_horse`, `badger`, `lynx`, `mammoth` (tundra, rare).

Cavern fauna (non-hostile, this system): `glow_beetle` (cavern 1, harmless, glows), `cave_crab` (cavern 1, timid, meat), `blind_fish` (aquatic, cavern lakes), `cave_ox` (cavern 2, grazer on cave moss, tameable), `mole_hound` (cavern 2, territorial, tameable), `ember_newt` (cavern 3, lives near magma, harmless).

Hostile cave creatures (`cave_crawler`, `blind_stalker`, `giant_cave_spider`, `troll`, `magma_wyrm`, Hollow-born) belong to 18.

### Perception and brains

Every animal has a brain state and a `thinkEvery` interval: `WILD_THINK_TICKS` for wild animals farther than `NEAR_DWARF_RADIUS` from any dwarf, `1` otherwise (a fleeing deer must react every tick). Perception is a radius by species (`perception`, default 12) on the same z-level, using the spatial index; animals do not see through walls (a cheap line-of-sight check from 22 is used only when a candidate is within radius).

### Wild behavior

States: `idle`, `graze`, `wander`, `flee`, `hunt`, `attack`, `sleep`, `leave`.

- `idle` → after a random 20–100 ticks, `graze` (grazers, if grass in radius 6), `wander` (a random walkable tile within `WANDER_RADIUS` of the home chunk), or `sleep` if it is the species' rest time (night for diurnal, day for nocturnal).
- `graze`: walk to a grass tile; on arrival, clear its grass (`GrassGrazed`), stay `GRAZE_TICKS`, then `idle`.
- Threat check every think: a *threat* is any creature of a faction the species fears: for `timid`, dwarves, hostiles and carnivores; for `neutral`, anything that attacked it; for `territorial`, nothing, but any dwarf within `TERRITORY_RADIUS` triggers `attack`; for `aggressive` carnivores, any prey (species with `size < own size × 0.8` and not carnivore) or dwarf within perception triggers `hunt` when hungry, else ignores dwarves unless approached within 3 tiles.
- `flee`: run to the tile in perception that maximizes distance from all threats, re-evaluated every think for `FLEE_TICKS`; if a map edge is within perception, use `leave` instead.
- `hunt`: path to the prey; when adjacent, `attack`. Predators are *hungry* every `PREDATOR_HUNGER_DAYS` days and stop hunting after a kill (they eat the corpse over `EAT_CORPSE_TICKS`, which consumes the corpse item).
- `attack`: set `Soldier`-like targeting through 16 (`combat.setTarget(id, targetId)`); 16 resolves attacks; the animal returns to `idle` when the target dies, flees, or is out of perception for 50 ticks. Wounded animals (blood below the species' `flee` percent, defaulting to 16's `FLEE_BLOOD_PERCENT`) flee unless `aggressive`.
- `leave`: path to the nearest map edge tile and despawn on arrival. Wild animals leave when their species count exceeds the biome cap, when they have been on the map longer than `WILD_LIFETIME_DAYS`, or when fleeing reaches an edge.

### Wild spawning

- Each `DayPassed`, for each species in the biome's list for the current season (some species are seasonal, for example `elk` in autumn and winter), if `count(species, wild) < cap(species, biome)`: with `SPAWN_PERMILLE × weight`, spawn a group of `groupSize` at a walkable outdoor edge tile at least `SPAWN_MIN_DISTANCE` from any dwarf, with `home` set to the spawn chunk. `beastwood` doubles caps and makes `wolf` and `bear` groups larger; `serene_vale` doubles herbivore caps and removes `wolf` and `bear`.
- Cavern fauna spawns once at generation per cavern (initial populations) and respawns by the same daily rule at random walkable cavern tiles once the cavern is breached.
- The global `MAX_CREATURES` cap applies.

### Tame behavior

- Tame animals are `idle`/`wander` near their pasture (grazers) or near the hearth hall and meeting areas (others), or follow their assigned dwarf (war and hunting dogs, pets). A tame animal never stops on a door tile: when its movement would end on one, it continues to the nearest walkable non-door tile beside it, on the side it was heading to (22 makes any creature on a door block the door).
- Tame `timid` animals flee hostiles; war-trained animals attack hostiles within `WAR_ANIMAL_RADIUS` of their station or their dwarf; hunting dogs attack the hunter's target.
- Tame animals do not leave the map and do not attack dwarves. A tame `territorial` species loses its territoriality.

### Pastures and feeding

- `pasture` zone: tiles must be walkable; the zone has a capacity shown as "grass tiles / grazers" and a warning if grazers exceed `grass tiles / GRASS_PER_GRAZER`.
- Assignment: `AssignPasture { animalId, zoneId | none }`. Assigned grazers path into the pasture and stay (they do not path out unless fleeing). Unassigned grazers wander near the wagon or hearth and eat any grass they find.
- Condition rises `CONDITION_PER_HOUR` per hour; eating a grass tile lowers it by `CONDITION_PER_GRASS`. At 100 the animal is `starving` (announcement, once per animal per season); after `ANIMAL_STARVE_DAYS` at 100 it dies (`CreatureDied { cause: starvation }` through 17). Snow-covered grass cannot be eaten; cold snaps double the rise.
- `none`-diet species (`dog`, `cat`, `chicken`, `pig`) need no feeding; they forage abstractly.

### Breeding

- Each `DayPassed`, for each tame species with a `breedingCap` (player setting, default `BREEDING_CAP_DEFAULT`), if `count(species, tame) < breedingCap`: for each adult female not pregnant and not `noBreed`-flagged with an adult male of the species within `BREED_RADIUS` (or in the same pasture), with `BREED_PERMILLE`, she becomes pregnant for `gestationDays`; then `litterSize` young spawn adjacent, `Tame`, unassigned, with age 0. Young are `juvenile` until `growDays`; juveniles are not milked, sheared or slaughtered by auto-orders, and produce half meat.
- Wild animals do not breed on the map; they arrive by spawning.

### Products

- `milk`: adult females of milking species produce every `milkDays`; a `milk_animal` job (labor `animal_care`, skill `animal_care`) at a farmer's workshop is created when a product is ready; the dwarf leads the animal (the animal follows the dwarf when adjacent) to the workshop and yields one `milk` item (a liquid requiring a barrel in a stockpile; 13).
- `wool`: shearing species every season; `shear_animal` job at the farmer's workshop yields `wool`.
- `eggs`: chickens lay every `eggDays` in a `nest_box` building; if no nest box exists, nothing is laid. Eggs are items collected by hauling when `autoCollect` is on; a nest box with an egg left for `HATCH_DAYS` hatches a chick if a rooster exists (this is how chickens breed instead of the pregnancy rule).
- Products are announced as notes only when they are the first of their kind.

### Slaughter

`MarkSlaughter { animalId }` sets a flag; the `slaughter` job (labor `butchery`, skill `butchery`) leads the animal to a butcher's workshop and kills it there (no combat; the animal becomes a corpse item at the workshop) and immediately queues the butcher job (09). Animals marked while assigned to a pasture leave the pasture with the butcher. War and hunting animals cannot be marked while assigned to a dwarf.

### Training and taming

- `TrainAnimal { animalId, kind: war | hunting }` for `trainable` species: a `train_animal` job (labor `animal_training`, skill `animal_training`) at a kennel; work `TRAIN_TICKS`; success with `TRAIN_BASE_PERMILLE + skill × TRAIN_PER_SKILL`; failure just retries. Trained animals get bigger attacks (`war`: +50% damage, `naturalArmor + 1`) and follow their assigned dwarf (`AssignAnimal { animalId, dwarfId | stationZone }`).
- Taming: a wild animal caught in a cage trap (19) is an item-like caged creature; `TameCaged { cageId }` for `tameable` species creates a `tame_animal` job at a kennel; success by the same formula; on success the creature becomes `Tame` and is released next to the kennel; on failure it stays caged and can be retried. Untameable creatures stay in the cage forever, can be sold to caravans (Mountainhome buys exotic beasts), or be released (which is dangerous).

### Pets

- Each season, each `cat` not already a pet adopts a random dwarf with `ADOPT_PERMILLE` (`PetAdopted`, a thought for the dwarf). Dogs can be assigned as pets by the player. A pet follows its dwarf loosely (within 5 tiles) and its death gives the owner grief (15).

### Death

Animals die through 17 like every creature. A dead animal leaves a corpse item (13). Tame deaths are announced as notes; pet deaths as alerts.

## State

- Per animal: `Wild { state, homeChunk, stateUntilTick, hungry, lastThinkTick }` or `Tame { pastureId, condition, trained, assignedTo, pregnantUntil, lastProductTick[], juvenileUntil, slaughter, pet }`.
- `breedingCaps: Map<species, number>`, `speciesCounts` (recomputed daily), `nestBoxes: EntityId[]`.
- Rng stream.

## Interfaces

Implementation note: Additional public queries and secondary emitters implement the rules above; reader additions: `animals.breedingCap`, `animals.capOf`, `animals.nestBoxes`; events additions: `CorpseCreated`, `CreatureDied`, `CreatureFled`, `Starvation`; commands additions: `NameAnimal`; audited in DECISIONS D-220.

### Reader

- `animals.isWild(id)`, `animals.isTame(id)`, `animals.state(id)`
- `animals.tameList()`, `animals.wildList()`, `animals.bySpecies(species, wild?)`
- `animals.pastureOf(id)`, `animals.condition(id)`, `animals.assignedTo(id)`
- `animals.threatTo(id)` — whether the animal currently treats the fortress as a threat (used by 16 for hostility)
- `animals.def(species)`

### Commands

`AssignPasture`, `MarkSlaughter`, `UnmarkSlaughter`, `TrainAnimal`, `TameCaged`, `AssignAnimal`, `SetBreedingCap { species, cap }`, `ReleaseCaged { cageId }`.

### Events consumed

`DayPassed`, `HourPassed`, `CavernBreached`, `CreatureDied`, `AttackResolved` (to react to being attacked), `TrapTriggered` (cage), `JobCompleted` for its job types, `ZoneChanged` for pastures.

### Events emitted

`AnimalSpawned { id, species }`, `AnimalBorn { id, species }`, `AnimalStarving { id }`, `GrassGrazed { tile }`, `ProductReady { id, product }`, `AnimalTamed { id }`, `AnimalTrained { id, kind }`, `PetAdopted { animalId, dwarfId }`, `AnimalLeft { id }`.

### Registrations

Job producer `animals` (`milk_animal`, `shear_animal`, `slaughter`, `train_animal`, `tame_animal`, `collect_egg`); panel `animals` (hotkey in 24); inspector section `creature › animal`; announcements for starving, pet death (via 17), adoption.

## Player-facing behavior

- Animals panel: tabs Tame (species, name if any, pasture, condition bar, trained, pregnant, actions) and Wild (species, count, huntable toggle from 09, "seen near" location); breeding caps per species.
- Pasture zone: capacity line; assigning by selecting animals in the panel or by clicking an animal and choosing "Pasture".
- Glyphs: lowercase letters by species (`d` dog, `c` cat, `C` cow is uppercase to read as large; the convention is lowercase for small and medium, uppercase for large animals; hostiles are uppercase in red).
- Announcements: "A pack of wolves has arrived from the north" (note), "The cow is starving" (alert), "The cat has adopted Ketil Ironvein" (note).

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `WILD_THINK_TICKS` | 10 | Think interval when far from dwarves |
| `NEAR_DWARF_RADIUS` | 20 | |
| `WANDER_RADIUS` | 16 | |
| `GRAZE_TICKS` | 60 | |
| `TERRITORY_RADIUS` | 5 | |
| `FLEE_TICKS` | 200 | |
| `FLEE_BLOOD_PERCENT` | 50 | Default flee threshold; defined in 16; species override it with their `flee` column |
| `PREDATOR_HUNGER_DAYS` | 3 | |
| `EAT_CORPSE_TICKS` | 300 | |
| `WILD_LIFETIME_DAYS` | 28 | |
| `SPAWN_PERMILLE` | 150 | Per species per day when below cap |
| `SPAWN_MIN_DISTANCE` | 25 | Tiles from any dwarf |
| `GRASS_PER_GRAZER` | 6 | Pasture capacity rule |
| `CONDITION_PER_HOUR` | 2 | |
| `CONDITION_PER_GRASS` | 25 | |
| `ANIMAL_STARVE_DAYS` | 10 | Days at condition 100 before a grazer dies (dwarves use 10's `STARVE_DAYS`) |
| `BREEDING_CAP_DEFAULT` | 12 | Per species |
| `BREED_RADIUS` | 10 | |
| `BREED_PERMILLE` | 60 | Per eligible female per day |
| `HATCH_DAYS` | 12 | |
| `TRAIN_TICKS` | 400 | |
| `TRAIN_BASE_PERMILLE` | 300 | |
| `TRAIN_PER_SKILL` | 35 | Per skill level |
| `WAR_ANIMAL_RADIUS` | 8 | |
| `ADOPT_PERMILLE` | 250 | Per cat per season |

Species values (size, speed, products, intervals, gestation, litter, growth) are content.

## Extension points

- Herding behavior (animals keeping together) is a wander bias toward the group centroid.
- Milking and shearing at pasture instead of at a workshop: change the job target.
- Animal happiness (pastured animals happier, affects products): a field on `Tame`.
- New products (honey, silk) are product rows with a job type.
