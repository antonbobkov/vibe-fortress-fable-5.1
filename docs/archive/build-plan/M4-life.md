# M4 — Life

**Goal:** the year-one loop: plants and farming, animals, foraging, needs and activities, the first workshops, morale, the hearth, the embark supplies in play. **Gate:** `pl_*`, `an_*` (except `an_predator`, `an_tame`), `fo_*` (except `fo_hunt`, `fo_no_ammo`), `dw_*` (`dw_starve` up to the `Starvation` announcement; its death assertion is M6), `ws_bed`, `ws_maintain`, `mo_*`, `bd_hearth`, e2e `farm-plot-and-orders`.

Spec: [`07`](../../02-systems/07-plants-and-farming.md), [`08`](../../02-systems/08-animals-and-domestication.md), [`09`](../../02-systems/09-hunting-gathering-fishing.md), [`10`](../../02-systems/10-dwarves.md), [`12`](../../02-systems/12-workshops-and-professions.md), [`15`](../../02-systems/15-happiness-and-morale.md), [`14`](../../02-systems/14-buildings-and-rooms.md) § hearth; algorithms `environment.md` § Plant growth, `creature-brains.md` § Dwarf, § Animal, `economy.md` § Workshop operation.

## T-M4-01 Plants: species data, growth, crops, plots, plant and harvest jobs (L)

Needs: M3. Produces: `src/systems/plants/{index,state,reader,growth,plots,producer}.ts`, `Crop` entities, `SetPlotCrop`, `DesignateHarvest`, light and season and temperature rules, yields with skill, `SEEDS_PER_HARVEST`, frost death, wilt, `PlotNeedsSeeds`.
Spec: `07` § Growth, § Farm plots, § Seeds; `plants.md`; algorithm § Plant growth.
Tests: scenarios `pl_cave_cycle`, `pl_light_rule`, `pl_frost`; unit: growth per hour under each blocking condition; stage lengths per species; yield formula with skill 0/5/10; `light_mismatch` rejection; mixed plot refusal at placement.

## T-M4-02 Plants: trees, saplings, shrubs, grass, ash (M)

Needs: 01. Produces: sapling aging, regrowth, shrub gather yields and timers, wild seed chance, grass regrowth over `bareSoil`, ash expiry, `GrassGrazed` handling.
Spec: `07` § Trees, § Shrubs, § Grass, § Ash; `03` chop and gather item yields now real.
Tests: scenario `pl_regrowth`; unit: chop yields per species range; gather yields and `wildSeedPermille` statistics; grass regrowth needs a grass neighbor; ash blocks regrowth for the duration.

## T-M4-03 Animals: species, wild brain, spawning, leaving (L)

Needs: M3. Produces: `src/systems/animals/{index,state,reader,brain,spawn}.ts`, `Wild` component, perception with line of sight, states idle/graze/wander/flee/sleep/leave, daily spawning by biome and season with caps, `MAX_CREATURES`, trait modifiers (`beastwood`, `serene_vale`), cavern fauna initial and respawn on breach.
Spec: `08` § Perception and brains, § Wild behavior, § Wild spawning; `creatures.md` wild and cavern rows; algorithm § Animal brain.
Tests: scenarios `an_flee`; unit: state transitions table-driven; spawn respects caps and distance; nocturnal rest windows; `leave` at lifetime; think interval by dwarf distance. (`hunt`/`attack` states are wired but only exercised in M6 when combat exists: assert they set `combat.setTarget` through a stub.)

## T-M4-04 Animals: tame behavior, pastures, condition, breeding, products, slaughter marking (M)

