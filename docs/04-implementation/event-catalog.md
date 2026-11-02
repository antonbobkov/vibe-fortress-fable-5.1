# Event Catalog

**Owner:** implementation · **Depends on:** [`../01-architecture/simulation-core.md`](../01-architecture/simulation-core.md), every system document

Every event type, its fields, its emitters and its subscribers. `ui` means the presentation announcement registry or panels subscribe. Batched events carry arrays and are emitted at most once per emitter per tick, except `ConstructionCollapsed`: 03 emits one batch per terrain action that settles. Consumers must accept several collapse batches in one tick. Every event has at least one emitter and one subscriber; the consistency checks in `tooling.md` checks this table against the system documents.

The presentation event surface is the union of registered announcements, named panel or screen consumers, and catalog rows explicitly marked `ui (none)`. This union must cover exactly the catalog's `ui` rows; `24` on KillRecorded names the presentation UI. Multiple announcement specs retain the owning system's severity, including the per-kind sulk split. CreatureUnconscious uses the health system's alert severity.

JobCreated, JobClaimed, JobStarted, JobCompleted, JobCancelled, JobBlocked and JobUnblocked carry the job content id as `jobType`; `type` remains the event discriminator. ItemCreated and ItemDestroyed carry the item content id as `itemType`, and ItemCreated material is its content id.

