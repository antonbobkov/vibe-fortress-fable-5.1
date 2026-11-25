# 14 Buildings & Rooms

**Owner:** `systems/buildings` · **Depends on:** [03-terrain-and-mining.md](03-terrain-and-mining.md), [11-jobs-and-labor.md](11-jobs-and-labor.md), [13-items-and-storage.md](13-items-and-storage.md), [10-dwarves.md](10-dwarves.md), [15-happiness-and-morale.md](15-happiness-and-morale.md), [19-defense-and-traps.md](19-defense-and-traps.md)

## Purpose

Let the player shape the fortress: constructions, furniture, workshops, mechanisms, traps, the hearth, the depot, and zones. Detect rooms and rate them. Own ownership and burial.

## Concepts

- **Building**: an entity occupying one or more tiles with a type from `buildings-and-furniture.md`. Categories: `construction` (wall, floor, ramp, stairs, fortification, paved floor), `furniture` (placed from a crafted item), `workshop`, `mechanism` (lever, pressure plate, floodgate, hatch, drawbridge, door), `trap`, `special` (hearth, trade depot, well, nest box, cage, chain, coffin, memorial slab, archery target). Its state is `planned`, `constructing` or `built`, or `ruined` for a ruin's wreck (§ Wrecks).
- **Function tag**: what a building does, read by systems: `sleep`, `sit`, `eat_at`, `door`, `hatch`, `bridge`, `floodgate`, `lever`, `plate`, `trap:*`, `container`, `well`, `depot`, `hearth`, `workshop`, `training`, `archery_target`, `coffin`, `memorial`, `cage`, `chain`, `nest_box`, `hive`, `store` (cabinet, chest), `blocks_fluid`, `light`.
- **Zone**: a set of tiles with a type and settings. Types: `stockpile`, `farm_plot`, `pasture`, `bedroom`, `dining_hall`, `hearth_hall`, `hospital`, `barracks`, `archery_range`, `meeting_area`, `tomb`, `dump`, `fishing`, `gather`, `sanctum`, `compost`.
- **Room**: a zone of a room type with a computed quality. Room types: `bedroom`, `dining_hall`, `hearth_hall`, `hospital`, `barracks`, `tomb`.
- **Quality tier**: bare, modest, decent, fine, grand, royal.
- **Ownership**: a bedroom's owner; a tomb's occupant.

## Rules

### Placement

`PlaceBuilding { buildingType, origin, orientation, materialChoice, priority }`:

1. Optional integer `width` and `height` are accepted only for a variable footprint (the drawbridge), from 1 through `BRIDGE_MAX`. Supplying either on a fixed type is rejected as `fixed_footprint` before creating an entity or job; the message names the building. Omitted dimensions use the type’s own footprint. Footprint from the type (`w × h`, rotated by orientation for bridges and depots). `origin` is the footprint's north-west tile; a rotatable type swaps `w` and `h` at odd orientations. Every footprint tile must be `discovered`, must be a `floor` (or per type: a bridge may span `open` tiles as long as one end tile is `floor`; a floodgate must be on a `floor`; a well must be over an `open` channel; a hatch over a `stairs_down` or ramp top; a door must have a wall on two opposite sides; a beehive must stand on an outdoor floor of class `soil`; constructions have their own rules below), must not be occupied by another building (except that furniture may be placed inside a zone), must not contain a creature for mechanisms that become walls, and must not be `restricted` for the placement of nothing (restrictions are for traffic only). A `sapling` or `shrub` counts as the floor it stands on for all of these rules: the placement shows what will be cleared, and the builder clears it (step 4). A grown `tree` refuses the building, and the refusal says to chop it first.
2. Materials: the type lists inputs (for example a bed: one `furniture/bed` item; a wall: one block, log, bar or raw stone of the player's choice; a lever: one mechanism; a well: one bucket, one chain or rope, one mechanism, one block; a cage trap: one mechanism and one cage). `materialChoice` narrows the filter (oak, granite, steel).
   - **Workshops of stone.** A workshop with `log` among its inputs, except one tagged `logs_only` (the carpenter's: logs are its trade), may be placed with `materialChoice: 'blocks'`: each of its inputs that is `n` `log` becomes `2n` `stone_block` (blocks of any material: stone, brick, bone, metal; not wooden blocks), and its build takes `buildTicks × STONE_WORKSHOP_TICKS_PERCENT / 100`. Its other inputs, its labor and its footprint are the row's; it takes the material of its first unit consumed, as any building does, and deconstruction returns the blocks. The choice is kept on the building (`settings.ofBlocks`). A treeless fortress builds its loom, tannery or kennel of stone, slowly. `'blocks'` for any other type names no material and is rejected with `not_found`.
3. Magma safety: if any footprint tile is within 1 of magma (the tile itself and its 26 neighbours) or is over a channel to magma (a `magma_*` workshop), every material must be magma-safe (05) or the command is rejected with `not_magma_safe`. With no `materialChoice` the placement is refused too, since the materials cannot be known to be safe.
4. Create the entity in state `planned` and a `build` job (labor by category: `construction` for constructions, `carpentry` for wooden furniture placement, `masonry` for stone, `mechanics` for mechanisms and traps, `construction` for everything else; skill `building`; a type whose labor is "by material" takes it from the chosen material's class: wood carpentry, stone masonry, metal smithing, else `construction`) with the materials as inputs and `workTile: adjacent` (or `at` for floors and stairs the builder stands on). The job anchors at the centre of the footprint. Priority from the command. The inputs of an `adjacent` build whose site cannot be stood on (a wall over open space) are delivered to the worker's stand tile. With saplings or shrubs on the footprint the job's work is longer by `CLEAR_PLANT_TICKS` (07) for each, and that work comes first: when it is done the builder has uprooted them, each tile becomes the floor (grass if soil) that felling a tree leaves, and a `mature` shrub drops what `gather` would. Cancelling the building before then leaves the plants standing. A stair or channel designation on a footprint tile, and a ramp designation on the wall beneath one, is cleared when the building is placed: nothing is cut under a building (03 § Tile transitions).
5. `BuildingPlaced`. The planned building renders as a dim outline and is passable.

The `wagon` is placed at embark only (02); `PlaceBuilding` refuses it with `bad_placement`.

A ruin's standing furniture (02 § Ruins, T-690) is placed at arrival too, built at once like the wagon (`placeRuin`): a furniture type that links its item, at its recorded origin and orientation, where its footprint is in the map, holds no building and no sapling or shrub, and every tile passes the type's placement rule (a door's two opposite walls, a hatch's stairs or ramp top, a floor for the rest; `discovered` is not asked). The linked item is made anew of the recorded type, material and quality, and the build completes as `TestWorld.build`'s does (`BuildingPlaced`, `BuildingCompleted`; a door or hatch `open`). A piece that does not fit is gone. A ruin's wrecks, then its mechanisms and traps, are placed after the furniture by the same rule (`placeWreck`), but not built, except a ruin's armed trap (§ Wrecks).

`build` job completion: consume inputs (the furniture item is *linked*, not destroyed: `Building.itemId` keeps it for quality, material and value, the item is `installed` (13) and so leaves every search, haul and available count while it stays in the totals and in wealth, and it returns to the building's anchor tile on deconstruction or removal), set state `built`, apply tile changes through the terrain API for constructions (`setKind`, `constructed` flag; the material grid gets the block's material), register mechanisms, emit `BuildingCompleted`. Constructions that become walls check that no creature is on the tile (the job waits otherwise). Any other building that makes a footprint tile impassable when it is built (a workshop's impassable tiles, such as the forge's corners, where its builder may have worked) moves each creature standing on such a tile, in the same tick, to the nearest tile beside the footprint that a walker can stand on (Chebyshev distance from the creature's tile, ties by tile index). Work done standing on a tile the building now blocks ends with it: 03 clears the designations worked from that tile (03 § Tile transitions), and a farm plot tile under a built building is not planted (07 § Farm plots). Before sealing a wall, move each loose ground item that will remain after consuming its construction inputs to one of the eight adjacent tiles on the same level, outside the footprint, that is solid-bottomed and passable to a walker. Choose the qualifying tile with the lowest tile index. Move whole remaining stacks and containers, preserving contents, ownership, reservations and flags. If a remaining item has no qualifying destination, the build waits without consuming any inputs or changing the terrain.

A build input of more than one unit is counted in units, not stacks: a hearth's three blocks may arrive as a stack of two and a stack of one. A build claims only the units it needs, as a workshop job does: it splits a partial stack where it lies and carries the part (11 § Assignment step 4), so several builds share one stack and their builders work at once (T-568: seven pallets from one heap of cloth, by seven dwarves). The job consumes exactly the units it needs; a remainder of a stack on the site (one delivered whole by an older save) stays there (a wall clears it as above). A furniture building takes its linked item's material; any other building takes the material of the first unit consumed. The item types consumed are kept on the building, and deconstruction returns them. A trap's load (every input after its mechanism: the stone, the cage, the weapons or spikes) is not consumed: it is installed (13) as the trap's loaded items (19 § Trap kinds), and only the mechanism is kept as consumed, so a trap taken apart gives back its mechanism and what it is loaded with then, once. A furniture row whose input is counted (a pallet's "2 `cloth` or `wool_raw`") links no item: it is laid from its materials, which are consumed and kept as a construction's are (§ Beds).

### Beds

Every building tagged `sleep` is a bed: for a bedroom's and a hospital's requirement, for the bed search (10 § Sleeping) and for `freeBeds`. Its row's `rest` is the percent it rests at (10 § Sleeping): `pallet` and `straw_pallet` 90, `stone_bed` 95, `bed` 100: a narrow band (T-572), since a bed's worth is mostly its sleeper's thought (10 § Sleeping). `buildings.restPercent(id)` reads it, and gives `MADE_UP_REST_PERCENT` for a made-up bed.

- **A pallet is a dwarf lying down under a cloth.** `pallet` (2 `cloth` or `wool_raw`) and `straw_pallet` (3 `fiber`, `straw` or `reed`) are laid straight from their materials, with no item and no workshop: the player places one on a floor like a chair, and a `build` job of labor `hauling` (any dwarf, children too) carries the materials to the tile and spreads them in `buildTicks` 20, the shortest build there is. The job uses no skill (the worker's `building` level does not speed it) and gives no experience. Taking it apart returns the materials. A pallet adds no room value, and its sleeper thinks `slept_on_a_pallet`.
- **A stone bed is a mason's job.** `make_stone_bed` and `make_stone_bed_straw` at the mason (`masonry`): 1 `raw_stone` and a pallet's materials make 1 `stone_bed` item of the stone, with no quality. It is placed as a bed is (labor `masonry`) and rests at 95. It takes no bedding, and its sleeper has no thought for it.
- **A wooden bed needs bedding stuff.** `make_bed` at the carpenter takes 1 `log` and a pallet's materials (2 `cloth` or `wool_raw`), and `make_bed_straw` 1 `log` and 3 `fiber`, `straw` or `reed`: 1 `bed` of the log's wood either way. It rests at 100 and its sleeper thinks `slept_in_a_bed` (+1). A bed bought at embark or from a caravan comes made.
- **A dressed bed.** A built `bed` (the wooden bed) wants 1 `bedding` and 1 `pillow` (§ Building wants). A bed holding its bedding is *made up*: it rests at `MADE_UP_REST_PERCENT`. `buildings.bedding(id)` is `soft` for a bed holding both, `feather` when both were stuffed with feathers (`Item.stuffing`, recorded at the clothier, 12 § Operation), and `none` otherwise: bedding with no pillow rests as a made-up bed and gives no thought. 10's `Slept` carries it, and 15's thoughts follow. The bedding and pillow add their value to the room as a linked item does (§ Rooms and quality), a featherbed's at its doubled value (13 § Value).
- So a fortress on day one, with no carpenter, puts its seven dwarves on pallets of the wagon's cloth that afternoon (seven founders lay seven pallets at once, from the wagon's cloth and a stack beside it, in about two hours, most of it walking: T-568), and on stone beds once the mason has stone.

### Building wants

A building row's `wants` (`buildings-and-furniture.md`) makes a built building of that type hold items: a bed wants 1 `bedding` and 1 `pillow`. `Building.held` lists the items it holds (saved; absent: none). 13 fills the wants as it fills a hospital's chest (13 § Buildings that want items): each item it brings is held, flagged `installed`, off every search and count of available stock and still in the totals and in wealth. `buildings.wants(id)` gives each want with its count, the held items that answer it and those on their way; `buildings.held(id)` the items held; `buildings.withWants()` the built buildings whose type has wants.

- A held item leaves the building when the player takes it out (`ReleaseHeld { buildingId }`: every held item drops on the building's tile, unflagged), or when the building is taken apart or removed (its held items drop on its tile, unflagged). Taken out, the wants are filled again from the nearest available items, the same ones unless the player forbids them.
- The building panel lists what it holds and wants, a bed's rest and whether it is made up ("Made up: linen bedding, feather pillow"), and offers `[h] take out` (`t`, the first choice, is the Threats panel's letter).

### Mugs at the table

A built `table` wants one `mug` for each chair beside it, up to four (`buildings-and-furniture.md`: `wants` 1 `mug` per adjacent chair, up to 4): a want with `per: 'chair'` counts the built buildings tagged `sit` on a tile 8-adjacent to the building on its level (its *chairs*, in ascending id), up to its `max`, times its `count`. A table with no chair beside it wants none. 13 fills it by § Building wants, counted in units: a stack of mugs is brought whole, so a stack may give a table more mugs than chairs.

- `buildings.seatHasMug(chairId)`: the chair is among the first chairs, by id, of a table beside it that holds a mug for it: the table's held mugs, in units, number more than the chair's place in its order. A chair beside two tables has its mug when either holds one for it.
- A meal at a dining seat (a chair beside a table, 10 § Eating and drinking) whose chair has its mug carries `mug: true` on `MealEaten`, and 15 gives `drank_from_a_mug`. The mugs a table holds add their value to its room as held items do (§ Rooms and quality). Mugs have waited a long time for a job.

### The drying rack

`drying_rack` (1×1, 2 `log`, `stone_block` or `bone_pile`, labor `construction`, tag `rack`, impassable; its materials return when it is taken apart) wants `RACK_CAPACITY` units of the items its setting dries, over all its rows (`items.md` § Drying; by default every row). `SetRackDrying { buildingId, rows }` sets which drying rows it takes; a held item no row of it now takes drops on its tile. Nobody works it. 13 hauls to it by § Building wants: each row's input (a load of `peat`, not of any soil), up to `RACK_CAPACITY` units in all, a stack brought whole; and for a row with a second input, as many of that as the units of the row's input it holds need (a `salt` a hide). `buildings.holderWants(id)` gives these wants as item types, counts and materials.

- **An item on a rack becomes its dried form after its drying days.** On each `DayPassed`, each held item of a row gains drying days: under a roof one; outdoors (an `outdoor` tile) two on a day whose weather was `clear` all day, none on a day with `rain`, `storm` or `snow` at any hour, and one otherwise (06's state, followed through the day by `WeatherChanged`: the rack's day record, kept only while a rack is built). At the row's days it is dry. The dry units of a row are consumed `count` at a time (3 dung for a cake; for a row of count 1, each unit), with the second input the row names (1 `salt` a hide, held on the same rack: a dry hide with no salt waits), and the output is spawned on the rack's tile, released, of the input's material: `soil_load` of peat → `peat_brick`; 3 `dung` → 1 `dung_cake`; raw fish → `cured_fish`; raw meat → `cured_meat`; `raw_hide` + 1 `salt` → `salted_hide`. A dry remainder waits on the rack for the rest of its group. A held raw item does not rot while it dries (13 § Rot).
- `Building.dryDays` records each held item's drying days (saved; absent: none). `ReleaseHeld` drops everything and forgets the days.
- The rack's panel lists each held item with its days left ("boar meat: 3 days left", "dung: dry, waiting for the rest", "salt: to salt with"), then its drying rows as a checklist, one line a row, which `Enter` or a click turns on or off (`SetRackDrying`). The first rack built raises `hint_rack`.

### Candle stands and lanterns

Comfort light is the light dwarves live by, not the light crops grow by: the built hearth's square (§ Special buildings), a built lamp's 3×3, a burning candle stand's 3×3 and a built lantern's 3×3. `buildings.comfortLightAt(i)` reads it. It sets no `lit` flag and gives no crop light.

- `candle_stand` (1×1, 1 `stone_block` or `bar`, labor `construction`, tag `light`, impassable; its block or bar returns when it is taken apart) wants `STAND_CANDLES` `candle`s (§ Building wants), counted in units: a stack of candles is brought whole, so the last may take it over. While it holds a candle it burns the first: a candle burns the days of its material (beeswax `CANDLE_DAYS_WAX`, tallow and any other `CANDLE_DAYS_TALLOW`), counted on `DayPassed` (`Building.burnDays`, saved; absent: none), and when they are spent one unit of it is consumed and the next is lit. A stand holding a candle lights its 3×3 on its level. Its candles add their value to its room as held items do (§ Rooms and quality). Nobody works it: a `maintain` order for candles (12) keeps the stock that the haulers bring. `ReleaseHeld` drops its candles and forgets the days.
- `lantern` (an item made at the kiln: 1 glass block + 1 candle; placed like furniture, it links its item, labor `construction`, tag `light`, impassable) lights its 3×3 forever: the permanent version, at the price of glass.
- **What light does.** A meal eaten at a table on a comfort-lit tile (the eater's seat) carries `candlelit: true` on `MealEaten` (the hearth's square and lamps count), and 15 gives `ate_by_candlelight`. A fortress creature standing on a comfort-lit tile spots a hidden creature `CANDLE_SPOT_BONUS` tiles farther, and a hidden creature standing on one is spotted that much farther away (18 § Stealth): candles at the gate catch thieves. A cellar beside a burning stand is no cellar (13 § Aging in a cellar).
- **Tallow smokes.** On each `HourPassed`, each fortress dwarf standing on a tile lit only by stands burning tallow candles (`buildings.tallowSmokeAt(i)`: no `lit` flag, hearth, lamp, lantern or beeswax stand reaches it) gets `smoky_hall` at `TALLOW_SMOKE_PERMILLE`: 10 makes the draw on its own stream, only for such a dwarf and only while a stand is built, and emits `SmokyFuelBurned { workshopId: 0, tile, dwarfId }`, which 15 gives to that dwarf alone and 05 does not draw. Beeswax does not smoke.
- The stand's panel shows its candles and the days its burning one has left ("Candles: 5 of 5", "Burning: tallow, 3 days left", or "No candle: dark. Order tallow or wax candles at a craftsdwarf's workshop.", with the workshops whose recipes make candles). 23's `light` overlay tints comfort-lit tiles.

### Constructions

| Type | Result | Notes |
|---|---|---|
| `wall` | `wall` tile, `constructed` | Blocks everything; support rule (03) |
| `floor` | `floor` tile, `constructed` | Over `open`; needs support, or a planned floor beside it (a span, below) |
| `paved_floor` | `floor` with `paved` material property | On existing floor; clears grass and mud; blocks regrowth; no room value |
| `ramp` | `ramp` | On a floor with a wall among its four same-level neighbours |
| `stairs_up` / `stairs_down` / `stairs_updown` | as named | Up stairs on a floor; down and up/down stairs on a floor whose tile below is `open` |
| `fortification` | `fortification` | Blocks movement, passes projectiles and fluids; ranged units adjacent can shoot through |
| `bridge` (fixed) | `floor` tiles over open | A plain constructed floor; the drawbridge is a mechanism below |

**A span of floor.** A floor over `open` may be placed where nothing supports it yet, when one of its four same-level neighbours holds a planned floor (one not yet built): that floor will hold it. So a bridge over a river or a channel is planned in one go, by a drag across it (`fortress-screen.md` § Build tool), each tile beside one placed before it, out from the end the bank holds. A wall or floor over `open` that nothing supports is not started: its `build` job is made once one of its six face-adjacent tiles supports it (03's support rule), so a span is built from its held end, one tile after another, each builder standing on the floor built before. A span whose held end is cancelled waits until it is cancelled too or something holds it.

Deconstruct (`DeconstructBuilding` → `remove` designation for constructions, `deconstruct` job for others): returns the material item(s); constructions revert per 03's `remove` rule.

**Glass.** A wall, floor or fortification built of `stone_block` of `glass` is a glass construction (material class `glass`); the construction rows take a glass block as they take any block, and glass has no building row of its own. A glass wall blocks movement and fluids as any wall, and passes light (03 § Outdoor and lit) and sight (22 § Line of sight): archers and watchers see through it, and nothing passes it, arrows and spells included. A glass floor is a skylight wherever it stands over open space (03's `skylit`), and a floor one can see through over magma or water (23): it is magma-safe (glass melts at 1400 °C), with the room value of a constructed floor of its material. The first glass floor built over open space raises `hint_skylight`.

A built construction keeps its building entity on its tile and remembers the items it was built from; the first is the item 03's `remove` and collapse return (`setConstructionItemSource`). This system removes the building on the `TilesChanged` that shows the tile no longer matches the construction (the flag cleared or the kind changed).

A wall or floor built of `stone_block` of `ice` (cut by `harvest_ice`, 03 § Ice harvesting) is an ice construction: no new row, the construction rows take an ice block as they take any block. 05 cools the tiles around it and melts it (05 § Ice constructions: underground after `ICE_CONSTRUCTION_DAYS`, outdoors at the thaw), and the building goes with its tile as any construction's does. It is magma-unsafe, as ice is. A gate of ice holds a raid in winter and opens itself in spring.

### Doors and hatches

- `door`: passable to fortress creatures; **mode** `open` (default; anyone including hostiles that `opensDoors` can pass; wild animals cannot), `locked` (impassable to everyone; fluids still pass; a door does not close on a creature in its doorway, a hostile included, so a lock set by hand, by a lever or by the alert takes effect on the first buildings tick the doorway is clear, and the door panel says it is waiting), `no_pets` (tame animals cannot pass), `lock_on_alert` (locks while the alert is `hearth`, under the conditions of 19 § Hearth alert retreat; the lock is taken on a buildings tick when those conditions hold, and noted once per alert, which dirties the door's chunks and emits `BuildingStateChanged`, and the alert returning to `calm` unlocks it the same way). A door is locked to every reader, the pathfinder and the connectivity labels alike, only from the tick its lock is taken and its chunks dirtied, never from a condition that comes due between buildings ticks: otherwise the pathfinder would see a lock the labels do not, and a walk would fail between places the labels join. When the doors that the alert has locked leave no living fortress dwarf in the walker region (the connectivity label, with the doors as they now stand) of the inner side of any of them, the fortress is shut out of its own gate: an outdoor tile on the hearth's side of the gate does not count as outside. A door's inner side is the tile beside it toward the hearth (the indoor side when there is no hearth, and no door whose two sides are both indoors or both outdoors without a hearth is judged). The judgement is made on a buildings tick after the doors have locked, and the system emits `FortressShutOut { id, doors, tile }` once per alert (`doors` are the `lock_on_alert` doors locked by then, `id` the first of them, `tile` its tile), and the announcement is a danger line that names the doors and says to set the alert back to calm or watchful. Doors are 1×1 and need a wall on two opposite sides. Doors do not block fluids.
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

A lamp is a placed glowstone statue. It lights the 3×3 around it for comfort. The first lamp records each tile's original crop-light bit, overlapping lamps increment a coverage count, and removing the last lamp restores the original bit. Plants use that recorded crop light, so lamps do not make dark crops sunlit. A `glow` crop grows on a dark tile under a lamp (07). Coverage and original bits are saved. A worn `light` piece (25) is not a lamp: it keeps no coverage here, and 07 reads it beside `lampCoveredAt`.

- `hearth`: 1×1, one per fortress; inputs 3 stone blocks and 1 log; on completion emits `HearthLit` (15 gives everyone `hearth_lit`); provides `light` and warmth over the 5×5 around it (`HEARTH_HALL_SIDE`): that square is lit for the purpose of comfort, not crops (`buildings.hearthLightAt`; the map's `lit` flag and `cropLitAt` are unchanged), and 05's `temperatureAt` adds `HEARTH_WARMTH_C` to a tile in it (the 5 °C override grid is unchanged). Cannot be deconstructed while dwarves live (the command is rejected with `hearth_is_home`); a hearth's wreck is not the hearth (§ Wrecks). If no `hearth_hall` zone exists, the 5×5 around the hearth is treated as the hearth hall for behavior and quality.
- `trade_depot`: 3×3; inputs 3 logs or 3 blocks; must be reachable from a map edge by a 1-wide walkable path (checked when a caravan arrives, 20). One or more.
- `well`: 1×1 over an `open` tile with water within `WELL_DEPTH` below (04); provides drinking water and hospital water; `working` when 04's `waterBelow` finds liquid water through open tiles; rock or ice without liquid water ends that search.
- `nest_box`: 1×1; chickens lay in it (08).
- `beehive`: 1×1, a hive item from the carpenter, the kiln or the craftsdwarf, placed like furniture (labor by material); impassable. It must stand on an outdoor floor of class `soil`; elsewhere `PlaceBuilding` refuses it (`bad_placement`; the build tool says "a hive stands outdoors on soil"). 08 runs it (08 § Hives).
- `cage`: a cage item placed as a building holds one creature (caught by a cage trap; the building's `occupantId` names it, 0 when empty); `release` through a lever link or the `ReleaseCage` command. A creature in a built cage keeps its species' nature (08 § Cages): a caged glowing creature (the `glow_beetle`) lights the four tiles beside the cage for a `glow` crop (`buildings.beetleLitAt`, 07 § Growth: the beetle jar), and a caged giant cave spider webs the eight tiles around it daily (18 § Cavern monsters: the spider ranch).
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

### Wrecks

A ruin's workshops, hearths, trade depots and wells, and its levers, pressure plates, floodgates, drawbridges and traps, stand as wrecks on the next embark on its site (02 § Ruins). 14 places each at arrival, after the ruin's furniture, at its recorded origin and orientation (a drawbridge at its recorded size), where its footprint is in the map, holds no building and no sapling or shrub, and every tile passes the type's placement rule (`discovered` and the magma channel are not asked); one that does not fit is gone. A wreck is a building in state `ruined`, of its recorded material, holding the units it kept as its consumed inputs (`settings.inputs`). Placing it emits `BuildingPlaced` and nothing else.

- **It does nothing.** It is not built: every rule above that asks for a built building passes it by. A workshop's wreck takes no orders and runs no jobs (12 makes a workshop only on `BuildingCompleted`), a depot's wreck draws no caravan, a well's wreck gives no water, and a wreck adds no value to wealth or to a room. It blocks nothing: its tiles are passable as a planned building's (a forge's corners have fallen in).
- **The old hearth stands cold.** A hearth's wreck is not the fortress's hearth (`hearthId`): it does not light (`HearthLit` is not emitted), gives no light or warmth, makes no hearth hall and does not refuse the expedition's own hearth (`hearth_exists`). It may be taken apart while dwarves live.
- **It is taken apart.** `DeconstructBuilding` accepts it, and its `deconstruct` job (half its row's build ticks, labor by its material) gives back the units it holds at its anchor, as a built building's does; `BuildingRemoved` carries value 0. `CancelBuilding` refuses it with `not_cancellable`. A wreck is not repaired: repairing it would cost the same materials as taking it apart and building anew.
- **Drawn worn**: its type's glyph in its color dimmed one level (23 § Compositor, step 4); a hearth's wreck does not pulse. Its building panel says so: "A wreck of the old fortress: it does nothing. Taken apart: block ×2." and offers take apart.
- **Its mechanisms keep no links.** A lever's or plate's wreck pulls and springs nothing and cannot be linked (`LinkMechanism` and `PullLever` ask for a built building); a floodgate's wreck holds no water back and a drawbridge's neither raises nor blocks: its deck lies passable where it fell, on the tiles the ruin left.
- **An armed old trap.** A trap the ruin records with its loaded items (02 § Ruins) is not a wreck: 14 builds it at once, by the same rule, `built` and of its recorded material, with its loaded items made anew (their type, material and weathered quality) and installed, and one unit of its first input, its mechanism, as what it was built of. Its mode is `anyone` (19 § Trap targeting): no faction owns it. Placing it emits `BuildingPlaced` and `BuildingCompleted`, so 19 registers it armed. Taken apart (`DeconstructBuilding`, as any built trap), it gives back its mechanism and its loaded items. It is drawn as a trap, red while it is armed and no one's (23 § Compositor, step 4), once its tile is discovered; its building panel says "An old trap of the fortress that stood here: it springs on anyone, your dwarves too. Choose a mode to make it yours, or take it apart." with the two trap modes, neither marked, and take apart.

### Zones

`SetZoneSetting` checks the setting's value type before changing state and rejects an invalid value with `bad_setting`. `desired supplies` is a record of 17's supply kinds with integer counts from 0 to `HOSPITAL_SUPPLY_MAX`, stored under `desired supplies` as by `SetHospitalSupplies`; `squad` is 0 or a living squad id. `owner` is an integer dwarf id or 0 and uses `AssignRoom`'s checks and assignment. `crop per season` is the four season slots, each 0 or a known farmed plant id/index with the plot's light requirement, using `SetPlotCrop`'s validation and stored as plant indices. Check every slot before storing any. `fertilize` (a farm plot, 07 § Fertilizer) is a boolean. `priority` is an integer from `PRIORITY_MIN` to `PRIORITY_MAX`. Stockpile settings use 13's dedicated commands.

`CreateZone { zoneType, tiles }`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`. Rules:

- Tiles must be walkable floors (gather zones may also include shrubs as described in 09). A tile that holds a building on a floor also qualifies, so furniture, the hearth and doors may lie inside zones. A farm plot's tiles must also be all lit or all dark (07). A fishing bank uses 09's shared shore lookup: one of its four same-level cardinal neighbours contains deep, unfrozen water, or is open air above a straight drop through only open air to deep, unfrozen water no more than `FISH_BANK_DROP` levels below the bank. Intervening floors, solid tiles or shallow fluid stop the lookup; water beside magma does not qualify. The catch comes from the body at the bottom of that drop, with water-body connectivity still confined to one level.
- A command whose tiles do not all qualify is rejected whole (`bad_zone_tiles`) and changes nothing; the zone tool submits only the tiles that qualify.
- No two zones share a tile, whatever their types, except `meeting_area` over a `hearth_hall` or `dining_hall` (it only adds a gathering spot; two meeting areas never overlap). `zoneAt` names the hall there and `zonesAt(i)` lists both, ascending; removing the hall hands its tiles back to the meeting area.
- Each zone type has settings (`plants`, `animals`, `items`, `health`, `combat` read theirs): farm plot crops, pasture nothing, stockpile filter, hospital desired supplies, barracks squad assignment, bedroom owner, tomb occupant, dump nothing, compost heap nothing (a compost heap is no room; 13 gives it a stockpile record with a fixed filter, 13 § The compost heap), sanctum apprentices (set by 25's `SetSanctumApprentices` only). `SetZoneSetting` stores any other key of the zone-type table (in words or snake_case) on the zone; a stockpile's `filter`, `containers`, `priority` and `links` are 13's and are rejected (`bad_setting`).
- A new stockpile accepts nothing until a filter is set. Its priority is `HAUL_PRIORITY`, or `HAUL_PRIORITY_FOOD` while its filter selects only food, until the player sets one. 13 defines the presets (§ Stockpiles).
- `ZoneChanged { zoneId, zoneType, change: created | resized | removed | settings, tiles }`: `tiles` is the zone's tiles after the change (before it, for `removed`). 17's `SetHospitalSupplies` raises it too (`settings`), for the hospital setting it writes.

### Rooms and quality

A room zone synchronously creates a `Room` entity with tier 0 and score 0. Dirty rooms recompute at this system’s tick: zone changes, building completion or removal on or beside the zone, and terrain changes on or beside it make it dirty. `DayPassed` marks every room dirty and runs recomputation before auto-assignment. A first score at tier 0 emits no quality-change event.

For each zone of a room type:

```
tileScore(tile) = constructedFloorValue(material) or (engraved ? 3 + engravingQuality : smoothed ? 3 : natural stone ? 1 : 0)
wallScore = for each wall tile bordering the zone (8-neighborhood): engraved ? 2 + engravingQuality/2 : smoothed ? 2 : 0
furnitureScore = Σ value(building.item) / 10 for buildings inside, poor quality counts 0; statues multiply the linked item contribution by 2. Without a positive-quality linked item, use numeric type.roomValue, else 0; plus Σ value(item) / 10 for each item a building inside holds (§ Building wants), poor quality counting 0
sizeScore = min(tiles, ROOM_SIZE_CAP) × 1
enclosed = every border tile is a wall, a door, a hatch, or a fortification → score × ENCLOSED_PERCENT / 100
score = (Σ tileScore + wallScore + furnitureScore + sizeScore) × enclosure
tier: bare < 20, modest < 60, decent < 150, fine < 400, grand < 1000, royal ≥ 1000
```

Room type requirements for the zone to count as that room ("a bed" is any built building tagged `sleep`: a bed, a stone bed or a pallet): bedroom needs a built bed; dining hall needs at least one built table with an adjacent built chair; hearth hall needs the built hearth inside; hospital needs a built bed and chest; barracks needs nothing (an armor stand or weapon rack adds value); tomb needs a built coffin; sanctum needs a built building tagged `rune_circle` (25).

The room inspector names each missing requirement and counts the unique open border tiles in the same-z 8-neighbourhood. Walls, fortifications and built doors or hatches close the border; planned doors and hatches do not. Open border tiles on the viewed level are highlighted while the zone is selected. These diagnostics read current tiles and furniture without recomputing or writing the stored room state.

Effects (thought ids in 15): bedroom tier on `Slept`; dining hall tier on `MealEaten` at a table; hearth hall tier as the fortress-wide baseline bonus; hospital tier on `PatientHealed`; barracks tier on training sessions; tomb tier on `Buried` for mourners; sanctum tier on an attune session's xp and mishap chance (25). `RoomQualityChanged { zoneId, tier }` when the tier changes.

On room entry, 10 observes visible floor masterworks and installed furniture throughout the room, excluding container contents and the viewer's own work; 10 saves its seen-item memory.

### Ownership

- Bedroom: `AssignRoom { zoneId, dwarfId }`; auto-assignment daily: bedrooms with a built bed and no owner, in zone-id order, go to living fortress creatures with `Title` and no bedroom, titled dwarves first (Thane, then Warden, Broker, Chief Medic), then by lowest mood from 15’s reader, with id as the last tie-break. `MOOD_BASELINE` is used only when no morale reader exists in a standalone world. `Room.ownerId` stores ownership; assigning a dwarf elsewhere clears the previous bedroom. On `CreatureDied`, every bedroom owned by that creature becomes unowned in the same tick and is available to the next daily auto-assignment. `freeBeds` excludes beds inside owned bedrooms and beds held by another living sleeper or patient. A chosen bed is held throughout the walk and sleep until waking, abandoning the activity or death; patient assignment holds it until discharge, reassignment or death. The holds come from 10's saved rest activities and 17's saved `Patient.bedId`, and availability is queried live. No two dwarves use the same bed at once. Auto-assignment draws no RNG. An owner’s bed is theirs; other dwarves do not sleep in it.
- Tomb coffins: assigned to a living dwarf (reserved) or left open for anyone; burial fills the first free coffin, preferring a reserved one for its dwarf. The reservation survives its dwarf's death.

### Burial

On `CorpseCreated` for a dwarf: a `bury` job (labor `hauling`) hauls the corpse to a free coffin; on completion `Buried { dwarfId, coffinId, tombTier }`; the corpse item is destroyed and the coffin becomes `occupied`. The dwarf is buried in its worn clothing, which is destroyed as `buried` and removed from stock counts and wealth; its weapon, shield, armor and quiver, which only a corpse from an older save still wears (a dwarf's kit drops where it falls, 13 § Forbid, dump, melt, claim), drop unowned on the coffin's tile. Resolve that tile before destroying the corpse, even when the hauler stands beside the coffin. Without a coffin the corpse stays where it is (miasma follows). Placing a memorial slab for a dwarf whose body is gone (rotted, lost to magma) emits `Buried` with `coffinId: 0` and `tombTier: none`; a `Buried` with `coffinId: 0` is how a memorial is told from a burial in a coffin outside a tomb, which also has `tombTier: none`.

A slab names its dwarf through its work order: `AddWorkOrder` for `make_memorial_slab` takes an optional `memorialDwarfId`, which must name a dead dwarf with no intact body (a skeleton counts as a rotted body); the craft job carries the id onto the slab item. A slab without a name can be crafted but resolves no grief.

### Value

Each built building contributes `materialValue + type.valueBonus` (plus the linked item's value) to fortress wealth (13 sums from `BuildingCompleted`/`BuildingRemoved`, whose `value` is the building's contribution, 0 for one that was never built). A bridge's bonus is per footprint tile.

## State

- `Building` components (`type, material, state, origin, footprint, orientation, itemId, mode, linkedIds, ownerId, settings`, `held` for a building with wants, `dryDays` for a drying rack and `burnDays` for a candle stand), `buildingAt` map (in `Map3D`), `Zone` components with `tiles` sorted, `zoneAt: Map<TileIndex, zoneId>` (one per tile), `Room` components (`zoneId, score, tier, ownerId, enclosed`), `hearthId`, `depots[]`, `coffins[]`, `dirtyRooms`.
- Rng stream (auto-assignment ties; reserved).
- Superset fields of `BuildingsState` (schemas/system-state.md): `pendingJobs`, the buildings waiting for a build or deconstruct job, and `magmaTouched`; `rackDay`, the day's weather so far for the drying racks (`notClear`, `wet`), saved only while a rack is built.

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
- `buildings.ghost(typeId, origin, orientation, width?, height?, planned?)` — the build tool's ghost: the footprint, the failing tiles, the reason `PlaceBuilding` would give (or null), and the `on` rule; `planned` is a set of tiles counted as planned floors (the tiles a drag places before this one, § Constructions, A span of floor)
- `buildings.roomScore(zoneId)` — the score of a room right now, with its parts (the `zone › room` inspector)
- `buildings.roomDiagnostics(zoneId)` — current missing furniture requirements and sorted, unique open border tiles; a read-only query, undefined for a non-room zone
- `buildings.wellWorking(id)` — the well has water within `WELL_DEPTH` below; `buildings.cageOccupant(id)` — the creature held in a cage building, or 0; `buildings.memorialEligible(id)` — the dead dwarf has no intact body and can be named on a memorial slab
- `buildings.wagon()` — the wagon, or 0; `buildings.holderTile(id)` — the tile a building's container contents lie on (the wagon), or −1
- `buildings.hearthLightAt(i)` — the tile is in the built hearth's 5×5 comfort light (which is not crop light); `buildings.cropLitAt(i)` — the tile has crop light; `buildings.lampCoveredAt(i)` — the tile lies in the 3×3 of a built lamp; `buildings.beetleLitAt(i)` — a cardinal neighbour on the tile's level holds a built cage building whose occupant's species has the flag `glows` (07 reads it for growth and for a glow plot); `buildings.comfortLightAt(i)` — the tile is in comfort light, the built hearth's square, a built lamp's 3×3, a burning candle stand's or a built lantern's 3×3 (not crop light; it sets no `lit` flag; 13's cellars must be out of it, 10's meals and 18's spotting read it); `buildings.tallowSmokeAt(i)` — the tile is lit only by stands burning tallow (§ Candle stands and lanterns); `buildings.standCandles(id)` — a candle stand's candles held, the burning one's material and its days left
- `buildings.value(id)` — a building's contribution to wealth when built (material value plus the per-type bonus)
- `buildings.wants(id)` — each want of a built building with its `count`, the `held` items that answer it and those `coming` (13's hauls to it); `buildings.held(id)` — the living items it holds; `buildings.withWants()` — the built buildings whose type has wants, ascending (§ Building wants)
- `buildings.seatHasMug(chairId)` — a table beside the chair holds a mug for it (§ Mugs at the table)
- `buildings.restPercent(id)` — the percent a built `sleep` building rests at (`MADE_UP_REST_PERCENT` made up), 0 for anything else; `buildings.bedding(id)` — `none`, `soft` or `feather` (§ Beds)
- `buildings.holderWants(id)` — the wants 13 hauls to a built building that holds items, as item types, counts, materials and shared pools (§ Building wants, § The drying rack); `buildings.dryingRows()` — every drying row; `buildings.rackDrying(id)` — the rows a rack takes; `buildings.rackItems(id)` — a rack's held items with their row, days and days left

### Commands

`PlaceBuilding`, `CancelBuilding`, `DeconstructBuilding`, `SetBuildingPriority`, `CreateZone`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`, `AssignRoom`, `LinkMechanism`, `UnlinkMechanism`, `SetDoorMode`, `SetHatchMode`, `SetPlateTrigger`, `ReleaseCage`, `AssignCoffin`, `ReleaseHeld` (§ Building wants), `SetRackDrying` (§ The drying rack).

### Events consumed

`JobCompleted`, `JobCancelled`, `DayPassed` (rooms; the drying racks; the candle stands), `WeatherChanged` (a drying rack's day), `TilesChanged` (validity of planned buildings; room recompute), `CorpseCreated`, `CreatureDied` (release bedroom ownership, preserving reserved coffins), `MechanismTriggered` (from 19 for plates and levers: this system applies the state change), `AlertChanged` (lock-on-alert doors), `DoorBreakAttempt` (from 18), `MagmaContact` (04 also emits it for a magma tile that holds a building, with the creatures there, possibly none; this system queues the tile and at its next tick removes each non-construction building on it whose material melts at or below `MAGMA_C`, destroying its linked item as `melted`; constructions are terrain, and 05's fire takes wooden ones), `SulkHappened` (a `break` sulk from 15 names a building: this system queues it, saves the queue, and in its own tick removes the building and destroys its linked item as `sulk`), `FireOut` (wooden building burned: 05 asks through `terrain.setKind`; this system removes the entity on `TilesChanged` when its tile no longer matches), `Mishap` (25's `scorched_circle` names a built rune circle: this system removes it at once, and nothing comes back, since a circle links no item).

### Events emitted

`BuildingPlaced { id, buildingType, tiles }`, `BuildingCompleted { id, buildingType, value }`, `BuildingRemoved { id, buildingType, value }`, `BuildingStateChanged { id, state }` (door mode, hatch mode, floodgate open/closed, bridge raised/lowered: consumed by 04, 22, 19), `ZoneChanged`, `RoomQualityChanged`, `RoomAssigned { zoneId, dwarfId }`, `HearthLit`, `DoorBroken { id }`, `FortressShutOut { id, doors[], tile }`, `Buried { dwarfId, coffinId, tombTier }`, `MechanismToggled { id, newState }`, and 16's `DamageDealt` (a drawbridge that is raised with creatures on it).

### Registrations

Job producer `buildings` (`build`, `deconstruct`, `pull_lever`, `link_mechanism`, `bury`); panel `build` and `zones`; inspector sections `building` (type, material, quality, state, mode, links, owner, workshop delegation to 12) and `zone › room` (tier, score breakdown, owner, requirements); overlay `zones`; announcements: `HearthLit` (note, with the line "The hearth is lit. This is a deepholm now."), `DoorBroken` (alert), `FortressShutOut` (danger), `Buried` (note), `RoomQualityChanged` to grand or royal (note).

## Player-facing behavior

- Build menu (hotkey `b`): categories → types; a footprint ghost follows the cursor, green where valid, red where not, with the reason; material choice list showing available counts; orientation with `r`. Placing several of the same type: the menu stays open.
  - A workshop that may be built of blocks (§ Placement step 2) offers "of logs" and "of blocks": the material choice runs through the logs' materials and then blocks, and the line under it shows the chosen way's inputs and build time (24 § Build menu).
  - For a type with a fixed 1×1 footprint (furniture, constructions, mechanisms, traps; not the `special` category, so not the hearth or the well), a drag places one per valid tile of the rectangle, on button-up. The status bar shows the count while dragging ("Door ×5, 2 tiles blocked"). Tiles that fail the placement rule are skipped and reported in one message that names the rule. A single click still places one: a drag that never leaves its tile is a click and is sent even when the tile is blocked, so the simulation's refusal names the rule.
  - Each row of the menu gives how many of the building the stock allows, every input counted, or names the input none of which is in stock: "Still 1 barrel+1 stone (no stone)".
  - When an input is out of stock (the scarcest), the status bar says how many placed buildings will wait and offers the order: "0 doors in stock: 5 will wait · [o] order 5". `o` opens the work-order picker (12) preset to that item and count. When no built workshop makes the item, the line names the workshop to build instead, never one that needs the item itself and that the stock cannot build; for stone or blocks with no such workshop at hand, it says where the rock is ("dig down to rock: the soil here is 4 levels deep").
- Zones menu (hotkey `z`): type → drag → confirm; the zone panel shows settings and, for rooms, the quality breakdown.
  - Select a zone by clicking its map tiles, or centre the map/cursor on it and press `Enter` with no zone tool active. The stockpile and room inspectors replace the type list; `y`, or its button, returns to zone types. Other panel letters always open their panels.
  - A room names missing furniture ("Needs a bed", "Needs a table with a chair", "Needs the hearth inside", "Needs a chest", "Needs a coffin") and says "Not enclosed: 3 open border tiles", highlighting those tiles. A bedroom offers `Shift+O` or its owner button, using the building panel's same Nobody/dwarf list, arrows and Enter or a click. It submits `AssignRoom`; Esc cancels the choice. A bedroom without a built bed, or whose room registration is still pending, explains why ownership is unavailable.
- Clicking a building opens its panel: state, mode toggles, links, owner, deconstruct; workshops delegate to 12. A left click with no tool on a tile that holds a building, and no creature or loose item the map shows (24 § Inspection, the click ladder), opens the depot's panel, a finished workshop's panel, or the building panel for everything else (a planned workshop too); a drag from the tile still selects a rectangle, and a right click opens Look's tile list. The building is a row of that list, which opens it with its digit, `Enter` or a click; the building panel's "Look at the tile" line goes back. The panel is in the sidebar with no hotkey of its own.
  - Doors, hatches and traps list their modes with the current one marked.
  - A planned building shows what it waits for and takes a build priority (`1`–`9`).
  - A bed gives the bedroom zone it stands in an owner from the list of dwarves, or nobody; a coffin is kept for a dwarf, or for anyone.
  - A cage shows its occupant, with release (confirmed) and tame. A built cage says what its occupant does there: "Lights the four tiles beside its cage for glowcap." or "Spins webs around its cage every day."
  - A bed says what it rests at and whether it is made up; a building with wants lists what it holds and wants, with `[h] take out` (§ Building wants).
  - A drying rack lists its items with their days left and its drying checklist (§ The drying rack).
  - A wreck says it does nothing and what taking it apart gives back, with take apart (§ Wrecks). An armed old trap says it springs on anyone until its mode is chosen (§ Wrecks).
  - A candle stand shows its candles and the days its burning one has left (§ Candle stands and lanterns).
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
| `STONE_WORKSHOP_TICKS_PERCENT` | 150 | Build time of a workshop of blocks against its logs (*unmeasured*) |
| `MADE_UP_REST_PERCENT` | 110 | The percent a made-up bed rests at (§ Beds) (*unmeasured*) |
| `RACK_CAPACITY` | 5 | The units a drying rack holds over its rows (*unmeasured*) |
| `STAND_CANDLES` | 5 | The candles a candle stand holds (*unmeasured*) |
| `CANDLE_DAYS_TALLOW` | 7 | The days a tallow candle burns (*unmeasured*) |
| `CANDLE_DAYS_WAX` | 14 | The days a beeswax candle burns (*unmeasured*) |
| `CANDLE_SPOT_BONUS` | 2 | Tiles farther a creature in comfort light spots, or is spotted (18 § Stealth) (*unmeasured*) |
| `TALLOW_SMOKE_PERMILLE` | 20 | Per mille an hour, `smoky_hall` for a dwarf lit only by tallow (*unmeasured*) |

Material and item requirements, value bonuses and footprints are content.

## Extension points

- New building: a row and, if it has a new function tag, a consumer in one system.
- Multi-tile furniture (long tables): a footprint on the type; placement already supports it.
- Room flood-fill detection from furniture: replace the zone-defined room with a fill from the bed; the quality formula is unchanged.
- Ownership of dining seats or workshops: `ownerId` exists on every building.
