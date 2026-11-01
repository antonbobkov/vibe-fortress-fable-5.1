# 14 Buildings & Rooms

**Owner:** `systems/buildings` · **Depends on:** [03-terrain-and-mining.md](03-terrain-and-mining.md), [11-jobs-and-labor.md](11-jobs-and-labor.md), [13-items-and-storage.md](13-items-and-storage.md), [10-dwarves.md](10-dwarves.md), [15-happiness-and-morale.md](15-happiness-and-morale.md), [19-defense-and-traps.md](19-defense-and-traps.md)

## Purpose

Let the player shape the fortress: constructions, furniture, workshops, mechanisms, traps, the hearth, the depot, and zones. Detect rooms and rate them. Own ownership and burial.

## Concepts

- **Building**: an entity occupying one or more tiles with a type from `buildings-and-furniture.md`. Categories: `construction` (wall, floor, ramp, stairs, fortification, paved floor), `furniture` (placed from a crafted item), `workshop`, `mechanism` (lever, pressure plate, floodgate, hatch, drawbridge, door), `trap`, `special` (hearth, trade depot, well, nest box, cage, chain, coffin, memorial slab, archery target).
- **Function tag**: what a building does, read by systems: `sleep`, `sit`, `eat_at`, `door`, `hatch`, `bridge`, `floodgate`, `lever`, `plate`, `trap:*`, `container`, `well`, `depot`, `hearth`, `workshop`, `training`, `archery_target`, `coffin`, `memorial`, `cage`, `chain`, `nest_box`, `store` (cabinet, chest), `blocks_fluid`, `light`.
- **Zone**: a set of tiles with a type and settings. Types: `stockpile`, `farm_plot`, `pasture`, `bedroom`, `dining_hall`, `hearth_hall`, `hospital`, `barracks`, `archery_range`, `meeting_area`, `tomb`, `dump`, `fishing`, `gather`.
- **Room**: a zone of a room type with a computed quality. Room types: `bedroom`, `dining_hall`, `hearth_hall`, `hospital`, `barracks`, `tomb`.
- **Quality tier**: bare, modest, decent, fine, grand, royal.
- **Ownership**: a bedroom's owner; a tomb's occupant.

## Rules

### Placement

`PlaceBuilding { buildingType, origin, orientation, materialChoice, priority }`:

1. Optional integer `width` and `height` are accepted only for a variable footprint (the drawbridge), from 1 through `BRIDGE_MAX`. Supplying either on a fixed type is rejected as `fixed_footprint` before creating an entity or job; the message names the building. Omitted dimensions use the type’s own footprint. Footprint from the type (`w × h`, rotated by orientation for bridges and depots). `origin` is the footprint's north-west tile; a rotatable type swaps `w` and `h` at odd orientations. Every footprint tile must be `discovered`, must be a `floor` (or per type: a bridge may span `open` tiles as long as one end tile is `floor`; a floodgate must be on a `floor`; a well must be over an `open` channel; a hatch over a `stairs_down` or ramp top; a door must have a wall on two opposite sides; constructions have their own rules below), must not be occupied by another building (except that furniture may be placed inside a zone), must not contain a creature for mechanisms that become walls, and must not be `restricted` for the placement of nothing (restrictions are for traffic only). A `sapling` or `shrub` counts as the floor it stands on for all of these rules: the placement shows what will be cleared, and the builder clears it (step 4). A grown `tree` refuses the building, and the refusal says to chop it first.
2. Materials: the type lists inputs (for example a bed: one `furniture/bed` item; a wall: one block, log, bar or raw stone of the player's choice; a lever: one mechanism; a well: one bucket, one chain or rope, one mechanism, one block; a cage trap: one mechanism and one cage). `materialChoice` narrows the filter (oak, granite, steel).
3. Magma safety: if any footprint tile is within 1 of magma (the tile itself and its 26 neighbours) or is over a channel to magma (a `magma_*` workshop), every material must be magma-safe (05) or the command is rejected with `not_magma_safe`. With no `materialChoice` the placement is refused too, since the materials cannot be known to be safe.
4. Create the entity in state `planned` and a `build` job (labor by category: `construction` for constructions, `carpentry` for wooden furniture placement, `masonry` for stone, `mechanics` for mechanisms and traps, `construction` for everything else; skill `building`; a type whose labor is "by material" takes it from the chosen material's class: wood carpentry, stone masonry, metal smithing, else `construction`) with the materials as inputs and `workTile: adjacent` (or `at` for floors and stairs the builder stands on). The job anchors at the centre of the footprint. Priority from the command. The inputs of an `adjacent` build whose site cannot be stood on (a wall over open space) are delivered to the worker's stand tile. With saplings or shrubs on the footprint the job's work is longer by `CLEAR_PLANT_TICKS` (07) for each, and that work comes first: when it is done the builder has uprooted them, each tile becomes the floor (grass if soil) that felling a tree leaves, and a `mature` shrub drops what `gather` would. Cancelling the building before then leaves the plants standing.
5. `BuildingPlaced`. The planned building renders as a dim outline and is passable.

The `wagon` is placed at embark only (02); `PlaceBuilding` refuses it with `bad_placement`.

`build` job completion: consume inputs (the furniture item is *linked*, not destroyed: `Building.itemId` keeps it for quality, material and value, the item is `installed` (13) and so leaves every search, haul and available count while it stays in the totals and in wealth, and it returns to the building's anchor tile on deconstruction or removal), set state `built`, apply tile changes through the terrain API for constructions (`setKind`, `constructed` flag; the material grid gets the block's material), register mechanisms, emit `BuildingCompleted`. Constructions that become walls check that no creature is on the tile (the job waits otherwise). Any other building that makes a footprint tile impassable when it is built (a workshop's impassable tiles, such as the forge's corners, where its builder may have worked) moves each creature standing on such a tile, in the same tick, to the nearest tile beside the footprint that a walker can stand on (Chebyshev distance from the creature's tile, ties by tile index). Work done standing on a tile the building now blocks ends with it: 03 clears the designations worked from that tile (03 § Tile transitions), and a farm plot tile under a built building is not planted (07 § Farm plots). Before sealing a wall, move each loose ground item that will remain after consuming its construction inputs to one of the eight adjacent tiles on the same level, outside the footprint, that is solid-bottomed and passable to a walker. Choose the qualifying tile with the lowest tile index. Move whole remaining stacks and containers, preserving contents, ownership, reservations and flags. If a remaining item has no qualifying destination, the build waits without consuming any inputs or changing the terrain.

A build input of more than one unit is counted in units, not stacks: a hearth's three blocks may arrive as a stack of two and a stack of one; the job consumes exactly the units it needs and leaves any remainder of a stack on the site (a wall clears that remainder as above). A furniture building takes its linked item's material; any other building takes the material of the first unit consumed. The item types consumed are kept on the building, and deconstruction returns them.

### Constructions

| Type | Result | Notes |
|---|---|---|
| `wall` | `wall` tile, `constructed` | Blocks everything; support rule (03) |
| `floor` | `floor` tile, `constructed` | Over `open`; needs support |
| `paved_floor` | `floor` with `paved` material property | On existing floor; clears grass and mud; blocks regrowth; no room value |
| `ramp` | `ramp` | On a floor with a wall among its four same-level neighbours |
| `stairs_up` / `stairs_down` / `stairs_updown` | as named | Up stairs on a floor; down and up/down stairs on a floor whose tile below is `open` |
| `fortification` | `fortification` | Blocks movement, passes projectiles and fluids; ranged units adjacent can shoot through |
| `bridge` (fixed) | `floor` tiles over open | A plain constructed floor; the drawbridge is a mechanism below |

Deconstruct (`DeconstructBuilding` → `remove` designation for constructions, `deconstruct` job for others): returns the material item(s); constructions revert per 03's `remove` rule.

A built construction keeps its building entity on its tile and remembers the items it was built from; the first is the item 03's `remove` and collapse return (`setConstructionItemSource`). This system removes the building on the `TilesChanged` that shows the tile no longer matches the construction (the flag cleared or the kind changed).

### Doors and hatches

- `door`: passable to fortress creatures; **mode** `open` (default; anyone including hostiles that `opensDoors` can pass; wild animals cannot), `locked` (impassable to everyone; fluids still pass; a door does not close on a creature in its doorway, a hostile included, so a lock set by hand, by a lever or by the alert takes effect on the first tick the doorway is clear, and the door panel says it is waiting), `no_pets` (tame animals cannot pass), `lock_on_alert` (locks while the alert is `hearth`, under the conditions of 19 § Hearth alert retreat; the lock is noted once per alert, which dirties the door's chunks and emits `BuildingStateChanged`, and the alert returning to `calm` unlocks it the same way). When the doors that the alert has locked leave no living fortress dwarf in the walker region (the connectivity label, with the doors as they now stand) of the inner side of any of them, the fortress is shut out of its own gate: an outdoor tile on the hearth's side of the gate does not count as outside. A door's inner side is the tile beside it toward the hearth (the indoor side when there is no hearth, and no door whose two sides are both indoors or both outdoors without a hearth is judged). The judgement is made on a buildings tick after the doors have locked, and the system emits `FortressShutOut { id, doors, tile }` once per alert (`doors` are the `lock_on_alert` doors locked by then, `id` the first of them, `tile` its tile), and the announcement is a danger line that names the doors and says to set the alert back to calm or watchful. Doors are 1×1 and need a wall on two opposite sides. Doors do not block fluids.
  - Passability for 22's hook `blocksMovementAt(i, class, faction, mover)`: a locked door (or a `lock_on_alert` door that is locked) blocks everyone; otherwise it blocks `large` movers; with no faction (the connectivity labels) it passes; otherwise it blocks `wild` movers, `hostile:*` and `deep` movers without `opensDoors`, and tame movers at a `no_pets` door. The mover options carry `opensDoors` (species flag `O`) and `tame` (a `Tame` component).
  - A built door stands open while a creature is in its doorway and is closed otherwise; a closed or locked door blocks line of sight.
- `hatch`: over stairs or a ramp top; modes `open` and `locked`; when locked blocks vertical movement and blocks fluid falling into the tile below. A hatch never blocks horizontal movement. A locked hatch on the open tile over a ramp removes the ramp's edges through that tile as well as a stairs edge.
- Trollkin and other `breaksDoors` creatures destroy a locked door after `DOOR_BREAK_TICKS` adjacent to it (18 AI; this system removes the building and emits `DoorBroken`).

### Mechanisms and links

- `lever`: 1×1; needs 1 mechanism; `PullLever` creates a `pull_lever` job (any adult, `hauling` labor, no skill) that toggles every linked target after `LINK_DELAY_TICKS`.
- `pressure_plate`: 1×1; settings: `triggerOn: creatures (minSize, includeFortress) | water ≥ n | magma ≥ n`, set by `SetPlateTrigger { plateId, trigger }` with `trigger` `{ kind: 'creatures', minSize, includeFortress }` or `{ kind: 'water' | 'magma', level }` (`level` an integer 1 to 7; otherwise `out_of_range`, without changing settings) and stored as `settings.triggerOn`; a new plate is set to hostile, wild and deep creatures of any size; toggles linked targets when its condition becomes true and again when it becomes false, with `PLATE_RESET_TICKS` minimum between toggles.
- Targets: `door` (toggle locked), `hatch` (toggle locked), `floodgate` (toggle open), `drawbridge` (toggle raised), `spike_trap` (extend), `cage` (open and release).
- `LinkMechanism { sourceId, targetId }` creates a `link_mechanism` job (labor `mechanics`, skill `mechanics`, input 1 mechanism item, work at the target then at the source): one job at the target, which delivers and consumes the mechanism, then a second at the source, which records the mechanism's material and the link, each lasting `LINK_WORK_TICKS`. Links are stored on both entities; `UnlinkMechanism` returns one mechanism of the recorded material at the source.
- `floodgate`: 1×1; closed by default: acts as a `wall` for movement and fluid (a `blocks_fluid` building on a floor tile; 04 and 22 read `buildings.blocksAt(i)`); open: a floor. Magma-safe material required next to magma.
- `drawbridge`: `w × h` up to `BRIDGE_MAX × BRIDGE_MAX`, orientation 0/1 hinges on the low x/y edge and 2/3 on the high x/y edge; at least one hinge tile must be floor. Original open tiles are saved and restored when raised or deconstructed; needs `w × h` blocks and 1 mechanism. **Lowered**: every footprint tile is a walkable floor (spanning open space). **Raised**: every footprint tile is impassable for movement and fluid; creatures on the tiles when it raises take `BRIDGE_CRUSH_DAMAGE` (17) and are moved to a random adjacent walkable tile, or die if none; items on the tiles are moved to adjacent tiles. Raising and lowering take effect after `LINK_DELAY_TICKS` from the trigger. A bridge over magma must be magma-safe.

### Special buildings

A lamp is a placed glowstone statue. It lights the 3×3 around it for comfort. The first lamp records each tile's original crop-light bit, overlapping lamps increment a coverage count, and removing the last lamp restores the original bit. Plants use that recorded crop light, so lamps do not make dark crops sunlit. Coverage and original bits are saved.

- `hearth`: 1×1, one per fortress; inputs 3 stone blocks and 1 log; on completion emits `HearthLit` (15 gives everyone `hearth_lit`); provides `light` and warmth over the 5×5 around it (`HEARTH_HALL_SIDE`): that square is lit for the purpose of comfort, not crops (`buildings.hearthLightAt`; the map's `lit` flag and `cropLitAt` are unchanged), and 05's `temperatureAt` adds `HEARTH_WARMTH_C` to a tile in it (the 5 °C override grid is unchanged). Cannot be deconstructed while dwarves live (the command is rejected with `hearth_is_home`). If no `hearth_hall` zone exists, the 5×5 around the hearth is treated as the hearth hall for behavior and quality.
- `trade_depot`: 3×3; inputs 3 logs or 3 blocks; must be reachable from a map edge by a 1-wide walkable path (checked when a caravan arrives, 20). One or more.
- `well`: 1×1 over an `open` tile with water within `WELL_DEPTH` below (04); provides drinking water and hospital water; `working` when 04's `waterBelow` finds liquid water through open tiles; rock or ice without liquid water ends that search.
- `nest_box`: 1×1; chickens lay in it (08).
- `cage`: a cage item placed as a building holds one creature (caught by a cage trap; the building's `occupantId` names it, 0 when empty); `release` through a lever link or the `ReleaseCage` command.
- `wagon`: placed at embark only, a building with its own container (class `wagon`, unlimited capacity) holding the supplies; the contents lie at its centre, are found by search and want hauling like items on the ground. Deconstructing it uses `construction` labor, yields the `WAGON_LOGS` logs recorded at its placement and leaves the contents where they lie.
- `chain`: a rope or chain item placed; `AssignAnimal` to a chain restrains a tame animal to within 1 tile (war dogs at the gate).
- `coffin`: a coffin item placed; inside a `tomb` zone it accepts a burial; a coffin outside a tomb also works but gives no tomb thought.
- `memorial_slab`: an engraved slab item (crafted at the mason with `engraving` skill, naming a dead dwarf without a body) placed anywhere; counts as burial for grief.
- `archery_target`: for archery ranges (16).
- `weapon_rack`, `armor_stand`: barracks furniture; room value only.
- `statue`: room value; dwarves admire statues of fine quality or better when passing (`SawMasterwork`-like thought `admired_statue`, once per statue per dwarf per season).
- `cabinet`, `chest`: `store` tag; in a bedroom they hold the owner's spare clothing (13 `owned` items); room value.
- `table`, `chair`: `eat_at` and `sit`; a chair adjacent to a table makes a dining seat; dwarves eating at a table in a dining hall get the room's meal thought.
- `bed`: `sleep`; in a bedroom, assignable.

### Zones

`SetZoneSetting` checks the setting's value type before changing state and rejects an invalid value with `bad_setting`. `desired supplies` is a record of 17's supply kinds with integer counts from 0 to `HOSPITAL_SUPPLY_MAX`, stored under `desired supplies` as by `SetHospitalSupplies`; `squad` is 0 or a living squad id. `owner` is an integer dwarf id or 0 and uses `AssignRoom`'s checks and assignment. `crop per season` is the four season slots, each 0 or a known farmed plant id/index with the plot's light requirement, using `SetPlotCrop`'s validation and stored as plant indices. Check every slot before storing any. `priority` is an integer from `PRIORITY_MIN` to `PRIORITY_MAX`. Stockpile settings use 13's dedicated commands.

`CreateZone { zoneType, tiles }`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`. Rules:

- Tiles must be walkable floors (gather zones may also include shrubs as described in 09). A tile that holds a building on a floor also qualifies, so furniture, the hearth and doors may lie inside zones. A farm plot's tiles must also be all lit or all dark (07). A fishing bank uses 09's shared shore lookup: one of its four same-level cardinal neighbours contains deep, unfrozen water, or is open air above a straight drop through only open air to deep, unfrozen water no more than `FISH_BANK_DROP` levels below the bank. Intervening floors, solid tiles or shallow fluid stop the lookup; water beside magma does not qualify. The catch comes from the body at the bottom of that drop, with water-body connectivity still confined to one level.
- A command whose tiles do not all qualify is rejected whole (`bad_zone_tiles`) and changes nothing; the zone tool submits only the tiles that qualify.
- No two zones share a tile, whatever their types, except `meeting_area` over a `hearth_hall` or `dining_hall` (it only adds a gathering spot; two meeting areas never overlap). `zoneAt` names the hall there and `zonesAt(i)` lists both, ascending; removing the hall hands its tiles back to the meeting area.
- Each zone type has settings (`plants`, `animals`, `items`, `health`, `combat` read theirs): farm plot crops, pasture nothing, stockpile filter, hospital desired supplies, barracks squad assignment, bedroom owner, tomb occupant, dump nothing. `SetZoneSetting` stores any other key of the zone-type table (in words or snake_case) on the zone; a stockpile's `filter`, `containers`, `priority` and `links` are 13's and are rejected (`bad_setting`).
- A new stockpile accepts nothing until a filter is set. Its priority is `HAUL_PRIORITY`, or `HAUL_PRIORITY_FOOD` while its filter selects only food, until the player sets one. 13 defines the presets (§ Stockpiles).
- `ZoneChanged { zoneId, zoneType, change: created | resized | removed | settings, tiles }`: `tiles` is the zone's tiles after the change (before it, for `removed`).

### Rooms and quality

A room zone synchronously creates a `Room` entity with tier 0 and score 0. Dirty rooms recompute at this system’s tick: zone changes, building completion or removal on or beside the zone, and terrain changes on or beside it make it dirty. `DayPassed` marks every room dirty and runs recomputation before auto-assignment. A first score at tier 0 emits no quality-change event.

For each zone of a room type:

```
tileScore(tile) = constructedFloorValue(material) or (engraved ? 3 + engravingQuality : smoothed ? 3 : natural stone ? 1 : 0)
wallScore = for each wall tile bordering the zone (8-neighborhood): engraved ? 2 + engravingQuality/2 : smoothed ? 2 : 0
furnitureScore = Σ value(building.item) / 10 for buildings inside, poor quality counts 0; statues multiply the linked item contribution by 2. Without a positive-quality linked item, use numeric type.roomValue, else 0
sizeScore = min(tiles, ROOM_SIZE_CAP) × 1
enclosed = every border tile is a wall, a door, a hatch, or a fortification → score × ENCLOSED_PERCENT / 100
score = (Σ tileScore + wallScore + furnitureScore + sizeScore) × enclosure
tier: bare < 20, modest < 60, decent < 150, fine < 400, grand < 1000, royal ≥ 1000
```

Room type requirements for the zone to count as that room: bedroom needs a built bed; dining hall needs at least one built table with an adjacent built chair; hearth hall needs the built hearth inside; hospital needs a built bed and chest; barracks needs nothing (an armor stand or weapon rack adds value); tomb needs a built coffin.

The room inspector names each missing requirement and counts the unique open border tiles in the same-z 8-neighbourhood. Walls, fortifications and built doors or hatches close the border; planned doors and hatches do not. Open border tiles on the viewed level are highlighted while the zone is selected. These diagnostics read current tiles and furniture without recomputing or writing the stored room state.

Effects (thought ids in 15): bedroom tier on `Slept`; dining hall tier on `MealEaten` at a table; hearth hall tier as the fortress-wide baseline bonus; hospital tier on `PatientHealed`; barracks tier on training sessions; tomb tier on `Buried` for mourners. `RoomQualityChanged { zoneId, tier }` when the tier changes.

On room entry, 10 observes visible floor masterworks and installed furniture throughout the room, excluding container contents and the viewer's own work; 10 saves its seen-item memory.

### Ownership

- Bedroom: `AssignRoom { zoneId, dwarfId }`; auto-assignment daily: bedrooms with a built bed and no owner, in zone-id order, go to living fortress creatures with `Title` and no bedroom, titled dwarves first (Thane, then Warden, Broker, Chief Medic), then by lowest mood from 15’s reader, with id as the last tie-break. `MOOD_BASELINE` is used only when no morale reader exists in a standalone world. `Room.ownerId` stores ownership; assigning a dwarf elsewhere clears the previous bedroom. On `CreatureDied`, every bedroom owned by that creature becomes unowned in the same tick and is available to the next daily auto-assignment. `freeBeds` excludes beds inside owned bedrooms and beds held by another living sleeper or patient. A chosen bed is held throughout the walk and sleep until waking, abandoning the activity or death; patient assignment holds it until discharge, reassignment or death. The holds come from 10's saved rest activities and 17's saved `Patient.bedId`, and availability is queried live. No two dwarves use the same bed at once. Auto-assignment draws no RNG. An owner’s bed is theirs; other dwarves do not sleep in it.
- Tomb coffins: assigned to a living dwarf (reserved) or left open for anyone; burial fills the first free coffin, preferring a reserved one for its dwarf. The reservation survives its dwarf's death.

### Burial

On `CorpseCreated` for a dwarf: a `bury` job (labor `hauling`) hauls the corpse to a free coffin; on completion `Buried { dwarfId, coffinId, tombTier }`; the corpse item is destroyed and the coffin becomes `occupied`. The dwarf is buried in its worn clothing, which is destroyed as `buried` and removed from stock counts and wealth; its weapon, shield, armor and quiver drop unowned on the coffin's tile. Resolve that tile before destroying the corpse, even when the hauler stands beside the coffin. Without a coffin the corpse stays where it is (miasma follows). Placing a memorial slab for a dwarf whose body is gone (rotted, lost to magma) emits `Buried` with `coffinId: 0` and `tombTier: none`; a `Buried` with `coffinId: 0` is how a memorial is told from a burial in a coffin outside a tomb, which also has `tombTier: none`.

A slab names its dwarf through its work order: `AddWorkOrder` for `make_memorial_slab` takes an optional `memorialDwarfId`, which must name a dead dwarf with no intact body (a skeleton counts as a rotted body); the craft job carries the id onto the slab item. A slab without a name can be crafted but resolves no grief.

### Value

Each built building contributes `materialValue + type.valueBonus` (plus the linked item's value) to fortress wealth (13 sums from `BuildingCompleted`/`BuildingRemoved`, whose `value` is the building's contribution, 0 for one that was never built). A bridge's bonus is per footprint tile.

## State

- `Building` components (`type, material, state, origin, footprint, orientation, itemId, mode, linkedIds, ownerId, settings`), `buildingAt` map (in `Map3D`), `Zone` components with `tiles` sorted, `zoneAt: Map<TileIndex, zoneId>` (one per tile), `Room` components (`zoneId, score, tier, ownerId, enclosed`), `hearthId`, `depots[]`, `coffins[]`, `dirtyRooms`.
- Rng stream (auto-assignment ties; reserved).
- Superset fields of `BuildingsState` (schemas/system-state.md): `pendingJobs`, the buildings waiting for a build or deconstruct job, and `magmaTouched`.

## Interfaces

### Reader

- `buildings.at(i)`, `buildings.get(id)`, `buildings.byType(type)`, `buildings.byTag(tag)`
- `buildings.blocksMovementAt(i, factionOrMovementClass)`, `buildings.blocksFluidAt(i)`, `buildings.blocksFallAt(i)` (locked hatch)
- `buildings.zoneAt(i)`, `buildings.zone(id)`, `buildings.zonesOfType(type)`, `buildings.zoneSetting(id, key)`
- `buildings.room(zoneId)` (score, tier, enclosed, requirementsMet), `buildings.bedroomOf(dwarfId)`, `buildings.ownerOf(zoneId)`
- `buildings.hearth()`, `buildings.hearthHallTier()`, `buildings.hearthHallTiles()`
- `buildings.depots()`, `buildings.wells()`, `buildings.freeCoffins()`, `buildings.diningSeats()`
- `buildings.freeBeds(forDwarf?)` ? unassigned built beds, in id order, held by nobody else; omitted dwarf means any hold excludes the bed
- `buildings.bedHolder(bedId)` ? a built bed's living patient, else its walking or sleeping dwarf, or 0
- `buildings.mechanismState(id)` (`raised`, `open`, `locked` …)
- `buildings.doorAt(i)`, `buildings.lockedHatchAt(i)`, `buildings.blocksSightAt(i)` — 22's hooks for passability, falling and line of sight; `buildings.doorOpen(id)` — a creature stands in the doorway (for drawing)
- `buildings.zonesAt(i)` — every zone on a tile, ascending (a meeting area may lie over a hall); `buildings.zoneTileQualifies(type, i)` — the tile qualifies for the zone type (the zone tool's green)
- `buildings.types()` — every building type row (the build menu); `buildings.inputTypes(match)` — the item types an input's `match` names, by id or tag
- `buildings.ghost(typeId, origin, orientation, width?, height?)` — the build tool's ghost: the footprint, the failing tiles, the reason `PlaceBuilding` would give (or null), and the `on` rule
- `buildings.roomScore(zoneId)` — the score of a room right now, with its parts (the `zone › room` inspector)
- `buildings.roomDiagnostics(zoneId)` — current missing furniture requirements and sorted, unique open border tiles; a read-only query, undefined for a non-room zone
- `buildings.wellWorking(id)` — the well has water within `WELL_DEPTH` below; `buildings.cageOccupant(id)` — the creature held in a cage building, or 0; `buildings.memorialEligible(id)` — the dead dwarf has no intact body and can be named on a memorial slab
- `buildings.wagon()` — the wagon, or 0; `buildings.holderTile(id)` — the tile a building's container contents lie on (the wagon), or −1
- `buildings.hearthLightAt(i)` — the tile is in the built hearth's 5×5 comfort light (which is not crop light); `buildings.cropLitAt(i)` — the tile has crop light
- `buildings.value(id)` — a building's contribution to wealth when built (material value plus the per-type bonus)

### Commands

`PlaceBuilding`, `CancelBuilding`, `DeconstructBuilding`, `SetBuildingPriority`, `CreateZone`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`, `AssignRoom`, `LinkMechanism`, `UnlinkMechanism`, `SetDoorMode`, `SetHatchMode`, `SetPlateTrigger`, `ReleaseCage`, `AssignCoffin`.

### Events consumed

`JobCompleted`, `JobCancelled`, `TilesChanged` (validity of planned buildings; room recompute), `CorpseCreated`, `CreatureDied` (release bedroom ownership, preserving reserved coffins), `MechanismTriggered` (from 19 for plates and levers: this system applies the state change), `AlertChanged` (lock-on-alert doors), `DoorBreakAttempt` (from 18), `MagmaContact` (04 also emits it for a magma tile that holds a building, with the creatures there, possibly none; this system queues the tile and at its next tick removes each non-construction building on it whose material melts at or below `MAGMA_C`, destroying its linked item as `melted`; constructions are terrain, and 05's fire takes wooden ones), `SulkHappened` (a `break` sulk from 15 names a building: this system queues it, saves the queue, and in its own tick removes the building and destroys its linked item as `sulk`), `FireOut` (wooden building burned: 05 asks through `terrain.setKind`; this system removes the entity on `TilesChanged` when its tile no longer matches).

### Events emitted

`BuildingPlaced { id, buildingType, tiles }`, `BuildingCompleted { id, buildingType, value }`, `BuildingRemoved { id, buildingType, value }`, `BuildingStateChanged { id, state }` (door mode, hatch mode, floodgate open/closed, bridge raised/lowered: consumed by 04, 22, 19), `ZoneChanged`, `RoomQualityChanged`, `RoomAssigned { zoneId, dwarfId }`, `HearthLit`, `DoorBroken { id }`, `FortressShutOut { id, doors[], tile }`, `Buried { dwarfId, coffinId, tombTier }`, `MechanismToggled { id, newState }`, and 16's `DamageDealt` (a drawbridge that is raised with creatures on it).

### Registrations

Job producer `buildings` (`build`, `deconstruct`, `pull_lever`, `link_mechanism`, `bury`); panel `build` and `zones`; inspector sections `building` (type, material, quality, state, mode, links, owner, workshop delegation to 12) and `zone › room` (tier, score breakdown, owner, requirements); overlay `zones`; announcements: `HearthLit` (note, with the line "The hearth is lit. This is a deepholm now."), `DoorBroken` (alert), `FortressShutOut` (danger), `Buried` (note), `RoomQualityChanged` to grand or royal (note).

## Player-facing behavior

- Build menu (hotkey `b`): categories → types; a footprint ghost follows the cursor, green where valid, red where not, with the reason; material choice list showing available counts; orientation with `r`. Placing several of the same type: the menu stays open.
  - For a type with a fixed 1×1 footprint (furniture, constructions, mechanisms, traps; not the `special` category, so not the hearth or the well), a drag places one per valid tile of the rectangle, on button-up. The status bar shows the count while dragging ("Door ×5, 2 tiles blocked"). Tiles that fail the placement rule are skipped and reported in one message that names the rule. A single click still places one: a drag that never leaves its tile is a click and is sent even when the tile is blocked, so the simulation's refusal names the rule.
  - When the first input is out of stock, the status bar says how many placed buildings will wait and offers the order: "0 doors in stock: 5 will wait · [o] order 5". `o` opens the work-order picker (12) preset to that item and count. When no built workshop makes the item, the line names the workshop to build instead.
- Zones menu (hotkey `z`): type → drag → confirm; the zone panel shows settings and, for rooms, the quality breakdown.
  - Select a zone by clicking its map tiles, or centre the map/cursor on it and press `Enter` with no zone tool active. The stockpile and room inspectors replace the type list; `y`, or its button, returns to zone types. Other panel letters always open their panels.
  - A room names missing furniture ("Needs a bed", "Needs a table with a chair", "Needs the hearth inside", "Needs a chest", "Needs a coffin") and says "Not enclosed: 3 open border tiles", highlighting those tiles. A bedroom offers `Shift+O` or its owner button, using the building panel's same Nobody/dwarf list, arrows and Enter or a click. It submits `AssignRoom`; Esc cancels the choice. A bedroom without a built bed, or whose room registration is still pending, explains why ownership is unavailable.
- Clicking a building opens its panel: state, mode toggles, links, owner, deconstruct; workshops delegate to 12. A left click with no tool on a tile that holds a building opens the depot's panel, a finished workshop's panel, or the building panel for everything else (a planned workshop too); a drag from the tile still selects a rectangle, and a right click still opens Look. From the keyboard, `Enter` in Look on the building's tile opens it, and Look shows that as a clickable line; the building panel's "Look at the tile" line goes back. The panel is in the sidebar with no hotkey of its own.
  - Doors, hatches and traps list their modes with the current one marked.
  - A planned building shows what it waits for and takes a build priority (`1`–`9`).
  - A bed gives the bedroom zone it stands in an owner from the list of dwarves, or nobody; a coffin is kept for a dwarf, or for anyone.
  - A cage shows its occupant, with release (confirmed) and tame.
- Lever panel: linked targets with their states; a Pull button (creates the job); link, which picks the target on the map or from a list of the buildings that can be linked; unlink. A pressure plate has the same links and its trigger (19).
- Hints: "A room needs walls or doors around it to count as enclosed", "Smooth and engrave the walls to raise room quality", "Lock doors on alert to keep raiders out".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `LINK_DELAY_TICKS` | 100 | Between a trigger and the mechanism acting (*unmeasured*) |
| `PLATE_RESET_TICKS` | 100 | *unmeasured* |
| `DOOR_BREAK_TICKS` | 600 | Time a door-breaker needs (*unmeasured*) |
| `BRIDGE_MAX` | 5 | Max bridge side (*unmeasured*) |
| `BRIDGE_CRUSH_DAMAGE` | 60 | Damage units to a random part (17) (*unmeasured*) |
| `WELL_DEPTH` | 10 | *unmeasured* |
| `ROOM_SIZE_CAP` | 40 | Tiles that count toward size (*unmeasured*) |
| `ENCLOSED_PERCENT` | 150 | Score multiplier for enclosed rooms (*unmeasured*) |
| `BUILD_BASE_TICKS` | 100 | Default build time; types override (*unmeasured*) |
| `LINK_WORK_TICKS` | 150 | Each of the two jobs of a link (*unmeasured*) |
| `HEARTH_HALL_SIDE` | 5 | Side of the square around the hearth that is its stand-in hall and comfort light (*unmeasured*) |
| `HEARTH_WARMTH_C` | 2 | °C added inside that square (05) (*unmeasured*) |

Material and item requirements, value bonuses and footprints are content.

## Extension points

- New building: a row and, if it has a new function tag, a consumer in one system.
- Multi-tile furniture (long tables): a footprint on the type; placement already supports it.
- Room flood-fill detection from furniture: replace the zone-defined room with a fill from the bed; the quality formula is unchanged.
- Ownership of dining seats or workshops: `ownerId` exists on every building.