| Event | Fields | Emitters | Subscribers |
|---|---|---|---|
| `WorldGenerated` | `seed, size` | 01 (via app) | ui |
| `Embarked` | `fortressName, regionId` | 02 | ui, 18 (schedule roll), 20 (schedule roll) |
| `CommandRejected` | `command, reason` | core | ui |
| `HourPassed` | `hour` | core calendar | 06, 07, 10, 15, 16, 17, 18, 24 (hints) |
| `DayPassed` | `dayOfSeason, season, year` | core | 07, 08, 09, 14, 15, 16, 17, 18, 20, 21 |
| `SeasonChanged` | `season, year` | core | 06, 08, 13 (rot sampling), 20, 21, app (autosave), ui |
| `YearPassed` | `year` | core | 10, 20 |
| `TilesChanged` | `tiles[]` | 03 (also on behalf of 04, 05, 14 through the terrain API) | 04, 07, 08, 11, 13, 14, 18, 22, 23 |
| `TilesDiscovered` | `tiles[]` | 03 | 23 |
| `VeinFound` | `material, tile, finderId` | 03 (first mined tile of a new face-connected mineral vein key) | 15, 18 (deepsilver gauge unlock), ui |
| `MineralMined` | `tile, material, minerId` | 03 | 13 (item spawn is done by 03 via spawn API; 13 counts) |
| `DeepsilverMined` | `tile, minerId` | 03 | 18, ui |
| `CavernBreached` | `cavern, tile` | 03 | 08, 18, 24 (milestone), ui |
| `ConstructionCollapsed` | `tiles[]` | 03 | 14, 13, ui |
| `TreeFelled` | `tile, species` | 03 | 07, ui (none) |
| `FluidsChanged` | `chunks[]` | 04 | 05, 09, 11, 19, 22, 23 |
| `ObsidianFormed` | `tile` | 04 | ui |
| `CreatureSubmerged` | `id, tile` | 04 | 17 |
| `MagmaContact` | `tile, entities[]` | 04 | 05, 13, 14, 17 |
| `TileFrozen` / `TileThawed` | `tile` | 04 | 09, 23 |
| `MistProduced` | `tiles[]` | 04 | ui |
| `TemperatureTick` | — | 05 | 04, 13 |
| `FireStarted` / `FireSpread` / `FireOut` | `tile` / `tiles[]` / `tiles[]` | 05 | 13, 14, 23, ui |
| `BurnDamage` | `id, amount` | 05 | 17 |
| `ItemMelted` | `id` | 05 | 13 |
| `WeatherChanged` | `from, to` | 06 | 05, 18, ui |
| `LightningStrike` | `tile` | 06 | 05, 17 |
| `SnowCoverChanged` | `chunks[]` | 06 | 05, 23 |
| `SeasonEffectsChanged` | `season` | 06 | 07, 18 |
| `CropPlanted` / `CropHarvested` / `CropDied` | `tile, species[, count, farmerId]` / `tile, reason` | 07 | 15 (harvest), ui |
| `PlotNeedsSeeds` | `zoneId, species` | 07 | ui |
| `SaplingGrew` / `ShrubRegrown` / `GrassRegrown` | `tile[, species]` / `tiles[]` | 07 | 23 |
| `AnimalSpawned` / `AnimalBorn` / `AnimalLeft` | `id, species` | 08 | 09, 18 (counts), ui |
| `AnimalStarving` | `id` | 08 | ui |
| `GrassGrazed` | `tile` | 08 | 07 |
| `ProductReady` | `id, product` | 08 | ui (first only) |
| `AnimalTamed` / `AnimalTrained` | `id[, kind]` | 08 | ui |
| `PetAdopted` | `animalId, dwarfId` | 08 | 10, 15, ui |
| `HuntStarted` / `HuntKill` / `HuntAbandoned` | `hunterId, targetId[, reason]` | 09 | ui |
| `FishCaught` | `fisherId, bodyId, species` | 09 | ui (first only) |
| `ButcheryDone` | `workshopId, species, yields` | 09 | ui (none) |
| `FishPoolDepleted` | `bodyId` | 09 | ui |
| `MealEaten` | `id, quality, atTable, roomTier, stage, kind` | 10 | 15 |
| `DrankAlcohol` / `DrankWater` | `id, material` / `id, outdoors` | 10 | 15 |
| `Slept` | `id, bedQuality, roomTier, onFloor, outdoors, ownBed, restored` | 10 | 15 |
| `Talked` | `a, b, friends` | 10 | 15 |
| `Sat` | `id, roomTier` | 10 | 15 |
| `HearthVisited` | `id` | 10 | 15 |
| `DwarfFeltMist` / `DwarfNearSpring` | `id` | 10 | 15 |
| `DwarfOutdoorsIn` | `id, weather` | 10 | 15 |
| `SawMasterwork` | `id, itemId` | 10 | 15 |
| `NeedCritical` | `id, need` | 10 | 11 |
| `Starving` | `id, need` | 10 | 17, ui |
| `Starvation` | `id` | 10 | 17 |
| `SkillLevelUp` | `id, skill, level` | 10 | 12, 15 |
| `LegendaryReached` | `id, skill` | 10 | 15, 24 (milestone), ui |
| `DwarfIdle` | `id` | 10 | ui (none) |
| `TitleAssigned` | `dwarfId, title` | 10 | 16, 20, ui |
| `DwarfBecameAdult` | `id` | 10 | 11, 15, ui |
| `JobCreated` / `JobClaimed` / `JobStarted` / `JobCompleted` / `JobCancelled` / `JobBlocked` / `JobUnblocked` | `jobId, jobType[, workerId, target, reason]` | 11 | producers (03, 07, 08, 09, 12, 13, 14, 17, 19, 20), 10 (xp on completed), ui |
| `ItemReserved` | `itemId, jobId` | 11 | 13 |
| `ItemReleased` | `itemId, jobId` | 10, 11 | 13 |
| `ToolEquipped` / `ToolDropped` | `dwarfId, itemId` / `itemId` | 11 | 11 (retry), 16 |
| `ItemCrafted` | `itemId, quality, crafterId, workshopId, recipeId` | 12 | 13, 15, 16 (better gear), 24 (milestones) |
| `MasterworkCreated` | `itemId, crafterId` | 12 | 15, ui |
| `WorkOrderCompleted` | `workshopId, recipeId` | 12 | ui (none) |
| `StoneSet` | `itemId, enchantId, tier, smithId` | 12 | ui (a masterwork setting: 25's announcement) |
| `WorkshopBlocked` / `WorkshopIdle` | `workshopId, reason[, container, input]` / `workshopId` | 12 | ui |
| `ItemCreated` | `id, itemType, material, count` | 13 | 11, 12, 16, 17 |
| `ItemDestroyed` | `id, itemType, reason, crafterId` | 13 | 11, 12, 15 |
| `ItemRotStage` / `ItemRotted` | `id, stage` / `id` | 13 | ui (none) |
| `MiasmaSpread` | `tiles[]` | 13 | 17 (infection modifier), ui |
| `StocksChanged` | `types[]` | 13 | 11, 12, ui |
| `StockpileFull` | `id` | 13 | ui |
| `WealthChanged` | `wealth` | 13 | 18, 20, 21 |
| `CorpseCreated` | `itemId, creatureId` | 13 | 08, 09, 14, 15 |
| `BuildingPlaced` | `id, buildingType, tiles[]` | 14 | 12, 13, 19, 20, 22, 24 (milestones), ui |
| `BuildingCompleted` | `id, buildingType, value` | 14 | 12, 13, 19, 20, 22, 24 (milestones), ui |
| `BuildingRemoved` | `id, buildingType, value` | 14 | 12, 13, 19, 20, 22, 24 (milestones), ui |
| `BuildingStateChanged` | `id, state` | 14 | 04, 11, 22, 23 |
| `ZoneChanged` | `zoneId, zoneType, change, tiles[]` | 14 | 07, 08, 09, 13, 16, 17 |
| `RoomQualityChanged` | `zoneId, tier` | 14 | 15, 10 (thane), ui |
| `RoomAssigned` | `zoneId, dwarfId` | 14 | 10 |
| `HearthLit` | `id` | 14 | 10, 15, 24 (milestone), ui |
| `DoorBroken` | `id` | 14 | 18, 24 (hint), ui |
| `FortressShutOut` | `id, doors[], tile` | 14 | ui |
| `Buried` | `dwarfId, coffinId, tombTier` | 14 | 15, ui |
| `MechanismToggled` | `id, newState` | 14 | 19, ui (none) |
| `MoodTierChanged` | `id, from, to` | 15 | 10, ui |
| `ThoughtGained` | `id, thoughtId, value` | 15 | ui |
| `SulkHappened` | `id, kind` | 15 | 10, 13 (hoard), 14 (broken furniture), ui |
| `HallSpiritChanged` | `value, tier` | 15 | 21, ui |
| `AttackResolved` | `attackerId, defenderId, part, damageType, amount, outcome` | 16 | 08, 18, 20, ui (combat log) |
| `DamageDealt` | `defenderId, part, damageType, amount, attackerId, weaponId` | 16, 19, 25 | 17 |
| `ProjectileFired` | `shooterId, targetId, itemId` | 16 | 09 |
| `CreatureFled` | `id, from` | 16 | 18 |
| `ThreatNearby` | `id, hostileId` | 16 | 10, 11, 15 |
| `SquadOrderIssued` | `squadId, order` | 16 | ui (none) |
| `AlertChanged` | `from, to` | 16 | 08, 10, 11, 14, 19, ui |
| `KillRecorded` | `killerId, victimId, hostile, hunted, killerName, killerSpecies, victimName, victimSpecies` | 16 | 15, 24 (milestones, legend) |
| `TrainingSession` | `squadId, members[]` | 16 | 15 (barracks thought) |
| `WoundInflicted` | `id, part, type, severity` | 17 | 15 |
| `LimbLost` | `id, part` | 17 | 15, 16, ui |
| `CreatureUnconscious` / `CreatureConscious` | `id` | 17 | 10, 16, 18, ui |
| `CreatureDied` | `id, cause, killerId, tile, species, name, faction, ageTicks, wornItems` | 17 | 08, 09, 10, 11, 13, 14, 15, 16, 18, 20, ui |
| `PatientAdmitted` / `PatientDischarged` / `PatientHealed` | `id[, hospitalTier]` | 17 | 10, 15, ui |
| `InfectionStarted` / `InfectionCured` | `id` | 17 | ui |
| `TreatmentDone` | `patientId, medicId, kind` | 17 | 10 (xp) |
| `ThreatWarning` | `kind, civ, sizeBand, edge` | 18 | 24 (hint), ui |
| `RaidArrived` | `partyId, kind, size` | 18 | 15, 16, 20, 21, ui |
| `RaidEnded` | `partyId, outcome` | 18 | 15, 21, 24 (milestone), ui |
| `ThiefSpotted` / `ThiefEscaped` | `id` / `id, itemId, animalId` | 18 | 13 (wealth), 15, ui |
| `AmbushSprung` | `partyId` | 18 | ui |
| `HostileSpawned` | `id, partyId` | 18 | 16 |
| `MonsterSpawned` / `MonsterEmerged` | `id, cavern` / `ids[], tile` | 18 | ui |
| `DeepStirred` | `level` | 18 | 15, ui |
| `HostileFled` | `id` | 18 | ui (none) |
| `DoorBreakAttempt` | `id, doorId` | 18 | 14 |
| `RestlessRose` | `count` | 18 | ui |
| `WebSpun` | `tiles[]` | 18 | 03 (flag), 23 |
| `TrapTriggered` / `TrapSpent` / `TrapJammed` / `TrapRearmed` | `trapId[, creatureId, kind, outcome]` | 19 | 08 (cage), 18 (spotting), ui |
| `CreatureCaged` | `creatureId, cageItemId` | 19 | 08, 13, 18, ui |
| `MechanismTriggered` | `sourceId, on` | 19 | 14 |
| `CaravanArrived` / `CaravanWaiting` / `CaravanAtDepot` / `CaravanDeparted` / `CaravanLost` / `CaravanAttacked` | `civ[, …]` | 20 | 15 (arrived), 18 (attacked → nothing; reputation in 20), ui |
| `TradeCompleted` / `TradeRefused` / `GiftGiven` | `civ, givenValue, receivedValue` / `shortfall` / `civ, value` | 20 | 10 (xp), ui |
| `ReputationChanged` | `civ, delta, reason` | 20 | 21 (Mountainhome), ui |
| `ImmigrantsArrived` | `ids[], count, children, guaranteed` | 21 | 11, 15, 18 (renown), ui |
| `ImmigrationSkipped` | `reason` | 21 | ui |
| `EntitiesMoved` | `moves: [id, from, to][]` | core movement helper | 03, 04, 18, 19 |
| `Fell` | `id, levels, landedOn` | core movement helper | 17 |
| `AttuneSession` | `id, xp, mishap` | 25 | 15 |
| `Mishap` | `id, kind, buildingId, tile` | 25 | 05 (`fire`), 14 (`scorched_circle`), 15, ui |
| `CreatureStunned` | `id, until` | 25 | 17 |
| `FirstRunecaster` | `id` | 25 | 15, ui |
| `SpellCast` | `casterId, spellId, targetId, tile, burned` | 25 (casts ride 16's loop; a firebloom's bloom) | ui (a bloom that burned a fortress creature) |
| `RuneSpent` | `id` | 25 | ui |
| `VialDrunk` | `id` | 25 | ui (none) |
| `Warded` | `id` | 25 | 15 |
| `Mended` | `id, casterId` | 25 | 15, 17 |

For a need errand's `ItemReleased`, `jobId` carries the eating or drinking dwarf's id; for a job reservation it carries the job id.

For `WorkshopBlocked`, `input` names the missing recipe input match when reason is `missing_input`, or `fuel` for a fuel shortage. The container class remains in `container` for `no_empty_container`.

## Notes for implementers

- Subscribers listed as "ui (none)" exist for the log's optional verbose filter and the debug panel; they need no announcement row.
- Events carrying `ids` of destroyed entities are still delivered; handlers check `alive`.
- A row lists the fields every emitter sets; an emitter may add the fields its subscribers read. `ZoneChanged` names the zone's type `zoneType` and carries the zone's `tiles`. `BuildingPlaced`, `BuildingCompleted` and `BuildingRemoved` name the type `buildingType`; `BuildingPlaced` also carries `tiles`, and the other two carry the building's wealth `value`. `CreatureDied` also carries `tile`, `species`, `name`, `faction`, `wildState` (a wild victim's behavior state, absent for others), `ageTicks` and `wornItems`: the dwarf-death thoughts read `species`, `faction` and `ageTicks`. `KillRecorded` carries the names and species of both creatures because the victim is gone when a line is drawn; `hostile` is whether the victim was an enemy of the killer, and `hunted` is true when the victim was the quarry of a claimed hunt job, which `HuntKill` announces; a trap's kill names the trap building as `killerName`. `HuntKill` also carries `targetSpecies`, the quarry's species index, for the same reason. `MealEaten` also carries `mealType` and `ItemDestroyed` also carries `quality`. `DamageDealt` from 25 also carries `clean: true`: 17 makes that wound already cleaned. `SulkHappened` also carries what the sulk chose: `partnerId` (argue), `targetTile` (weep), `itemId` (hoard) or `buildingId` (break).
- `TilesChanged` is emitted by 03 only. When 04, 05 or 14 change tiles through the terrain API, 03 batches them into the same tick's event.
- The announcement registry (24) has one row per event marked `ui` with a severity from the system document that emits it.
