# 12 Workshops & Professions

**Owner:** `systems/workshops` · **Depends on:** [11-jobs-and-labor.md](11-jobs-and-labor.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [05-materials-and-temperature.md](05-materials-and-temperature.md), [04-fluids.md](04-fluids.md), [10-dwarves.md](10-dwarves.md)

## Purpose

Convert materials into goods. Own workshop operation, recipes, work orders, quality, fuel and magma power, and the profession titles the player sees.

## Concepts

- **Workshop**: a building with the `workshop` function tag and a workshop type that lists its recipes.
- **Recipe**: inputs → outputs with a skill, a base time, a fuel flag and a quality flag.
- **Work order**: an instruction to make a recipe N times, optionally repeating while stock is low.
- **Quality**: one of six tiers rolled from skill on quality-bearing outputs.
- **Fuel**: a `coal` or `charcoal` bar consumed by fuel-burning workshops per job, unless the workshop is magma-powered.
- **Profession**: a dwarf's displayed title.

## Rules

### Workshops fixed by this design

| Workshop | Labor | Makes |
|---|---|---|
| `carpenter` | carpentry | beds, tables, chairs, doors, hatches, cabinets, chests, bins, barrels, buckets, wooden blocks, training weapons, wooden shields, bolts (wood) |
| `mason` | masonry | stone blocks, doors, hatches, tables, chairs, cabinets, chests, coffins, statues, floodgates, bridges' stone parts |
| `craftdwarf` | crafts | crafts (figurines, rings, amulets, mugs) from stone, bone, shell, wood; totems from skulls |
| `jeweler` | gem_cutting | cut gems from rough gems |
| `mechanic` | mechanics | mechanisms from stone; assembles traps and levers (14 consumes mechanisms as build materials) |
| `wood_furnace` | smelting | charcoal from logs |
| `smelter` | smelting | bars from ore; alloys; melts marked metal items to bars |
| `forge` | smithing | weapons, armor, picks, axes, anvils, chains, metal cages, bolts, metal blocks, metal furniture |
| `kitchen` | cooking | meals (easy 2 ingredients, fine 3, lavish 4), tallow from fat |
| `still` | brewing | drinks from brewable plants (needs an empty barrel) |
| `tannery` | leather | leather from raw hide |
| `leatherworks` | leather | leather armor, bags, quivers, backpacks |
| `loom` | textiles | thread from fiber (flax, sporecloth, wool); cloth from thread |
| `clothier` | textiles | clothing, cloth bags, ropes, padded armor |
| `farmers_workshop` | animal_care / farming | milking and shearing (08), cheese from milk, fiber from flax and sporecloth plants |
| `butcher` | butchery | corpse processing (09) |
| `kennel` | animal_training | training and taming (08) |
| `bowyer` | carpentry | bows and crossbows from wood; arrows from wood |

Magma variants: `magma_smelter`, `magma_forge`, `magma_kiln` (unused in version 1 but listed for glass later). The `magma` building tag identifies a magma workshop for power detection, independently of whether a base workshop or recipes exist. The reserved magma kiln therefore reports power by the same footprint rule while its recipe list remains empty. A magma workshop is buildable only where at least one footprint tile has, directly below it, a tile with magma of level ≥ `MAGMA_POWER_LEVEL` (a channel over a magma pool or a pipe branch). Placement without that magma rejects with `bad_placement`; `no_magma` is reserved for workshop/job blocking after power is lost. It needs no fuel. If the magma drops below the level, its jobs block with `no_magma`.

### Recipes (content) and derived recipes

A recipe row has `id`, `name`, `workshop`, `inputs`, `outputs`, `skill`, `baseTicks`, `fuel`, `quality` and optional `container`, as defined in [Content rows](../04-implementation/schemas/content-rows.md). Input `match` accepts ids, tags and alternatives. `materials` restricts material ids; `materialProperty` selects brewable plants or magma-safe metals; `sameMaterial` requires every unit to share a material. Outputs using `stage: 'next'` take the input material's `nextStage`, falling back to that input when no next stage exists. An empty container input holds the output.

Fuel inputs use the item tag `fuel`. An input with `flagged: 'melt'` takes one whole marked item, including its stack, instead of counted units. Automatic melting selects workshop types whose recipes have such an input; recipe operation reads these constraints from data.

Generated at load from the minerals and metals tables:

- `smelt_<ore>`: 1 ore → `yields` bars (the ore's `yields` list; `galena` gives 1 `lead` and, with the silver yield's `permille`, 1 `silver`), fuel, no quality.
- `alloy_<metal>`: the metal's `alloyInputs` bars → `alloyOutput` bars, fuel, no quality (`bronze`: 1 copper + 1 tin → 2 bronze; `brass`: 1 copper + 1 zinc → 2 brass; `steel`: 1 iron + 1 flux stone + 1 fuel → 1 steel, on top of the workshop's fuel; `electrum`: 1 gold + 1 silver → 2 electrum).
- `melt_<class>`: a marked metal item → `floor(stackCount × itemBarValue × MELT_RETURN_PERCENT / 100)` bars of its metal, fuel, no quality.
- `forge_<weapon|armor|tool>`: bars → the item; bar counts per item type; material from input; quality.

