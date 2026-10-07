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

`PlaceBuilding { type, origin, orientation, materialChoice, priority }`:

1. Footprint from the type (`w × h`, rotated by orientation for bridges and depots). Every footprint tile must be `discovered`, must be a `floor` (or per type: a bridge may span `open` tiles as long as one end tile is `floor`; a floodgate must be on a `floor`; a well must be over an `open` channel; a hatch over a `stairs_down` or ramp top; a door must have a wall on two opposite sides; constructions have their own rules below), must not be occupied by another building (except that furniture may be placed inside a zone), must not contain a creature for mechanisms that become walls, and must not be `restricted` for the placement of nothing (restrictions are for traffic only).
2. Materials: the type lists inputs (for example a bed: one `furniture/bed` item; a wall: one block, log, bar or raw stone of the player's choice; a lever: one mechanism; a well: one bucket, one chain or rope, one mechanism, one block; a cage trap: one mechanism and one cage). `materialChoice` narrows the filter (oak, granite, steel).
3. Magma safety: if any footprint tile is within 1 of magma or is over a channel to magma (a `magma_*` workshop), every material must be magma-safe (05) or the command is rejected with `not_magma_safe`.
4. Create the entity in state `planned` and a `build` job (labor by category: `construction` for constructions, `carpentry` for wooden furniture placement, `masonry` for stone, `mechanics` for mechanisms and traps, `construction` for everything else; skill `building`) with the materials as inputs and `workTile: adjacent` (or `at` for floors and stairs the builder stands on). Priority from the command.
5. `BuildingPlaced`. The planned building renders as a dim outline and is passable.

`build` job completion: consume inputs (the furniture item is *linked*, not destroyed: `Building.itemId` keeps it for quality, material and value, and it returns on deconstruction), set state `built`, apply tile changes through the terrain API for constructions (`setKind`, `constructed` flag; the material grid gets the block's material), register mechanisms, emit `BuildingCompleted`. Constructions that become walls check that no creature is on the tile (the job waits otherwise).

A build input of more than one unit is counted in units, not stacks: a hearth's three blocks may arrive as a stack of two and a stack of one; the job consumes exactly the units it needs and leaves any remainder of a stack on the site.

### Constructions

| Type | Result | Notes |
|---|---|---|
| `wall` | `wall` tile, `constructed` | Blocks everything; support rule (03) |
| `floor` | `floor` tile, `constructed` | Over `open`; needs support |
| `paved_floor` | `floor` with `paved` material property | On existing floor; clears grass and mud; blocks regrowth; no room value |
| `ramp` | `ramp` | Needs a wall side |
| `stairs_up` / `stairs_down` / `stairs_updown` | as named | |
| `fortification` | `fortification` | Blocks movement, passes projectiles and fluids; ranged units adjacent can shoot through |
| `bridge` (fixed) | `floor` tiles over open | A plain constructed floor; the drawbridge is a mechanism below |

Deconstruct (`DeconstructBuilding` → `remove` designation for constructions, `deconstruct` job for others): returns the material item(s); constructions revert per 03's `remove` rule.

### Doors and hatches

- `door`: passable to fortress creatures; **mode** `open` (default; anyone including hostiles that `opensDoors` can pass; wild animals cannot), `locked` (impassable to everyone; fluids still pass), `no_pets` (tame animals cannot pass), `lock_on_alert` (locks while the alert is `hearth`). Doors are 1×1 and need a wall on two opposite sides. Doors do not block fluids.
- `hatch`: over stairs or a ramp top; modes `open` and `locked`; when locked blocks vertical movement and blocks fluid falling into the tile below.
- Trollkin and other `breaksDoors` creatures destroy a locked door after `DOOR_BREAK_TICKS` adjacent to it (18 AI; this system removes the building and emits `DoorBroken`).

### Mechanisms and links

- `lever`: 1×1; needs 1 mechanism; `PullLever` creates a `pull_lever` job (any adult, `hauling` labor, no skill) that toggles every linked target after `LINK_DELAY_TICKS`.
- `pressure_plate`: 1×1; settings: `triggerOn: creatures (minSize, includeFortress) | water ≥ n | magma ≥ n`; toggles linked targets when its condition becomes true and again when it becomes false, with `PLATE_RESET_TICKS` minimum between toggles.
- Targets: `door` (toggle locked), `hatch` (toggle locked), `floodgate` (toggle open), `drawbridge` (toggle raised), `spike_trap` (extend), `cage` (open and release).
- `LinkMechanism { sourceId, targetId }` creates a `link_mechanism` job (labor `mechanics`, skill `mechanics`, input 1 mechanism item, work at the target then at the source). Links are stored on both entities; `UnlinkMechanism` returns the mechanism.
- `floodgate`: 1×1; closed by default: acts as a `wall` for movement and fluid (a `blocks_fluid` building on a floor tile; 04 and 22 read `buildings.blocksAt(i)`); open: a floor. Magma-safe material required next to magma.
- `drawbridge`: `w × h` up to `BRIDGE_MAX × BRIDGE_MAX`, one edge is the hinge; needs `w × h` blocks and 1 mechanism. **Lowered**: every footprint tile is a walkable floor (spanning open space). **Raised**: every footprint tile is impassable for movement and fluid; creatures on the tiles when it raises take `BRIDGE_CRUSH_DAMAGE` (17) and are moved to a random adjacent walkable tile, or die if none; items on the tiles are moved to adjacent tiles. Raising and lowering take effect after `LINK_DELAY_TICKS` from the trigger. A bridge over magma must be magma-safe.

### Special buildings

- `hearth`: 1×1, one per fortress; inputs 3 stone blocks and 1 log; on completion emits `HearthLit` (15 gives everyone `hearth_lit`); provides `light` (the 5×5 around it is `lit` for the purpose of comfort, not crops) and a +2 temperature override (05). Cannot be deconstructed while dwarves live (the command is rejected with `hearth_is_home`). If no `hearth_hall` zone exists, the 5×5 around the hearth is treated as the hearth hall for behavior and quality.
- `trade_depot`: 3×3; inputs 3 logs or 3 blocks; must be reachable from a map edge by a 1-wide walkable path (checked when a caravan arrives, 20). One or more.
- `well`: 1×1 over an `open` tile with water within `WELL_DEPTH` below (04); provides drinking water and hospital water; `working` when 04's `waterBelow` finds liquid water through open tiles; rock or ice without liquid water ends that search.
- `nest_box`: 1×1; chickens lay in it (08).
- `cage`: a cage item placed as a building holds one creature (caught by a cage trap); `release` through a lever link or the `ReleaseCage` command.
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

`CreateZone { type, tiles }`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`. Rules:

- Tiles must be walkable floors (fishing and gather zones may include non-walkable water-adjacent tiles as described in 09).
- Zones of different types do not overlap, except `meeting_area` may overlap `hearth_hall` and `dining_hall` (it only adds a gathering spot).
- Each zone type has settings (`plants`, `animals`, `items`, `health`, `combat` read theirs): farm plot crops, pasture nothing, stockpile filter, hospital desired supplies, barracks squad assignment, bedroom owner, tomb occupant, dump nothing.
- `ZoneChanged { zoneId, type, change: created | resized | removed | settings }`.

### Rooms and quality

For each zone of a room type, recomputed when its tiles change, when a building inside completes or is removed, when a tile inside or on its border is smoothed or engraved, and daily:

```
tileScore(tile) = constructedFloorValue(material) or (engraved ? 3 + engravingQuality : smoothed ? 3 : natural stone ? 1 : 0)
wallScore = for each wall tile bordering the zone (8-neighborhood): engraved ? 2 + engravingQuality/2 : smoothed ? 2 : 0
furnitureScore = Σ value(building.item) / 10 for buildings inside, poor quality counts 0
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

- Bedroom: `AssignRoom { zoneId, dwarfId }`; auto-assignment daily: every unowned bedroom is given to a dwarf without one, titled dwarves first (Thane, then Warden, Broker, Chief Medic), then by lowest mood. An owner's bed is theirs; other dwarves do not sleep in it.
- Tomb coffins: assigned to a living dwarf (reserved) or left open for anyone; burial fills the first free coffin, preferring a reserved one for its dwarf.

### Burial

On `CorpseCreated` for a dwarf: a `bury` job (labor `hauling`) hauls the corpse to a free coffin; on completion `Buried { dwarfId, coffinId, tombTier }`; the corpse item is destroyed and the coffin becomes `occupied`. Without a coffin the corpse stays where it is (miasma follows). Placing a memorial slab for a dwarf whose body is gone (rotted, lost to magma) emits `Buried` with `tombTier: none`.

### Value

Each built building contributes `materialValue + type.valueBonus` (plus the linked item's value) to fortress wealth (13 sums from `BuildingCompleted`/`BuildingRemoved`).

## State

- `Building` components (`type, material, state, origin, footprint, orientation, itemId, mode, linkedIds, ownerId, settings`), `buildingAt` map (in `Map3D`), `Zone` components with `tiles` sorted, `zoneAt: Map<TileIndex, zoneId>` (one per tile), `Room` components (`zoneId, score, tier, ownerId, enclosed`), `hearthId`, `depots[]`, `coffins[]`, `dirtyRooms`.
- Rng stream (auto-assignment ties; reserved).

## Interfaces

### Reader

- `buildings.at(i)`, `buildings.get(id)`, `buildings.byType(type)`, `buildings.byTag(tag)`
- `buildings.blocksMovementAt(i, factionOrMovementClass)`, `buildings.blocksFluidAt(i)`, `buildings.blocksFallAt(i)` (locked hatch)
- `buildings.zoneAt(i)`, `buildings.zone(id)`, `buildings.zonesOfType(type)`, `buildings.zoneSetting(id, key)`
- `buildings.room(zoneId)` (score, tier, enclosed, requirementsMet), `buildings.bedroomOf(dwarfId)`, `buildings.ownerOf(zoneId)`
- `buildings.hearth()`, `buildings.hearthHallTier()`, `buildings.hearthHallTiles()`
- `buildings.depots()`, `buildings.wells()`, `buildings.freeBeds()`, `buildings.freeCoffins()`, `buildings.diningSeats()`
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

`JobCompleted`, `JobCancelled`, `TilesChanged` (validity of planned buildings; room recompute), `CorpseCreated`, `MechanismTriggered` (from 19 for plates and levers: this system applies the state change), `AlertChanged` (lock-on-alert doors), `DoorBreakAttempt` (from 18), `MagmaContact` (destroy non-magma-safe buildings), `FireOut` (wooden building burned: 05 asks through `terrain.setKind`; this system removes the entity on `TilesChanged` when its tile no longer matches).

### Events emitted

`BuildingPlaced`, `BuildingCompleted { id, type }`, `BuildingRemoved { id, type }`, `BuildingStateChanged { id, state }` (door mode, hatch mode, floodgate open/closed, bridge raised/lowered: consumed by 04, 22, 19), `ZoneChanged`, `RoomQualityChanged`, `RoomAssigned { zoneId, dwarfId }`, `HearthLit`, `DoorBroken { id }`, `Buried { dwarfId, coffinId, tombTier }`, `MechanismToggled { id, newState }`, and 16's `DamageDealt` (a drawbridge that is raised with creatures on it).

### Registrations

Job producer `buildings` (`build`, `deconstruct`, `pull_lever`, `link_mechanism`, `bury`); panel `build` and `zones`; inspector sections `building` (type, material, quality, state, mode, links, owner, workshop delegation to 12) and `zone › room` (tier, score breakdown, owner, requirements); overlay `zones`; announcements: `HearthLit` (note, with the line "The hearth is lit. This is a deepholm now."), `DoorBroken` (alert), `Buried` (note), `RoomQualityChanged` to grand or royal (note).

## Player-facing behavior

- Build menu (hotkey `b`): categories → types; a footprint ghost follows the cursor, green where valid, red where not, with the reason; material choice list showing available counts; orientation with `r`. Placing several of the same type: the menu stays open.
  - For a type with a 1×1 footprint (furniture, constructions, mechanisms, traps; not the hearth or the well), a drag places one per valid tile of the rectangle. The status bar shows the count while dragging ("Door ×5, 2 tiles blocked"). Tiles that fail the placement rule are skipped and reported in one message that names the rule. A single click still places one.
  - When the first input is out of stock, the status bar says how many placed buildings will wait and offers the order: "0 doors in stock: 5 will wait · [o] order 5". `o` opens the work-order picker (12) preset to that item and count. When no built workshop makes the item, the line names the workshop to build instead.
- Zones menu (hotkey `z`): type → drag → confirm; the zone panel shows settings and, for rooms, the quality breakdown.
  - Select a zone by clicking its map tiles, or centre the map/cursor on it and press `Enter` with no zone tool active. The stockpile and room inspectors replace the type list; `y`, or its button, returns to zone types. Other panel letters always open their panels.
  - A room names missing furniture ("Needs a bed", "Needs a table with a chair", "Needs the hearth inside", "Needs a chest", "Needs a coffin") and says "Not enclosed: 3 open border tiles", highlighting those tiles. A bedroom offers `Shift+O` or its owner button, using the building panel's same Nobody/dwarf list, arrows and Enter or a click. It submits `AssignRoom`; Esc cancels the choice. A bedroom without a built bed, or whose room registration is still pending, explains why ownership is unavailable.
- Clicking a building opens its panel: state, mode toggles, links, owner, deconstruct; workshops delegate to 12. From the keyboard, `Enter` in Look on the building's tile opens it.
  - Doors, hatches and traps list their modes with the current one marked.
  - A planned building shows what it waits for and takes a build priority (`1`–`9`).
  - A bed gives the bedroom zone it stands in an owner from the list of dwarves, or nobody; a coffin is kept for a dwarf, or for anyone.
  - A cage shows its occupant, with release (confirmed) and tame.
- Lever panel: linked targets with their states; a Pull button (creates the job); link, which picks the target on the map or from a list of the buildings that can be linked; unlink. A pressure plate has the same links and its trigger (19).
- Hints: "A room needs walls or doors around it to count as enclosed", "Smooth and engrave the walls to raise room quality", "Lock doors on alert to keep raiders out".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `LINK_DELAY_TICKS` | 100 | Between a trigger and the mechanism acting |
| `PLATE_RESET_TICKS` | 100 | |
| `DOOR_BREAK_TICKS` | 600 | Time a door-breaker needs |
| `BRIDGE_MAX` | 5 | Max bridge side |
| `BRIDGE_CRUSH_DAMAGE` | 60 | Damage units to a random part (17) |
| `WELL_DEPTH` | 10 | |
| `ROOM_SIZE_CAP` | 40 | Tiles that count toward size |
| `ENCLOSED_PERCENT` | 150 | Score multiplier for enclosed rooms |
| `BUILD_BASE_TICKS` | 100 | Default build time; types override |

Material and item requirements, value bonuses and footprints are content.

## Extension points

- New building: a row and, if it has a new function tag, a consumer in one system.
- Multi-tile furniture (long tables): a footprint on the type; placement already supports it.
- Room flood-fill detection from furniture: replace the zone-defined room with a fill from the bed; the quality formula is unchanged.
- Ownership of dining seats or workshops: `ownerId` exists on every building.
