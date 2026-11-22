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
| `craftdwarf` | crafts | crafts (figurines, rings, amulets, mugs) from stone, bone, shell, wood; totems from skulls; baskets, reed rope and wicker bucklers from reeds; bone splints and crutches |
| `jeweler` | gem_cutting | cut gems from rough gems |
| `mechanic` | mechanics | mechanisms from stone; assembles traps and levers (14 consumes mechanisms as build materials) |
| `wood_furnace` | smelting | charcoal from logs |
| `smelter` | smelting | bars from ore; alloys; melts marked metal items to bars |
| `alchemist` | alchemy | the laboratory: rune vials from glowcap and glowstone, and draughts ([25](25-runecraft.md) § Draughts) |
| `runeforge` | smithing | wands and staffs, one recipe of each per stone that carries a spell ([25](25-runecraft.md) § Channels); the runed robe and the circlet; a setting recipe per enchantment (25 § Setting stones) |
| `forge` | smithing | weapons, armor, picks, axes, anvils, chains, metal cages, bolts, metal blocks, metal furniture, metal crutches |
| `kitchen` | cooking | meals (easy 2 ingredients, fine 3, lavish 4), tallow from fat, soap |
| `still` | brewing | drinks from brewable plants (needs an empty barrel) |
| `tannery` | leather | leather from raw hide |
| `leatherworks` | leather | leather armor, bags, quivers, backpacks, leather rope |
| `loom` | textiles | thread from fiber (flax, sporecloth, wool); coarse thread from reed, cactus and nettle fiber, two to a thread; cloth from thread |
| `clothier` | textiles | clothing, cloth bags, ropes, padded armor |
| `farmers_workshop` | animal_care / farming | milking and shearing (08), cheese from milk, fiber from flax and sporecloth plants |
| `butcher` | butchery | corpse processing (09) |
| `kennel` | animal_training | training and taming (08) |
| `bowyer` | carpentry | bows and crossbows from wood; arrows from wood |
| `kiln` | crafts | bricks and pots, clay jugs and mugs from clay; glass blocks from sand; glass mugs; potash from logs; bone ash from bones and crushed fossils |

Magma variants: `magma_smelter`, `magma_forge`, `magma_kiln`; each has its base workshop's recipes. The `magma` building tag identifies a magma workshop for power detection, independently of whether a base workshop or recipes exist. A magma workshop is buildable only where at least one footprint tile has, directly below it, a tile with magma of level ≥ `MAGMA_POWER_LEVEL` (a channel over a magma pool or a pipe branch). Placement without that magma rejects with `bad_placement`; `no_magma` is reserved for workshop/job blocking after power is lost. It needs no fuel. If the magma drops below the level, its jobs block with `no_magma`.

Every workshop built of logs but the carpenter's may be built of stone blocks in place of its logs, two blocks a log, more slowly (14 § Placement, Workshops of stone): a treeless fortress still has its loom, tannery, leatherworks, kennel, bowyer and craftsdwarf.

The kiln is built of 3 `stone_block` (bricks are blocks) with `masonry`, and every kiln recipe burns a fuel. Its magma variant `magma_kiln` (3 magma-safe blocks, `variant of: kiln`) is buildable wherever the magma rule holds and needs no anvil: a Glasslands fortress, over one of its shallow magma pools, has a kiln that burns no fuel from its first days. The kiln's recipes use the skill `pottery` (labor `crafts`, profession Potter, attributes Agility and Wits): bricks, pots, clay jugs, clay and glass mugs, glass blocks, potash, bone ash and crushed fossils ([workshops-and-recipes.md](../03-content/workshops-and-recipes.md) § Kiln). Glass comes out of the kiln as blocks (2 sand loads → 1 block; with 1 potash, 2 sand loads → 2 blocks): there is no glass item between. Fired clay is its own material, `earthenware`; a brick is a block of `brick`.

### Recipes (content) and derived recipes

A recipe row has `id`, `name`, `workshop`, `inputs`, `outputs`, `skill`, `baseTicks`, `fuel`, `quality` and optional `container`, as defined in [Content rows](../04-implementation/schemas/content-rows.md). Input `match` accepts ids, tags and alternatives. `materials` restricts material ids; `materialProperty` selects brewable plants or magma-safe metals; `sameMaterial` requires every unit to share a material. Outputs using `stage: 'next'` take the input material's `nextStage`, falling back to that input when no next stage exists. An empty container input holds the output.