Needs: 03, M2-03. Produces: `Tame` component, pasture assignment and grazing, condition and starvation death (through a direct `CreatureDied` emit until M6's health exists: the animals system kills starving animals itself and M6 re-routes through health), breeding and juveniles, product timers and `milk_animal`/`shear_animal`/`collect_egg` jobs (workshop delivery in T-M4-12), nest boxes and hatching, `MarkSlaughter` (the slaughter job arrives with the butcher in T-M4-11), pets and adoption, breeding caps, `AssignPasture`, `AssignAnimal`, `NameAnimal`.
Spec: `08` § Tame behavior, § Pastures and feeding, § Breeding, § Products, § Pets; `jobs.md` § Animals.
Tests: scenarios `an_pasture`, `an_starve`, `an_breed`; unit: condition arithmetic; breeding cap stops pregnancy; egg laying only with nest boxes; hatching needs a rooster; adoption rate over 100 seasons.

## T-M4-05 Dwarves: needs, hourly update, thresholds, interrupts (M)

Needs: M3-07. Produces: `Needs` component update on `HourPassed` with Endurance and thirst modifiers; want and critical thresholds; `interruptFlag`; `NeedCritical`, `Starving`, `Starvation` (damage consumer arrives in M6; until then `Starvation` only announces and the acceptance `dw_starve` death assertion is tagged M6), sleep schedule.
Spec: `10` § Needs; algorithm § Dwarf brain (hourly).
Tests: unit: rates per need with Endurance 20/50/80; threshold crossing sets the flag exactly once; heatwave thirst; scenario `dw_needs` (with food and drink items placed and the eat/drink activities from T-M4-06).

## T-M4-06 Dwarves: activities eat, drink, sleep, social, comfort, joy; behavior selection complete for civilians (L)

Needs: 05, M2. Produces: `brain/activities.ts` per `creature-brains.md` § startNeed; dining seat search; water sources (wells, adjacent water); beds and bedroom ownership; talking with relationships and friends; sitting; hearth visits; `MealEaten/DrankAlcohol/DrankWater/Slept/Talked/Sat/HearthVisited`; `NEED_DEFER_PRIORITY` rule; `retreat`/`flee`/`patient`/`duty` branches present but inert until M6.
Spec: `10` § Eating and drinking, § Sleeping, § Social, comfort, joy, § Behavior selection, § Relationships.
Tests: scenarios `dw_sleep`, `dw_critical_interrupt`, `dw_starve` (up to the announcement), `dw_child` (with a spawned child), `dw_title` (thought part waits on T-M4-13); unit: food preference order; drink fallback order and the `outdoors` flag; friend after `FRIEND_TALKS`; a priority-1 job beats a want-level need.

## T-M4-07 Dwarves: titles, children, aging, clothing slots (S)

Needs: 06. Produces: `AssignTitle`, `RenameDwarf`, `SetSchedule`, title effects hooks (Thane thought source registered in T-M4-13; Broker and Chief Medic read in M6/M7), `YearPassed` aging and `DwarfBecameAdult`, `Equipment` clothing slots with `unclothed` detection, professions title cache hook.
Spec: `10` § Titles, § Children and aging, § Clothing.
Tests: unit: one holder per title; child labors fixed; adult at 12; clothing slots from embark clothing items.

## T-M4-08 Workshops: operation, work orders, quality, professions (L)

Needs: M2-05, M2-04. Produces: `src/systems/workshops/{index,state,reader,operate,orders,quality,professions}.ts`, `Workshop` component, recipe registry merge, `craft` job producer and `onComplete`, `AddWorkOrder/EditWorkOrder/RemoveWorkOrder/ReorderWorkOrder/SetWorkshopWorker/SuspendWorkshop`, global orders, quality roll, `ItemCrafted`, `MasterworkCreated`, `WorkshopBlocked` once per reason change, profession titles.
Spec: `12` § Operation, § Work orders, § Quality, § Professions; algorithm `economy.md` § Workshop operation; `jobs.md` § Workshops.
Tests: scenarios `ws_bed`, `ws_maintain` (kitchen recipe from T-M4-09); unit: runnable predicate for every input kind; quality distribution over 2,000 rolls at levels 0/6/13/20; material resolution `from_input`/`fixed`/`plantDrink`; profession tie-break by `lastRaised`.

## T-M4-09 Workshops: carpenter, mason, craftsdwarf, kitchen, still, farmer's workshop recipes (M)

Needs: 08. Produces: the recipe rows of those six workshops live (content already loaded; this task verifies each recipe's inputs/outputs and adds the `container` handling for the still and the bag for flour, meal naming from `names.md` § Dish words, produce quality on meals).
Spec: `workshops-and-recipes.md` sections for those workshops; `items.md` § Meal ingredients.
Tests: unit: every recipe of the six workshops executes on a fixture with exactly the documented inputs and outputs (table-driven from the JSON); brewing needs an empty barrel; drink units 20; meal name generation.

## T-M4-10 Butcher, tannery, loom, clothier, leatherworks, kennel, bowyer: buildings and recipes (S)

Needs: 09. Produces: the remaining non-metal workshops buildable with their recipes verified (smelter, forge, wood furnace, mechanic, jeweler are M5).
Tests: unit: table-driven recipe execution for these workshops (bowyer bows with yew power flag; clothier bandages ×4; tannery hide → leather material).

## T-M4-11 Foraging: gather zones, fishing, butchery, slaughter (M)

Needs: 03, 09, 10. Produces: `src/systems/foraging/{index,state,reader,fishing,butcher}.ts`, gather zone auto-designation, water bodies and pools, `fish` job, `butcher` job with yields, `slaughter` job (leads the animal to the butcher), `SetHuntable` (hunting itself is M6: it needs projectiles).
Spec: `09` § Gathering, § Fishing, § Butchery; `08` § Slaughter.
Tests: scenarios `fo_fish`, `fo_butcher_rot` (rot arrives in T-M4-15: tag the skeleton assertion to that task and run it there); unit: water body flood fill and staleness; pool regeneration and river double rate; butcher yields for five species sizes; slaughter path.

## T-M4-12 Animal product jobs at the farmer's workshop (S)

Needs: 04, 09. Produces: `milk_animal`, `shear_animal` execution (lead the animal, produce items), `make_cheese` verified, `collect_egg` hauling.
Tests: unit: milk every `milkDays`; wool per season; eggs collected when `autoCollectProducts`.

## T-M4-13 Morale: thoughts, mood, tiers, hall spirit, sulks (L)

Needs: 06, 07. Produces: `src/systems/morale/{index,state,reader,thoughts,mood,sulks}.ts`, `Mood` component, declarative triggers from the thoughts table (event + predicate), `ThoughtSource` registration and the 10 sources (friend died, etc. as far as events exist), decay shapes, caps, personality scaling, standing thoughts (needs, no bedroom, unclothed, miasma stub, unburied stub), mood formula, tiers and productivity, `HallSpiritChanged`, sulks with the five kinds (`hoard` moves an item; `break` destroys furniture through 14; `argue` adds grudges), `got_it_out`.
Spec: `15` (all); `personality-and-thoughts.md`; `10` § Titles (Thane thought).
Tests: scenarios `mo_floor`, `mo_misery_needs`, `mo_caps`, `mo_hall_spirit` (with a hearth from T-M4-14), `mo_grief` (with a scripted death event until M6); property `mood bounds`; unit: every thought row's trigger matches its event fixture (table-driven from JSON); decay curves; `stoic` halves negatives; sulk kind by trait; one sulk per `SULK_DAYS`.

## T-M4-14 The hearth and hearth hall (S)

Needs: M2-06, 13. Produces: hearth building completion → `HearthLit`, light and warmth overrides, implicit 5×5 hall, `hearth_hall` zone requirement, hearth hall tier bonus in the mood formula, `hearth_is_home` rejection, `Home` key centering.
Spec: `14` § Special buildings (hearth); `15` § Mood (`hearthBonus`); `24` § Map keys.
Tests: scenario `bd_hearth`; unit: tier bonus 0..10; idle dwarves gather in the hall.

## T-M4-15 Items: rot queue, miasma, corpses (M)

Needs: 13. Produces: rot stages with location and temperature speed, bucket queue, `ItemRotStage/ItemRotted`, corpses to skeletons, miasma tiles and `MiasmaSpread`, `in_miasma` standing thought, `CorpseCreated` on `CreatureDied` (animals dying of starvation, slaughter).
Spec: `13` § Rot, § Corpses; algorithm `jobs-and-hauling.md` § Rot queue.
Tests: scenarios `it_rot`, `it_miasma`, `fo_butcher_rot` (complete); unit: bucket re-queue on move; frozen larder stops rot; container speed 25%.

## T-M4-16 Embark supplies and animals in play; hints; the year-one hints (S)

Needs: 04, 06, M2-08. Produces: embark animals become real tame animals (pasture-less), hint system (`register.hint`, hourly evaluation, once, saved), the twenty hints from `ui-keymap-and-screens.md` with their triggers wired to readers.
Spec: `24` § Hints; `ui-keymap-and-screens.md` § Hints.
Tests: unit: each hint's trigger predicate against a fixture state (table-driven); shown once; disabled by setting. Scenario `ui_hints_once` (headless variant through the announcement listener).

## T-M4-17 Panels: orders, animals, mood, population stub, zones farm settings, hospital placeholder (M)

Needs: 08, 04, 13, M2-09. Produces: `panels/{orders,animals,mood}.ts`, farm plot season dropdowns, pasture capacity line, workshop panel (recipes, orders, worker, suspend), building inspection delegating to workshops.
Spec: `ui-screens/panels.md` (Orders, Animals, Mood, Zones farm settings), `12` § Player-facing behavior.
Tests: unit golden cell buffers per panel; e2e `farm-plot-and-orders`: dig a chamber, place a farm plot, set dimcap for all seasons (seeds from embark), add a still work order `maintain ≥ 20 dimcap ale`, run at 4× for 40 days, assert `readers.items.count(drink) ≥ 20` and a crop harvested event.

## T-M4-18 Compositor: crops, saplings, shrubs, grass colors, animals, hearth pulse (S)

Needs: 01–04, 14. Produces: compositor additions and glyphs per `glyphs-and-colors.md`; crop brightness by stage; mature crop blink.
Tests: golden render `m4-farm.json`.

## T-M4-19 Property generator: farming, orders, animals, titles (S)

Needs: 17. Extend with `SetPlotCrop`, `AddWorkOrder` (valid recipes), `AssignPasture`, `MarkSlaughter`, `AssignTitle`, `SetStandingOrder`. Determinism and round-trip must hold.

## T-M4-20 Gate M4 (S)

Needs: all. `reports/M4-gate.md`; `current-milestone: 5`. The gate report must include the year-one table of `balance.md` § Year-one expectation evaluated by a scripted headless run (`test/scenarios/year_one.scenario.ts`, milestone 4): report which rows hold; rows needing later milestones (caravans, immigrants, raids) are listed as deferred.
