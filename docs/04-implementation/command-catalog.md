# Command Catalog

**Owner:** implementation · **Depends on:** [`../01-architecture/module-interfaces.md`](../01-architecture/module-interfaces.md), every system document

Every command, its fields, its owning system, its validation and the events its application emits. Rejection reasons are from the fixed list at the end. A handler validates the type of each field before using it. If a handler throws, the command phase records `precondition_failed`, emits `CommandRejected` and continues the remaining queue without losing a tick. Commands are applied at the start of a tick in submission order. While paused, the host runs the same command phase immediately, stamped with the next tick's number, without running any other tick phase. Rejections reach presentation at once; other command events wait for the normal tick dispatch.

| Command | Fields | Owner | Validation (reject reason) | Emits |
|---|---|---|---|---|
| `Designate` | `tiles[], kind, priority` | 03 | each tile in bounds; kind precondition per 03's transition table for tiles that are discovered (undiscovered tiles accepted blind); `deepsilver_unconfirmed` if any tile is known deepsilver and `deepsilverConfirmed` is false | `JobCreated` via producer |
| `UndoDesignation` | `tiles[]` | 03 | tiles have designations without progress (`has_progress` otherwise, partial) | `JobCancelled` |
| `SetDesignationPriority` | `tiles[], priority` | 03 | designations exist; Designate tool applies it to the still-designated tiles of its last batch | — |
| `SetTraffic` | `tiles[], mode` | 03 | in bounds | `TilesChanged` |
| `DesignateStairwell` | `x, y, zTop, zBottom` | 03 | integer coordinates in the map (`out_of_bounds`); `zTop > zBottom` | as Designate |
| `DesignateHarvest` | `tiles[]` | 07 | crops at stage 3 | `JobCreated` |
| `ConfirmDeepsilver` | — | 03 | — | — (sets `deepsilverConfirmed`) |
| `SetPlotCrop` | `zoneId, season, speciesId \| 0` | 07 | zone is a farm plot; species is 0 or a known farmed plant id/integer index (`not_found` otherwise); light matches the plot kind (`light_mismatch`) | — |
| `AssignPasture` | `animalId, zoneId \| 0` | 08 | tame grazer; zone is a pasture | — |
| `MarkSlaughter` / `UnmarkSlaughter` | `animalId` | 08 | tame; not assigned as war or hunting animal (`assigned`) | `JobCreated` |
| `TrainAnimal` | `animalId, kind` | 08 | species trainable for kind; a kennel exists (`no_kennel`) | `JobCreated` |
| `TameCaged` | `cageId` | 08 | cage holds a tameable creature; kennel exists | `JobCreated` |
| `AssignAnimal` | `animalId, dwarfId \| chainId \| squadId \| 0` | 08 | trained or pet-able; target exists | — |
| `SetBreedingCap` | `species, cap` | 08 | 0–100 | — |
| `ReleaseCaged` | `cageId` | 08 | cage occupied | `CreatureCaged`-reverse via 19 `ReleaseCage` |
| `SetHuntable` | `species, on` | 09 | known wild species (`not_found` for unknown species); boolean `on` | — |
| `SetLabor` | `dwarfId, labor, on` | 11 | adult (children: `child_labor`); `hauling` cannot be turned off for children | `JobUnblocked` retries |
| `SetLaborPriority` | `labor, priority` | 11 | 1–9 | — |
| `CancelJob` | `jobId` | 11 | job exists and is cancellable (not `completing`) | `JobCancelled` |
| `SetJobPriority` | `jobId, priority` | 11 | job open or claimed | — |
| `SetStandingOrder` | `name, on` | 11 | known name | — |
| `AssignTitle` | `dwarfId \| 0, title` | 10 | adult; one holder per title | `TitleAssigned` |
| `RenameDwarf` | `dwarfId, name` | 10 | 1–24 characters | — |
| `SetSchedule` | `dwarfId, sleepStartHour` | 10 | 0–23 | — |
| `AddWorkOrder` | `workshopId \| 0, order` | 12 | `order` is a non-null record (`precondition_failed` otherwise); recipe belongs to the workshop type; count 1–999 or maintain threshold 1–999; `materialFilter` is null, a known material id (normalised to its index), a valid integer material index or a material class (`bad_setting` otherwise); `order.memorialDwarfId` only on `make_memorial_slab`, naming a dead dwarf with no intact body | — |
| `EditWorkOrder` / `RemoveWorkOrder` / `ReorderWorkOrder` | `workshopId, index[, patch \| to]` | 12 | index valid; Edit requires a non-null record `patch` (`precondition_failed` otherwise) and validates and normalises `materialFilter` as AddWorkOrder before cancelling work | — |
| `SetWorkshopWorker` | `workshopId, dwarfId \| 0` | 12 | dwarf has any enabled recipe labor for the workshop type | — |
| `SuspendWorkshop` | `workshopId, on` | 12 | — | `JobCancelled` if running |
| `ForbidItem` / `ClaimItem` / `DumpItem` / `MeltItem` | `itemId \| tiles[] \| typeId, on` | 13 | items exist; melt only metal items | `ItemReleased` when forbidding a reserved item cancels its job |
| `SetStockpileFilter` | `zoneId, filter` | 13 | zone is a stockpile; category nodes exist | — |
| `SetStockpileContainers` / `SetStockpilePriority` / `LinkStockpile` | `zoneId, …` | 13 | — | — |
| `PlaceBuilding` | `buildingType, origin, orientation, materialChoice, priority, width?, height?` | 14 | optional integer dimensions only for a variable footprint (`fixed_footprint` names a fixed type); footprint rules; materials exist in the fortress (`no_materials` is a warning, not a rejection: the job blocks); magma safety (`not_magma_safe`); one hearth (`hearth_exists`); depot reachability is checked at caravan time | `BuildingPlaced`, `JobCreated` |
| `CancelBuilding` | `buildingId` | 14 | planned or constructing | `BuildingRemoved`, `JobCancelled` |
| `DeconstructBuilding` | `buildingId` | 14 | built; not the hearth while dwarves live (`hearth_is_home`) | `JobCreated` |
| `SetBuildingPriority` | `buildingId, priority` | 14 | planned | — |
| `CreateZone` | `zoneType, tiles[]` | 14 | tiles walkable (type-specific), no overlap (`overlap`), fishing and farm tile rules; a command with any bad tile is rejected whole (`bad_zone_tiles`) | `ZoneChanged` |
| `ResizeZone` / `RemoveZone` / `SetZoneSetting` | `zoneId, …` | 14 | zone exists; setting key and typed value valid for the type (`bad_setting` otherwise); owner uses AssignRoom checks; seasonal crops use SetPlotCrop checks | `ZoneChanged` |
| `AssignRoom` | `zoneId, dwarfId \| 0` | 14 | bedroom with a bed | `RoomAssigned` |
| `LinkMechanism` / `UnlinkMechanism` | `sourceId, targetId` | 14 | source is a lever or plate; target is linkable; mechanism available (blocks otherwise) | `JobCreated` |
| `SetDoorMode` / `SetHatchMode` | `buildingId, mode` | 14 | building has the tag | `BuildingStateChanged` |
| `SetPlateTrigger` | `plateId, trigger` | 14 | valid trigger: `{ kind: 'creatures', minSize, includeFortress }` or `{ kind: 'water' or 'magma', level }` with level 1 to 7 | — |
| `ReleaseCage` | `cageBuildingId` | 14 | occupied | `CreatureCaged` reverse (creature spawned adjacent) |
| `AssignCoffin` | `coffinId, dwarfId \| 0` | 14 | coffin free | — |
| `CreateSquad` | `name` | 16 | fewer than `SQUAD_MAX_COUNT` squads | — |
| `DisbandSquad` | `squadId` | 16 | exists | — |
| `SetSquadMembers` | `squadId, members[]` | 16 | adults; at most `SQUAD_MAX_SIZE`; not in another squad | — |
| `SetSquadLeader` / `SetSquadMode` / `SetSquadEquipment` / `SetSquadStation` / `SetSquadPatrol` | `squadId, …` | 16 | — | — |
| `SquadOrder` | `squadId, order` | 16 | target exists; tiles walkable | `SquadOrderIssued` |
| `SetAlert` | `level` | 16 | — | `AlertChanged` |
| `SetHospitalSupplies` | `zoneId, wants` | 17 | hospital zone; wants is a supply-kind record with integer counts 0 to HOSPITAL_SUPPLY_MAX (`bad_setting` otherwise) | — |
| `SetTrapMode` | `trapId, mode` | 19 | trap exists | — |
| `PullLever` | `leverId` | 19 | built lever | `JobCreated` |
| `MoveToDepot` / `RemoveFromDepot` | `itemIds[]` | 20 | items exist; a depot exists (`no_depot`) | `JobCreated` |
| `TradeOpen` | `depotId` | 20 | caravan at this depot (`no_caravan`) | `JobCreated` (trade job) |
| `TradeOffer` | `give[], take[]` | 20 | session open; items are at the depot / merchant's | `TradeCompleted` or `TradeRefused`, `ReputationChanged` |
| `TradeCancel` | — | 20 | session open | — |
| `SetRequests` | `civ, entries[]` | 20 | at most `REQUEST_MAX` | — |
| `SetPopulationCap` | `n` | 21 | 20–200 | — |
| `NameAnimal` | `animalId, name` | 08 | tame; name 1–24 characters | — |
| `RenameSquad` | `squadId, name` | 16 | 1–32 characters | — |
| `RenameFortress` | `name` | core | 1–32 characters | — |