Melting takes the whole marked stack. Its bar cost comes from the weapon or armor row, else the matching metal recipe's bar inputs divided by its output units, else one bar. Explicit work orders run first; `autoMeltMarked` starts only when none starts and the smelter is idle.

### Operation

Magma power and stock are read each tick. Each tick, for each built, unsuspended workshop:

1. If it has a `currentJobId`, nothing to do (11 runs the job). The exception is a current job that is `blocked` with `missing_input` while its order is no longer runnable (an input was taken after the job was created): the workshop cancels it (`JobCancelled { reason: 'order_not_runnable' }`), which releases what it had reserved and leaves delivered inputs where they lie, and goes on to step 2 in the same tick. A job blocked for any other reason (`no_worker`, `unreachable`, `no_tool`, `no_magma`) is kept.
2. Otherwise, walk its work orders in order; for the first order that is *runnable*, create the job `craft { workshopId, orderIndex }` with the recipe's inputs as job inputs (11 reserves them), `workTile = at` (the workshop's work tile), tool none, priority = the order's priority. An order is runnable when: its `remaining > 0` (or its `maintain` condition holds); every input filter matches at least `count` available items (13 `countAvailable(filter)`); if `fuel`, a fuel bar is available or the workshop is magma-powered; if `container`, an empty container is available; and if the workshop has an assigned worker restriction, that worker exists.
3. If no order is runnable, the workshop is idle; if an order is not runnable because of inputs, the order shows "waiting for <input>" in the panel and the workshop reports `WorkshopBlocked { reason }` once (not every tick). An order that waits for an input reports `missing_input` and names its missing recipe input match in `input` (the fuel shortage is `fuel`); an order whose only shortage is an empty container reports `no_empty_container` and names the container class in the event's `container` field (`barrel` for a brew). A container that holds anything, even a single stack of food or seed, is not empty, and a brew never empties one: the still waits until the player has another barrel made. The report comes once when the wait starts, and again only after the wait has ended (the workshop started a job or became idle) and a new one begins. When a previously blocked workshop has neither a running job nor a blocking reason, emit `WorkshopIdle { workshopId }` once and clear its remembered reason. Removing its last blocked order is one such transition; a workshop that stays idle does not repeat the event.

Job execution (producer `workshops`):

