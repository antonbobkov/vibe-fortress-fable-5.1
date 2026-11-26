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
| `HourPassed` | `hour` | core calendar | 06, 07, 10, 13 (compost heaps), 15, 16, 17, 18, 24 (hints) |
| `DayPassed` | `dayOfSeason, season, year` | core | 07, 08, 09, 14, 15, 16, 17, 18, 20, 21 |
| `SeasonChanged` | `season, year` | core | 06, 08, 13 (rot sampling), 20, 21, app (autosave), ui |
| `YearPassed` | `year` | core | 10, 20 |
| `TilesChanged` | `tiles[]` | 03 (also on behalf of 04, 05, 14 through the terrain API) | 04, 07, 08, 11, 13, 14, 18, 22, 23 |
| `TilesDiscovered` | `tiles[]` | 03 | 23 |
| `VeinFound` | `material, tile, finderId` | 03 (first mined tile of a new face-connected mineral vein key) | 15, 18 (deepsilver gauge unlock), ui |
| `MineralMined` | `tile, material, minerId` | 03 (an ore, gem or bone tile dug) | 13 (item spawn is done by 03 via spawn API; 13 counts) |
| `FossilFound` | `dwarfId, tile` | 03 (the first tile of class `bone` dug in a fortress, once) | 15, ui |
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
| `TileIgnited` | `tile, dwarfId` | 03 (an `ignite` job done: the firebrand spent) | 05 (queues the ignition), 15 |
| `IceMelted` | `tiles[]` | 05 (ice walls and floors melted, at most once a day) | 13 (re-reads rot speeds), ui |
| `WeatherChanged` | `from, to` | 06 | 05, 14 (a drying rack's day), 18, ui |
| `LightningStrike` | `tile` | 06 | 05, 17 |
| `SnowCoverChanged` | `chunks[]` | 06 | 05, 23 |
| `SeasonEffectsChanged` | `season` | 06 | 07, 18 |
| `CropPlanted` / `CropHarvested` / `CropDied` | `tile, species[, count, farmerId]` / `tile, reason` | 07 | 15 (harvest), ui |
| `PlotNeedsSeeds` | `zoneId, species` | 07 | ui |
| `SaplingGrew` / `ShrubRegrown` / `GrassRegrown` | `tile[, species]` / `tiles[]` | 07 | 23 |
| `AnimalSpawned` / `AnimalBorn` / `AnimalLeft` | `id, species` | 08 | 09, 18 (counts), ui |
| `AnimalStarving` | `id` | 08 | ui |
| `GrassGrazed` | `tile` | 08 | 07 |
| `ShrubGrazed` | `tile` | 08 | 07 |
| `ProductReady` | `id, product` | 08 | ui (first only) |
| `AnimalTamed` / `AnimalTrained` | `id[, kind]` | 08 | ui |
| `PetAdopted` | `animalId, dwarfId` | 08 | 10, 15, ui |
| `RoostFound` | `tile, dwarfId` | 08 (the first fortress dwarf within `ROOST_NOTICE_RADIUS` of a discovered bat roost's drop tile, once a fortress) | ui |
| `HuntStarted` / `HuntKill` / `HuntAbandoned` | `hunterId, targetId[, reason]` | 09 | ui |
| `FishCaught` | `fisherId, bodyId, species` | 09 | ui (first only) |
| `ButcheryDone` | `workshopId, species, yields` | 09 | ui (none) |
| `FishPoolDepleted` | `bodyId` | 09 | ui |
| `MealEaten` | `id, quality, atTable, roomTier, stage, kind` | 10 | 15 |
| `DrankAlcohol` / `DrankWater` | `id, material, quality, group, aged` / `id, outdoors` | 10 | 15 |
| `DrankFromPlant` | `id, material` | 10 | 15 |
| `Stung` | `id, source` | 09, 08 | 15 |
| `SpatOn` | `id, animalId, first` | 08 (a camel spits on the dwarf `id` who milked or shore it; `first` for the day's first spit) | 15, ui |
| `Slept` | `id, bedQuality, roomTier, onFloor, outdoors, ownBed, restored, rest, bedding, bedType` | 10 | 15, 24 |
| `Talked` | `a, b, friends` | 10 | 15 |
| `Sat` | `id, roomTier` | 10 | 15 |
| `HearthVisited` | `id` | 10 | 15 |
| `DwarfFeltMist` / `DwarfNearSpring` | `id` | 10 | 15 |
| `CraterEntered` | `id, first` | 10 (a dwarf steps into a `starfall` crater tile from outside it; `first` for the fortress's first) | 15, ui |
| `RibsEntered` | `id, boneyard` | 10 (the first fortress dwarf to stand in a boneyard's ribs, once a boneyard; `boneyard` its index in 03's `boneyards`) | 03 (marks `boneyardsEntered`), 15, ui |
| `WhimSet` | `thaneId, whimId` | 10 (on `SeasonChanged`, the Thane's whim of the season: a `whims` row id) | ui |
| `WhimJudged` | `thaneId, whimId, met` | 10 (on the next `SeasonChanged`, before the next draw; `thaneId` the Thane then, 0 for none) | 15, ui |
| `DwarfOutdoorsIn` | `id, weather` | 10 | 15 |
| `SawMasterwork` | `id, itemId` | 10 | 15 |
| `NeedCritical` | `id, need` | 10 | 11 |
| `Starving` | `id, need` | 10 | 17, ui |
| `Starvation` | `id` | 10 | 17 |
| `SkillLevelUp` | `id, skill, level` | 10 | 12, 15 |
| `LegendaryReached` | `id, skill` | 10 | 15, 24 (milestone), ui |
| `DwarfIdle` | `id` | 10 | ui (none) |
| `TitleAssigned` | `dwarfId, title, previousId` | 10 | 16, 20, ui |
| `DwarfBecameAdult` | `id` | 10 | 11, 15, ui |
| `JobCreated` / `JobClaimed` / `JobStarted` / `JobCompleted` / `JobCancelled` / `JobBlocked` / `JobUnblocked` | `jobId, jobType[, workerId, target, reason]` | 11 | producers (03, 07, 08, 09, 12, 13, 14, 17, 19, 20), 10 (xp on completed), ui |
| `ItemReserved` | `itemId, jobId` | 11 | 13 |
| `ItemReleased` | `itemId, jobId` | 10, 11 | 13 |
| `ToolEquipped` / `ToolDropped` | `dwarfId, itemId` / `itemId` | 11 | 11 (retry), 16 |
| `ItemCrafted` | `itemId, quality, crafterId, workshopId, recipeId` | 12 | 10 (the smokehouse's hunger), 13, 15, 16 (better gear), 24 (milestones) |
| `MasterworkCreated` | `itemId, crafterId` | 12 | 15, ui |
| `WorkOrderCompleted` | `workshopId, recipeId` | 12 | ui (none) |
| `StoneSet` | `itemId, enchantId, tier, smithId` | 12 | 24 (legend), ui (a masterwork setting: 25's announcement) |
| `SmokyFuelBurned` | `workshopId, tile` | 12, 10 | 05 (smoke), 15 (`smoky_hall`) |
| `DeepsilverWorked` | `amount, tile` | 12 (a `rune_work` building consumed a metal with `runePressure`) | 18 |
| `WorkshopBlocked` / `WorkshopIdle` | `workshopId, reason[, container, input]` / `workshopId` | 12 | ui |
| `WorkOrderSkipped` | `workshopId, recipeId, input` | 12 (an order skipped as out of reach, once until an order of its kind starts) | ui |
| `ItemCreated` | `id, itemType, material, count` | 13 | 11, 12, 16, 17 |
| `ItemDestroyed` | `id, itemType, reason, crafterId` | 13 | 11, 12, 15 |
| `ItemMerged` | `id, into, count` | 13 (`items.merge`: stack `id` joined stack `into` and is gone, with no `ItemDestroyed`) | 11, ui |
| `ItemRotStage` / `ItemRotted` | `id, stage` / `id` | 13 | ui (none) |
| `ItemAged` | `id, stage` | 13 (a stage gained in a working cellar) | ui (none) |
| `MiasmaSpread` | `tiles[]` | 13 | 17 (infection modifier), ui |
| `StocksChanged` | `types[]` | 13 | 11, 12, ui |
| `StockpileFull` | `id` | 13 | ui |
| `WealthChanged` | `wealth` | 13 | 18, 20, 21 |
| `CorpseCreated` | `itemId, creatureId` | 13 | 08, 09, 14, 15 |
| `BuildingPlaced` | `id, buildingType, tiles[]` | 14 | 03, 12, 13, 19, 20, 22, 24 (milestones), ui |
| `BuildingCompleted` | `id, buildingType, value` | 14 | 12, 13, 19, 20, 22, 24 (milestones), ui |
| `BuildingRemoved` | `id, buildingType, value` | 14 | 12, 13, 19, 20, 22, 24 (milestones), ui |
| `BuildingStateChanged` | `id, state` | 14 | 04, 11, 12, 22, 23 |
| `ZoneChanged` | `zoneId, zoneType, change, tiles[]` | 14 | 07, 08, 09, 13, 16, 17 |
| `RoomQualityChanged` | `zoneId, tier` | 14 | 15, 10 (thane), ui |
| `RoomAssigned` | `zoneId, dwarfId` | 14 | 10 |
| `HearthLit` | `id` | 14 | 10, 15, 24 (milestone), ui |
| `DoorBroken` | `id` | 14 | 18, 24 (hint), ui |
| `FortressShutOut` | `id, doors[], tile` | 14 | ui |
| `AlertLocksHeld` | `id, doors[], tile` | 14 | ui |
| `AlertLocksCleared` | `id, doors[], tile` | 14 | ui |
| `Buried` | `dwarfId, coffinId, tombTier` | 14 | 15, ui |
| `MechanismToggled` | `id, newState` | 14 | 19, ui (none) |
| `MoodTierChanged` | `id, from, to` | 15 | 10, ui |
| `ThoughtGained` | `id, thoughtId, value` | 15 | ui |
| `SulkHappened` | `id, kind` | 15 | 10, 13 (hoard), 14 (broken furniture), ui |
| `HallSpiritChanged` | `value, tier` | 15 | 21, ui |
| `AttackResolved` | `attackerId, defenderId, part, damageType, amount, outcome` | 16 | 08, 13, 18, 20, 25, ui (combat log) |
| `DamageDealt` | `defenderId, part, damageType, amount, attackerId, weaponId` | 16, 19, 25 | 17 |
| `ProjectileFired` | `shooterId, targetId, itemId` | 16 | 09 |
| `CreatureFled` | `id, from` | 16 | 18 |
| `ThreatNearby` | `id, hostileId` | 16 | 10, 11, 15, 25 (the `fire` draughts) |
| `SquadOrderIssued` | `squadId, order` | 16 | ui (none) |
| `AlertChanged` | `from, to` | 16 | 08, 10, 11, 14, 19, ui |
| `KillRecorded` | `killerId, victimId, hostile, hunted, killerName, killerSpecies, victimName, victimSpecies` | 16 | 15, 24 (milestones, legend) |
| `TrainingSession` | `squadId, members[]` | 16 | 15 (barracks thought) |
| `WoundInflicted` | `id, part, type, severity` | 17 | 15 |
| `LimbLost` | `id, part, name, species` | 17 | 15, 16, ui |
| `CreatureUnconscious` / `CreatureConscious` | `id` | 17 | 10, 11 (`CreatureUnconscious`), 16, 18, ui |
| `CreatureDied` | `id, cause, killerId, tile, species, name, faction, ageTicks, wornItems` | 17 | 08, 09, 10, 11, 13, 14, 15, 16, 18, 20, ui |
| `PatientAdmitted` / `PatientDischarged` / `PatientHealed` | `id[, hospitalTier]` | 17 | 10, 15, ui |
| `InfectionStarted` / `InfectionCured` | `id` | 17 | ui |
| `NoDressing` | `id` | 17 | ui |
| `Frostbitten` | `id` | 17 | ui |
| `TreatmentDone` | `patientId, medicId, kind` | 17 | 10 (xp) |
| `ThreatWarning` | `kind, civ, sizeBand, edge` | 18 | 24 (hint), ui |
| `RaidArrived` | `partyId, kind, size, edge` | 18 | 15, 16, 20, 21, 25, ui |
| `RaidEnded` | `partyId, outcome` | 18 | 15, 21, 24 (milestone), ui |
| `ThiefSpotted` / `ThiefEscaped` | `id` / `id, partyId, itemId, ownerId, itemType, material, count` or `id, partyId, animalId, species` | 18 | 13 (wealth), 15, ui |
| `AmbushSprung` | `partyId` | 18 | 21, 25, ui |
| `HostileSpawned` | `id, partyId` | 18 | 16 |
| `MonsterSpawned` / `MonsterEmerged` | `id, cavern` / `ids[], tile` | 18 | ui; 25 (`MonsterEmerged`: the `deep` draughts) |
| `DeepStirred` | `level` | 18 | 15, 25 (the `deep` draughts), ui |
| `HostileFled` | `id[, nerve, species]` | 18 | ui (a note when `nerve`: a raider that lost its nerve, 18 § Morale) |
| `DoorBreakAttempt` | `id, doorId` | 18 | 14 |
| `RestlessRose` | `count` | 18 | ui |
| `WebSpun` | `tiles[]` | 18 | 03 (flag), 23 |
| `TrapTriggered` / `TrapSpent` / `TrapJammed` / `TrapRearmed` | `trapId[, creatureId, kind, outcome]` | 19 | 08 (cage), 18 (spotting, morale), ui |
| `CreatureCaged` | `creatureId, cageItemId` | 19 | 08, 13, 18, ui |
| `MechanismTriggered` | `sourceId, on` | 19 | 14 |
| `CaravanArrived` | `civ[, …]` | 20 | 15, ui |
| `CaravanWaiting` | `civ, partyId, edge, reason[, depotId, tile, depotSide]` | 20 | ui |
| `CaravanAtDepot` | `civ, partyId, depotId` | 20 | ui |
| `CaravanDeparted` / `CaravanLost` / `CaravanAttacked` | `civ[, …]` | 20 | 18 (attacked → nothing; reputation in 20), ui |
| `TradeCompleted` / `TradeRefused` / `GiftGiven` | `civ, givenValue, receivedValue` / `shortfall` / `civ, value` | 20 | 10 (xp), ui |
| `TradeMissed` | `civ, depotId, traderId` | 20 | ui (an alert: the stay ended with a trade request waiting) |
| `DepotGoodsReturned` | `depotId, count` | 20 | ui (a note: a caravan's departure took the goods left at a depot back to stock) |
| `ReputationChanged` | `civ, delta, reason` | 20 | 21 (Mountainhome), ui |
| `ImmigrantsArrived` | `ids[], count, children, guaranteed` | 21 | 11, 15, 18 (renown), ui |
| `ImmigrationSkipped` | `reason[, wealth, need]` | 21 | ui (`wealth` and `need`, the fortress's wealth and the bar, with reason `wealth`) |
| `EntitiesMoved` | `moves: [id, from, to][]` | core movement helper | 03, 04, 18, 19 |
| `Fell` | `id, levels, landedOn` | core movement helper | 17 |
| `AttuneSession` | `id, xp, mishap` | 25 | 15 |
| `Mishap` | `id, kind, buildingId, tile` | 25 | 05 (a mishap with a tile: `fire`, `blaze`), 14 (`scorched_circle`), 15, ui |
| `CreatureStunned` | `id, until` | 25 | 11, 17 |
| `FirstRunecaster` | `id` | 25 | 15, 24 (legend), ui |
| `SpellCast` | `casterId, spellId, targetId, tile, burned` | 25 (casts ride 16's loop; a firebloom's bloom) | ui (a bloom that burned a fortress creature) |
| `SpellBloomed` | `casterId, tile` | 25 (a firebloom's bloom) | ui (the compositor's flash) |
| `RuneSpent` | `id` | 25 | ui |
| `VialDrunk` | `id, sick` | 25 | 15 (`sick`), ui (none) |
| `Warded` | `id` | 25 | 15 |
| `Mended` | `id, casterId` | 25 | 15, 17 |
| `DraughtDrunk` | `id, draughtId, calm, again` | 25 | 15, ui (none) |
| `SummonCalled` | `id, casterId` | 25 | 24 (milestone) |
| `SummonTurned` | `id` | 25 | 15, 18, ui |
| `SummonFaded` | `id` | 25 | 17 |
| `WispAppeared` | `id, tile` | 25 (a called wisp; a loose wisp) | 15 |
| `PutToFlight` | `id, sourceId` | 25 (a Dread or a fearsome blow adds a `flee` effect) | 15 |

For a need errand's `ItemReleased`, `jobId` carries the eating or drinking dwarf's id; for a job reservation it carries the job id.

For `WorkshopBlocked`, `input` names the missing recipe input match when reason is `missing_input`, or `fuel` for a fuel shortage, and the item types out of reach ('|'-joined) when reason is `out_of_reach`; `cloth_kept` names none (12 § Cloth kept for dressings); `material_kept` names the recipe input match whose units are kept for another order (12 § Materials kept for orders). The container class remains in `container` for `no_empty_container`. `WorkOrderSkipped` names the item types out of reach in `input` the same way.

## Notes for implementers

- Subscribers listed as "ui (none)" exist for the log's optional verbose filter and the debug panel; they need no announcement row.
- Events carrying `ids` of destroyed entities are still delivered; handlers check `alive`.
- A row lists the fields every emitter sets; an emitter may add the fields its subscribers read. `ZoneChanged` names the zone's type `zoneType` and carries the zone's `tiles`. `BuildingPlaced`, `BuildingCompleted` and `BuildingRemoved` name the type `buildingType`; `BuildingPlaced` also carries `tiles`, and the other two carry the building's wealth `value`. `CreatureDied` also carries `tile`, `species`, `name`, `faction`, `wildState` (a wild victim's behavior state, absent for others), `petOf` (the owner of a pet, 0 for none; the log reads it, since the pet is gone when the line is drawn), `ageTicks` and `wornItems`: the dwarf-death thoughts read `species`, `faction` and `ageTicks`. With a killer it carries `killerName` and `killerSpecies` (no species for a trap, named by its building), so the death line can name a killer that is gone. Every emitter goes through 17's death, so a death outside 17 (04's `frozen`, 08's `slaughter`, 18's `dawn`) carries the same fields; one whose emitter leaves its own remains (08's slaughter, 18's restless dead) also carries `noCorpse: true`, and 13 makes no corpse for it. `KillRecorded` carries the names and species of both creatures because the victim is gone when a line is drawn; `hostile` is whether the victim was an enemy of the killer, and `hunted` is true when the victim was the quarry of a claimed hunt job, which `HuntKill` announces; a trap's kill names the trap building as `killerName`. `HuntKill` also carries `targetSpecies`, the quarry's species index, for the same reason. `MealEaten` also carries `mealType`, `seasoned` (the material ids of the meal's seasonings) when it has any, `candlelit: true` for a meal at a table in comfort light (14 § Candle stands and lanterns), `feast: true` for a feast's serving (10 § Feasts) and `mug: true` for a meal at a seat whose table holds its mug (14 § Mugs at the table); `SmokyFuelBurned` from 10 is a candle's tallow smoke, with `workshopId` 0 and the `dwarfId` it is given to, and `ItemDestroyed` also carries `quality`. `DamageDealt` from 25 also carries `clean: true`: 17 makes that wound already cleaned. `SulkHappened` also carries what the sulk chose: `partnerId` (argue), `targetTile` (weep), `itemId` (hoard) or `buildingId` (break).
- `TilesChanged` is emitted by 03 only. When 04, 05 or 14 change tiles through the terrain API, 03 batches them into the same tick's event.
- The announcement registry (24) has one row per event marked `ui` with a severity from the system document that emits it.