Fuel inputs use the item tag `fuel`. An input with `flagged: 'melt'` takes one whole marked item, including its stack, instead of counted units. Automatic melting selects workshop types whose recipes have such an input; recipe operation reads these constraints from data.

Generated at load from the minerals and metals tables:

- `smelt_<ore>`: 1 ore → `yields` bars (the ore's `yields` list; `galena` gives 1 `lead` and, with the silver yield's `permille`, 1 `silver`), fuel, no quality. A mineral row with no yields (`halite`, `giant_bone`) has none.
- `alloy_<metal>`: the metal's `alloyInputs` bars → `alloyOutput` bars, fuel, no quality (`bronze`: 1 copper + 1 tin → 2 bronze; `brass`: 1 copper + 1 zinc → 2 brass; `steel`: 1 iron + 1 flux stone + 1 fuel → 1 steel, on top of the workshop's fuel; `electrum`: 1 gold + 1 silver → 2 electrum; `pewter`: 1 tin + 1 lead → 2 pewter).
- `melt_<class>`: a marked metal item → `floor(stackCount × itemBarValue × MELT_RETURN_PERCENT / 100)` bars of its metal, fuel, no quality.
- `forge_<weapon|armor|tool>`: bars → the item; bar counts per item type; material from input; quality.

Authored beside them at the smelter: `make_steel_shell`, 1 iron bar + 3 `shell_piece` of any shell material (`chitin` included) + 1 fuel → 1 steel, and `make_steel_bone_ash`, 1 iron bar + 1 `bone_ash` + 1 fuel → 1 steel, both fuel and no quality as the alloy: shells and bone ash from the kiln stand in for the flux stone. At the kitchen, `crush_halite` crushes 1 `ore` of halite (rock salt) into 5 `salt`, and `make_soap` boils 1 tallow and 1 `potash` into 2 `soap` (a hospital supply, 17 § Patients and hospitals).

Melting takes the whole marked stack. Its bar cost comes from the weapon or armor row, else the matching metal recipe's bar inputs divided by its output units, else one bar. Explicit work orders run first; `autoMeltMarked` starts only when none starts and the smelter is idle.

### Operation

Magma power and stock are read each tick. Each tick, for each built, unsuspended workshop (the buildings that have recipes; the list is renewed whenever a building is added, removed or changed, and a building is given its workshop record the tick it is built):