- `onStart`: nothing.
- Work: `baseTicks` skill-scaled by 11's work rate.
- `onComplete`: validate that every delivered input still exists, is unconsumed and is reserved to this job before consuming; a missing or foreign-held input goes back to fetching or blocks rather than producing output. Consume inputs (destroy items; the container input becomes the output's container); consume fuel if applicable; roll quality if `quality`; spawn outputs at the workshop's output tile (into the container if any); emit `ItemCrafted { itemId, quality, crafterId, workshopId, recipeId }`; decrement the order; if `remaining == 0` and not `maintain`, remove the order and emit `WorkOrderCompleted`.

Delivered inputs stay reserved to the craft job while its order stands, through a need/threat interruption, a block or a reservation timeout. Only undelivered reservations use `RESERVE_KEEP_TICKS`; completed or cancelled jobs release all remaining reservations, and removing the order cancels the job. Haulers cannot remove delivered reserved inputs.

Suspending a workshop cancels its current job; the order waits until it is resumed. Setting or clearing its assigned worker also cancels the current job. On `CreatureDied` of an assigned worker, clear `assignedWorker` to 0 and cancel the current job exactly as `SetWorkshopWorker { dwarfId: 0 }` does; another eligible worker can run the retained order.

`SetWorkshopWorker` accepts a dwarf with any enabled labor used by a recipe of the workshop type, rather than its construction labor. The assigned job still checks the specific recipe's labor. Recipe quantities are input units; 11 reserves the needed units in as few stacks as possible and fetches each stack once.

### Work orders

```
WorkOrder { recipeId, serial? (global identity), remaining, mode: once | maintain, threshold (for maintain: keep at least N in stock), priority, materialFilter?: materialClass | materialId }
```

- `maintain` orders are runnable when `stock(outputItemType, materialFilter) < threshold`; they never complete.
- Editing or removing an order cancels only the job belonging to that order; another order's running job keeps its progress. Reordering cancels no job and updates each running job's `orderIndex`. Global orders have non-reused serials, saved with their next serial; a global job is keyed by its order serial, independently of list position. Completion decrements that same order and renumbers remaining running jobs. Older saves without serials retain their immediate loaded state; serials are assigned in list order on first use.
- Orders on the workshop are executed in list order (the player reorders). A `WorkOrder` panel lists all orders in the fortress by workshop.
- Orders can be placed at a workshop or from the global orders panel (which picks any workshop of the type; a global order goes to the first idle workshop of the type, in entity order).
- Applying AddWorkOrder or EditWorkOrder normalises materialFilter: a known material id becomes its registry index; another string must be a material class; null means no filter. Numeric filters must be valid integer material indices. Invalid filters reject with bad_setting before changing orders or cancelling work. The same form is held by local and global orders and survives save/load. A brewing maintain order counts the selected plant's drink output for either id or index input.
- `materialFilter` restricts inputs (make steel axes, oak beds). A work order's material filter constrains only the input the first output takes its material from (`material.from.index`), or input 0 when that output's material is `fixed`, `alloy` or `plantDrink`.

### Quality

`roll = skill × 5 + rng.int(0, 40)`:

| Roll | Tier | Value multiplier | Notes |
|---|---|---|---|
| < 30 | poor | ×0.5 | Furniture gives no room value; weapons −20% damage; armor −20% |
| 30–54 | common | ×1.0 | |
| 55–74 | fine | ×1.5 | |
| 75–89 | superior | ×2.0 | |
| 90–104 | exceptional | ×3.0 | |
| ≥ 105 | masterwork | ×5.0 | Crafter gets `made_masterwork` thought; other dwarves get `saw_masterwork` on seeing it; the item is announced |

Level 20 rolls 100–140, so masterworks are common for legends and impossible below level 13. Meals use the cook's roll the same way; drinks and bars have no quality.

Seeing a masterwork follows 10's room-entry visibility and saved per-dwarf memory: floor items and installed furniture, excluding container contents and the crafter.

A masterwork that is later destroyed (melted, burned, sold is fine) gives its crafter a grief-like thought `masterwork_lost`; 15 gives this on 13's `ItemDestroyed` with the crafter id.

### Fuel and charcoal

- `wood_furnace`: `make_charcoal`: logs to charcoal bars, with the input and output counts of the recipe's content row, no fuel, no quality.
- Coal: `bituminous_coal` and `lignite` are minerals; `smelt` recipes for them produce `coal` bars in the count of the mineral's `yields` row, which count as fuel. A coal seam is worth finding.
- Fuel bars are consumed one per fuel job. Magma workshops never consume fuel, including for the steel reaction's workshop fuel (the reaction's own fuel input is still required: steel needs carbon).

### Professions

- `professionOf(dwarf)`: the profession name of the dwarf's highest skill (ties: the most recently raised); `Settler` if all skills are 0; `Child` for children; for a dwarf in a squad and on duty, the military title of their weapon skill (`Axedwarf`, `Hammerdwarf`, `Swordsdwarf`, `Speardwarf`, `Crossbowdwarf`, `Bowdwarf`, `Recruit` if none ≥ 1).
- Profession names are in the skills table. The profession sets the dwarf's glyph color hue in the units panel but not on the map.

## State

- `Workshop` components: `orders[]`, `currentJobId`, `suspended`, `assignedWorker`, `magmaPowered`, `lastBlockedReason`.
- `recipes`: the merged registry (content + generated + registered sets).
- `globalOrders: WorkOrder[]` (orders not bound to a workshop).
- Rng stream (quality rolls).

## Interfaces

### Reader

