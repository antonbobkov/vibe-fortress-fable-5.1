# 13 Items & Storage

**Owner:** `systems/items` · **Depends on:** [`../01-architecture/data-model.md`](../01-architecture/data-model.md), [05-materials-and-temperature.md](05-materials-and-temperature.md), [11-jobs-and-labor.md](11-jobs-and-labor.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Track every object in the fortress: what it is, what it is made of, how good it is, where it is, whether it is spoken for, and where it should go. Own stockpiles, containers, decay, value, and the stock counts that the rest of the game plans around.

## Concepts

- **Item type**: a row of `items.md` with a three-level category path (`food/meat/raw`), a value multiplier, stacking rules, the container class it wants in a stockpile, a rot time, tags, and a glyph.
- **Item**: an entity with `Item { type, material, quality, wear, count, containerId, ownerId, flags }` and a `Position` when it lies on the ground. Items in a container have no `Position`; items carried have `Item.carriedBy` naming their creature, corpse or in-flight projectile, and no `Position`.
- **Stack**: one entity with `count > 1` for stackable types (ammunition, seeds, meals, bars, blocks, coins). Stacks split when part of one is taken and merge when identical stacks meet in a stockpile slot.
- **Container**: an item with `Container { contents, capacity }`. Classes: `barrel` (drink, liquids, food), `bag` (seeds, flour, powders), `bin` (crafts, cloth, leather, bars, ammunition), `chest` (personal items, hospital supplies), `bucket` (one unit of water or milk). A cage is not a container: it holds one creature, named by the cage item's `occupantId` (0 when it is empty).
- **Stockpile**: a zone with a filter, container wants, a priority, and optional source links.
- **Slot**: a stockpile tile, or a container in a stockpile tile. A tile holds one item or stack, or one container.
- **Rot**: the decay of perishable items in stages.
- **Wealth**: the sum of item values in fortress possession plus building values (14).

## Rules

### Category tree (fixed by this design; leaves in `03-content/items.md`)

```
food/      meat/{raw, cooked}  fish/raw  plant/{raw, processed}  meal/{easy, fine, lavish}  egg  cheese  milk  fat  tallow
drink/     ale  beer  wine  spirits
seed/
stone/     raw  block  gem_rough  gem_cut
ore/
wood/      log  block
bar/       metal  coal  charcoal
furniture/ bed  table  chair  door  hatch  cabinet  chest  coffin  statue  cage  mechanism  floodgate  anvil  nest_box  weapon_rack  armor_stand  memorial_slab  trap_part
container/ barrel  bag  bin  bucket
weapon/    melee  ranged
ammo/
armor/     head  body  arms  legs  feet  shield
clothing/  body  legs  feet
tool/      pick  axe  fishing_rod  crutch
craft/     figurine  ring  amulet  mug  totem
textile/   fiber  thread  cloth  wool  hide  leather  bone  shell  skull
medical/   splint  bandage  brightleaf
refuse/    corpse  skeleton  rotten  part
```

Stockpile filters select any node; selecting a node selects its subtree. Material class and quality range refine the selection.

### Value

An item that does not come from the fortress (a hostile's gear, its corpse, what it drops) carries the `foreign` flag (`ItemFlag.Foreign`). The flag survives splitting, dropping and rot, and a creature whose death is still queued when the game is saved keeps the origin of what it holds. A foreign item is in no stock count and adds nothing to wealth. The flag is cleared, and the item counted, when a fortress dwarf picks it up (a container's contents with it) or when the `strip_corpse` job that recovers it completes.

`value(item) = materialValue × type.valueMultiplier × qualityMultiplier × count`, integer marks, where `qualityMultiplier` is 12's tier table (0.5 … 5.0) and 1.0 for non-quality items. Engravings, decorations and encrusting do not exist in version 1, so this is the whole formula.

Fortress wealth is maintained incrementally: `+value` on `ItemCreated` (fortress faction), `−value` on `ItemDestroyed`, `±` on quality change (none in version 1), `+` when a hostile's loot is recovered, `−` when a thief escapes, plus building values from 14 (`BuildingCompleted` adds its material value plus a per-type bonus; `BuildingRemoved` subtracts). `WealthChanged` is emitted at the items cadence when the cached value differs from the last emitted by more than `WEALTH_EVENT_STEP`.

### Placement and pickup

- A count above an item type's stack size creates several stacks at the requested place and returns the first id.
- `spawn.item` places items on a walkable tile; if the tile is `open`, the item falls (movement helper rules) to the first solid-bottomed tile below.
- Items on a tile stack in a list; a tile can hold any number of items (there is no tile capacity outside stockpiles), but the compositor shows the most valuable.
- Pickup and drop are core operations used by 11 (`items.attachToCarrier(itemId, carrierId)`, `items.dropAt(itemId, tile)`, `items.putIn(itemId, containerId)`, `items.takeOut(itemId)`); each updates the spatial index and the "wants hauling" set.

### Stockpiles

```
Stockpile { filter: { categories: Set<CategoryPath>, materialClasses: Set<MaterialClass> | 'any', minQuality, maxQuality, allowRot: boolean },
            containersWanted: { barrel, bag, bin },  priority, linkedSources: EntityId[], acceptsFromAnywhere: boolean }
```

- `accepts(stockpile, item)`: the item's category is under a selected node, its material class is allowed, its quality is in range, it is not forbidden, and (if `linkedSources` is non-empty) the item currently sits in one of those stockpiles. `LinkStockpile` accepts only another stockpile zone as source; a building or any other zone type rejects with `not_found`.
- Slot search for an item: if the item's type wants a container class, find an unreserved container of that class in the stockpile with room, else an empty tile if a container is wanted and available to be hauled in (a `haul_to_stockpile` job for an empty container is created first), else refuse; if the type wants no container, find an empty tile. Empty tiles are filled in `(y, x)` order for a tidy look.
- Each items tick requests one nearest free empty container per class per stockpile while wants exceed those present, including incoming containers. A wanted empty container already on its stockpile counts as stored.
- `SetStockpileContainers` accepts each barrel, bag or bin count only as an integer from 0 through the stockpile’s tile count. Reject the whole request with `out_of_range` before writing any count if one is outside that range.
- Container filling: containers in stockpiles are themselves items; `containersWanted` produces haul jobs for empty containers from wherever they are (usually the carpenter's output).
- Before filling a container on delivery, check that it is still unreserved and in the destination stockpile. If another job reserved it or moved it away, leave the item on the delivery tile, release the slot reservation, and let ordinary hauling find another home. A workshop's reserved input container cannot be filled by stockpile haulers.
- Slot reservations: when a haul job is claimed, the destination slot is reserved for the job (`slotReservations: Map<slotKey, jobId>`), released on completion or cancellation.
- A stockpile at capacity emits `StockpileFull { id }` once until it has space again; when it gains space, `noHome` items return to the wants set. Items waiting for a wanted or incoming container stay in the wants set without a job. Stale slot reservations are dropped each items tick.
- Stockpile priority is the haul job priority for items going to it (default `HAUL_PRIORITY`, food stockpiles `HAUL_PRIORITY_FOOD`; both from 11). A new stockpile has an empty filter and accepts nothing. Its priority is the default until the player sets one, and the default follows the filter: `HAUL_PRIORITY_FOOD` while the filter selects only food nodes. A priority the player has set stays when the filter changes (`ItemsState.explicitPriority`).
- The presets select category nodes: Food `food`; Drink `drink`; Seeds `seed`; Stone `stone/raw`, `stone/block`; Ore and bars `ore`, `bar`; Wood `wood`; Furniture `furniture`; Weapons and armor `weapon`, `ammo`, `armor`; Cloth and leather `textile`, `clothing`; Crafts and gems `craft`, `stone/gem_rough`, `stone/gem_cut`; Refuse `refuse/skeleton`, `refuse/rotten`, `refuse/part` and Corpses `refuse/corpse` (both allow rot); Everything every top-level node (rot allowed). The quality range applies only to types that bear a quality.
- Destroying an item or removing its destination stockpile cancels the affected haul jobs with `target_invalid`.
- Removing a stockpile zone leaves its items where they are; they become "wants hauling" again if another stockpile accepts them.

Eggs reserved in nest boxes do not enter ordinary hauling. The `collect_egg` job releases a collected egg at its worker's tile, after which the normal hauling rules apply.

### The "wants hauling" set

Maintained incrementally, sorted by item id:

- An item enters the set when it is created on the ground, dropped, released from a reservation, its stockpile is removed, or a stockpile's filter changes to include it.
- It leaves when it is picked up for a job, put in an accepting stockpile slot, forbidden, destroyed, or when no stockpile accepts it (it is moved to a `noHome` set that is re-examined when any stockpile filter changes or a stockpile is created).
- The 13 tick creates `haul_to_stockpile` jobs (through 11's sink) for up to `HAUL_JOBS_PER_TICK` items from the set that do not have a job yet, nearest accepting stockpile with a free slot first (by Chebyshev distance to the stockpile's centroid, then by stockpile priority).
- When an item leaves the set because another job picked it up (a tool fetched, food eaten, an input delivered), an unclaimed haul, dump or strip job for it is cancelled (`target_invalid`).

### Containers in play

- Drinks are made *into* a barrel at the still (12's `container` input) and stay in it; a dwarf drinks one unit from the barrel where it stands (10 finds the barrel, walks to it, takes one unit: the stack count in the barrel decrements; an empty barrel becomes a free container). A barrel that holds anything is not empty, so a brew never takes one that holds food, seed or another drink; when every barrel holds something the still waits for a new one (12 § Operation).
- Seeds go into bags; bags into stockpiles.
- Bins hold up to `BIN_CAPACITY` items of any bin-wanting category; a bin in a stockpile that accepts crafts and cloth may hold both.
- Barrels, bags and buckets count units; bins and chests count items. An item container never goes inside another item container. The wagon’s building container can hold item containers; everything held in it resolves to its centre and is found and unloaded as on the ground. A container is hauled with its contents.
- Items in containers are visible in the stocks panel and are found by `findItem`; taking one out is part of the fetch step (11).

### Forbid, dump, melt, claim

`Item.flags`: `forbidden` (ignored by all jobs and searches), `dump` (wants hauling to a `dump` zone; on arrival the flag clears), `melt` (a smelter may consume it), `reserved` (held by a job, or by a dwarf walking to eat or drink it; released when the holder dies or abandons the errand), `owned` (belongs to a dwarf: worn clothing, an assigned bed's owner's chest contents), `installed` (linked to a built piece of furniture, 14: off the map and out of every search, haul and available count, but still in the totals and in wealth; deconstruction clears it and returns the item to the building's tile).

Ownership ends with its owner: on `CreatureDied` of any creature, every item with its `ownerId` loses the owner and the `owned` flag through `items.setOwner(id, 0)`, including worn clothing, claimed gear and chest contents. Worn items and any extra carried equipment, including spare weapons and ammunition outside worn slots, stay with the corpse, unowned.

Commands set flags on items, on all items in a rectangle including their container contents, or on all items of a type in the stocks panel. Items dropped by dead dwarves and hostiles are not forbidden by default (unlike the inspiration). A dead worker's held tool and carried item, when they are not in its `Equipment`, drop at the recorded death tile, with no owner or reservation and with the forbidden flag clear; items *worn by a corpse* stay with the corpse until the corpse is buried, rots, or is butchered (every non-dwarf corpse with worn items can be looted by a `strip_corpse` hauling job that moves the equipment to the ground). Dumped items stay in the dump zone; a dump-marked item uses the first tile of the nearest dump zone by centroid, and has no home without a dump zone.

When a corpse is buried, its worn clothing (the `clothing/*` items from `Equipment.clothing`) is destroyed with it as `ItemDestroyed { reason: 'buried' }`, leaving the stock counts and wealth. Its weapon, shield, armor and quiver drop unowned on the coffin's tile. Destroying any corpse through `items.destroy` applies the same disposition at its resolved tile, with clothing using the corpse's destruction reason. Only items still carried by that corpse are disposed of; a missing item or one already moved to another holder is untouched. Rot drops all worn items at the corpse's tile when it becomes a skeleton.

### Rot

Types with `rotDays > 0` (raw meat, raw fish, raw plants, meals, eggs, cheese, milk, corpses, hides) have a rot timer. Rot advances in a bucket queue keyed by expiry tick (only the head bucket is inspected each 13 tick).

| Stage | At | Effect |
|---|---|---|
| fresh | 0 | normal |
| stale | 50% of `rotDays` | meals and raw food give a smaller meal thought (15 reads the stage) |
| rotting | 100% | inedible; the item is refuse; indoors it emits miasma |
| gone | 150% | destroyed; a corpse becomes a `skeleton` item (bones for animals, a dwarven skeleton for dwarves, still burial-eligible) |

Rot speed: full speed on the ground and in a workshop; `ROT_CONTAINER_PERCENT` when the item is inside a container that is inside a stockpile; `0` for raw plants and seeds in bags (they are dry goods: `rotDays` 0 for seeds anyway); double speed on a tile with temperature above `ROT_HOT_C`; halved below `ROT_COLD_C`; stopped below `FREEZE_C` (a frozen larder is a legitimate design).

Miasma: each 13 tick, every rotting item on a tile that is not `outdoor` emits miasma to its tile and the 8 neighbors: `miasmaTiles: Map<TileIndex, expiresTick>` with `MIASMA_DURATION`. Dwarves entering a miasma tile get the `miasma` thought (10 checks `items.isMiasma(i)` on entering, like mist). Refuse stockpiles outdoors are the answer; so are burial and butchering promptly.

### Corpses

A corpse is an item of type `refuse/corpse` with `Corpse { species, diedTick, wornItems[] }`, created on `CreatureDied` at the death tile with the creature's size as its weight (heavier than most things: hauling a troll corpse is slow). Dwarf corpses use `skull_bone` as material, preserving species and dwarf name on the `Corpse` component; they want hauling to a coffin (14 burial job) before a refuse stockpile. Sapient hostile corpses can be dumped or hauled to refuse; they cannot be butchered.

### Stock counts and the stocks panel

`counts: Map<typeIndex, { total, byMaterialClass, byQuality, available (not forbidden, not reserved, not owned, not carried; a cage that holds a creature is not available) }>` maintained incrementally. On load, rebuild every stock dimension once from the restored item records, excluding merchant goods and unrecovered foreign items as usual; preserve the saved dirty-type queue. This heals stale counts in older saves and leaves valid counts unchanged. `StocksChanged { types[] }` is emitted batched each 13 tick for types whose counts changed. The stocks panel groups by category with expanders, shows counts and total value, and allows forbid, dump and melt on a type or a selected item.

### Searching

- `items.findItem(filter, fromTile, movementClass, { reservable: true })`: expanding-radius search through the spatial index over items with `Position` (including containers, whose contents are matched), skipping forbidden, reserved and owned items, checking connectivity between `fromTile` and the item's tile; returns the nearest match or `0`. Bounded by `FIND_RADIUS_MAX`; beyond that, falls back to all matching items in ascending id order, stockpile items first and then the rest, with the same eligibility and connectivity checks. This works for a filter that names no type as well as one or several types. Carried items remain outside every search. An optional `allowedTile(tile)` search option rejects candidate locations, including the resolved tile of container contents, in both the radius and stock-index searches without changing their order; noncritical need searches use it to avoid remembered threats.
- `items.findItems(filter, count, fromTile, movementClass)` for job inputs.
- `items.countAvailable(filter)` from `counts`.

Filters: `{ type | types (any of several types) | category | tag, materialClass | materialId, minQuality, edible, drinkable, emptyContainer(class), unoccupied }`. `unoccupied` matches an item with no occupant, which is how a search asks for an empty cage; every search that takes a cage as material (the `rearm_trap` input, the build inputs of a building) sets it, and an occupied cage is never counted by `countAvailable`.

### Items and hazards

- `MagmaContact` (04): items with `meltsAt ≤ MAGMA_C` are destroyed with `ItemMelted` (05 decides; this system destroys).
- Burning tiles (05): burnable items destroyed after `ITEM_BURN_TICKS`.
- Items in deep water are fine (nothing floats or sinks in version 1).
- A collapsing construction (03) drops items to the tile below.

## State

- `Item`, `Container`, `Corpse` components; `itemsAtTile` via the spatial index; `wantsHauling`, `noHome`; `slotReservations`; `rotQueue`; `miasmaTiles`; `counts`; `wealthCached`; `Stockpile` components and `stockpileTiles: Map<TileIndex, stockpileId>`.
- `dirtyTypes`, `fullStockpiles` and `buildingWealth`; queued `pendingDeaths` retain foreign origin.
- Rng stream (ammunition breakage, not used here; reserved).

## Interfaces

### Reader

- `items.get(id)` (the `Item` record), `items.value(id)`, `items.rotStage(id)`, `items.isMiasma(i)`
- `items.at(i)` (ids on a tile), `items.inContainer(id)`, `items.containerOf(id)`
- `items.findItem`, `items.findItems`, `items.countAvailable`, `items.count(typeId)`
- `items.stockpileAt(i)`, `items.stockpileAccepts(stockpileId, itemId)`, `items.freeSlots(stockpileId)`
- `items.wealth()`, `items.wantsHaulingCount()`
- `items.def(typeId)`, `items.categoryOf(typeId)`
- `items.tileOf(id)` — the tile an item is on, directly or through its container or carrier; −1 when nowhere
- `items.countOf(typeId)` (the same as `items.count`), `items.available(typeId)` (units not forbidden, reserved or owned), `items.stock(typeId)` (total, available, and the count by quality), `items.stockedTypes()` (the types with a non-zero count), `items.countMatching(filter)` (units of matching items whatever their flags)
- `items.room(containerId)` — room left in a container (units for barrels and bags, items for bins and chests); `items.containerRecord(id)` — the `Container` record (a copy)
- `items.stockpile(id)` — the `Stockpile` record of a stockpile zone (a copy); `items.findSlot(stockpileId, itemId)` — the slot the item would go to, the wanted container to haul in first, or null when the stockpile refuses the item or is full
- `items.itemCategory(id)` — the category path an item files under (a drink by its material's group)
- `items.unburiedDead(tick)` — some dwarf's remains have lain unburied longer than 15's `UNBURIED_DAYS`
- `items.carriedItems(carrierId)` — the items a creature carries directly, in entity-table order (held ammunition is read from it)
- `items.bestUnattendedItems(from?, radius?)` — the highest-valued unattended, unforbidden item of each tile, by descending value and then entity slot. With `from` and `radius`, only the tiles of the same-z Chebyshev square are visited. Thief and loot goals read it; a caller that excludes some items itself (a party's own loot) searches in full when an excluded item could be hiding a tile's next best

### Item API (mutation, called by 11, 12, 10, 14, 16, 20)

`attachToCarrier`, `dropAt`, `putIn`, `takeOut`, `split(itemId, count)`, `merge(a, b)`, `consume(itemId, count)`, `destroy(itemId, reason)`, `setFlag(itemId, flag, on)`, `setOwner(itemId, dwarfId)`, `setOccupant(itemId, creatureId)` (the creature a cage holds, 0 when released), `reserve(itemId, holderId)`, `release(itemId)` (the caller emits `ItemReleased` when releasing a held reservation).

### Commands

`ForbidItem { itemId | tiles | typeId, on }`, `ClaimItem` (the same with `on: false`), `DumpItem { … }`, `MeltItem { … }`, `SetStockpileFilter { zoneId, filter }`, `SetStockpileContainers { zoneId, wants }`, `SetStockpilePriority`, `LinkStockpile { zoneId, sourceZoneId, on }`. (`SetHospitalSupplies` is 17's command; its value is stored as a filter here.)

### Events consumed

`CreatureDied` (release the creature's item ownership; create corpse), `ZoneChanged` (stockpiles), `MagmaContact`, `ItemMelted`, `FireStarted`/`FireSpread` (burn timers), `TilesChanged` (items on tiles that became open fall), `BuildingCompleted`/`BuildingRemoved` (wealth), `ThiefEscaped` (wealth), `TemperatureTick` (rot speed sampling for the head bucket).

### Events emitted

`ItemCreated { id, itemType, material, count }`, `ItemDestroyed { id, itemType, reason, crafterId }` (type and material are content ids), `ItemRotStage { id, stage }`, `ItemRotted { id }`, `MiasmaSpread { tiles[] }`, `StocksChanged { types[] }`, `StockpileFull { id }`, `WealthChanged { wealth }`, `CorpseCreated { itemId, creatureId }`.

### Registrations

Job producer `items` (`haul_to_stockpile`, `haul_to_dump`, `strip_corpse`); panel `stocks`; inspector sections `item` (type, material, quality, count, value, rot, owner, flags, container) and `zone › stockpile` (filter, containers, usage, priority, links); overlay `stockpile usage` (tiles colored by fullness); announcements: `StockpileFull` note (once per stockpile per season), `MiasmaSpread` alert (once per area per day, "Miasma spreads.").

## Player-facing behavior

- Zones menu › Stockpile: drag, then a filter editor with the category tree (checkboxes with tri-state for partial subtrees), material classes, quality range, container counts, priority, source links. Presets: Food, Drink, Seeds, Stone, Ore and bars, Wood, Furniture, Weapons and armor, Cloth and leather, Crafts and gems, Refuse, Corpses, Everything.
  - The preset is a dropdown opened with its button or `Shift+P`; arrows choose, `Enter` applies, and accelerator letters jump to matching names (a panel letter requires Shift). In the tree, `↑↓` selects, `→` expands, `←` collapses or selects the parent, and `Space` toggles the selected subtree. Clicking a name expands it; clicking its checkbox toggles it.
  - `q` focuses the wanted barrel count; `↑↓` or `Tab` moves through barrels, bags, bins, priority, minimum quality and maximum quality. `←→` or `+/-` changes the selected value, as do the mouse minus and plus buttons. Counts are non-negative, priority is 1–9 and quality is 0–5 with minimum no greater than maximum. A refused adjustment says why in the status row and changes nothing.
  - `g` returns to the category tree. `v` opens the material-class checklist; arrows select and `Space` toggles, as does a click. The Any row switches between all classes and none. `Esc` returns without another change. All these actions are buttons or fields as well as keys, and are listed in Help. Truncated values have full-text tooltips.
  - A full-stockpile announcement names its ordinal and category preset, or Custom, and focuses the stockpile: "Stockpile #2 (Wood) is full."
- Stocks panel: category tree with counts and values; stocked category leaves expand to type rows and individual item stacks. Forbid, dump and melt act on the selected scope. With mixed materials in a type, melt addresses only its metal stacks.
- Item inspection: every field.
- Glyphs: `%` food and corpses (corpses in dark red), `☼` drink barrels... the full glyph table is in `03-content/glyphs-and-colors.md`; the rule is one glyph per category node at depth 2.
- Hints: "Stockpiles need barrels for drink and bags for seeds", "Refuse rots: keep the refuse pile outside".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `BIN_CAPACITY` | 30 | Items per bin |
| `BARREL_CAPACITY` | 20 | Units of drink or food per barrel |
| `BAG_CAPACITY` | 25 | Seeds or units of powder |
| `CHEST_CAPACITY` | 20 | |
| `HAUL_JOBS_PER_TICK` | 20 | New haul jobs created per items tick |
| `ROT_CONTAINER_PERCENT` | 25 | Rot speed inside a container in a stockpile |
| `ROT_HOT_C` / `ROT_COLD_C` | 30 / 5 | |
| `MIASMA_DURATION` | 300 | Ticks |
| `FIND_RADIUS_MAX` | 48 | Tiles |
| `WEALTH_EVENT_STEP` | 250 | Marks |
| `CORPSE_ROT_DAYS` | 14 | Default; species may override |

Rot days per type, stack sizes and value multipliers are content.

## Extension points

- Item decorations and encrusting: a `decorations[]` on `Item` and a term in `value`.
- Wear on clothing: `wear` exists on the record; a daily increment and a `tattered` threshold with a thought.
- Quantum stockpiles through dumping into a pit are allowed by the fall rule; a rule capping items per tile would go in `dropAt`.
- Minecarts and carts: a container class with movement; out of scope.