1. If it has a `currentJobId`, nothing to do (11 runs the job). The exception is a current job that is `blocked` with `missing_input` while its order is no longer runnable (an input was taken after the job was created): the workshop cancels it (`JobCancelled { reason: 'order_not_runnable' }`), which releases what it had reserved and leaves delivered inputs where they lie, and goes on to step 2 in the same tick. A current job blocked with `missing_input` while its order is still runnable is looked at every `ORDER_AHEAD_TICKS` after its creation: when the order's inputs lie out of reach of the work tile (step 2: a door locked after the job was made), the workshop cancels it (`JobCancelled { reason: 'out_of_reach' }`), remembers the order as out of reach as step 2 does, and goes on to step 2 in the same tick. A job blocked for any other reason (`no_worker`, `unreachable`, `no_tool`, `no_magma`) is kept for that reason. The other exception is a current job that no worker has taken: every `ORDER_AHEAD_TICKS` after its creation, a current job that is `open` or `blocked` with no worker, no progress and nothing delivered is cancelled (`JobCancelled { reason: 'order_ahead' }`) when an order ahead of its own is runnable with its inputs within reach (step 2; the workshop's own orders in list order come before the global orders, and an automatic melt after both), and the workshop goes on to step 2 in the same tick, which starts the first runnable order. Workers take the most urgent job open to them (11 § Assignment), so a fortress with a standing backlog of more urgent work can leave a less urgent order's job unclaimed for months; without this the workshop's one job would hold back the orders the player put first (T-527: a bed order at priority 5 kept a cage order at the head of the list from rearming a cage trap). A job a worker holds, or one with progress or delivered inputs, is never cancelled for an order ahead.
2. Otherwise, walk its work orders in order; for the first order that is *runnable*, create the job `craft { workshopId, orderIndex }` with the recipe's inputs as job inputs (11 reserves them), `workTile = at` (the workshop's work tile), tool none, priority = the order's priority. An order is runnable when: its `remaining > 0` (or its `maintain` condition holds); every input filter matches at least `count` available items (13 `countAvailable(filter)`); if `fuel`, a fuel bar is available or the workshop is magma-powered; if `container`, an empty container is available; and if the workshop has an assigned worker restriction, that worker exists. The counts take an item wherever it lies, so before the workshop starts an order that is runnable by them, it searches for its inputs as the job's claim will (13 `findItems` from the work tile for a walker, honouring the connectivity labels): each recipe input, the fuel it burns together with the fuel its product takes (steel's one bar), and the empty container. If an input does not reach (the charcoal on the surface stockpile behind a locked gate), the order is skipped for the next runnable one, as an order whose inputs are missing is: the workshop remembers the order as out of reach, by its recipe, material filter and target type, with the item types in stock of which none is within reach (`charcoal_bar`; the input's own match when it names no type), for `OUT_OF_REACH_RETRY_TICKS`. Until then an order of that kind is not runnable and its inputs are not searched again; the panel says "charcoal out of reach". Another order of the recipe with another filter is searched for itself: steel axes out of reach do not hold back the iron axes ordered below them. A door, hatch or bridge that changes state (`BuildingStateChanged`) ends the time of every order the workshop remembers, so an order whose way opens is started at the next look; a new way dug to the goods waits for the time to run out. When the time is out and the workshop next starts an order, it searches again, and remembers the order again while the inputs still do not reach. The first time an order of a kind is remembered, the workshop emits `WorkOrderSkipped { workshopId, recipeId, input }` (`input` as in `WorkshopBlocked`); the search that renews it does not, so a skip is told once, whether or not the workshop has other work. The workshop keeps the memory after its time is out until an order of that kind starts a job (then a later skip is told again) or no order of that kind is left at the workshop or among the global orders. A workshop that would otherwise hold a job no worker could fill, its order counted runnable, works its next order meanwhile.
3. If no order is runnable, the workshop is idle; if an order is not runnable because of inputs, the order shows "waiting for <input>" in the panel and the workshop reports `WorkshopBlocked { reason }` once (not every tick). An order that waits for an input reports `missing_input` and names its missing recipe input match in `input` (the fuel shortage is `fuel`); an order whose only shortage is an empty container reports `no_empty_container` and names the container class in the event's `container` field (`barrel` for a brew); an order skipped because its inputs are out of reach reports `out_of_reach` and names the item types in `input` ('|'-joined: `charcoal_bar`). A container that holds anything, even a single stack of food or seed, is not empty, and a brew never empties one: the still waits until the player has another barrel made. The report comes once when the wait starts, and again only after the wait has ended (the workshop started a job or became idle) and a new one begins. When a previously blocked workshop has neither a running job nor a blocking reason, emit `WorkshopIdle { workshopId }` once and clear its remembered reason. Removing its last blocked order is one such transition; a workshop that stays idle does not repeat the event.

Job execution (producer `workshops`):

- `onStart`: nothing.
- Work: `baseTicks` skill-scaled by 11's work rate.
- `onComplete`: validate that every delivered input still exists, is unconsumed and is reserved to this job before consuming; a missing or foreign-held input goes back to fetching or blocks rather than producing output. Consume inputs (destroy items; the container input becomes the output's container); consume fuel if applicable; roll quality if `quality`; for a `spoilable` recipe, one draw on this system's stream at `max(0, ALCHEMY_MISHAP_PERMILLE − 10 × skill)` per mille, and when it lands every output is the spoiled draught (25 § Draughts; no other recipe draws); spawn outputs at the workshop's output tile (into the container if any, as many as it holds: a pot of 10 takes 10 units of a brew of 20, and the job completes only while the container has room for that many), each with the stone its recipe names (`stone: { from: 'input', index }`: that delivered input's material, read before the inputs are consumed; 25 § Channels); emit `ItemCrafted { itemId, quality, crafterId, workshopId, recipeId }`; decrement the order; if `remaining == 0` and not `maintain`, remove the order and emit `WorkOrderCompleted`.
- A **transform** recipe (`transform: true`, with the `enchants` row it sets in `enchant`) has no outputs. Its `onComplete` consumes every input but input 0, rolls quality, gives each delivered item of input 0 the enchantment at that tier through 13's `items.setEnchant`, drops it at the output tile and emits `StoneSet { itemId, enchantId, tier, smithId }` for it; the job's release then frees its reservation. It emits no `ItemCrafted` and no `MasterworkCreated`; experience and the order count down as for any recipe.
- At a building tagged `rune_work` (the runeforge, the laboratory), either kind of recipe emits `DeepsilverWorked { amount, tile }` for each consumed input whose material is a metal with a positive `runePressure` ([minerals-and-metals.md](../03-content/minerals-and-metals.md) § Metals): `amount` is the units consumed times `runePressure`, `tile` the building's origin, and the material is read before the input is consumed. No other building emits it. 18 raises the Deep's pressure by it (25 § Deepsilver).

