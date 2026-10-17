# 18 Threats, Monsters & Raids

**Owner:** `systems/threats` · **Depends on:** [01-world-generation.md](01-world-generation.md), [16-combat.md](16-combat.md), [13-items-and-storage.md](13-items-and-storage.md), [03-terrain-and-mining.md](03-terrain-and-mining.md), [06-weather-and-seasons.md](06-weather-and-seasons.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Bring danger on a schedule the player can read, scaled by the region's peril and the fortress's success. Own hostile parties and their AI, cavern monsters, the Deep, and the special threats of region traits.

## Concepts

- **Threat kind**: `thief`, `bandits`, `ambush`, `raid`, `siege`, `restless_dead`, `cavern_spawn`, `hollow_emergence`.
- **Party**: a group of hostiles with a leader, a purpose, a goal, a state and loot.
- **Schedule**: per peril rating, when each kind may first happen and how often (`threat-schedules.md`).
- **Renown**: the fortress's threat-scaling score from wealth and population.
- **Stealth**: a creature not drawn or detected until within spotting range and line of sight of a dwarf or trained guard animal, or a trap triggers.
- **Deep pressure**: the gauge raised by mining deepsilver.

## Rules

### Renown

`renown = wealth / RENOWN_WEALTH_DIVISOR + dwarf population × RENOWN_POP_WEIGHT`, recomputed daily and on wealth changes, immigration arrivals and `CreatureDied` of a dwarf. Party sizes are `base + renown × perRenown`, capped at `max` per kind. Renown is shown to the player as a number with a one-line explanation.

### Schedule

Each `DayPassed`, for each kind enabled for the region's peril: if the current date is at or after the kind's `earliest` and `nextTick ≤ now`, spawn (or, for kinds with a warning, emit the warning and schedule the spawn `WARNING_DAYS` later); then set `nextTick = now + rng.int(intervalMin, intervalMax) days`. The first `nextTick` after `earliest` is rolled at embark so the first event of each kind is not on its earliest day.

A bandit party is due only while Hillfolk reputation is below 50 (read through 20's reader at the daily check). One that is due while reputation is higher is suppressed without advancing or rerolling `nextTick`; once reputation falls below 50 the due party arrives at the next daily check.

Fixed by this design (numbers in `03-content/threat-schedules.md`):

| Peril | Thieves | Bandits | Ambushes | Raids | Sieges |
|---|---|---|---|---|---|
| 0 | from year 2 | rare | never | never | never |
| 1 | from year 1 autumn | occasional | never | from year 2 autumn, small | never |
| 2 | from year 1 summer | occasional | from year 1 autumn | from year 2 spring | never |
| 3 | frequent | rare | frequent | from year 1 autumn | from year 3 |
| 4 | constant | rare | frequent | from year 1 summer, large | from year 2 autumn |

`serene_vale` disables everything but thieves. `twilight_pass` halves every interval and sends thieves in pairs. `old_battlefield` adds `restless_dead` on autumn nights. Raids never come in winter at peril ≤ 2 (the passes are closed). The schedule, its intervals and its party sizes are *unmeasured*: no fortress has been measured through a year of raids.

### Party composition

Content rows per kind and civ list roles with counts scaled by size. Roles and species:

- Gloam: `gloam_snatcher` (thief; stealth; fast; steals), `gloam_warrior` (melee, leather and copper or iron), `gloam_archer` (bow), `gloam_captain` (leader, better gear, holds the party together), `trollkin` (large, breaks doors, no armor, heavy blunt attacks; sieges only).
- Hillfolk bandits: `hillfolk_bandit` (melee, steals; low peril nuisance; killing them lowers Hillfolk reputation slightly, capturing them in cages raises it).
- Restless dead: `restless_dead` (slow, mindless, no loot, attacks fortress creatures, does not flee; rises at dusk in autumn from the battlefield band, `RESTLESS_PER_NIGHT` per night, and collapses to bones at dawn unless already slain; a collapsing dead drops what it wears and carries on its tile, where it lies as ordinary unowned stock).

Hostile equipment is generated from the civ's equipment table with a peril-scaled quality (`hostile gear tier = min(peril, 3)` metal tier; sieges +1). Members get `Skills` with every combat skill at `2 + HOSTILE_SKILL_PER_TIER × gear tier` (captains + 2) and no `Attributes` (`16`'s defaults apply). Every kit item is foreign, owned by and attached to its member through 13 immediately on spawn, including spare weapons and ammunition; it has no ground position while carried.

### Arrival and warning

- Parties arrive at the map edge nearest the civ (`nearestEdgeTo`), at a walkable outdoor tile at least `ARRIVAL_SPREAD` apart per member, spawned over `ARRIVAL_TICKS` so they trickle in.
- `ThreatWarning { kind, civ, sizeBand, edge }` is emitted `WARNING_DAYS` before raids and sieges (`sizeBand`: "a few", "a band", "a horde"; the exact count is not shown). Fog (06) halves the lead time. Thieves, bandits and ambushes give no warning.
- `RaidArrived { partyId, kind, size }` at spawn for parties other than ambushes: a danger announcement that pauses and centers on the edge. Every ambush member arrives hidden; no `RaidArrived` announces that party. Its first spotting instead emits one `AmbushSprung { partyId }`, a danger announcement that pauses and centers on its leader.

### Party AI

Party state: `approach → engage → loiter → retreat → gone`, evaluated every threats tick (50 ticks) by the party; members act every tick through 16 targeting and the movement helper.

- **Goal selection** (`approach`): thieves target the most valuable *reachable* item or small tame animal (`size < STEAL_MAX_SIZE`) not inside a locked area, preferring outdoors; bandits target the nearest reachable stockpile and, on arriving, each take one unattended item within `LOOT_RADIUS` (stockpile items first, most valuable first) and retreat with their loot, or loiter if there is nothing to take; ambushes target the nearest dwarf outdoors; raids and sieges target the hearth (or the wagon, or the nearest fortress building) by path; if no path exists (including a walk the path search reports unreachable), the target is the reachable tile nearest to the goal (22 `nearestReachable`) and the party loiters on arriving there. A thief with no quarry remains hidden at its arrival tile and rechecks on each threats tick. If it still has no quarry `THIEF_WAIT_DAYS` after arrival, it retreats with an empty-handed `withdrew` outcome; a thief that has not reached a quarry `THIEF_APPROACH_DAYS` after arrival (its walk keeps failing, or its quarry keeps moving away) withdraws the same way. Reaching a goal without a quarry is not theft.
- **Approach**: the leader paths to the goal; members follow the leader within `FOLLOW_RADIUS`, using the leader's path (22 shared path) to save pathfinding; when any member sees a fortress creature within perception that the party can reach by path, the party enters `engage`, except a hidden thief continues toward its quarry until spotted. Creatures it can see but not reach (behind a locked door, across a moat) do not start a fight. Once the leader is on or adjacent to its goal, a non-thief, non-restless party with no reachable target in perception for `ENGAGE_IDLE_TICKS` enters `loiter`; idle time begins at arrival and resets if the goal changes, it leaves the goal or it perceives a reachable target.
- **Engage**: each member picks targets through 16 (nearest fortress creature, soldiers preferred by archers), judging reachability by the member's own movement class; a member keeps a target it holds when the target leaves sight, and 16 decides when it is lost; melee members that cannot reach any target and stand adjacent to a locked door with `breaksDoors` start breaking it (`DoorBreakAttempt` each tick; 14 removes it after `DOOR_BREAK_TICKS`); after `ENGAGE_IDLE_TICKS` with no reachable target in perception, back to `approach`.
- Looting by raiders belongs to `loiter`, never to `engage`; door breaking can occur in either state.
- **Loiter**: when the goal is unreachable or the arrived party has no reachable target: the party stands at the nearest reachable tile (arrived when on it or adjacent to it, or when the walk there stays blocked), archers shoot at anything in range and line of sight, melee members with `breaksDoors` adjacent to a locked door break it as in engage, members pick up unattended items within `LOOT_RADIUS` (one per member), and after `LOITER_DAYS_RAID` (2) or `LOITER_DAYS_SIEGE` (5) days the party retreats. If a broken door makes a previously unreachable goal reachable, the party returns to `approach` and its loiter timer is discarded. Unrelated terrain changes do not restart the timer at an already reachable empty goal.
- **Retreat**: triggered by loiter timeout, by casualties (`RETREAT_LOSS_PERCENT` of members dead or unconscious; a member that fled and left the map counts toward `RETREAT_LOSS_PERCENT`), or by a thief having stolen (`ThiefEscaped` when it leaves the map with the item; `thief_escaped_with_my_things` for the item's owner); members path to their arrival edge carrying loot and despawn at an edge with what they carry. Each member keeps its selected exit through the walk, clears its combat target on beginning that retreat, and records the best distance reached toward the exit. Pending requests and steps that do not reduce that distance do not reset the progress clock. After `RETREAT_STUCK_TICKS` without improving the distance, choose the nearest reachable, passable tile on any map edge using the member's movement class, minimizing horizontal Chebyshev distance plus twice the vertical distance, with tile-index ties. If no exit is reachable, wait and retry at that interval. After `RETREAT_GIVE_UP_DAYS` in retreat, remove every remaining living member, including unconscious survivors, through the same departure and loot cleanup path. The final outcome still follows actual departing loot and the retreat reason. Destroy their carried and owned equipment, including spare items and container contents, through 13 as `left_map`; escaped loot is handled separately by `ThiefEscaped`; `RaidEnded { outcome }` where `outcome` is `repelled` (retreat by casualties without loot), `looted` (any member escaped with loot, counted when `ThiefEscaped` is emitted), `wiped` (all dead without an earlier loot escape), `withdrew` (loiter timeout without loot). `raid_repelled` thought on `repelled` or `wiped`.
- When a party ends, set its state to `gone` and `stateSince` to the ending tick. Destroy that Party entity after `PARTY_HISTORY_DAYS` (one day); the legend retains the ending from `RaidEnded`.
- Members separated from the party (no path to the leader) act alone with the same rules.

An animal picked up as loot stops walking and leaves the position and spatial indexes while held; the party saves the animal-to-member carrier mapping. Only that member can take it off the map. If the carrier dies on the map, the animal remains alive and returns to the death tile, with its spatial entry restored and its loot/carrier records cleared.

Only the departing holder emits an item or animal loot escape; an empty member cannot report another member's held item. Living unconscious members are casualties that trigger retreat, not a wiped ending. Compute the final outcome from actual loot escapes before any other retreat reason; held loot that never escapes does not qualify. Spotting a thief already retreating preserves its original retreat deadline. Spotting a thief after pickup preserves its looted retreat; spotting before pickup yields an empty-handed withdrawal.

### Stealth

`gloam_snatcher` and `blind_stalker` have `stealth: true`. Every member of an `ambush` party also arrives stealthed regardless of its species. A hidden ambush does not enter engage merely because it perceives a fortress creature beyond spotting range; it still follows its approach and loiter rules. A stealthed creature is not drawn, not inspectable, and not targeted until *spotted*: a conscious dwarf within `SPOT_RADIUS`, or a conscious tame animal trained for war or hunting within `SPOT_RADIUS_DOG`, with line of sight, or any trap trigger. The animal's species must permit that training through its `trainable` field (`both` permits either); untrained livestock and pets do not spot hidden creatures. Combat targeting still includes all fortress creatures. Spotting emits `ThiefSpotted` (alert) for a thief and removes its stealth for its lifetime on the map. The first spotting of any ambush member, by a creature or trap, emits `AmbushSprung` once, reveals every living member and puts the party in `engage`. Save the party's reveal flag; members still arriving after it has sprung are visible and spotted, and loading never announces it again. A snatcher that is spotted before stealing flees empty-handed.

### Cavern monsters

Cavern spawn tables (content) per cavern tier:

| Cavern | Species | Notes |
|---|---|---|
| 1 | `cave_crawler` (pack hunter, aggressive), `giant_cave_spider` (territorial, webs slow and entangle: `web` flag on tiles around its lair; entangled creatures cannot move for `WEB_TICKS`) | |
| 2 | `blind_stalker` (stealth ambusher), `troll` (large, breaks doors, eats livestock) | |
| 3 | `magma_wyrm` (boss: huge, fire breath as a ranged `burn` attack, magma-safe; one per map from `wyrm_roost` or from the Deep) | |

- At generation each cavern gets `initialSpawns` placed asleep at random walkable tiles in its band; they wake on `CavernBreached` for that cavern, emitting one `MonsterSpawned { id, cavern }` per living monster that changes from asleep to awake. Repeated breaches do not announce monsters that are already awake. As events emitted by a handler, these notifications are delivered on the following tick under the core dispatch rule.
- During load bootstrap, initialization installs the threat reader and registrations without spawning initial monsters or spinning initial webs. Restore the saved monsters, web-owner records and Web flags; floors carved since generation receive no new initial population or webs. Ordinary new-world initialization still creates the initial population and lair webs.
- Each `DayPassed` after breach, each species respawns toward its cap at a random cavern tile at least `SPAWN_MIN_DISTANCE` (08) from dwarves.
- Monsters wander their cavern; aggressive ones seek fortress creatures within `CAVE_SEEK_RADIUS` of any cavern tile (they will follow a breach corridor into the fortress); they return to the cavern when no target is found for `CAVE_RETURN_TICKS`. Sealing the breach with a wall or a locked door (trolls break doors) stops them.
- `MonsterSpawned { id, cavern }` is a note, both when an initial sleeper wakes at breach and when a daily respawn creates a monster; visibility and proximity do not change its severity.

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

- `Party` entities: `civ, purpose, members[], leaderId, state, goalTile, goalEntity, arrivedTick, stateSince, loot[], edge`, and the saved `escapedLootCount` (missing in older saves means zero), plus optional `animalCarriers` mapping stolen animal ids to their individual member ids (absent when no animals are held), `goalIdleSince` while waiting at an arrived goal and `ambushSprung` for the one-time party reveal.
- `Hostile` components on members: `partyId, role, behaviorState, stealthed, spotted, breakingDoorId`, plus optional `retreat { stateSince, goalTile, bestDistance, progressSince }`. Missing progress fields in older saves begin tracking on the next member step; the party's saved `stateSince` still governs its retreat deadline.
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

`DayPassed`, `HourPassed` (restless dead dusk and dawn), `WealthChanged`, `ImmigrantsArrived` (population for renown), `CavernBreached`, `DeepsilverMined`, `CreatureDied` (dwarf population for renown, and party/monster cleanup), `CreatureUnconscious`, `TrapTriggered`, `DoorBroken`, `WeatherChanged` (fog), `EntitiesMoved` (spotting; batched), `TilesChanged` (goal re-evaluation).

### Events emitted

`ThreatWarning`, `RaidArrived`, `RaidEnded`, `ThiefSpotted { id }`, `ThiefEscaped { id, itemId | animalId }`, `AmbushSprung { partyId }`, `HostileSpawned { id, partyId }`, `MonsterSpawned { id, cavern }`, `MonsterEmerged { ids[], tile }`, `DeepStirred { level }`, `HostileFled { id }`, `DoorBreakAttempt { id, doorId }`, `RestlessRose { count }`, `WebSpun { tiles[] }`, and 17's `CreatureDied` (the restless dead that collapse to bones at dawn).

### Registrations

Panel `threats` (active parties with size and state, renown, schedule preview, cavern monster counts, Deep gauge); inspector section `creature › hostile` (party, role, state; hidden while stealthed); announcements: `ThreatWarning` (alert: "Gloam scouts have been seen at the eastern edge. They will come tomorrow."), `RaidArrived` (danger), `RaidEnded` (an alert when the raid escaped with loot, a note for every other outcome), `ThiefSpotted` (alert), `ThiefEscaped` (alert), `AmbushSprung` (danger), `MonsterSpawned` (a note: no visibility or proximity threshold decides otherwise), `DeepStirred` (danger), `RestlessRose` (alert).

## Player-facing behavior

- Hostiles are uppercase letters in red (`G` goblin, `T` trollkin, `S` stalker, `W` wyrm, `H` Hollow-born, `Z` restless dead); stealthed creatures are invisible until spotted.
- Threats panel as above. The Deep gauge is visible from the first deepsilver vein found (`VeinFound { deepsilver }` unlocks it). The unlock is saved with the UI state, so the gauge stays after a load; a positive pressure or level also shows it.
- The deepsilver confirmation dialog: "Deepsilver is the finest metal in the world. Taking it wakes the Hollow: creatures will come up through the rock where it was mined. Mine it?" with Yes and No; asked once per fortress.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `RENOWN_WEALTH_DIVISOR` | 2000 | Marks per renown point (*unmeasured*) |
| `RENOWN_POP_WEIGHT` | 0.2 | Renown per dwarf (*unmeasured*) |
| `WARNING_DAYS` | 1 | *unmeasured* |
| `PARTY_HISTORY_DAYS` | 1 | Days to retain an ended Party entity (*unmeasured*) |
| `ARRIVAL_SPREAD` | 2 | *unmeasured* |
| `ARRIVAL_TICKS` | 100 | *unmeasured* |
| `THIEF_WAIT_DAYS` | 1 | How long an empty-goal thief waits after arrival before withdrawing (*unmeasured*) |
| `THIEF_APPROACH_DAYS` | 2 | How long a thief may approach its quarry after arrival before withdrawing (*unmeasured*) |
| `STEAL_MAX_SIZE` | 30 | *unmeasured* |
| `FOLLOW_RADIUS` | 4 | *unmeasured* |
| `ENGAGE_IDLE_TICKS` | 150 | *unmeasured* |
| `LOOT_RADIUS` | 6 | *unmeasured* |
| `LOITER_DAYS_RAID` / `LOITER_DAYS_SIEGE` | 2 / 5 | *unmeasured* |
| `RETREAT_LOSS_PERCENT` | 50 | *unmeasured* |
| `RETREAT_STUCK_TICKS` | 600 | No progress toward the selected exit before choosing any reachable edge (*unmeasured*) |
| `RETREAT_GIVE_UP_DAYS` | 2 | Maximum retreat duration, including unconscious survivors (*unmeasured*) |
| `SPOT_RADIUS` / `SPOT_RADIUS_DOG` | 6 / 10 | *unmeasured* |
| `WEB_TICKS` | 100 | *unmeasured* |
| `CAVE_SEEK_RADIUS` | 30 | *unmeasured* |
| `CAVE_RETURN_TICKS` | 600 | *unmeasured* |
| `DEEP_PRESSURE_PER_TILE` | 10 | *unmeasured* |
| `DEEP_THRESHOLDS` | 50, 150, 300, 500 | Levels 1–4 (*unmeasured*) |
| `EMERGENCE_TILES` | 4 | *unmeasured* |
| `HOLLOW_WAVE_DAYS` | 28 | *unmeasured* |
| `RESTLESS_PER_NIGHT` | 2–8 | Scaled by renown (*unmeasured*) |

Schedules, compositions, gear tables and caps are content.

## Extension points

- Breaching sieges: fill the `breach` behavior slot (a party member with a pick digs toward the goal).
- Diplomacy: a `demand` party purpose that leaves if paid.
- Named enemies and vendettas: a legend record of party leaders that return.
- More civilizations as raiders: a civ row with `raids: true` and a composition table.