- `workshops.ordersOf(workshopId)`, `workshops.allOrders()`, `workshops.globalOrders()`
- `workshops.recipe(id)`, `workshops.recipesFor(workshopType)`, `workshops.isRunnable(recipeId, workshopId)` with the missing input named
- `workshops.professionOf(dwarfId)`, `workshops.militaryTitle(dwarfId)`
- `workshops.stockOf(recipeOutput)` (delegates to 13)
- `workshops.isMagmaPowered(workshopId)`
- `workshops.mealName(itemId)` — the dish name of a prepared meal, from its tier and its first ingredient; null for any other item

### Commands

`AddWorkOrder { workshopId | 0, order }`, `EditWorkOrder { workshopId, index, patch }`, `RemoveWorkOrder`, `ReorderWorkOrder { workshopId, from, to }`, `SetWorkshopWorker { workshopId, dwarfId | 0 }`, `SuspendWorkshop { workshopId, on }`. (`MeltItem` is 13's command; listed here only because the smelter consumes the flag.)

### Events consumed

`BuildingCompleted` (new workshop), `BuildingRemoved`, `JobCancelled`, `JobCompleted`, `SkillLevelUp` (profession cache), `CreatureDied` (clear the dead assigned worker and cancel its job).

### Events emitted

`ItemCrafted`, `MasterworkCreated { itemId, crafterId }`, `WorkOrderCompleted { workshopId, recipeId }`, `WorkshopBlocked { workshopId, reason[, container, input] }`, `WorkshopIdle { workshopId }`.

### Registrations

Job producer `workshops` (`craft`); panel `orders`; inspector section `building › workshop` (orders, current job and worker, inputs present, magma status); announcements: `WorkshopBlocked { missing_input }` (note, names workshop and missing input; once per workshop and reason until its next craft completion, saved in UI state), `MasterworkCreated` (note, names crafter and item), `WorkshopBlocked { no_magma }` (alert), `WorkshopBlocked { no_empty_container }` (alert, names the container: "A workshop is waiting for an empty barrel: every one holds something."); hint `hint_barrel` on that event for a barrel (03-content/ui-keymap-and-screens.md § Hints).

## Player-facing behavior

- The build menu lists a workshop only if a recipe names it or a job is worked at it (the butcher's shop and the kennel have jobs and no recipes), and `PlaceBuilding` refuses one that neither names ("Nothing can be made there yet."). A built workshop with no recipes shows its name, "No recipes in this version." and only `[x] take apart`.
- Clicking a workshop opens its panel: the recipe list with "makeable now" marked, the order list with counts and status, the assigned worker, suspend (after a confirmation), take apart. `[S-n]`, or a click on a recipe, adds an order.
- Orders panel: every order in the fortress with its count, mode and status ("waiting for log (0)", "no carpenter's workshop", "in progress", "done"); `+`/`-` change the selected order's count (`remaining`, or the threshold of a `keep ≥ N` order), `[r]` repeats the selected or the last finished order, `[S-n]` adds an order.
- An order is accepted even when no workshop can make it yet; the status line names what is missing at once (no workshop of the type, or the input a built workshop waits for), and the Jobs panel lists the orders no job serves.
- Adding an order opens a picker: a type-ahead filter over the recipes grouped by output category with the recent ones first, the quantity (1–999), the mode `once N` / `keep ≥ N`, the material filter and, for a global order, the workshop (any of the type, or one). One order makes N items: "5 doors" is one order with `remaining` 5.
- Opening the material picker selects the current filter, resolving an in-memory material index to its content id.
- Material filters list relevant input material classes and their materials, falling back to output classes when inputs provide none; brewing lists brewable plants.
- Hints: "Smelters and forges need fuel: a wood furnace makes charcoal", "Build a forge next to magma to skip fuel".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `MAGMA_POWER_LEVEL` | 4 | Magma level required below a magma workshop tile |
| `MELT_RETURN_PERCENT` | 60 | Of the item's bar cost returned |

Recipe times, bar costs per item and profession names are content.

## Extension points

- Glass and kilns: a `kiln` workshop with sand → glass recipes; the magma kiln exists already.
- Reaction chains with by-products (slag): additional outputs in the recipe row.
- Worker preferences (a workshop preferring the most skilled dwarf): the assignment bonus in 11 already favors skill; a `preferBest` flag could raise it.
- Custom player recipes: not planned; the recipe table is the extension point.