A meal records the seasonings among its ingredients: `Item.seasoned`, the materials of its delivered ingredients (not its fuel or container) that carry the tag `seasoning` (`wyrmtongue`), ascending, read before the inputs are consumed; omitted when there is none. Two stacks of meals merge only with the same seasonings. `MealEaten` carries `seasoned` (the material ids) when the meal has any, and 15 gives `ate_wyrmtongue` beside the meal's own thought.

An output whose item type carries the tag `stuffed` (`bedding`, `pillow`) records its stuffing: `Item.stuffing`, the material of the recipe's last input (the straw's crop, `wool`, `feather`), read before the inputs are consumed, through `items.setStuffing` (13 § Value: feathers double its worth). Two stacks merge only with the same stuffing.

Delivered inputs stay reserved to the craft job while its order stands, through a need/threat interruption, a block or a reservation timeout. Only undelivered reservations use `RESERVE_KEEP_TICKS`; completed or cancelled jobs release all remaining reservations, and removing the order cancels the job. Haulers cannot remove delivered reserved inputs.

Suspending a workshop cancels its current job; the order waits until it is resumed. Setting or clearing its assigned worker also cancels the current job. On `CreatureDied` of an assigned worker, clear `assignedWorker` to 0 and cancel the current job exactly as `SetWorkshopWorker { dwarfId: 0 }` does; another eligible worker can run the retained order.

`SetWorkshopWorker` accepts a dwarf with any enabled labor used by a recipe of the workshop type, rather than its construction labor. The assigned job still checks the specific recipe's labor. Recipe quantities are input units; 11 reserves the needed units in as few stacks as possible and fetches each stack once.

### Work orders

```
WorkOrder { recipeId, serial? (global identity), remaining, mode: once | maintain, threshold (for maintain: keep at least N in stock), priority, materialFilter?: materialClass | materialId, targetType?: itemTypeIndex }
```

