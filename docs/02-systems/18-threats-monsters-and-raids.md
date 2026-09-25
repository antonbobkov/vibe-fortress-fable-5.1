# 18 Threats, Monsters & Raids

**Detail level:** W2 · **Owner:** `systems/threats` · **Depends on:** [01-world-generation.md](01-world-generation.md), [16-combat.md](16-combat.md), [13-items-and-storage.md](13-items-and-storage.md), [03-terrain-and-mining.md](03-terrain-and-mining.md), [06-weather-and-seasons.md](06-weather-and-seasons.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Bring danger on a schedule the player can read, scaled by the region's peril and the fortress's success. Own hostile parties and their AI, cavern monsters, the Deep, and the special threats of region traits.

## Concepts

- **Threat kind**: `thief`, `bandits`, `ambush`, `raid`, `siege`, `restless_dead`, `cavern_spawn`, `hollow_emergence`.
- **Party**: a group of hostiles with a leader, a purpose, a goal, a state and loot.
- **Schedule**: per peril rating, when each kind may first happen and how often (`threat-schedules.md`).
- **Renown**: the fortress's threat-scaling score from wealth and population.
- **Stealth**: a creature not drawn or detected until within a spotting radius of a fortress creature.
- **Deep pressure**: the gauge raised by mining deepsilver.

## Rules

### Renown

`renown = wealth / RENOWN_WEALTH_DIVISOR + population × RENOWN_POP_WEIGHT`, recomputed daily. Party sizes are `base + renown × perRenown`, capped at `max` per kind. Renown is shown to the player as a number with a one-line explanation.

### Schedule

Each `DayPassed`, for each kind enabled for the region's peril: if the current date is at or after the kind's `earliest` and `nextTick ≤ now`, spawn (or, for kinds with a warning, emit the warning and schedule the spawn `WARNING_DAYS` later); then set `nextTick = now + rng.int(intervalMin, intervalMax) days`. The first `nextTick` after `earliest` is rolled at embark so the first event of each kind is not on its earliest day.

Fixed by this design (numbers in Wave 3):

| Peril | Thieves | Bandits | Ambushes | Raids | Sieges |
|---|---|---|---|---|---|
| 0 | from year 2 | rare | never | never | never |
| 1 | from year 1 autumn | occasional | never | from year 2 autumn, small | never |
| 2 | from year 1 summer | occasional | from year 1 autumn | from year 2 spring | never |
| 3 | frequent | rare | frequent | from year 1 autumn | from year 3 |
| 4 | constant | rare | frequent | from year 1 summer, large | from year 2 autumn |

`serene_vale` disables everything but thieves. `twilight_pass` halves every interval and doubles thief frequency. `old_battlefield` adds `restless_dead` on autumn nights. Raids never come in winter at peril ≤ 2 (the passes are closed).

### Party composition

Content rows per kind and civ list roles with counts scaled by size. Roles and species:

- Gloam: `gloam_snatcher` (thief; stealth; fast; steals), `gloam_warrior` (melee, leather and copper or iron), `gloam_archer` (bow), `gloam_captain` (leader, better gear, holds the party together), `trollkin` (large, breaks doors, no armor, heavy blunt attacks; sieges only).
- Hillfolk bandits: `hillfolk_bandit` (melee, steals; low peril nuisance; killing them lowers Hillfolk reputation slightly, capturing them in cages raises it).
- Restless dead: `restless_dead` (slow, mindless, no loot, attacks anything, does not flee; rises at dusk in autumn from the battlefield band, `RESTLESS_PER_NIGHT` per night, and collapses to bones at dawn unless already slain).

Hostile equipment is generated from the civ's equipment table with a peril-scaled quality (`hostile gear tier = min(peril, 3)` metal tier; sieges +1). Members get `Skills` with every combat skill at `2 + HOSTILE_SKILL_PER_TIER × gear tier` (captains + 2) and no `Attributes` (`16`'s defaults apply).

### Arrival and warning

- Parties arrive at the map edge nearest the civ (`nearestEdgeTo`), at a walkable outdoor tile at least `ARRIVAL_SPREAD` apart per member, spawned over `ARRIVAL_TICKS` so they trickle in.
- `ThreatWarning { kind, civ, sizeBand, edge }` is emitted `WARNING_DAYS` before raids and sieges (`sizeBand`: "a few", "a band", "a horde"; the exact count is not shown). Fog (06) halves the lead time. Thieves, bandits and ambushes give no warning.
- `RaidArrived { partyId, kind, size }` at spawn: a danger announcement that pauses and centers on the edge.

### Party AI

Party state: `approach → engage → loiter → retreat → gone`, evaluated every threats tick (50 ticks) by the party; members act every tick through 16 targeting and the movement helper.

