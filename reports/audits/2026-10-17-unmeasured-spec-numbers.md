# Audit: the spec numbers nobody has measured

**Task:** T-333 · **Date:** 2026-10-17 · **Commit examined:** master `c6ae2dd` · **Kind:** audit and spec marks; no source, test, fixture, constant value or content value was changed · **Source:** [the process review](2026-10-15-process-review.md) § 1

## The answer

- **363 tuning constants** in the `## Tuning constants` tables of `docs/02-systems/01` to `24` were checked, one by one, against the filed reports under `reports/audits/` and the balance record [`balance-status.md`](../../docs/balance-status.md). **323 are unmeasured**; 36 were measured in the game; 4 are not tuning numbers (a physical fact and three editor bounds).
- Outside those tables, nine numeric rules of the system documents (the season growth multipliers, the need table's purpose rates and critical thresholds, the quality roll, the rot stages, the mood tiers and productivity factors, the combat formulas, the threat schedule, the reputation bands and the path costs) and **26 figures of the balance model** are unmeasured as well.
- Every one is now marked *unmeasured* beside it in the spec, as [`agent-workflow.md`](../../docs/process/agent-workflow.md) § Working asks. The mark sits in the Meaning cell of a tuning row, or in a sentence under a rule table; no value cell changed. The threat schedule, an exported content table, carries its mark in its prose.
- The measured numbers are the ones the balance and wildlife work of October chased: the need cycle, the mood formula, immigration's wave size, the pasture, clotting and the wild animals' release rules. What a fortress lives on beyond those, **its farms, its work rate, its fights, its wounds and its raids**, rests on numbers nobody has measured. Those five are the top five, and each now has a measurement task (T-364 to T-368).
- Reading the numbers against each other turned up four contradictions in the spec: the balance model's seven hours of sleep against its own measured time share, four sums of the balance model that the rules do not give, a stale paragraph in its wild-animals section, and thirteen rows of `balance-status.md` that sit above its title. Each has a work file (T-369 to T-372).

## How each number was judged

- **Measured**: a filed report or a balance instrument ran the game and recorded the outcome this number governs, by name or by the quantity it sets (the ticks a dwarf spends eating are `EAT_TICKS`). The report and section are listed under [Measured](#measured). A measurement that disagrees with the spec still counts as measured; where it disagrees, a contradiction is filed.
- **Derived**: a figure computed from measured numbers by a rule the spec states (the balance model's 0.48 food units a day from the measured hunger rate). A figure derived from an unmeasured number is unmeasured, and is marked: the mining times of the balance model follow from `DIG_BASE_TICKS` and `SKILL_TIME_BONUS_PERCENT`, which nobody measured.
- **Not a tuning number**: a value no measurement could move: `SNOW_C` (water freezes at 0 °C), and the bounds of two editors (`BREEDING_CAP_MIN`, `BREEDING_CAP_MAX`, `HOSPITAL_SUPPLY_MAX`).
- **Unmeasured**: everything else, including numbers a report *mentions* without measuring. The walking-speed report lists some thirty time limits and radii and says of each that it was left alone; that is a reading, not a measurement. A unit test that checks a rule uses its number; it does not measure what the number does to a fortress, so a unit test is never the evidence here.
- Three rows repeat a constant defined in another document (`SKILL_TIME_BONUS_PERCENT` in 11, `THREAT_RADIUS` in 16, `FLEE_BLOOD_PERCENT` in 08). They carry the mark too, and are counted once, where the constant is defined.
- The values in the spec and in `src/systems/*/constants.ts` were compared mechanically: every literal value agrees. Three spec rows have no single constant in the source (`CAVERN_OPEN_FRACTION` and `RESTLESS_PER_NIGHT` are ranges, `NEED_WEIGHT` lives in the mood code); they are judged from the spec.
- Content data tables under `docs/03-content/` (creatures, items, recipes, plants) were not reviewed number by number: they are thousands of values and outside this task. Where a balance-model figure rests on one of them, the figure is judged.

## Count by system

| System | Constants checked | Measured | Not a tuning number | Unmeasured |
|---|---:|---:|---:|---:|
| 01-world-generation | 18 | 0 | 0 | 18 |
| 02-embark-and-loadout | 6 | 0 | 0 | 6 |
| 03-terrain-and-mining | 14 | 0 | 0 | 14 |
| 04-fluids | 13 | 0 | 0 | 13 |
| 05-materials-and-temperature | 18 | 0 | 0 | 18 |
| 06-weather-and-seasons | 7 | 0 | 1 | 6 |
| 07-plants-and-farming | 8 | 1 | 0 | 7 |
| 08-animals-and-domestication | 27 | 8 | 0 | 19 |
| 09-hunting-gathering-fishing | 21 | 0 | 0 | 21 |
| 10-dwarves | 27 | 9 | 0 | 18 |
| 11-jobs-and-labor | 11 | 0 | 0 | 11 |
| 12-workshops-and-professions | 2 | 0 | 0 | 2 |
| 13-items-and-storage | 12 | 0 | 0 | 12 |
| 14-buildings-and-rooms | 12 | 0 | 0 | 12 |
| 15-happiness-and-morale | 8 | 6 | 0 | 2 |
| 16-combat | 22 | 0 | 0 | 22 |
| 17-health-and-medicine | 24 | 4 | 1 | 19 |
| 18-threats-monsters-and-raids | 26 | 0 | 0 | 26 |
| 19-defense-and-traps | 8 | 0 | 0 | 8 |
| 20-trade-and-caravans | 25 | 0 | 0 | 25 |
| 21-immigration | 21 | 8 | 0 | 13 |
| 22-pathfinding-and-spatial | 8 | 0 | 0 | 8 |
| 23-rendering | 11 | 0 | 0 | 11 |
| 24-ui-and-input | 14 | 0 | 2 | 12 |
| **All** | **363** | **36** | **4** | **323** |

## Marked outside the tuning tables

| Document | Section | What is unmeasured |
|---|---|---|
| 06 | Seasons | the growth multipliers (100%, 120%, 80%, 0%) and the daylight hours |
| 10 | Needs | the purpose rates (+2 idle, −10 working), the critical thresholds (85, 85, 90), joy's relief from mist, a fine meal and a masterwork |
| 12 | Quality | the roll `skill × 5 + rng(0, 40)`, the tier bounds and the value multipliers (×0.5 to ×5) |
| 13 | Rot | the stage fractions (50%, 100%, 150%) and the speed factors |
| 15 | Tiers and effects | the tier bounds (20, 40, 65, 85) and the productivity factors (80% to 115%) |
| 16 | Melee resolution | the terms of the hit, parry, block, damage and Toughness formulas, and the ranged hit |
| 18 | Schedule | the schedule by peril, with every interval, base, per-renown term and cap of `threat-schedules.md` |
| 20 | Reputation effects | the bands (−50, 0, 50) |
| 22 | Costs | the water, snow, `restricted`, `web` and door costs |
| balance.md | Time and pace | the room and corridor times; the year-1 400 tiles, 6 workshops and 10 bedrooms |
| balance.md | Needs and consumption | purpose: "dislike idling for more than a day" |
| balance.md | Food chain | a farm tile's 0.25 plants a day and its seed; a hunter's deer a day; a fisher's 0.4 fish and "feeds 4 dwarves"; milk; eggs; the plot sizes for twenty dwarves |
| balance.md | Drink chain | the 13-tile still plot and brewing jobs; a barrel a day, seven in circulation |
| balance.md | Wood and fuel | 40 saplings a day |
| balance.md | Mining and metal | every step time; a vein as 100 minutes of a smith's work |
| balance.md | Wealth curve | year 5; the renown curve 5 → 15 → 30 → 75; raid size at peril 2 |
| balance.md | Combat pace | the whole section (a note, and the three bullets) |
| balance.md | Mood floor | one sulk a week; the peak of 70 |
| balance.md | Immigration | the 70% chance |
| balance.md | Trade | the caravan value and the margin of the worked example |
| balance.md | Year-one expectation | the first ambush or raid warning on day 56 at peril ≥ 2; the river frozen at temper ≥ 1 |

The figures of the balance model that were measured are not marked: the walking speed, the need table's other rows and its time shares, the wealth curve of years 1 to 3, mood's steady mean, immigration's waves, the wild-animal figures and the many-seed survival table, and pasture feeding. [`balance-status.md`](../../docs/balance-status.md) holds their latest figures.

## The list, ranked by how much play depends on it

Rank 1 is the number play depends on most. Numbers that play depends on for the same reason share a row and its line of why; the row lists each with its value and its system document. Tier 1 is the top five; tier 2 reaches every fortress less directly; tier 3 matters in some fortresses or once a fortress keeps soldiers, traps or animals; tier 4 is the world, the embark, the engine and the screen.

| Rank | Tier | Group | Numbers | Why play depends on it | Constants (value, document) |
|---:|---:|---|---:|---|---|
| 1 | 1 | Farm yield | 2 | Every fortress eats from its plots every day; starvation is what kills the measured fortresses past 40 dwarves, and the plot sizes the spec tells the player rest on these numbers. | `BASE_GROWTH` 100 (07), `SEEDS_PER_HARVEST` 1 (07) |
| 2 | 1 | Work pace | 11 | Every job time in the game is a base time divided by the skill factor; the work share is measured (28%) but not how much work it buys. | `SKILL_TIME_BONUS_PERCENT` 8 (03), `DIG_BASE_TICKS` 60 (03), `BUILD_BASE_TICKS` 100 (14), `CHANNEL_BASE_TICKS` 80 (03), `SMOOTH_BASE_TICKS` 120 (03), `ENGRAVE_BASE_TICKS` 300 (03), `CHOP_BASE_TICKS` 90 (03), `GATHER_BASE_TICKS` 40 (03), `PLANT_TICKS` 40 (07), `HARVEST_TICKS` 40 (07), `PRODUCTIVITY_FLOOR` 30 (17) |
| 3 | 1 | Combat pace | 10 | Decides every fight, against wild animals at peril 0 and against every party above it; no fight between armed sides has been measured, because the peril 2 and 4 runs stopped early. | `MIN_ATTACK_COOLDOWN` 12 (16), `BLUNT_THROUGH_PERCENT` 30 (16), `FRACTURE_PERCENT` 30 (16), `CREATURE_BASE_SKILL` 2 (16), `HOSTILE_SKILL_PER_TIER` 2 (16), `CREATURE_ATTRIBUTE_DEFAULT` 50 (16), `FLEE_BLOOD_PERCENT` 50 (16), `PERCEPTION_RADIUS` 14 (16), `TRAIN_SHIFT_HOURS` 6 (16), `TRAIN_XP` 12 (16) |
| 4 | 1 | Wounds, healing and infection | 13 | Every fight ends here: which wound kills, how long a soldier is out and whether an infection kills; bleeding to death is the main cause of the measured fortress deaths, and only clotting and treatment time were measured. | `LIGHT_MAX` 0.2 (17), `SERIOUS_MAX` 0.5 (17), `HEAL_BASE_TICKS` 6000 (17), `BLOOD_REGEN_PER_TICK` 1 (17), `PAIN_UNCONSCIOUS` 80 (17), `BLOOD_UNCONSCIOUS_PERCENT` 40 (17), `INFECTION_PERMILLE` 100 (17), `INFECTION_DEATH_PERMILLE` 50 (17), `INFECTION_CURE_DAYS` 3 (17), `TREAT_FAIL_PERMILLE` 200 (17), `PAIN_DISCHARGE` 30 (17), `SUTURED_HEAL_PERCENT` 150 (17), `UNTREATED_FRACTURE_PERCENT` 25 (17) |
| 5 | 1 | Renown and raid size | 7 | Sets the size of every raid, siege and ambush from year 2 at perils 1 to 4; raid sizes at peril 2 have never been measured on a fortress that lived. | `RENOWN_WEALTH_DIVISOR` 2000 (18), `RENOWN_POP_WEIGHT` 0.2 (18), `WARNING_DAYS` 1 (18), `LOITER_DAYS_RAID` 2 (18), `LOITER_DAYS_SIEGE` 5 (18), `RETREAT_LOSS_PERCENT` 50 (18), `DOOR_BREAK_TICKS` 600 (14) |
| 6 | 2 | Starvation and thirst margins | 3 | How long a fortress that runs out of food or drink has before it loses dwarves; the measured starvations ran through these numbers but nobody chose them by a measurement. | `STARVE_DAYS` 7 (10), `DEHYDRATE_DAYS` 3 (10), `STARVE_PERCENT` 8 (17) |
| 7 | 2 | Spoilage and food storage | 4 | Whether a season of meals survives: the T-145 diagnosis lost 1,409 meal units to rot in 140 days; the barrel and rot numbers set that margin. | `BARREL_CAPACITY` 20 (13), `ROT_CONTAINER_PERCENT` 25 (13), `ROT_HOT_C` 30 (13), `ROT_COLD_C` 5 (13) |
| 8 | 2 | Hunting, fishing and butchery yields | 12 | The other food sources of the food-chain table; no long run hunts, fishes or butchers, so none of their yields has been seen. | `FISH_PER_TILE` 2 (09), `FISH_REGEN_PERCENT` 5 (09), `FISH_TICKS` 200 (09), `FISH_BASE_PERMILLE` 350 (09), `FISH_PER_SKILL` 30 (09), `MIN_FISHING_TILES` 6 (09), `FISH_BANK_DROP` 2 (09), `MEAT_PER_SIZE` 12 (09), `FIELD_BUTCHER_PERCENT` 60 (09), `HUNT_MIN_SIZE` 10 (09), `AMMO_FETCH` 20 (09), `BUTCHER_TICKS` 120 (09) |
| 9 | 2 | Caravan value and trade margins | 17 | What a caravan brings and costs: the anvil, the iron and every purchase; trade at every visit is measured, its value and margin are not. | `CARAVAN_VALUE_BASE` 2500 (20), `CARAVAN_VALUE_PER_RENOWN` 150 (20), `CARAVAN_VALUE_PER_REP` 20 (20), `PACK_VALUE` 800 (20), `MERCHANT_MARKUP` 120 (20), `MARGIN_BASE` 15 (20), `MARGIN_MIN` 3 (20), `MARGIN_PER_SKILL` 0.5 (20), `MARGIN_REP_DIVISOR` 20 (20), `REQUEST_SHARE` 30 (20), `REQUEST_MAX` 8 (20), `CARAVAN_DAY_MIN` 5 (20), `CARAVAN_DAY_MAX` 18 (20), `DEPOT_WAIT_DAYS` 3 (20), `CARAVAN_STAY_DAYS` 5 (20), `GUARDS_BASE` 2 (20), `GUARDS_PER_PERIL` 1 (20) |
| 10 | 2 | Wild animal and civilian behaviour | 7 | The annual wildlife instrument measures their sum, but none of these was varied or set by a measurement; each moves who an animal reaches first. | `PREDATOR_HUNGER_DAYS` 3 (08), `THREAT_RADIUS` 8 (10), `FLEE_TICKS` 200 (08), `WILD_LIFETIME_DAYS` 28 (08), `EAT_CORPSE_TICKS` 300 (08), `CIVILIAN_COMBAT_TIMEOUT_TICKS` 200 (10), `ANIMAL_STARVE_DAYS` 10 (08) |
| 11 | 2 | Immigration chance and reputation | 4 | The chance of an eligible wave and the reputation terms; the wave size is measured, the 70% roll and the reputation bonuses are not. | `IMMIGRATION_PERMILLE` 700 (21), `REP_PERMILLE_PER_POINT` 2 (21), `REP_PER_IMMIGRANT` 25 (21), `PEASANT_PERMILLE` 200 (21) |
| 12 | 2 | Mood around the measured formula | 10 | Sulks, grief and room value feed the mood whose mean is measured, but their own sizes were never varied. | `SULK_DAYS` 7 (15), `UNBURIED_DAYS` 3 (15), `ROOM_SIZE_CAP` 40 (14), `ENCLOSED_PERCENT` 150 (14), `HEARTH_HALL_SIDE` 5 (14), `FRIEND_TALKS` 5 (10), `SOCIAL_WAIT_TICKS` 200 (10), `DINING_SEARCH_RADIUS` 40 (10), `THANE_SOCIAL_BONUS` 20 (10), `GRUDGE_DAYS` 28 (10) |
| 13 | 3 | Job priorities | 5 | Which work waits: hauling, food hauling, patients and the depot; they shape the work order of every fortress at default priorities. | `HAUL_PRIORITY` 6 (11), `HAUL_PRIORITY_FOOD` 5 (11), `PATIENT_SUMMON_PRIORITY` 1 (11), `DEPOT_HAUL_PRIORITY` 3 (20), `FIND_RADIUS_MAX` 48 (13) |
| 14 | 3 | Military details | 13 | Training, ammunition and ranged spacing of a squad; they matter once a fortress keeps soldiers, after the combat numbers above. | `TARGET_LOSE_TICKS` 200 (16), `RANGED_KEEP_DISTANCE` 3 (16), `RANGED_KITE_TRIGGER_DISTANCE` 2 (16), `PROJECTILE_SPEED` 3 (16), `AMMO_BREAK_PERMILLE` 200 (16), `SPAR_TICKS` 300 (16), `SPAR_INJURY_PERMILLE` 20 (16), `TRAIN_SHOTS` 5 (16), `REEQUIP_CHECK_DAYS` 3 (16), `SOLDIER_AMMO` 25 (16), `ARMOR_MIN_SPEED_PERCENT` 60 (16), `THREAT_THROTTLE_TICKS` 50 (16), `WARDEN_TRAINING_BONUS_PERCENT` 25 (10) |
| 15 | 3 | Traps, gates and alerts | 12 | The defences the spec names as the answer to trollkin and raids; no trap has fired in a measured run. | `STONE_FALL_DAMAGE` 40 (19), `TRAP_SKILL` 5 (19), `TRAP_JAM_PERMILLE` 50 (19), `CAGE_MAX_SIZE` 150 (19), `WADE_LARGE_SIZE` 180 (19), `ALERT_LOCK_GRACE_TICKS` 400 (19), `ALERT_OUTSIDE_CLEAR_TICKS` 20 (19), `BRIDGE_CRUSH_DAMAGE` 60 (14), `BRIDGE_MAX` 5 (14), `LINK_DELAY_TICKS` 100 (14), `PLATE_RESET_TICKS` 100 (14), `LINK_WORK_TICKS` 150 (14) |
| 16 | 3 | Thieves, cavern creatures and the Deep | 20 | Threats other than raids: each matters on the maps and at the depths where it occurs, not in every fortress. | `THIEF_WAIT_DAYS` 1 (18), `STEAL_MAX_SIZE` 30 (18), `FOLLOW_RADIUS` 4 (18), `ENGAGE_IDLE_TICKS` 150 (18), `LOOT_RADIUS` 6 (18), `SPOT_RADIUS` 6 (18), `SPOT_RADIUS_DOG` 10 (18), `WEB_TICKS` 100 (18), `CAVE_SEEK_RADIUS` 30 (18), `CAVE_RETURN_TICKS` 600 (18), `DEEP_PRESSURE_PER_TILE` 10 (18), `DEEP_THRESHOLDS` 50, 150, 300, 500 (18), `EMERGENCE_TILES` 4 (18), `HOLLOW_WAVE_DAYS` 28 (18), `RESTLESS_PER_NIGHT` 2–8 (18), `ARRIVAL_SPREAD` 2 (18), `ARRIVAL_TICKS` 100 (18), `PARTY_HISTORY_DAYS` 1 (18), `RETREAT_STUCK_TICKS` 600 (18), `RETREAT_GIVE_UP_DAYS` 2 (18) |
| 17 | 3 | Fire, temperature and weather | 31 | Hazards and seasonal effects that depend on the biome and the temper; most fortresses meet a few of them. | `FIRE_SPREAD_PERMILLE` 150 (05), `FIRE_SPREAD_WET_PERMILLE` 20 (05), `FIRE_SPREAD_COOLDOWN` 30 (05), `BURN_TICK_DAMAGE` 6 (05), `ITEM_BURN_TICKS` 100 (05), `RAIN_EXTINGUISH_PERMILLE` 30 (05), `ASH_DURATION_DAYS` 28 (05), `FROST_KILL_C` −2 (05), `HEAT_INJURY_C` 55 (05), `COLD_INJURY_C` −25 (05), `WILT_PERMILLE` 50 (06), `LIGHTNING_PER_HOUR_PERMILLE` 250 (06), `SNOW_MOVE_COST_PERCENT` 150 (06), `WET_DURATION_HOURS` 6 (06), `SNOW_CHUNKS_PER_HOUR` 8 (06), `MELT_C` 2 (06), `FREEZE_C` −1 (04), `THAW_C` 2 (04), `DROWN_DAMAGE` 8 (17), `FALL_DAMAGE_PER_LEVEL_SQ` 6 (17), `UNDERGROUND_BASE_C` 10 (05), `NEAR_SURFACE_DEPTH` 3 (05), `DEEP_HEAT_START_Z` 12 (05), `DEEP_HEAT_PER_Z` 3 (05), `MAGMA_OVERRIDE` 16 (05), `FIRE_OVERRIDE` 12 (05), `SPRING_OVERRIDE` 5 (05), `SNOW_OVERRIDE` 1 (05), `MIST_DURATION_TICKS` 100 (04), `HEARTH_WARMTH_C` 2 (14), `MIST_THOUGHT_COOLDOWN` 1200 (10) |
| 18 | 3 | Livestock, breeding and training | 10 | Herds, eggs and war animals: no long run tames, breeds or trains an animal. | `BREEDING_CAP_DEFAULT` 12 (08), `BREED_RADIUS` 10 (08), `BREED_PERMILLE` 60 (08), `HATCH_DAYS` 12 (08), `TRAIN_TICKS` 400 (08), `TRAIN_BASE_PERMILLE` 300 (08), `TRAIN_PER_SKILL` 35 (08), `WAR_ANIMAL_RADIUS` 8 (08), `ADOPT_PERMILLE` 250 (08), `GRAZE_TICKS` 60 (08) |
| 19 | 3 | Stone and wood supply | 8 | How much stone a dug tile and wood a forest give; they bound crafts, blocks and fuel on maps where either is short. | `MINING_STONE_DROP_PERMILLE` 300 (03), `TREE_LOGS_MIN` 1 (03), `TREE_LOGS_MAX` 4 (03), `REGROWTH_TRIES_PER_DAY` 40 (07), `REGROWTH_PERMILLE` 200 (07), `SAPLING_YEARS` 2 (07), `MELT_RETURN_PERCENT` 60 (12), `HOSPITAL_DEFAULT_SUPPLIES` cloth 10, thread 5, splints 4, crutches 2, brightleaf 6, buckets 2 (17) |
| 20 | 4 | World and map generation | 28 | The shape of the world and the local map; play depends on them through the embark choice, which the player makes with the map in view. | `SEA_LEVEL` 96 (01), `HILLS_ELEVATION` 130 (01), `MOUNTAIN_ELEVATION` 165 (01), `MIN_LAND_FRACTION` 35% (01), `TEMP_SOUTH` 30 (01), `TEMP_NORTH` −12 (01), `TEMP_LAPSE_PER_ELEVATION` 22 (01), `RAIN_SHADOW_STRENGTH` 90 (01), `RAIN_SHADOW_DECAY` 18 (01), `COAST_RAIN_BONUS` 30 (01), `RIVER_SOURCE_ELEVATION` 150 (01), `RIVER_SOURCE_RAIN` 120 (01), `BROOK_LENGTH` 3 (01), `MAJOR_LENGTH` 12 (01), `VOLCANO_CHANCE_PERMILLE` 40 (01), `CIV_MIN_SEPARATION` 10 (01), `PERIL_DISTANCE_STEP` 6 (01), `TRAIT_MAX_PER_REGION` 2 (01), `CAVERN_OPEN_FRACTION` 0.25–0.55 (03), `LIGHT_SPREAD` 2 (03), `BATTLEFIELD_ITEM_COUNT` 30 (03), `VAULT_TREASURE` 3 (03), `WELL_DEPTH` 10 (14), `MAGMA_POWER_LEVEL` 4 (12), `OBSIDIAN_WALL_LEVEL` 4 (04), `ICE_WALL_LEVEL` 4 (04), `MAGMA_C` 1200 (04), `WATER_EVAPORATE_PERMILLE` 8 (04) |
| 21 | 4 | Embark, arrivals and small trade terms | 26 | One-off or rare choices: the embark shop, who comes in a wave, bans and drift; each changes a little of one fortress. | `EMBARK_AGE_MIN` 18 (02), `EMBARK_AGE_MAX` 65 (02), `EMBARK_REROLL_COST` 25 (02), `EMBARK_MARKUP_PERCENT` 20 (02), `ARRIVAL_SEARCH_DEPTH` 20 (02), `WAGON_LOGS` 3 (02), `PRIMARY_MIN` 2 (21), `PRIMARY_MAX` 7 (21), `FAMILY_PERMILLE` 300 (21), `CHILDREN_MAX` 2 (21), `PET_PERMILLE` 150 (21), `TOOL_STOCK_MIN` 2 (21), `COVERAGE_SKILL` 5 (21), `UNCOVERED_WEIGHT` 2 (21), `ARRIVAL_INTERVAL_TICKS` 20 (21), `ADULT_AGE_YEARS` 12 (10), `ATTRIBUTE_DRIFT` 1 (10), `HEAVY_ITEM_DENSITY` 3 (10), `CARAVAN_BAN_REP` −50 (20), `CARAVAN_BAN_YEARS` 2 (20), `WEATHER_SKIP_PERMILLE` 150 (20), `MERCHANTS_MIN` 2 (20), `MERCHANTS_MAX` 3 (20), `TRADE_XP` 15 (20), `REP_DRIFT_PER_YEAR` 5 (20), `DIAGNOSE_XP` 20 (17) |
| 22 | 4 | Engine budgets, cadences and capacities | 47 | Search limits, think intervals, retries and container sizes; they change how fast or how far the simulation looks, and an outcome only at their edges. | `FLUID_SETTLE_STEPS` 8 (04), `SPREAD_EQUALIZE_PERMILLE` 500 (04), `FLUID_EQUALIZE_BUDGET` 16 (04), `SPREAD_MAX_PER_STEP` 2 (04), `PRESSURE_SEARCH_LIMIT` 256 (04), `PRESSURE_BUDGET_TILES` 4000 (04), `Z_HEURISTIC_COST` 1000 (22), `PATH_NODE_LIMIT` 8000 (22), `PATH_NODES_PER_TICK` 24000 (22), `PATH_CONCURRENT` 16 (22), `PATH_CACHE_SIZE` 512 (22), `REPATH_WAIT_TICKS` 5 (22), `REPATH_LIMIT` 3 (22), `LOS_MAX` 30 (22), `ASSIGN_WORKERS_PER_TICK` 8 (11), `CANDIDATE_LIMIT` 32 (11), `Z_DISTANCE_WEIGHT` 6 (11), `RESERVE_KEEP_TICKS` 600 (11), `BLOCKED_RETRY_TICKS` 100 (11), `BLOCKED_RETRIES_PER_TICK` 20 (11), `IDLE_HAULER_WARNING` 200 (11), `HAULER_WARNING_MIN_WORKERS` 3 (11), `HAUL_JOBS_PER_TICK` 20 (13), `WILD_THINK_TICKS` 10 (08), `NEAR_DWARF_RADIUS` 20 (08), `WANDER_RADIUS` 16 (08), `GRAZE_SKIP_TICKS` 600 (08), `TALK_CHECK_TICKS` 10 (10), `IDLE_TICKS` 50 (10), `NEED_RETRY_TICKS` 50 (10), `CIVILIAN_FLEE_NODE_LIMIT` 256 (10), `RETREAT_SEARCH_LIMIT` 3000 (19), `CORPSE_WAIT_TICKS` 20 (09), `HUNT_GIVE_UP_TICKS` 300 (09), `FISH_RETRY_TICKS` 100 (09), `CARRY_MAX_SIZE` 100 (09), `BUTCHER_ROT_LIMIT` stage 2 (09), `HIDE_MIN_SIZE` 15 (09), `BONE_PER_SIZE` 25 (09), `FAT_PER_SIZE` 30 (09), `SKULL_MIN_SIZE` 30 (09), `MIASMA_DURATION` 300 (13), `WEALTH_EVENT_STEP` 250 (13), `CORPSE_ROT_DAYS` 14 (13), `BIN_CAPACITY` 30 (13), `BAG_CAPACITY` 25 (13), `CHEST_CAPACITY` 20 (13) |
| 23 | 4 | Rendering and interface | 23 | What the screen shows and for how long; no simulation outcome depends on them. | `LOG_ROWS` 3 (23), `ATLAS_COLOR_CACHE` 128 (23), `DIM_FACTOR` 0.55 (23), `FLUID_ANIM_MS` 500 (23), `AUTO_ZOOM_MIN_COLS` 100 (23), `AUTO_ZOOM_MIN_ROWS` 56 (23), `ZONE_TINT_ALPHA` 0.25 (23), `ZONE_TINT_MIN_LUMA` 0.18 (23), `TEMPERATURE_RAMP_COLD_C` −20 (23), `TEMPERATURE_RAMP_HOT_C` 40 (23), `PARTICLE_ONE_IN` 16 (23), `LOG_MAX_LINES` 2000 (24), `LOG_SAVED_LINES` 200 (24), `LOG_DEDUP_TICKS` 100 (24), `CURSOR_SCROLL_MARGIN` 3 (24), `STATUS_HINT_SECONDS` 4 (24), `GAME_MENU_MESSAGE_MS` 3000 (24), `HINT_CHECK_HOURS` 1 (24), `UNDO_BATCHES_MAX` 10 (24), `BREEDING_CAP_BIG_STEP` 10 (24), `UI_NORMAL_SPACING` 3 (24), `UI_COMPACT_SPACING` 1 (24), `EMBARK_PRESET_SPACING` 4 (24) |

The rule tables and balance figures of the previous section fall into the same groups: the season growth multipliers and the food-chain yields with farm yield (rank 1); the balance model's room, mining and metal times and the mood productivity factors with work pace (2); the combat formulas and the combat-pace section with combat pace (3); the renown curve, raid size, the threat schedule and the day-56 warning with raids (5); the critical thresholds with starvation margins (6); the rot stages and the barrel figures with spoilage (7); the fish, deer, milk and egg figures with foraging (8); the reputation bands and the trade example with trade (9); the quality roll beside trade in tier 2, as the largest unmeasured lever on the wealth curve (which is measured, and outside its range); the sulk week and the peak of 70 with mood (12); the path costs with the engine (22).

## The top five

1. **Farm yield** (T-364). `BASE_GROWTH`, `SEEDS_PER_HARVEST` and the season multipliers make the balance model's 0.25 plants per farm tile per day, and from it the plot sizes the spec promises: 20 cave tiles for twenty dwarves, 13 for the still. The three-year fortress starves past about 40 dwarves ([the food-chain diagnosis](2026-10-16-t145-food-chain-diagnosis.md)); its causes were script choices, but nobody can say from a measurement whether a plot of the promised size would have fed it. Food is the one supply every fortress needs every day.
2. **Work pace** (T-365). Every job time is a base time over `100 + SKILL_TIME_BONUS_PERCENT × level`. The share of a dwarf's time spent working is measured (28% in year 1); how many tiles, workshops and rooms that buys is not, so the balance model's year-1 fortress (400 tiles, 6 workshops, 10 bedrooms) and its iron timings are unverified. Wealth, defence and rooms all wait on work done.
3. **Combat pace** (T-366). The hit, block and damage terms, `BLUNT_THROUGH_PERCENT`, `FRACTURE_PERCENT`, `MIN_ATTACK_COOLDOWN` and the hostile skill per gear tier decide every fight. The balance model says a squad of three in mail handles a raid of ten at peril 2; no fight between armed sides has been measured: every peril 2 and 4 run of the economy sweep stopped on a game fault before its raids, and the sweep has not been run again since those faults were fixed ([the sweep](2026-10-12-economy-fixture-at-default-priority.md#the-sweep)).
4. **Wounds, healing and infection** (T-367). Bleeding to death after a fight is the main cause of death in the measured fortress (balance-status, main fortress deaths). Clotting, treatment time and the bleeding rate were measured; the wound thresholds, healing time, unconsciousness, infection and its death chance were not. They decide how long a soldier is out and whether a wounded dwarf dies a day later.
5. **Renown and raid size** (T-368). `RENOWN_WEALTH_DIVISOR` and `RENOWN_POP_WEIGHT` turn the measured wealth and population into renown, and the threat schedule turns renown into the size of every raid, siege and ambush from year 2 at perils 1 to 4. The balance model's raid of 10 in year 2 and 15 in year 3 has never been seen on a fortress that lived.

## Measured

| Constant | Value | System | Report and section | What was measured |
|---|---|---|---|---|
| `GRASS_REGROW_PERMILLE` | 120 | 07 | [2026-10-12-pasture-capacity-and-winter-feeding.md](2026-10-12-pasture-capacity-and-winter-feeding.md) § Capacity decision | daily grass rows of six parcels |
| `GRASS_PER_GRAZER` | 48 | 08 | [2026-10-12-pasture-capacity-and-winter-feeding.md](2026-10-12-pasture-capacity-and-winter-feeding.md) § Capacity decision | set from the measurement; six grazers stay below condition 100 |
| `CONDITION_PER_HOUR` | 2 | 08 | [2026-10-12-pasture-capacity-and-winter-feeding.md](2026-10-12-pasture-capacity-and-winter-feeding.md) § Capacity decision | daily condition rows; kept |
| `CONDITION_PER_GRASS` | 25 | 08 | [2026-10-12-pasture-capacity-and-winter-feeding.md](2026-10-12-pasture-capacity-and-winter-feeding.md) § Capacity decision | daily condition rows; kept |
| `ATTACK_PERCEPTION_GRACE_TICKS` | 50 | 08 | [2026-10-12-predator-grace-and-corpse-meals.md](2026-10-12-predator-grace-and-corpse-meals.md) § Rules and regressions | twelve-seed annual rows before and after |
| `PREY_PACK_MAX_MEMBERS` | 3 | 08 | [2026-10-11-pack-prey-size.md](2026-10-11-pack-prey-size.md) § The rule and the result | wolves against pastured grazers over six years |
| `TERRITORY_RADIUS` | 5 | 08 | [2026-10-10-wild-animals-after-the-fixes.md](2026-10-10-wild-animals-after-the-fixes.md) § After the fixes, ten seeds | seven civilians against a badger or boar, ten seeds |
| `SPAWN_PERMILLE` | 150 | 08 | [2026-10-09-wild-animal-activation.md](2026-10-09-wild-animal-activation.md) § Spawning and movement against system 08 | 40 arrivals in 24 ten-day runs |
| `SPAWN_MIN_DISTANCE` | 25 | 08 | [2026-10-09-wild-animal-activation.md](2026-10-09-wild-animal-activation.md) § Spawning and movement against system 08 | every arrival at least 25 tiles away |
| `CLOT_TICKS` | 300 | 17 | [2026-10-10-wild-animals-after-the-fixes.md](2026-10-10-wild-animals-after-the-fixes.md) § How it was measured | set to 300 and measured with civilians and wild animals |
| `TREAT_TICKS` | 200 | 17 | [2026-10-10-wild-animals-after-the-fixes.md](2026-10-10-wild-animals-after-the-fixes.md) § What the numbers say | a treatment takes about 300 ticks from the first wound |
| `BLOOD_PER_SIZE` | 10 | 17 | [2026-10-10-wild-animals-and-civilians.md](2026-10-10-wild-animals-and-civilians.md) § 4. Whether bleeding leaves time for any treatment | one light cut kills a resting dwarf of 600 blood in 2,500 ticks |
| `BLOOD_DEATH_PERCENT` | 20 | 17 | [2026-10-10-wild-animals-and-civilians.md](2026-10-10-wild-animals-and-civilians.md) § 4. Whether bleeding leaves time for any treatment | time to death by wound kind |
| `EAT_TICKS` | 60 | 10 | [2026-10-09-walking-speed.md](2026-10-09-walking-speed.md) § Why the work share does not move | 50–54 ticks in use per meal |
| `DRINK_TICKS` | 40 | 10 | [2026-10-09-walking-speed.md](2026-10-09-walking-speed.md) § Why the work share does not move | 38–40 ticks in use per drink |
| `SLEEP_HOURS` | 7 | 10 | [2026-10-09-walking-speed.md](2026-10-09-walking-speed.md) § Why the work share does not move | 118–121 ticks in use per sleep errand; disagrees with 7 hours (T-369) |
| `TALK_TICKS` | 80 | 10 | [2026-10-09-walking-speed.md](2026-10-09-walking-speed.md) § Why the work share does not move | 74–77 ticks in use per talk |
| `SIT_TICKS` | 100 | 10 | [2026-10-09-walking-speed.md](2026-10-09-walking-speed.md) § Why the work share does not move | 95–100 ticks in use per sit |
| `HEARTH_VISIT_TICKS` | 100 | 10 | [2026-10-09-walking-speed.md](2026-10-09-walking-speed.md) § Why the work share does not move | 98–100 ticks in use per hearth visit |
| `LEISURE_MARK` | 75 | 10 | [2026-10-10-wants-without-errands-after-t196.md](2026-10-10-wants-without-errands-after-t196.md) § Summary | year 1 mood 58.8 and work share 28.4% with the hall errand |
| `LEISURE_RETRY_TICKS` | 600 | 10 | [2026-10-10-wants-without-errands-after-t196.md](2026-10-10-wants-without-errands-after-t196.md) § Summary | landed with the hall errand it limits |
| `NEED_DEFER_PRIORITY` | 2 | 10 | [2026-10-08-economy-at-default-priority.md](2026-10-08-economy-at-default-priority.md) § Where the time goes | the share of dwarf time at default priorities |
| `POSITIVE_CAP` | 40 | 15 | [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The mood instrument | daily time mean 57.7 with thought shares; formula checked in M8-mood-diagnosis.md § 1 |
| `NEGATIVE_CAP` | 35 | 15 | [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The mood instrument | as above |
| `NEED_PRESSURE_CAP` | 20 | 15 | [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The mood instrument | as above |
| `MOOD_NEEDS_MET_FLOOR` | 20 | 15 | [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The mood instrument | as above |
| `NEED_WEIGHT` | 40 | 15 | [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The mood instrument | standing need thoughts measured (thirsty −2.50) |
| `HEARTH_TIER_BONUS` | 2 | 15 | [M8-mood-diagnosis.md](M8-mood-diagnosis.md) § 1. Mood Formula: Line-by-Line Code vs. Spec Verification | hearth tier in the mood sum |
| `IMMIGRATION_SPIRIT_MIN` | 55 | 21 | [M8-balance-economy.md](M8-balance-economy.md) § Measured eligible immigration arithmetic | eligible and failed seasons counted |
| `WEALTH_PER_WAVE` | 2000 | 21 | [2026-10-10-wants-without-errands-after-t196.md](2026-10-10-wants-without-errands-after-t196.md) § Three years, rewritten fixture | every wave from the winter of year 2 refused for wealth |
| `GUARANTEED_SIZE_MIN` | 2 | 21 | [2026-10-10-wants-without-errands-after-t196.md](2026-10-10-wants-without-errands-after-t196.md) § Three years, rewritten fixture | summer +2, autumn +3 |
| `GUARANTEED_SIZE_MAX` | 4 | 21 | [2026-10-10-wants-without-errands-after-t196.md](2026-10-10-wants-without-errands-after-t196.md) § Three years, rewritten fixture | as above |
| `IMMIGRANT_BASE` | 2 | 21 | [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The main scenario, run by run | waves of 7 to 11; population 15 / 34 / 56 |
| `WEALTH_PER_IMMIGRANT` | 3000 | 21 | [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The main scenario, run by run | as above |
| `SPIRIT_SIZE_STEP` | 2 | 21 | [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The main scenario, run by run | as above |
| `WAVE_MAX` | 12 | 21 | [2026-10-07-balance-after-f17.md](2026-10-07-balance-after-f17.md) § Immigration evaluations | winter clamp to 12 observed |
| Walking speed (creatures.md) | 0.15 tiles a tick | 10, balance.md | [2026-10-09-walking-speed.md](2026-10-09-walking-speed.md) § Summary | the speed factor against the need cycle |
| Need rates and want thresholds (hunger, thirst, rest, social, comfort, joy) | 10 § Needs | 10, balance.md | [2026-10-09-walking-speed.md](2026-10-09-walking-speed.md) § Why the work share does not move; [2026-10-12-economy-fixture-at-default-priority.md](2026-10-12-economy-fixture-at-default-priority.md) § The main scenario, run by run | errands per dwarf-day, and food and drink per dwarf-day (79% and 70–79% of the model) |

## Contradictions found

1. **Sleep** (T-369). The balance model's need table says rest gives "7 hours of sleep per 24", and `SLEEP_HOURS` is 7. The same document's measured table gives sleep 9% of a dwarf's time in use, about 2.2 hours, and the walking-speed report measured 1.14 to 1.20 sleep errands a day of 118 to 121 ticks each, under 3 hours. The rates (+5 an hour awake, −15 asleep) balance at 6 hours. At most one of the three can be right.
2. **Balance-model sums that the rules do not give** (T-373). (a) Raid size at peril 2 in year 2: `round(6 + 15 × 0.3)` is 11 (the code rounds half up), not "6 + 4 = 10". (b) Combat pace: a dwarf of 600 blood falls unconscious below 40%, after losing 360, not "at 240 lost". (c) Regrowth: 40 tries a day × `REGROWTH_PERMILLE` 200 × a forest's tree density gives one or two saplings a day, not "around 40". (d) Logs: the species rows give 1 to 4 logs a tree, most 2 to 3, not "2–4 (average 3)".
3. **The wild-animals section of the balance model states two results** (T-371). Its paragraph on the measured annual survival says "minimum 0 … one extinction … Forest seed 3 goes extinct"; its table and its closing paragraph give the later rows: minimum 9, no extinction. The paragraph is a superseded measurement left in place.
4. **`balance-status.md` has rows above its title** (T-372). Thirteen table rows with the 2026-10-12 figures sit on lines 1 to 13, before `# Balance status`, and the table under the title still holds older rows for the same measures (wealth in year 1: 18,891 above the title, 15,584 below). A reader of the living record gets two answers to each.

## Limits

- "Measured" is judged from what the reports say. A report that measured a number without naming it or its quantity may have been missed; a later task that finds one replaces the mark with the report.
- A measured number is not a right number: several measurements disagree with the model (food and drink at 70–79%, wealth outside its range). Those disagreements are already in `balance-status.md` and its open B rows.
- The ranking is a judgement of how much play depends on a number, made from the spec and the reports; it is not itself measured.