- `maintain` orders are runnable when `stock(outputItemType, outputMaterial) < threshold`; they never complete. The stock counts available units of the recipe's first output type (13 `countAvailable`: goods taken to the trade depot, forbidden or reserved do not count). When the recipe sets that output's material (its `fixed` material, its `alloy`, or the one material named by the input it takes its material from), it counts that material alone, whatever the order's filter: `distill` counts deepfire, `brew_hopped` hopped ale, `make_glass_block` glass blocks and not the fortress's stone blocks, `fire_bricks` bricks, `smelt_hematite` iron bars, `alloy_steel` steel bars, `knap_dagger_obsidian` obsidian daggers. Otherwise the order's material filter decides: a material counts that material, a class that class, and no filter every unit of the type (`make_stone_block` counts a block of any stone, glass and brick too; `make_table_bone` every table, of wood, stone or bone).
- Editing or removing an order cancels only the job belonging to that order; another order's running job keeps its progress. Reordering cancels no job and updates each running job's `orderIndex`. Global orders have non-reused serials, saved with their next serial; a global job is keyed by its order serial, independently of list position. Completion decrements that same order and renumbers remaining running jobs. Older saves without serials retain their immediate loaded state; serials are assigned in list order on first use.
- Orders on the workshop are executed in list order (the player reorders). A `WorkOrder` panel lists all orders in the fortress by workshop.
- Orders can be placed at a workshop or from the global orders panel (which picks any workshop of the type; a global order goes to the first idle workshop of the type, in entity order).
- Applying AddWorkOrder or EditWorkOrder normalises materialFilter: a known material id becomes its registry index; another string must be a material class; null means no filter. Numeric filters must be valid integer material indices. Invalid filters reject with bad_setting before changing orders or cancelling work. The same form is held by local and global orders and survives save/load. A brewing maintain order counts the selected plant's drink output for either id or index input.
- `materialFilter` restricts inputs (make steel axes, oak beds). A work order's material filter constrains only the input the first output takes its material from (`material.from.index`), or input 0 when that output's material is `fixed`, `alloy` or `plantDrink`, or the recipe has no outputs.
- A transform recipe is a setting generated from a row of `enchants` (25 § Setting stones), at the runeforge, or at the workshop the row names with that workshop's skill. The one such row is `fletched` (`weapons-and-armor.md` § Enchantments): the bowyer's `set_ammo_fletched`, 25 bolts or arrows + 1 feather, by `carpentry`, to-hit +5. It is a transform recipe by every rule here, and it emits `DeepsilverWorked` only at a `rune_work` building, as every recipe. A fletched set holds its one enchantment, so it never takes a rune setting after: seeking (emerald, +10) and fletching are a choice.
- A transform recipe's order is `once` only, since there is no output to count: AddWorkOrder or EditWorkOrder with `maintain` rejects with `precondition_failed`. Its input 0 takes only an item with no enchantment (the filter's `noEnchant`), so an enchanted item is never set again. `targetType` (an item id, normalised to its index, or null) narrows input 0 to one of its alternatives; any other value, or a target on a recipe that is not a transform, rejects with `bad_setting`. There is no order for one exact item: the search takes the nearest match.

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

Level 20 rolls 100–140, so masterworks are common for legends and impossible below level 13. Meals use the cook's roll the same way; drinks and bars have no quality. The roll, the tier bounds and the value multipliers are *unmeasured*.

Seeing a masterwork follows 10's room-entry visibility and saved per-dwarf memory: floor items and installed furniture, excluding container contents and the crafter.

A masterwork that is later destroyed (melted, burned, sold is fine) gives its crafter a grief-like thought `masterwork_lost`; 15 gives this on 13's `ItemDestroyed` with the crafter id.

### Spirits

- At the still, `distill`: 20 `drink` of the `drink/ale` or `drink/wine` group (one material: a barrel's worth, the input's `ale_or_wine` property, the material's `ale` or `wine` tag) + 1 fuel + an empty `barrel` container → 10 `drink` of `deepfire` in that barrel. The container rule is as it is: the job fetches its twenty units as any input (11's fetch takes them out of their barrel, from more than one barrel when no barrel holds twenty of one material), and the emptied source barrel is a free container again. A distillation therefore wants two barrels: the one it empties and the empty one it fills. Spirits are no input: deepfire is not of the ale or wine group.
- A `maintain` order counts deepfire (§ Work orders). Deepfire is the `drink/spirits` group (13 § Category tree; `items.md`), the Mountainhome's favourite (20, `caravan-goods.md` § Preferences), and makes its drinker tipsy (10 § Tipsy).
### Substitutes

