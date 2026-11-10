# 08 Animals & Domestication

**Owner:** `systems/animals` · **Depends on:** [07-plants-and-farming.md](07-plants-and-farming.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [16-combat.md](16-combat.md), [17-health-and-medicine.md](17-health-and-medicine.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

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

Every animal has a brain state and a `thinkEvery` interval: `WILD_THINK_TICKS` for wild animals farther than `NEAR_DWARF_RADIUS` from any dwarf, `1` otherwise (a fleeing deer must react every tick). Tame animals use `WILD_THINK_TICKS` between ordinary thinks. Perception is a radius by species (`perception`, default 12) on the same z-level, using the spatial index; animals do not see through walls (a cheap line-of-sight check from 22 is used only when a candidate is within radius).

### Wild behavior

States: `idle`, `graze`, `wander`, `flee`, `hunt`, `attack`, `eat`, `sleep`, `leave`.

- `idle` → after a random 20–100 ticks, `graze` (grazers, if grass in radius 6), `wander` (a random walkable tile within `WANDER_RADIUS` of the home chunk), or `sleep` if it is the species' rest time (night for diurnal, day for nocturnal). A wander ends on arrival or after `WANDER_TIMEOUT_TICKS = 200`.
- `graze`: grass in a pasture zone is eligible like other grass; zones do not fence out wild animals. Walk to a grass tile; on arrival, clear its grass (`GrassGrazed`), stay `GRAZE_TICKS`, then `idle`.
- Threat check every think: a *threat* is any creature of a faction the species fears: for `timid`, dwarves, hostiles and carnivores; for `neutral`, anything that attacked it; for `territorial`, nothing, but any dwarf within `TERRITORY_RADIUS` triggers `attack`; for `aggressive` animals, nothing either (one that is struck attacks back, below), but a quarry within perception (below) triggers `hunt` when hungry, else the animal enters `attack` when a dwarf approaches within `APPROACH_RADIUS = 3`.
- `sleep`: the animal stays asleep for 600 ticks, then `idle`; a threat wakes it as in `idle`. An animal struck in its sleep (an `AttackResolved` against it with outcome `hit`) wakes at once; one attacked in its sleep with outcome `miss`, `parried` or `blocked` wakes the same way on a `NOISE_MISS_PERMILLE` roll, else sleeps on (T-540, *Noise*, below). Woken by an attack on it: below its `flee` percent it flees the attacker unless `aggressive`, as in `attack`; else a `territorial` one starts a defending attack on the attacker from the tile where it lies, as `idle`'s rule starts one, wherever the attacker stands; an `aggressive` one attacks the attacker back as when struck awake (*Struck*, below); any other returns to `idle` with no wait, where at its next think its threats decide, and with none it goes back to sleep if it is still its rest time.
- *Noise* (T-540). A sleeper may wake from noise near it, on a roll on the animals' stream drawn only when it hears something. Each noise has a loudness, its wake chance one tile away: an attack on the sleeper that misses, is parried or is blocked, `NOISE_MISS_PERMILLE` (the loudest short of a hit, at any distance from the attacker); any attack (`AttackResolved`, any outcome) on another creature, `NOISE_FIGHT_PERMILLE`, heard by each wild sleeper within `NOISE_RADIUS` of the struck creature but the two fighters, in ascending id; and a conscious dwarf, `NOISE_DWARF_METAL_PERMILLE` when it wears any armour piece or shield of a `metal` material, else `NOISE_DWARF_PERMILLE` (leather, cloth or none), heard every `NOISE_LISTEN_TICKS` ticks (at a think whose tick plus the animal's id is a multiple of it; a sleeper near a dwarf thinks every tick) from each dwarf within `NOISE_RADIUS`, in ascending id until one wakes it. Distance is Chebyshev on the same level, with no line of sight needed; the chance is `floor(loudness × (NOISE_RADIUS + 1 − max(1, distance)) / NOISE_RADIUS)` permille, 0 beyond `NOISE_RADIUS`. A sleeper woken by noise other than an attack on it flees the noise's maker (the attacker, or the dwarf) below its flee percent, as a struck sleeper does; any other returns to `idle` with the ordinary idle wait, where its next think decides: a territorial one defends against a dwarf within `TERRITORY_RADIUS`, an aggressive one against a dwarf within `APPROACH_RADIUS`, a timid one flees what it sees, and with nothing to do it sleeps again after the wait if it is still its rest time. A noise never wakes a caged animal.
- *Heavy sleepers* (T-540, the owner's request). Each wild animal is a heavy sleeper or not, decided once when 08 spawns it, from its id alone (a hash, no stream), about `HEAVY_SLEEPER_PERMILLE` in a thousand, and kept in `Wild.heavySleeper`. A heavy sleeper's chance from any noise is the ordinary chance divided by `HEAVY_SLEEPER_NOISE_DIVISOR` (rounded down; at 0 nothing is drawn); a hit still wakes it at once. The look panel's creature tab shows "A heavy sleeper." under its name.
- `flee`: run to the tile in perception that maximizes distance from all threats, re-evaluated every think for `FLEE_TICKS`; if a map edge is within perception, use `leave` instead.
- `hunt`: path to the quarry; when adjacent, `attack`. Predators are *hungry* every `PREDATOR_HUNGER_DAYS` days and stop hunting after a kill (they eat the corpse over `EAT_CORPSE_TICKS`, which consumes the corpse item): a `CreatureDied` whose killer is a hungry predator ends its hunger and the hunger of every member of its pack, and a hunting predator that is no longer hungry returns to `idle`. On that kill, clear each newly fed member's hunting target and pursuit path, including an `attack` its hunt led to; a genuine defending attack keeps its target under the defending rules.
- `eat`: only the killer takes the physical corpse meal; the pack's hunger still ends at the kill. Save the killed creature id until 13's `CorpseCreated` supplies its corpse item id. Then walk to the ground corpse and wait `EAT_CORPSE_TICKS` there before consuming it through 13's item API. Save the item and deadline; an ordinary think interval change does not extend the deadline. A missing, carried-away or unreachable corpse ends the meal without another consumption. A genuine defending attack, flee or leave keeps precedence over walking to the meal; after a defence or flee ends, idle/wander may take the waiting meal.
- The quarry. *Prey* is an animal, wild or tame, of a non-carnivore species with `size < own size × 0.8 × members`. A *pack* is the wild animals of one species that arrived on the map in the same group (the same species and the same arrival tick). Count its living members that perceive the quarry, including the hunter, up to `PREY_PACK_MAX_MEMBERS`; perception requires the same level, range and line of sight. A lone predator keeps the single-animal size limit. Check the limit when choosing or sharing a quarry and while holding it in `hunt` or a hunting `attack`; a pack that loses enough members to make the quarry too large drops it. Dwarves are not judged by this size rule. A hungry predator prefers prey to dwarves: its quarry is the nearest prey within perception (Chebyshev distance, then lowest id), and the nearest dwarf within perception only when no prey is. The pack shares one quarry: while a hungry member hunts a quarry (in `hunt`, or in the `attack` its hunt led to), another member that becomes hungry or loses its quarry takes the same one if it perceives it and the size limit still allows it, and does not hunt while it does not. The quarry is chosen when the hunt starts, and again only when it is lost.
- `attack`: set `Soldier`-like targeting through 16 (`combat.setTarget(id, targetId)`); 16 resolves attacks. The attack ends when the target dies or is out of perception for `ATTACK_PERCEPTION_GRACE_TICKS` consecutive ticks, and the animal returns to `idle`; it ends as well when the target of a defending animal flees (below). Save the first observed loss of perception (level, species range or line of sight), clear it when sight returns, and end the attack at its deadline even between ordinary thinks. The current animal-quarry size rule still applies: the grace does not retain prey after too few living pack members perceive it. A defending attack still ends immediately when its target leaves the defended ground or becomes unconscious. 16 retains a wild attack target until this brain drops it rather than applying its generic perception cutoff. The animal never takes a new target while in `attack`: only the rules of `idle` start another attack. Wounded animals (blood below the species' `flee` percent, defaulting to 16's `FLEE_BLOOD_PERCENT`) flee unless `aggressive`: an aggressive species flees only below a `flee` percent of its own (a wolf at 45, a bear at 35), never at the default (16 § Fleeing and morale in combat).
- *Struck* (T-538). An `aggressive` animal fears no attacker. One that is struck (an `AttackResolved` against it, whatever the outcome) while in `idle`, `graze`, `wander` or `eat` attacks the striker back at once, wherever the striker stands: a defending attack (below) whose ground is the tile the striker stood on when it struck, so it charges an archer and lets go of a striker that runs farther than `APPROACH_RADIUS` from that tile. Below its species' own `flee` percent it flees the striker instead, as in `attack`; above it, however hurt, it fights. In `attack` or `hunt` it keeps its target, and in `flee` or `leave` it keeps going. A meal it was walking to waits, as after any defence.
- *Defending* and *hunting* attacks. An attack that `idle` starts because a dwarf came within `TERRITORY_RADIUS` (territorial) or `APPROACH_RADIUS` (aggressive) is a defence of the tile where it began, which the animal remembers; one that a strike starts defends the striker's tile (above). The target *flees* when it is farther than that same radius from that tile, or on another level; the animal also lets go of a target that is unconscious. Either way it drops the target and starts a `wander`, which ignores dwarves until it ends, so it does not attack the same dwarf again at once. An attack that a `hunt` leads to has no such limit: a hungry predator keeps its prey until the prey dies or is out of perception. A hunting attack is `hunt`, or `attack` with no defended tile; a fleeing civilian that a hunting animal hits in melee is caught (10), and one that a defending animal hits keeps fleeing and is let go when it leaves the ground.
- *Ground away from the fortress* (T-446). A territorial surface animal (a species with biomes, temperament `territorial`) keeps no home chunk whose centre lies within `TERRITORY_AVOID_RADIUS` tiles (horizontal Chebyshev, any level) of the fortress: the wagon, any built building's footprint and any zone's tiles. At every think in `idle`, `graze`, `wander` or `sleep`, if its home chunk is that near, it takes as home the nearest chunk on the same level whose centre is not (by chunk distance, ties by the lower chunk index) and starts a `wander` toward it; with no such chunk it `leave`s. The fortress's extent is recomputed when a building is completed or removed and when a zone changes. A dwarf who walks into its ground is still attacked as above.
- `leave`: path to the nearest map edge tile and despawn on arrival. The edge tile is the nearest, by Chebyshev distance, of the four edge tiles in a straight line from the animal (west, east, north and south on its level) that it can stand on and reach (22's connectivity); with none, the animal despawns where it is. It keeps that tile while the walk to it lasts, and chooses again only when the walk ends without arriving. Wild animals leave when their species count exceeds the biome cap, when they have been on the map longer than `WILD_LIFETIME_DAYS`, or when fleeing reaches an edge.

### Wild spawning

Species eligibility uses the season of the year (`0` spring, `1` summer, `2` autumn, `3` winter), independent of the year number.

- Each `DayPassed`, for each species in the biome's list for the current season (some species are seasonal, for example `elk` in autumn and winter), if `count(species, wild) < cap(species, biome)`: with `min(1000, floor(SPAWN_PERMILLE × weight / 100))`, with weight a percentage of the base rate, spawn a group of `groupSize` at a walkable outdoor edge tile at least `SPAWN_MIN_DISTANCE` from any dwarf, with `home` set to the spawn chunk. The region-trait hooks govern wildlife: `beastwood` multiplies all caps by 1.5, then wolf and bear caps by 2, and doubles those species' groups; `serene_vale` doubles grazer caps and removes wolves, bears and snow leopards; `fungal_depths` multiplies cavern caps by 1.5; `frostmarrow` adds the wild `yak` to the biome's list with weight `FROSTMARROW_YAK_WEIGHT` and groups of 2–4 (the yak row's own group is for the herd at embark), and raises a nonzero snow leopard cap by 2. Each cap multiplier rounds up.
- On the first breach of each cavern with nonzero fauna `cavern.initial`, spawn that many individuals of each eligible fauna species on random walkable cavern floor tiles in that species' movement class, limited by its remaining live cap and `MAX_CREATURES`. No fauna thinks in an unbreached cavern. Record the tier as initialized even when caps or lack of safe tiles prevent a spawn; repeated breach notifications and loading never retry the initial population. A zero initial count consumes no spawning randomness and needs no saved completion entry. After breach, fauna respawns by the existing daily rule.
- The global `MAX_CREATURES` cap applies.

### Tame behavior

- Tame animals are `idle`/`wander` near their pasture (grazers) or near the hearth hall and meeting areas (others), or follow their assigned dwarf (war and hunting dogs, pets). One with no pasture stands on a tile of the hearth hall or beside it. It stays there unless another idle tame animal of a lower id shares the tile; then it takes the walkable tile of the hall, not a door, with the fewest creatures on it or walking to it, ties by lowest index, if that is fewer than it has, and a tile beside the hall only if that is fewer still. Passers-by do not move it. A walk that has arrived is over: one whose target is the animal's own tile is not a walk to that tile, and the animal stops it once it is home (T-482). A tame animal never stops on a door tile: when its movement would end on one, it continues to the nearest walkable non-door tile beside it, on the side it was heading to (14 does not lock a door on a creature in its doorway).
- *The pets' heap* (T-482, a [fun feature](../fun-features.md), removable). A *pet* here is an idle tame animal of this kind that is not a grazer and is no larger than `PET_PILE_SIZE_MAX` (dogs, cats, foxes, chickens; not a pig). The *pets' spot* is the walkable tile beside the hearth hall's hearth (same level, the 8 tiles around it), not a door, not beside a door (a face neighbour) and with no building on it, that has the most of its 8 neighbours taken by a wall, the hearth or furniture (impassable to walkers, or holding a building): a nook off the hall's walking lines, ties by the lowest index. Every pet favours the same spot, so they heap there: a pet goes to it while fewer than `PET_PILE_MAX` pets stand on it or walk to it, and one already on it stays unless `PET_PILE_MAX` pets of lower ids lie there with it; the rest spread by the rule above, which never sends an animal onto the spot and moves a creature that is not heaped there off it. A pet that a think leaves on the spot lies *curled*: it counts for no crowd (22 § Crowding) until it walks again, so the heap slows no one stepping over it. A hall with no built hearth has no spot.
- *The cats' corner* (T-510, a [fun feature](../fun-features.md), removable). Cats keep to themselves: a *cat* (a pet of a species that adopts a dwarf, § Pets) heaps by the same rule, not on the pets' spot but on the *cats' corner*: the walkable tile of the hearth hall, not a door, not beside a door (a face neighbour), with no building on it and not the pets' spot, that has the most of its 8 neighbours taken by a wall or furniture (as for the pets' spot), ties by the farthest (in tiles, the larger of the two axis distances) from the hall's nearest *way in* (a hall tile with a walkable tile outside the hall among its 8 neighbours), then by the lowest index: a corner of the hall away from where creatures walk in. At most `PET_PILE_MAX` cats heap there, curled, and the rule above moves any other creature off it as it does off the pets' spot; other pets do not heap on it, and cats do not heap on the pets' spot. A hall needs no hearth for the corner.
- Tame `timid` animals flee hostiles; war-trained animals attack hostiles within `WAR_ANIMAL_RADIUS` of their station or their dwarf; hunting dogs attack the hunter's target.
- Tame animals do not leave the map and do not attack dwarves. A tame `territorial` species loses its territoriality.

### Pastures and feeding

- `pasture` zone: tiles must be walkable; the zone has a capacity shown as "grass tiles / grazers" and a warning if grazers exceed `grass tiles / GRASS_PER_GRAZER`. The allowance is for replenishing, accessible grass through the growing seasons, with no competing grazers; it includes a reserve for regrowth requiring a cardinal grass neighbour and uneven regrowth. It is a conservative warning, not a promise under snow, cold snaps, hostile interference or competition.
- Winter feeding: outdoor grass does not regrow and snow-covered grass cannot be eaten, so outdoor capacity is not a winter feeding guarantee. Move retained grazers to a walkable cave-loam pasture with unsnowed cave moss at the same capacity allowance before surface feeding stops, or reduce the herd. Cave moss uses the normal grass-regrowth rule throughout winter; animals do not eat stored fodder or plant-food items.
- Reject `AssignPasture` with `not_tame` for an untamed animal, or `not_grazer` for a tame animal whose diet is not grazer, without changing its assignment.
- Assignment: `AssignPasture { animalId, zoneId | none }`. Assigned grazers path into the pasture and stay (they do not path out unless fleeing). Unassigned grazers wander near the wagon or hearth and eat any grass they find.
- Condition rises `CONDITION_PER_HOUR` per hour; eating a grass tile lowers it by `CONDITION_PER_GRASS`. One grass tile feeds one grazer: the first to eat it claims the tile, and until 07 has cleared the flag no other grazer eats it or walks to it; a grazer standing on a claimed tile looks for other grass. A hungry tame grazer walks to the nearest grass tile of its pasture (with no pasture, within 6 tiles) that it can reach: grass in another region of its movement class, such as a tile shut in by trees, is passed over. It keeps walking to the tile it is walking to while that tile is still grass for it (uneaten, unclaimed, in its pasture, or within 6 tiles with no pasture, and in its region), and does not choose again on each think. A walk that comes back unreachable, such as one through a `no_pets` door (which the regions, computed with no faction, do not show), makes the grazer pass over that tile for `GRAZE_SKIP_TICKS`; the skip is part of 08's saved state. The claim is part of 08's saved state and ends when 07's change to the tile is announced (`TilesChanged`), or at once if the tile has no grass. At 100 the animal is `starving` (announcement, once per animal per season); after `ANIMAL_STARVE_DAYS` at 100 it dies (`CreatureDied { cause: starvation }` through 17). Snow-covered grass cannot be eaten; cold snaps double the rise.
- Only tame grazers accumulate condition and eat grass. Other diets, including carnivores, omnivores and `none`, forage abstractly without a concrete feeding action.

### Breeding

- Each `DayPassed`, for each tame species with a `breedingCap` (player setting, default `BREEDING_CAP_DEFAULT`), if `count(species, tame) < breedingCap`: for each adult female not pregnant and not `noBreed`-flagged with an adult male of the species within `BREED_RADIUS` (or in the same pasture), with `BREED_PERMILLE`, she becomes pregnant for `gestationDays`; then `litterSize` young spawn adjacent, `Tame`, unassigned, with age 0. Young are `juvenile` until `growDays`; juveniles are not milked, sheared or slaughtered by auto-orders, and produce half meat.
- Wild animals do not breed on the map; they arrive by spawning.

### Products

- `milk`: adult females of milking species produce every `milkDays`; a `milk_animal` job (labor `animal_care`, skill `animal_care`) at a farmer's workshop is created when a product is ready; the dwarf leads the animal (the animal follows the dwarf when adjacent) to the workshop and yields one `milk` item (a liquid requiring a barrel in a stockpile; 13).
- `wool`: shearing species every season; `shear_animal` job at the farmer's workshop yields `wool`.
- `eggs`: chickens lay every `eggDays` in a `nest_box` building; if no nest box exists, nothing is laid. An egg is reserved while it stays in its nest box, keeping it out of ordinary item hauling. With `autoCollectProducts` on, the `collect_egg` job lifts it to the worker's tile and releases it for ordinary stockpile hauling; a nest box with an egg left for `HATCH_DAYS` hatches a chick if a rooster exists (this is how chickens breed instead of the pregnancy rule).
- Products are announced as notes only when they are the first of their kind.

### Slaughter

`MarkSlaughter { animalId }` sets a flag; the `slaughter` job (labor `butchery`, skill `butchery`) leads the animal to a butcher's workshop and kills it there (no combat; the animal becomes a corpse item at the workshop) and emits `CorpseCreated`; 09 produces the butcher job for that corpse. Slaughter saves an optional `juvenile` marker on the corpse. Juvenile meat is `max(1, floor(adultMeat / 2))`; every other yield uses the species' full size. Animals marked while assigned to a pasture leave the pasture with the butcher. War and hunting animals cannot be marked while assigned to a dwarf.

### Training and taming

- `TrainAnimal { animalId, kind: war | hunting }` for `trainable` species: a `train_animal` job (labor `animal_training`, skill `animal_training`) at a kennel; work `TRAIN_TICKS`; success with `TRAIN_BASE_PERMILLE + skill × TRAIN_PER_SKILL`; failure just retries. Trained animals get bigger attacks (`war`: +50% damage, `naturalArmor + 1`) and follow their assigned dwarf (`AssignAnimal { animalId, dwarfId | stationZone }`).
- Taming: a wild animal caught in a cage trap (19) is an item-like caged creature; `TameCaged { cageId }` for `tameable` species creates a `tame_animal` job at a kennel; success by the same formula; on success the creature becomes `Tame` and is released next to the kennel; on failure it stays caged and can be retried. Untameable creatures stay in the cage forever, can be sold to caravans (Mountainhome buys exotic beasts), or be released (which is dangerous).

### Pets

- Each season, each `cat` not already a pet adopts a random dwarf with `ADOPT_PERMILLE` (`PetAdopted`, a thought for the dwarf). Dogs can be assigned as pets by the player. A pet follows its dwarf loosely (within 5 tiles) and its death gives the owner grief (15). While its dwarf stands in the hearth hall or beside it, a pet (a dog or hunting animal following its dwarf too, but not a war animal at its station) is idle in the hall like any tame animal with no pasture (§ Tame behavior): it takes its tile by the spreading rule, or heaps on the pets' spot or the cats' corner, so pets that came in with their dwarves do not stop together on the hall's way in (T-510); once its dwarf is elsewhere it follows again. On the owner's `CreatureDied`, the pet's `petOf` becomes 0 in the same tick, so it can be adopted again.

### Death

Animals die through 17 like every creature. A dead animal leaves a corpse item (13), except a summon (§ Summons). Slaughter completion creates its own corpse, and `CorpseCreated` removes the pending general death-to-corpse transition so no second corpse is created. Tame deaths are announced as notes; pet deaths as alerts.

### Summons

25's summons (25 § Summons) are creatures of a species whose row has `flags.summoned`; each carries `Summoned`. A called summon is a tame animal of the fortress, war-trained and assigned to its caster, so the tame brain drives it as it drives any war animal: it attacks hostiles within `WAR_ANIMAL_RADIUS` of its caster and otherwise follows it within 1 tile. A wisp loose from a sanctum mishap is wild, and the wild brain wanders it; the daily lifetime and cap check (`leave`) passes over a summon, which keeps to its own day. The reader's `tameList`, `wildList` and `bySpecies` leave summons out, so the animals panel, the hunters' quarry and the threats panel never list one. Every command that names a summon (`AssignPasture`, `MarkSlaughter`, `UnmarkSlaughter`, `TrainAnimal`, `AssignAnimal`, `NameAnimal`, and `TameCaged` for a caged one) is refused with `not_found`. A summon leaves no corpse, and its death gives no grief: it is no one's pet.

## State

- Per wild animal: `Wild { state, homeChunk, stateUntil, hungry, lastThinkTick, arrivedTick, defendFrom?, unseenSince?, pendingMeal?, mealId?, heavySleeper? }`. `defendFrom` is the defended tile, present only during that attack. A saved attack without it is a defence of the animal's current tile unless hungry. `unseenSince` is the first lost-perception tick; `pendingMeal` awaits the killed creature's corpse notification; `mealId` is the corpse being approached or eaten. `stateUntil` is 0 during meal travel and the deadline while eating. Absent fields in older saves mean no grace or meal, and a light sleeper.
- Per tame animal: `Tame { pastureId, condition, trained, assignedTo, pregnantUntil, lastProductTick[], juvenileUntil, slaughter, pet }`.
- `breedingCaps: Map<species, number>`, `speciesCounts` (recomputed daily), `nestBoxes: EntityId[]`.
- `initializedCaverns`: sorted tiers whose nonzero initial fauna has been attempted. Omitted when empty; older saves without it have no completed initial attempt.
- Rng stream.

## Interfaces

### Reader

- `animals.isWild(id)`, `animals.isTame(id)`, `animals.state(id)`
- `animals.tameList()`, `animals.wildList()`, `animals.bySpecies(species, wild?)` — none lists a summon (§ Summons)
- `animals.pastureOf(id)`, `animals.condition(id)`, `animals.assignedTo(id)`
- `animals.threatTo(id)` — whether the animal currently treats the fortress as a threat (used by 16 for hostility)
- `animals.def(species)`
- `animals.capOf(species)` — the live cap of a wild species in this region
- `animals.breedingCap(species)` — the player's breeding cap for a species (`BREEDING_CAP_DEFAULT` until set)
- `animals.nestBoxes()` — the nest box buildings, ascending id
- `animals.isDangerous(species)` — whether the species is dangerous (§ Registrations)

### Commands

`AssignPasture`, `MarkSlaughter`, `UnmarkSlaughter`, `TrainAnimal`, `TameCaged`, `AssignAnimal`, `SetBreedingCap { species, cap }`, `ReleaseCaged { cageId }`, `NameAnimal { animalId, name }` (a tame animal).

### Events consumed

`DayPassed`, `HourPassed`, `CavernBreached`, `CreatureDied`, `CorpseCreated` (associate a pending predator meal), `AttackResolved` (to react to being attacked), `TrapTriggered` (cage), `JobCompleted` for its job types, `ZoneChanged` for pastures, `TilesChanged` (ends the claim on a grazed tile once 07 has written its change).

### Events emitted

`AnimalSpawned { id, species }`, `AnimalBorn { id, species }`, `AnimalStarving { id }`, `GrassGrazed { tile }`, `ProductReady { id, product }`, `AnimalTamed { id }`, `AnimalTrained { id, kind }`, `PetAdopted { animalId, dwarfId }`, `AnimalLeft { id }`. This system also emits events that other systems own: `CreatureFled` (a wild animal starts to flee), `Starvation` (an animal has starved to the point of death; 17 applies it), and `CreatureDied` with `CorpseCreated` (a slaughter kills the animal and makes its corpse directly).

### Registrations

Job producer `animals` (`milk_animal`, `shear_animal`, `slaughter`, `train_animal`, `tame_animal`, `collect_egg`); panel `animals` (hotkey in 24); inspector section `creature › animal`; announcements for starving, pet death (via 17), adoption and the arrival of a dangerous species.

A *dangerous* species is a surface species (it has biomes) that is not `timid` and is a carnivore, `aggressive` or `territorial`; the content row decides, no species id appears in code. `AnimalSpawned` for a dangerous species is announced as an alert, in the same batch as one line per species ("A bear has come to the valley.", "3 wolves have come to the valley."); any other species keeps the note ("A deer has arrived.").

## Player-facing behavior

- Animals panel: tabs Tame (species, name if any, pasture, condition bar, trained, pregnant, actions) and Wild (species, count, huntable toggle from 09, "seen near" location); breeding caps per species. Tame offers a clickable train action (`Shift+T`): War/Hunting, arrows and Enter or a click, Esc to cancel. Training status is shown while a job exists (also for retraining), otherwise war, hunting or blank. A non-trainable species is explained on the status row; a missing kennel refusal says to build one.
- Pasture zone: capacity line; assigning by selecting animals in the panel or by clicking an animal and choosing "Pasture".
- Glyphs: lowercase letters by species (`d` dog, `c` cat, `C` cow is uppercase to read as large; the convention is lowercase for small and medium, uppercase for large animals; hostiles are uppercase in red).
- Announcements: "A bear has come to the valley." (alert, a dangerous species), "A deer has arrived." (note), "The cow is starving" (alert), "The cat has adopted Ketil Ironvein" (note).

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `WILD_THINK_TICKS` | 10 | Think interval when far from dwarves (*unmeasured*) |
| `NEAR_DWARF_RADIUS` | 20 | *unmeasured* |
| `WANDER_RADIUS` | 16 | *unmeasured* |
| `GRAZE_TICKS` | 60 | *unmeasured* |
| `GRAZE_SKIP_TICKS` | 600 | Ticks a grazer passes over a grass tile whose walk came back unreachable (*unmeasured*) |
| `TERRITORY_RADIUS` | 5 | |
| `TERRITORY_AVOID_RADIUS` | 16 | Tiles from the fortress within which a territorial animal keeps no home chunk (T-446). At 24 no chunk of a 48 × 48 map is far enough, so territorial animals never stay there; *unmeasured* otherwise |
| `FLEE_TICKS` | 200 | *unmeasured* |
| `NOISE_RADIUS` | 4 | Tiles within which a sleeper hears a noise (T-540, *unmeasured*) |
| `NOISE_MISS_PERMILLE` | 600 | Wake chance of a miss, parry or block on the sleeper (T-540, *unmeasured*) |
| `NOISE_FIGHT_PERMILLE` | 250 | Wake chance of an attack on another creature one tile away (T-540, *unmeasured*) |
| `NOISE_DWARF_METAL_PERMILLE` | 100 | Wake chance of a dwarf in metal armour one tile away, per listen (T-540, *unmeasured*) |
| `NOISE_DWARF_PERMILLE` | 30 | Wake chance of a dwarf in leather or no armour one tile away, per listen (T-540, *unmeasured*) |
| `NOISE_LISTEN_TICKS` | 10 | Ticks between a sleeper's listens for dwarves (T-540, *unmeasured*) |
| `HEAVY_SLEEPER_PERMILLE` | 200 | Share of wild animals that are heavy sleepers (T-540, *unmeasured*) |
| `HEAVY_SLEEPER_NOISE_DIVISOR` | 10 | A heavy sleeper's noise chances are the ordinary ones divided by this (T-540, *unmeasured*) |
| `FLEE_BLOOD_PERCENT` | 50 | Default flee threshold; defined in 16; species override it with their `flee` column (*unmeasured*) |
| `PREDATOR_HUNGER_DAYS` | 3 | *unmeasured* |
| `PREY_PACK_MAX_MEMBERS` | 3 | Maximum living pack members in perception of the quarry contributing to its size limit |
| `EAT_CORPSE_TICKS` | 300 | *unmeasured* |
| `ATTACK_PERCEPTION_GRACE_TICKS` | 50 | Consecutive unseen ticks before a held attack ends |
| `WILD_LIFETIME_DAYS` | 42 | With T-427's fix, a longer stay restores the arrival rate of fresh packs that stuck leavers had kept down (28 before; 56 and 84 measured and not taken); *unmeasured* otherwise |
| `SPAWN_PERMILLE` | 150 | Per species per day when below cap |
| `SPAWN_MIN_DISTANCE` | 25 | Tiles from any dwarf |
| `GRASS_PER_GRAZER` | 48 | Growing-season capacity allowance per grazer |
| `CONDITION_PER_HOUR` | 2 | |
| `CONDITION_PER_GRASS` | 25 | |
| `ANIMAL_STARVE_DAYS` | 10 | Days at condition 100 before a grazer dies (dwarves use 10's `STARVE_DAYS`) (*unmeasured*) |
| `BREEDING_CAP_DEFAULT` | 12 | Per species (*unmeasured*) |
| `BREED_RADIUS` | 10 | *unmeasured* |
| `BREED_PERMILLE` | 60 | Per eligible female per day (*unmeasured*) |
| `HATCH_DAYS` | 12 | *unmeasured* |
| `TRAIN_TICKS` | 400 | *unmeasured* |
| `TRAIN_BASE_PERMILLE` | 300 | *unmeasured* |
| `TRAIN_PER_SKILL` | 35 | Per skill level (*unmeasured*) |
| `WAR_ANIMAL_RADIUS` | 8 | *unmeasured* |
| `ADOPT_PERMILLE` | 250 | Per cat per season (*unmeasured*) |
| `PET_PILE_MAX` | 4 | Pets heaped on the pets' spot by the hearth, and cats on the cats' corner (T-482, T-510, fun features; *unmeasured*) |
| `PET_PILE_SIZE_MAX` | 35 | Largest species size that heaps as a pet: a wolf's (*unmeasured*) |

Species values (size, speed, products, intervals, gestation, litter, growth) are content.

## Extension points

- Herding behavior (animals keeping together) is a wander bias toward the group centroid.
- Milking and shearing at pasture instead of at a workshop: change the job target.
- Animal happiness (pastured animals happier, affects products): a field on `Tame`.
- New products (honey, silk) are product rows with a job type.