- **Goal selection** (`approach`): thieves target the most valuable *reachable* item or small tame animal (`size < STEAL_MAX_SIZE`) not inside a locked area, preferring outdoors; bandits target the nearest stockpile; ambushes target the nearest dwarf outdoors; raids and sieges target the hearth (or the wagon, or the nearest fortress building) by path; if no path exists, the target is the reachable tile nearest to the hearth (22 `nearestReachable`).
- **Approach**: the leader paths to the goal; members follow the leader within `FOLLOW_RADIUS`, using the leader's path (22 shared path) to save pathfinding; when any member sees a fortress creature within perception, the party enters `engage`.
- **Engage**: each member picks targets through 16 (nearest fortress creature, soldiers preferred by archers); melee members that cannot reach any target and stand adjacent to a locked door with `breaksDoors` start breaking it (`DoorBreakAttempt` each tick; 14 removes it after `DOOR_BREAK_TICKS`); after `ENGAGE_IDLE_TICKS` with no target in perception, back to `approach`.
- **Loiter**: when the goal is unreachable and no targets are visible: the party stands at the nearest reachable tile, archers shoot at anything visible, members pick up unattended items within `LOOT_RADIUS` (one per member), and after `LOITER_DAYS_RAID` (2) or `LOITER_DAYS_SIEGE` (5) days the party retreats.
- **Retreat**: triggered by loiter timeout, by casualties (`RETREAT_LOSS_PERCENT` of members dead or unconscious), or by a thief having stolen (`ThiefEscaped` when it leaves the map with the item; `thief_escaped_with_my_things` for the item's owner); members path to their arrival edge carrying loot and despawn there; `RaidEnded { outcome }` where `outcome` is `repelled` (retreat by casualties without loot), `looted` (retreat with loot), `wiped` (all dead), `withdrew` (loiter timeout without loot). `raid_repelled` thought on `repelled` or `wiped`.
- Members separated from the party (no path to the leader) act alone with the same rules.

### Stealth

`gloam_snatcher` and `blind_stalker` have `stealth: true`. A stealthed creature is not drawn, not inspectable, and not targeted until *spotted*: any fortress creature within `SPOT_RADIUS` (dogs `SPOT_RADIUS_DOG`) with line of sight, or any trap trigger. Spotting emits `ThiefSpotted` (alert) or `AmbushSprung` and removes stealth for the creature's lifetime on the map. A snatcher that is spotted before stealing flees empty-handed.

### Cavern monsters

Cavern spawn tables (content) per cavern tier:

| Cavern | Species | Notes |
|---|---|---|
| 1 | `cave_crawler` (pack hunter, aggressive), `giant_cave_spider` (territorial, webs slow and entangle: `web` flag on tiles around its lair; entangled creatures cannot move for `WEB_TICKS`) | |
| 2 | `blind_stalker` (stealth ambusher), `troll` (large, breaks doors, eats livestock) | |
| 3 | `magma_wyrm` (boss: huge, fire breath as a ranged `burn` attack, magma-safe; one per map from `wyrm_roost` or from the Deep) | |

- At generation each cavern gets `initialSpawns` placed asleep at random walkable tiles in its band; they wake on `CavernBreached` for that cavern.
- Each `DayPassed` after breach, each species respawns toward its cap at a random cavern tile at least `SPAWN_MIN_DISTANCE` (08) from dwarves.
- Monsters wander their cavern; aggressive ones seek fortress creatures within `CAVE_SEEK_RADIUS` of any cavern tile (they will follow a breach corridor into the fortress); they return to the cavern when no target is found for `CAVE_RETURN_TICKS`. Sealing the breach with a wall or a locked door (trolls break doors) stops them.
- `MonsterSpawned { id, cavern }` (note if far, alert if a path to dwarves exists).

### The Deep

- `DeepsilverMined` adds `DEEP_PRESSURE_PER_TILE` to `fortress.deepPressure`. Pressure never decays.
- Thresholds (content; fixed shape): at each threshold crossing emit `DeepStirred { level }` (danger; the log line for level 1 is "The Deep stirs. Something has noticed the pale metal being taken.") and an **emergence**: at the most recently mined deepsilver tile still adjacent to rock, the `EMERGENCE_TILES` nearest wall tiles are turned to `open` by the terrain API ("the rock cracks") and Hollow-born spawn in them: level 1 `hollow_crawler` ×3; level 2 `hollow_stalker` ×2 + crawlers; level 3 a `magma_wyrm` if none lives, else stalkers; level 4 the `hollow_maw` (a very large, slow, door-breaking creature) plus a wave; beyond level 4, a wave every `HOLLOW_WAVE_DAYS` with size growing by one per wave.
- Hollow-born have faction `deep`, never flee, never loot, and seek the nearest fortress creature anywhere on the map (they know where the dwarves are). Their emergence point is always a mined deepsilver location, so the player can fortify it.
- The gauge is shown in the threats panel as a bar with the next threshold marked; the first deepsilver designation prompts a confirmation explaining this (24).

### Wild predators

Aggressive wild animals are 08's; they become hostile through 08's `attack` state and 16's hostility, not through this system. `beastwood` and `old_battlefield` are region-trait hooks read here for their scheduled parts (restless dead) and by 08 for spawns.

### Caravans

Hostile parties target caravan members like fortress creatures (traders are `trader:<civ>` and hostile to `hostile:*`). 20 handles the consequences.

## State

- `Party` entities: `civ, purpose, members[], leaderId, state, goalTile, goalEntity, arrivedTick, stateSince, loot[], edge`.
- `Hostile` components on members: `partyId, role, behaviorState, stealthed, spotted, breakingDoorId`.
- `schedule: Map<kind, { nextTick, earliestTick }>`, `renown`, `deepLevel`, `deepsilverTiles: TileIndex[]` (mined), `cavernSpawns: per cavern counts`, `webs: Map<TileIndex, ownerId>`.
- Rng stream.

## Interfaces

### Reader

- `threats.activeParties()`, `threats.party(id)`, `threats.partyOf(creatureId)`, `threats.isHostile(id)`, `threats.isStealthed(id)`, `threats.isSpotted(id)`
- `threats.renown()`, `threats.schedulePreview()` (per kind: "possible from Autumn, Year 2"; never the exact next date)
- `threats.deepPressure()`, `threats.deepLevel()`, `threats.deepNextThreshold()`
- `threats.monstersInCavern(n)`

### Commands

None. (Alerts and squads are 16; the deepsilver confirmation is a UI gate on 03's `Designate`.)

### Events consumed

`DayPassed`, `HourPassed` (restless dead dusk and dawn), `WealthChanged`, `ImmigrantsArrived` and `DwarfDied` (population for renown), `CavernBreached`, `DeepsilverMined`, `CreatureDied`, `CreatureUnconscious`, `TrapTriggered`, `DoorBroken`, `WeatherChanged` (fog), `EntitiesMoved` (spotting; batched), `TilesChanged` (goal re-evaluation).

### Events emitted

`ThreatWarning`, `RaidArrived`, `RaidEnded`, `ThiefSpotted { id }`, `ThiefEscaped { id, itemId | animalId }`, `AmbushSprung { partyId }`, `HostileSpawned { id, partyId }`, `MonsterSpawned { id, cavern }`, `MonsterEmerged { ids[], tile }`, `DeepStirred { level }`, `HostileFled { id }`, `DoorBreakAttempt { id, doorId }`, `RestlessRose { count }`, `WebSpun { tiles[] }`.

### Registrations

Panel `threats` (active parties with size and state, renown, schedule preview, cavern monster counts, Deep gauge); inspector section `creature › hostile` (party, role, state; hidden while stealthed); announcements: `ThreatWarning` (alert: "Gloam scouts have been seen at the eastern edge. They will come tomorrow."), `RaidArrived` (danger), `RaidEnded` (note or alert by outcome), `ThiefSpotted` (alert), `ThiefEscaped` (alert), `AmbushSprung` (danger), `MonsterSpawned` (note or alert), `DeepStirred` (danger), `RestlessRose` (alert).

## Player-facing behavior

- Hostiles are uppercase letters in red (`G` goblin, `T` trollkin, `S` stalker, `W` wyrm, `H` Hollow-born, `Z` restless dead); stealthed creatures are invisible until spotted.
- Threats panel as above. The Deep gauge is visible from the first deepsilver vein found (`VeinFound { deepsilver }` unlocks it).
- The deepsilver confirmation dialog: "Deepsilver is the finest metal in the world. Taking it wakes the Hollow: creatures will come up through the rock where it was mined. Mine it?" with Yes and No; asked once per fortress.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `RENOWN_WEALTH_DIVISOR` | 2000 | Marks per renown point |
| `RENOWN_POP_WEIGHT` | 0.2 | Renown per dwarf |
| `WARNING_DAYS` | 1 | |
| `ARRIVAL_SPREAD` | 2 | |
| `ARRIVAL_TICKS` | 100 | |
| `STEAL_MAX_SIZE` | 30 | |
| `FOLLOW_RADIUS` | 4 | |
| `ENGAGE_IDLE_TICKS` | 150 | |
| `LOOT_RADIUS` | 6 | |
| `LOITER_DAYS_RAID` / `LOITER_DAYS_SIEGE` | 2 / 5 | |
| `RETREAT_LOSS_PERCENT` | 50 | |
| `SPOT_RADIUS` / `SPOT_RADIUS_DOG` | 6 / 10 | |
| `WEB_TICKS` | 100 | |
| `CAVE_SEEK_RADIUS` | 30 | |
| `CAVE_RETURN_TICKS` | 600 | |
| `DEEP_PRESSURE_PER_TILE` | 10 | |
| `DEEP_THRESHOLDS` | 50, 150, 300, 500 | Levels 1–4 |
| `EMERGENCE_TILES` | 4 | |
| `HOLLOW_WAVE_DAYS` | 28 | |
| `RESTLESS_PER_NIGHT` | 2–8 | Scaled by renown |

Schedules, compositions, gear tables and caps are content.

## Extension points

- Breaching sieges: fill the `breach` behavior slot (a party member with a pick digs toward the goal).
- Diplomacy: a `demand` party purpose that leaves if paid.
- Named enemies and vendettas: a legend record of party leaders that return.
- More civilizations as raiders: a civ row with `raids: true` and a composition table.