A recipe that stands in for a regular one when its input is missing (shells for the flux stone, and the Making Do recipes after it) is a *substitute*, and stays worse than the recipe it stands in for. Per unit of its first output, a substitute takes at least as many input units (the job's own fuel counted as one) and at least as many ticks, or its output is worth less (the output item's `mult` × its material's value); it is never better on all three. A unit test holds each pair to it; every substitute recipe adds its pair to the test's list. The pairs: `make_steel_shell` for `alloy_steel` (6 units against 4, 200 ticks against 200, the same steel); `make_steel_bone_ash` for `alloy_steel` (4 units against 4, 200 ticks against 200: as dear as the stone, after a kiln job and a fuel for the ash); at the kiln, `fire_bricks` for `make_stone_block` (2 units a block against half a stone), `make_pot` for `make_barrel` (2 units against 1, the same 100 ticks, for a container of the same class that holds half), `make_jug` for `make_bucket` and `make_mugs_clay` for `make_mug_stone` (a fuel beside the one input). Of reeds, bones and scraps: `spin_coarse_thread` for `spin_thread` (2 fiber a thread against 1, 100 ticks against 80); `weave_basket` for `make_bin` (3 reeds against a log, the same 100 ticks, for a bin of half the room); `twist_reed_rope` and `cut_leather_rope` for `make_rope` (3 reeds, a rope worth a third of a linen one; 2 leather in 120 ticks against 2 thread in 100); `weave_wicker_shield` for `make_buckler_wood` (3 reeds against a log, 120 ticks against 100); `make_splint_bone` for `make_splint` (2 splints a bone pile against 4 a log); `make_crutch_bone` and `forge_crutch` for `make_crutch` (2 bone piles, or a bar and a fuel, against a log, and slower). The half fuels stand in for charcoal (§ Fuel and charcoal): they are dried on a rack, not made at a workshop, and the test holds the drying row to the rule per fuel burned: a peat brick is 2 peat loads and 14 rack-days a fuel (`dry_peat`), a dung cake 6 dung and 14 rack-days (`dry_dung`), against `make_charcoal`'s 1 log in 100 ticks, and both smoke. A pot is compared with a barrel, and a basket with a bin, as containers of one class. `make_stone_bed` and `make_stone_bed_straw` stand in for `make_bed` with an item of their own: a stone bed is judged by its rest (95 against the wooden bed's 100, 14 § Beds) and its worth (a `mult` of 2 against 5), so the check holds it to resting less and being worth less, whatever its inputs; since T-572 both take a pallet's materials beside the stone or the log. The same check holds the pallets, which no workshop makes, to resting less than the wooden bed (90 against 100). `make_bed_straw` is not a substitute: it is `make_bed` of straw, as `make_stone_bed_straw` is the stone bed's.

### Fuel and charcoal

- `wood_furnace`: `make_charcoal`: logs to charcoal bars, with the input and output counts of the recipe's content row, no fuel, no quality.
- Coal: `bituminous_coal` and `lignite` are minerals; `smelt` recipes for them produce `coal` bars in the count of the mineral's `yields` row, which count as fuel. A coal seam is worth finding.
- Fuel bars are consumed one per fuel job. Magma workshops never consume fuel, including for the steel reaction's workshop fuel (the reaction's own fuel input is still required: steel needs carbon).
- **Half fuels.** A fuel job takes one item tagged `fuel` (a coal or charcoal bar) beyond the bars the recipe takes into its product, or, when there is none, `HALF_FUELS_PER_JOB` items tagged `fuel_half` (a `peat_brick`, a `dung_cake`, dried on a rack: 14 § The drying rack). An order is runnable when either is; the job reserves what it takes, bars first. A half fuel is never steel's carbon. A bar the job burns is asked for together with the bars the recipe takes into its product, as one input of their units (T-659): steel's job has three inputs, an iron bar, a flux stone and two fuel bars, and the two come in one trip from one stack that holds two, not in two trips to the same bin, unless two single bars lie nearer in all (11 § Assignment step 4). When the job burns half fuels they stay an input of their own beside the carbon; on a magma-powered workshop by the time the job completes only the carbon is consumed and the other bar is let go. The automatic melt burns its fuel by the same rule.
- **Smoke.** A job that burns an item tagged `smoky` (both half fuels) emits `SmokyFuelBurned { workshopId, tile }` on completion, `tile` the workshop's centre: 05 makes the workshop smoky and 15 gives everyone within `SMOKE_RADIUS` `smoky_hall` (05 § Smoke).

### Smoke, salt and the smokehouse

- Workshop `smokehouse`: 3 `stone_block`, masonry, skill `cooking`, fuel. `smoke_meat`: 5 raw meat (one material) and a fuel → 5 `cured_meat` of that material; `smoke_fish` the same for raw fish → `cured_fish`. On the completion of either, every fortress dwarf within `SMOKE_RADIUS` (Chebyshev, same level) of the smokehouse's centre who is not its worker gets `smelled_smokehouse` ("Smells of smoked {meat}. Hungry now.", `{meat}` the species of the meat: the thought's `detail`) from 15, and `SMOKEHOUSE_HUNGER` hunger from 10.
- Kitchen: `salt_meat` (5 raw meat of one material + 1 salt → 5 cured meat, no fuel) and `salt_fish` (the same for fish), beside `crush_halite`. Cured meat and fish never rot and are worth twice the raw (13 § Curing); they are ingredients.
- `salt` carries the tag `seasoning`, so a meal with it records it in `Item.seasoned` (§ Operation). `workshops.mealName` puts "salted" before the name of a salted meal ("salted boar stew"), and 15 gives `ate_salted_meal` on a `MealEaten` seasoned with salt, beside the meal's own thought: a salted meal is worth a thought a tier up, an easy meal's +2 becoming +3.

