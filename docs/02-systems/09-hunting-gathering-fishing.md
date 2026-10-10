# 09 Hunting, Gathering & Fishing

**Owner:** `systems/foraging` · **Depends on:** [08-animals-and-domestication.md](08-animals-and-domestication.md), [07-plants-and-farming.md](07-plants-and-farming.md), [04-fluids.md](04-fluids.md), [16-combat.md](16-combat.md), [12-workshops-and-professions.md](12-workshops-and-professions.md), [13-items-and-storage.md](13-items-and-storage.md)

## Purpose

Feed the fortress from the wild: hunt animals with ranged weapons, gather plants in zones, fish rivers and lakes, and turn corpses into meat, hide, bone and fat.

## Concepts

- **Huntable**: a wild species the player has toggled on for hunting.
- **Hunter**: a dwarf with the `hunting` labor and a ranged weapon with ammunition.
- **Gather zone**: a zone in which mature shrubs are automatically designated for gathering.
- **Fishing zone**: a zone of walkable tiles adjacent to water where fishers work.
- **Water body**: a connected set of water tiles; has a fish pool.
- **Butchery**: the workshop job that converts a corpse into products.

## Rules

### Hunting

- Huntable species default: all `timid` and `neutral` wild species of size ≥ `HUNT_MIN_SIZE`; predators are off by default (the player can enable them; the hunter may die).
- The `hunt` job is produced when: a huntable wild animal is on the map at a reachable tile, a hunter is idle, and no other hunter is assigned to that animal. The job's target is the animal.
- Hunter equipment: a crossbow with bolts or a bow with arrows in the quiver (16 equipment rules). A hunter without a ranged weapon does not take hunt jobs and the jobs panel says "no ranged weapon". A hunt is taken only by a worker that holds, or can reserve at the claim, both a launcher and ammunition of that launcher's kind: a bow is not taken while the fortress has no free arrows, and bolts are not taken by a worker with no crossbow to go with them (11 § Assignment, step 5). The hunter fetches the launcher and up to `AMMO_FETCH` of its ammunition before the hunt and keeps them like miners keep picks. With more hunts open than launchers, the hunts beyond the armed hunters stay unclaimed.
- Behavior (run by 11 as the job's work step, with 16 doing the shooting): approach until within `weapon.range` and line of sight (22); fire (16 `shoot`); repeat until the target is dead, flees out of perception for `HUNT_GIVE_UP_TICKS`, or the hunter runs out of ammunition (then the job is cancelled with reason `no_ammo`). A fleeing target is pursued at the hunter's speed; a hunting dog assigned to the hunter attacks it in melee.
- On kill: before the quarry is removed, an active hunt targets the tile where it died and keeps its original id in data.animal while waiting for CorpseCreated. An unclaimed hunt is cancelled when its target is removed. The active job continues as a haul of the quarry's own corpse, and of no other. 13 makes the corpse on its next tick; the job learns it from `CorpseCreated { creatureId }` and waits for it. If no corpse exists `CORPSE_WAIT_TICKS` after the death, the job ends. The hunter carries the corpse to the nearest built butcher's workshop, or sets it down where it stands if there is none (the ordinary butcher job and the refuse hauling take it from there). Corpses of size > `CARRY_MAX_SIZE` are butchered in place: the hunter performs the butcher job at the corpse tile with reduced yield (`FIELD_BUTCHER_PERCENT`) and hauls the products.
- Hunting at night halves perception (06). Fog reduces effective range by 2.
- Hunting gives `hunting` skill experience per shot and per kill; the shooting itself uses the weapon's skill (16).

### Gathering

- 03 owns the `gather` designation and job. This system adds the `gather` zone type: each `DayPassed`, every mature shrub inside a gather zone without a designation gets a `gather` designation at the zone's priority.
- Gathering wild crop species may yield a seed (07).
- Brightleaf (the medicine herb) is what hospitals use for infection treatment (17); it is the reason to gather in the woods.

### Fishing

- `fishing` zone: walkable bank tiles beside deep, unfrozen water (level ≥ `FLUID_DEEP_LEVEL`). One of the four same-level cardinal neighbours must either contain that water or be open air above a straight drop through only open air to that water, at most `FISH_BANK_DROP` levels below the bank. Intervening floors, solid tiles or shallow fluid stop the lookup. Water with cardinal magma adjacency does not qualify. Zone validation and fishing jobs use the same bank-to-water lookup. Tiles that do not qualify are excluded at placement and shown red.
- Water bodies: on `init` and whenever `TilesChanged` or `FluidsChanged` touches water tiles in a way that changes connectivity (checked lazily: a body is recomputed when a fishing job starts and the body's version is stale), flood-fill water tiles through same-level cardinal neighbours into bodies (vertical flow does not join pools) with an id, a tile count and a `fishPool`. `fishPool` starts at `tileCount × FISH_PER_TILE` and regenerates `FISH_REGEN_PERCENT` of capacity per day, capped at capacity. Bodies with fewer than `MIN_FISHING_TILES` tiles have no fish. River bodies (containing a source) regenerate at double rate. Match each recomputed body to the unused old body with the largest tile overlap, ties by old id. Retain that id and, if the old body had fish capacity, its fraction of remaining capacity; a body without an eligible old pool starts full. Save the version, next body id and per-zone retry ticks alongside the bodies.
- A bank draws its catch from the water body at the bottom of its qualifying shore column. Looking down from a bank does not join water bodies on different levels.
- The `fish` job (labor `fishing`, skill `fishing`) is produced per fishing zone while its body has fish and a fisher is idle: the fisher stands on a zone tile and works `FISH_TICKS` (skill-scaled); success with `FISH_BASE_PERMILLE + skill × FISH_PER_SKILL`; on success the pool decreases by one and a `raw_fish` item is spawned with a material by body type (`trout` for rivers, `perch` for lakes, `blindfish` for cavern lakes). Failure ends the job; the producer re-creates it after `FISH_RETRY_TICKS`.
- Frozen water and water with magma adjacency have no fishing.

### Butchery

- The `butcher` job (labor `butchery`, skill `butchery`) is produced for any corpse item of a butcherable species (not dwarves, not sapient hostiles; the species row has `butcherable`) that is not rotten beyond `BUTCHER_ROT_LIMIT`, when a butcher's workshop exists. The corpse is hauled to the workshop (the haul is part of the job) and processed in `BUTCHER_TICKS` (skill-scaled).
- Yields, by species `size`:
  - `meat`: `max(1, size / MEAT_PER_SIZE)` items of material `<species>_meat` (each species is a meat material with value by species).
  - `hide`: 1 if `size ≥ HIDE_MIN_SIZE`, of material `<species>_hide`; large animals (`size ≥ 120`) give 2.
  - `bone`: `size / BONE_PER_SIZE` items (stack), material `bone`.
  - `fat`: `size / FAT_PER_SIZE` items, rendered to `tallow` at a kitchen.
  - `skull`: 1 if `size ≥ SKULL_MIN_SIZE` (crafts).
  - `shell`: for `cave_crab` and `crocodile` in place of hide.
- A shelled species gives `max(1, hideYield)` shells, even below `HIDE_MIN_SIZE`; that threshold still applies to hide. A corpse with its saved `juvenile` marker gives `max(1, floor(adultMeat / 2))` meat and unchanged other yields.
- Keep the stage-2 admission limit for corpses; the separate `skeleton` item type is accepted as a bones-only input. A rotten corpse (13) yields only bones.
- Slaughtered animals (08) go through the same job at the workshop where they were killed. Slaughter completion owns corpse creation; its `CorpseCreated` cancels the general pending corpse transition in 13.

## State

- `huntable: Set<species>`, `hunterAssignments: Map<animalId, hunterId>`.
- `waterBodies: { id, tiles version, tileCount, fishPool, kind }[]`, `bodyOfTile: Map<TileIndex, bodyId>`.
- `gatherZones`, `fishingZones` (zone ids).
- Rng stream.

## Interfaces

### Reader

- `foraging.isHuntable(species)`, `foraging.huntTargets()` (animal ids currently eligible)
- `foraging.waterBodyAt(i)`, `foraging.fishPool(bodyId)`, `foraging.canFishAt(i)`
- `foraging.butcherYields(species)` — computed from the rules above, for the inspector

### Commands

`SetHuntable { species, on }`. (Gather and fishing zones are created through 14's `CreateZone` with the zone type; this system reads them.)

### Events consumed

`DayPassed`, `AnimalSpawned`, `AnimalLeft`, `CreatureDied` (release assignments; corpse butchery), `FluidsChanged`, `TilesChanged`, `ZoneChanged`, `JobCompleted`, `JobCancelled`, `ProjectileFired` (ammo counting for `no_ammo`).

### Events emitted

`FishCaught { fisherId, bodyId, species }`, `ButcheryDone { workshopId, species, yields }`, `FishPoolDepleted { bodyId }`. (The hunt events `HuntStarted`, `HuntKill` and `HuntAbandoned` are emitted by 11, which executes this system's hunt jobs; they are listed in 11.)

### Registrations

Job producer `foraging` (`hunt`, `fish`, `butcher`); inspector sections `zone › fishing` (body, pool, catch rate), `zone › gather`; announcements: `HuntKill` note, `FishPoolDepleted` note ("The pond is fished out"), `HuntAbandoned { no_ammo }` alert.

## Player-facing behavior

- Animals panel › Wild tab: a huntable checkbox per species with a count on the map.
- Zones menu: gather zone, fishing zone.
- The jobs panel shows hunts as "Hunting a deer (Brynja Coldhammer)".
- Hints: "Hunters need a crossbow and bolts", "Fishing needs deep water next to the bank".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `HUNT_MIN_SIZE` | 10 | Rabbits (size 8) are not hunted by default |
| `AMMO_FETCH` | 20 | Bolts a hunter keeps |
| `HUNT_GIVE_UP_TICKS` | 300 | |
| `CARRY_MAX_SIZE` | 100 | Larger corpses are butchered in the field |
| `FIELD_BUTCHER_PERCENT` | 60 | |
| `CORPSE_WAIT_TICKS` | 20 | Twice 13's cadence: how long a hunter waits for its kill's corpse |
| `FISH_BANK_DROP` | 2 | Maximum straight open-air drop from bank level to deep water |
| `FISH_PER_TILE` | 2 | Pool capacity |
| `FISH_REGEN_PERCENT` | 5 | Of capacity per day |
| `MIN_FISHING_TILES` | 6 | |
| `FISH_TICKS` | 200 | |
| `FISH_BASE_PERMILLE` | 350 | |
| `FISH_PER_SKILL` | 30 | |
| `FISH_RETRY_TICKS` | 100 | |
| `BUTCHER_TICKS` | 120 | |
| `BUTCHER_ROT_LIMIT` | stage 2 | Corpses past "rotting" give bones only (13 stages) |
| `MEAT_PER_SIZE` | 12 | |
| `HIDE_MIN_SIZE` | 15 | |
| `BONE_PER_SIZE` | 25 | |
| `FAT_PER_SIZE` | 30 | |
| `SKULL_MIN_SIZE` | 30 | |

## Extension points

- Trapping small game: a `snare` building with a daily catch roll, reusing the corpse path.
- Fish species by season or depth: the body kind is one field.
- Melee hunting for war-trained squads: a `hunt` order in 16 rather than a job here.