App-level (not simulation commands, not logged): `Save`, `Load`, `RetireFortress`, `SetSpeed`, `SetSetting`, and the embark-session commands of 02 (`SetSkill`, `RerollDwarf`, `RenameDwarf`, `SetSupply`, `ApplyPreset`, `SetFortressName`, `ConfirmEmbark`), which run before the world exists.

`Designate` and `DesignateStairwell` reject the whole command if any discovered tile fails its precondition; UI tools submit only eligible or undiscovered tiles. Every designation kind on discovered deepsilver requires confirmation. The kind accepts a designation number or name, and priority defaults to `PRIORITY_DEFAULT`, with values outside 1ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“9 rejected. `SetDesignationPriority` requires a designation on every tile. `UndoDesignation` clears each designation without progress, keeps progressed ones, and returns `has_progress` when any are kept: this is the explicit partial-application exception.

## Rejection reasons

`out_of_bounds`, `not_discovered`, `precondition_failed`, `has_progress`, `deepsilver_unconfirmed`, `light_mismatch`, `not_tame`, `assigned`, `no_kennel`, `not_trainable`, `child_labor`, `not_found`, `not_cancellable`, `invalid_index`, `no_labor`, `not_metal`, `bad_category`, `footprint_blocked`, `bad_placement`, `fixed_footprint`, `not_magma_safe`, `hearth_exists`, `hearth_is_home`, `overlap`, `bad_zone_tiles`, `bad_setting`, `no_bed`, `not_linkable`, `no_tag`, `squad_limit`, `member_limit`, `already_in_squad`, `not_adult`, `no_depot`, `no_caravan`, `no_session`, `not_at_depot`, `request_limit`, `out_of_range`, `bad_name`, `caravan_absent`.

Each reason has a string key `reject.<reason>` in the strings table; the UI shows it in the status bar for `STATUS_HINT_SECONDS`.