### Feasts

- Kitchen `cook_feast`: 1 `salt`, `honey` or `plant_food` of wyrmtongue (the seasoning) + 6 ingredients from distinct stacks → 20 `feast` (one stack of 20 servings, of the first ingredient's material), `Q` yes, 400 ticks, no fuel. The seasoning is the first input so that the job fetches it before the six ingredients, which would otherwise take the only salt as one of their own; a salt or wyrmtongue feast is seasoned as a meal is (§ Operation).
- Its `ItemCrafted` (`recipeId` `cook_feast`) gives everyone `held_a_feast` (15); each serving eaten gives its eater `feasted` (10 § Feasts).

### Professions

- `professionOf(dwarf)`: the profession name of the dwarf's highest skill (ties: the most recently raised); `Settler` if all skills are 0; `Child` for children; for a dwarf in a squad and on duty, the military title of their weapon skill (`Axedwarf`, `Hammerdwarf`, `Swordsdwarf`, `Speardwarf`, `Crossbowdwarf`, `Bowdwarf`, `Recruit` if none ≥ 1).
- Profession names are in the skills table. The profession sets the dwarf's glyph color hue in the units panel but not on the map.

## State

- `Workshop` components: `orders[]`, `currentJobId`, `suspended`, `assignedWorker`, `magmaPowered`, `lastBlockedReason`, and `outOfReach` (§ Operation 2: each remembered recipe id, the item types named and the tick until which it is skipped; absent when none).
- `recipes`: the merged registry (content + generated + registered sets).
- `globalOrders: WorkOrder[]` (orders not bound to a workshop).
- Rng stream (quality rolls).

## Interfaces

### Reader

- `workshops.ordersOf(workshopId)`, `workshops.allOrders()`, `workshops.globalOrders()`
- `workshops.recipe(id)`, `workshops.recipesFor(workshopType)`, `workshops.isRunnable(recipeId, workshopId)` with the missing input named
- `workshops.professionOf(dwarfId)`, `workshops.militaryTitle(dwarfId)`
- `workshops.orderStock(order)` — the stock a `maintain` order compares with its threshold, counted as the operator counts it (§ Work orders; delegates to 13)
- `workshops.isMagmaPowered(workshopId)`
- `workshops.mealName(itemId)` — the dish name of a prepared meal, from its tier and its first ingredient, "salted" before a salted one; null for any other item

### Commands

`AddWorkOrder { workshopId | 0, order }`, `EditWorkOrder { workshopId, index, patch }`, `RemoveWorkOrder`, `ReorderWorkOrder { workshopId, from, to }`, `SetWorkshopWorker { workshopId, dwarfId | 0 }`, `SuspendWorkshop { workshopId, on }`. (`MeltItem` is 13's command; listed here only because the smelter consumes the flag.)

### Events consumed

`BuildingCompleted` (new workshop), `BuildingRemoved`, `JobCancelled`, `JobCompleted`, `SkillLevelUp` (profession cache), `CreatureDied` (clear the dead assigned worker and cancel its job), `BuildingStateChanged` (end the time of the orders remembered as out of reach, § Operation 2).

### Events emitted

`ItemCrafted`, `SmokyFuelBurned { workshopId, tile }` (§ Fuel and charcoal), `MasterworkCreated { itemId, crafterId }`, `StoneSet { itemId, enchantId, tier, smithId }` (a transform recipe), `DeepsilverWorked { amount, tile }` (a `rune_work` building consumed a metal with `runePressure`; 25 § Deepsilver), `WorkOrderCompleted { workshopId, recipeId }`, `WorkshopBlocked { workshopId, reason[, container, input] }`, `WorkshopIdle { workshopId }`, `WorkOrderSkipped { workshopId, recipeId, input }` (§ Operation 2).

### Registrations

Job producer `workshops` (`craft`); panel `orders`; inspector section `building › workshop` (orders, current job and worker, inputs present, magma status); announcements: `WorkshopBlocked { missing_input }` (note, names workshop and missing input; once per workshop and reason until its next craft completion, saved in UI state), `MasterworkCreated` (note, names crafter and item), `WorkshopBlocked { no_magma }` (alert), `WorkshopBlocked { no_empty_container }` (alert, names the container: "A workshop is waiting for an empty barrel: every one holds something."), `WorkOrderSkipped` (note, names the workshop, the recipe and the inputs out of reach: "Smelter #1 skips its make steel order: no charcoal within reach."; once per skip, as § Operation 2 emits it; `WorkshopBlocked { out_of_reach }` has no line of its own); hint `hint_barrel` on that event for a barrel (03-content/ui-keymap-and-screens.md § Hints).

## Player-facing behavior

- The build menu lists a workshop only if a recipe names it or a job is worked at it (the butcher's shop and the kennel have jobs and no recipes), and `PlaceBuilding` refuses one that neither names ("Nothing can be made there yet."). A built workshop with no recipes shows its name, "No recipes in this version." and only `[x] take apart`.
- Clicking a workshop opens its panel: the recipe list with "makeable now" marked, the order list with counts and status, the assigned worker, suspend (after a confirmation), take apart. `[n]`, or a click on a recipe, adds an order.
- Orders panel: every order in the fortress with its count, mode and status, each by its own material filter and target ("waiting for log (0)", "charcoal out of reach", "no carpenter's workshop", "in progress", "done"); `+`/`-` change the selected order's count (`remaining`, or the threshold of a `keep ≥ N` order), `[r]` repeats the selected or the last finished order, `[n]` adds an order.
- An order is accepted even when no workshop can make it yet; the status line names what is missing at once (no workshop of the type, or the input a built workshop waits for), and the Jobs panel lists the orders no job serves, an order skipped as out of reach among them with its reason.
- Adding an order opens a picker: a type-ahead filter over the recipes grouped by output category with the recent ones first, the quantity (1–999), the mode `once N` / `keep ≥ N`, the material filter and, for a global order, the workshop (any of the type, or one). One order makes N items: "5 doors" is one order with `remaining` 5.
- Opening the material picker selects the current filter, resolving an in-memory material index to its content id.
- Material filters list relevant input material classes and their materials, falling back to output classes when inputs provide none; brewing lists brewable plants; a transform recipe lists the classes of input 0's alternatives.
- A selected transform order (setting a stone) has a `set in: any` action beside its material: each click steps the target type through input 0's alternatives and back to any. Its mode cannot become `keep ≥ N` ("Setting a stone is a once order: there is nothing to keep in stock."), and the picker adds it as `once`.
- Hints: "Smelters and forges need fuel: a wood furnace makes charcoal", "Build a forge next to magma to skip fuel".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `MAGMA_POWER_LEVEL` | 4 | Magma level required below a magma workshop tile (*unmeasured*) |
| `MELT_RETURN_PERCENT` | 60 | Of the item's bar cost returned (*unmeasured*) |
| `ORDER_AHEAD_TICKS` | 100 | How often a workshop's untaken current job looks for a runnable order ahead of it, and a blocked one at its inputs' reach (*unmeasured*) |
| `OUT_OF_REACH_RETRY_TICKS` | 100 | How long a workshop skips an order whose inputs lie out of reach before it searches again; as 11's `BLOCKED_RETRY_TICKS`, so an order waits no longer for its inputs than a blocked job did (*unmeasured*) |
| `HALF_FUELS_PER_JOB` | 2 | Half fuels (`fuel_half`) a fuel job burns in place of one bar (*unmeasured*) |
| `SMOKEHOUSE_HUNGER` | 5 | Hunger a dwarf near a smokehouse gains when it finishes a batch (*unmeasured*) |

Recipe times, bar costs per item and profession names are content.

## Extension points

- Reaction chains with by-products (slag): additional outputs in the recipe row.
- Worker preferences (a workshop preferring the most skilled dwarf): the assignment bonus in 11 already favors skill; a `preferBest` flag could raise it.
- Custom player recipes: not planned; the recipe table is the extension point.
