# Acceptance Tests

**Owner:** implementation (`test/scenarios/*`) · **Depends on:** [`../01-architecture/simulation-core.md`](../01-architecture/simulation-core.md) (headless runner), every system document

Every test is a headless scenario: `{ seed, region | 'flat-test', embark | 'default', commands[], ticks, assertions[] }`. `flat-test` is a generated local map with a flat granite surface at z=32, a 3-level soil layer, no river, no caverns above z=20, a `serene_vale`-like region (peril 0, wealth 2, temper 0) unless the test says otherwise. `default` embark is the Balanced preset. Scenario files live next to the tests; the ids below are the file names.

## Core

| id | Scenario | Expected |
|---|---|---|
| `core_determinism` | run 10,000 ticks twice from the same seed and command log | identical world hashes at ticks 1,000, 5,000, 10,000 |
| `core_save_roundtrip` | run 5,000 ticks, save, load, run 5,000 more; compare to an uninterrupted 10,000 | identical hash |
| `core_command_rejection` | submit `Designate` out of bounds | `CommandRejected { out_of_bounds }`, no state change |
| `core_event_order` | two systems emit in the same tick | dispatched in emission order; handlers run in system order |
| `core_calendar` | run `TICKS_PER_YEAR` ticks | `YearPassed { 2 }` once; 4 `SeasonChanged`; 112 `DayPassed` |

## 01 World generation

| id | Scenario | Expected |
|---|---|---|
| `wg_shape` | generate standard world, 20 seeds | land fraction ≥ 35%; ≥ 1 mountain 3×3 cluster; 4 civ homes placed with separation ≥ 8 |
| `wg_rivers` | any seed | every river ends in ocean, a lake or a confluence; class monotone along the path |
| `wg_ratings` | any seed | all ratings in 0–4; `serene_vale` regions have peril 0; no traits on ocean or glacier |
| `wg_determinism` | same seed twice | identical `WorldMap` |

## 03 Terrain

| id | Scenario | Expected |
|---|---|---|
| `tr_dig_room` | designate a 3×3 dig into the rock face; 1 miner | all 9 tiles `Floor` within 2,500 ticks; stone items dropped ≈ 30% (over 100 runs, 20–40%) |
| `tr_channel_ramp` | channel a floor tile above a wall | tile `Open`, tile below `Ramp`; a dwarf can walk down and up |
| `tr_stairwell` | `DesignateStairwell` 3 levels | up/down stairs carved; connectivity label equal across levels |
| `tr_support` | build a floor over open space, remove its only supporting wall | floor collapses; block item appears below; `ConstructionCollapsed` |
| `tr_discovery` | dig toward an undiscovered cavern | `CavernBreached` on the first open cavern tile; the connected cavern region is discovered |
| `tr_deepsilver_gate` | designate a deepsilver tile before confirmation | rejected `deepsilver_unconfirmed`; after `ConfirmDeepsilver`, accepted; `DeepsilverMined` on completion |

## 04 Fluids

| id | Scenario | Expected |
|---|---|---|
| `fl_conservation` | a closed basin with 700 units, no sources, 5,000 ticks | Σ levels = 700 at every sampled tick |
| `fl_spread` | 7 units in one tile of a 5×5 sealed floor | after 200 steps all 25 tiles at level 0–1 with Σ = 7; every tile settled |
| `fl_pressure` | a U-tube: source column 5 high, connected at the bottom to an empty column | the empty column fills to the source's level − 1 within 2,000 ticks; never above |
| `fl_waterfall_mist` | a channel dropping 3 levels onto a floor, source-fed | `MistProduced`; `isMisty` true on the 3×3 landing area; mud set on the landing floor |
| `fl_obsidian` | a magma tile at level 7 with water poured on | tile becomes `Wall` `obsidian`; `ObsidianFormed` |
| `fl_freeze` | outdoor pond, temper 4 region, winter | pond tiles frozen (`ice`) within a day of `surfaceTempC < FREEZE_C`; thawed in spring |
| `fl_drown` | a dwarf in a 1×1 pit flooded to level 7 | `CreatureSubmerged` each health tick; death by `drowned` within 400 ticks |
| `fl_perf` | reference fortress with a 40-tile waterfall channel, 2,000 ticks | average fluids tick ≤ 3 ms on CI (2× budget) |

## 05 Materials

| id | Scenario | Expected |
|---|---|---|
| `ma_fire_spread` | ignite a grass tile in a 10×10 dry grass field, clear weather | ≥ 60 tiles burn within 3,000 ticks; all end `Ash`; no spread onto stone |
| `ma_fire_rain` | same under `rain` | ≤ 10 tiles burn |
| `ma_magma_melt` | a copper bar and a granite block pushed into magma | copper `ItemMelted`; granite survives |
| `ma_temperature` | sample tiles at surface, depth 10, z=5 next to magma | values match the formula ±1 |

## 06 Weather

| id | Scenario | Expected |
|---|---|---|
| `we_transitions` | 10 years at temper 0 and temper 4 | temper 0 never `storm`, `heatwave`, `cold_snap`; temper 4 has ≥ 1 of each per year on average |
| `we_snow` | winter snowfall at temper 2 | all outdoor chunks covered within 6 hours; melt after `MELT_C` for 5 hours |

## 07 Plants

| id | Scenario | Expected |
|---|---|---|
| `pl_cave_cycle` | 4×4 dimcap plot, 10 seeds, 1 farmer | first harvest at 16 ± 1 days; yield 3–5 per tile; seeds ≥ 10 after harvest |
| `pl_light_rule` | dimcap on a lit tile; barley on a dark tile | neither grows; UI refuses mixed plots (`light_mismatch`) |
| `pl_frost` | barley crop, temp forced to −5 | `CropDied { frost }` |
| `pl_regrowth` | clear a 20×20 grass area of trees, run 2 years | ≥ 5 saplings, ≥ 2 trees |

## 08 Animals

| id | Scenario | Expected |
|---|---|---|
| `an_pasture` | 2 cows, pasture of 20 grass tiles | condition stays < 60 over a season; grass regrows |
| `an_starve` | cow with no grass | `AnimalStarving` by day 3; death `ANIMAL_STARVE_DAYS` later |
| `an_breed` | cow and bull in a pasture, one year (112 days) | ≥ 1 `AnimalBorn` (conception by day 52 is needed: 96% at `BREED_PERMILLE` 60) |
| `an_flee` | deer 8 tiles from a dwarf | deer enters `flee` within 10 ticks; distance increases |
| `an_predator` | wolf pack near unarmed dwarves, `beastwood` | ≥ 1 attack within a day; wolves flee below their species `flee` percent (45; `FLEE_BLOOD_PERCENT` is only the default) |
| `an_tame` | caged boar, kennel, trainer skill 10 | `AnimalTamed` within 5 attempts |

## 09 Foraging

| id | Scenario | Expected |
|---|---|---|
| `fo_hunt` | hunter with crossbow + 20 bolts, one deer | `HuntKill` within a day; corpse hauled to the butcher; meat 3, hide 1, bones 1 |
| `fo_no_ammo` | hunter with crossbow and no bolts | no `hunt` job; jobs panel reason `no_tool` |
| `fo_fish` | fishing zone on a river, fisher skill 5, 7 days | ≥ 2 `FishCaught`; pool regenerates |
| `fo_butcher_rot` | corpse left 21 days | `skeleton`; butchering yields bones only |

## 10 Dwarves

| id | Scenario | Expected |
|---|---|---|
| `dw_needs` | 7 dwarves, food and drink stocked, 3 days | each eats 3–5 times and drinks 6–8 times; no need reaches 100 |
| `dw_starve` | no food | `Starving` at hunger 100; `Starvation` damage daily after `STARVE_DAYS`; death on the 13th day of damage |
| `dw_sleep` | beds assigned | each dwarf sleeps once per day in their own bed; `Slept { ownBed: true }` |
| `dw_critical_interrupt` | miner mid-dig with thirst forced to 90 | job returns to open with progress kept; miner drinks; job resumes |
| `dw_child` | immigrant child | only hauling jobs; adult on the 12th birthday |
| `dw_title` | assign Thane; give the Thane a grand bedroom | everyone gets `thane_hall_grand` |
| `year_one` | 48×48 flat-test with one spring, Balanced embark, the opening orders of `archive/fixes/F-04-bootstrap-scenario.md`, 20 days | carpenter, still, mason, kitchen, hearth built and the room dug within their calibrated bounds; ≥ 1 brew; crops planted; nobody dies; ≤ 200 `missing_input` blocks |

## 11 Jobs

| id | Scenario | Expected |
|---|---|---|
| `jb_priority` | two dig jobs at priority 1 and 9 equidistant | priority 1 claimed first |
| `jb_labor_priority` | mining labor priority 3, hauling 5 | mining jobs chosen over equidistant haul jobs by every dwarf |
| `jb_unreachable` | dig target behind a locked door | `JobBlocked { unreachable }`; unlock → `JobUnblocked` within `BLOCKED_RETRY_TICKS` |
| `jb_reservation` | two craft jobs needing the same single log | one claims, the other blocks `missing_input`; on completion the second proceeds |
| `jb_tool` | miner without a pick, pick in a stockpile | fetches the pick first; keeps it after the job |
| `jb_hauling` | 50 stones on the ground, a stone stockpile of 20 tiles | 20 hauled; `StockpileFull` once; 30 remain |

## 12 Workshops

| id | Scenario | Expected |
|---|---|---|
| `ws_bed` | carpenter level 6, 1 log, order bed ×1 | bed item in 90–110 ticks of work; quality distribution over 200 runs matches the roll table ±3% |
| `ws_maintain` | maintain ≥ 10 meals, cook, ingredients | meals rise to ≥ 10 and the order stays; no job when ≥ 10 |
| `ws_fuel` | smelter, ore, no fuel | `WorkshopBlocked { missing_input }`; charcoal arrives → smelts |
| `ws_magma` | magma smelter over a channel to magma level 7 | smelts without fuel; drain the magma → `no_magma` |
| `ws_steel` | iron bar + limestone + 2 fuel | 1 steel bar |
| `ws_masterwork` | legendary carpenter, 100 beds | ≥ 40 masterworks; `MasterworkCreated`; crafter gets `made_masterwork` |

## 13 Items

| id | Scenario | Expected |
|---|---|---|
| `it_rot` | raw meat on the floor vs in a barrel in a food stockpile | floor: rotting at 6 days; barrel: at 24 days |
| `it_miasma` | rotting corpse indoors | `MiasmaSpread`; dwarves passing get `in_miasma` |
| `it_value` | masterwork steel breastplate | value 4,000 |
| `it_wealth` | craft 10 common granite tables | wealth rises by 80 (2 × 4 × 10) |
| `it_forbid` | forbid a log | no job takes it; claim → hauled |
| `it_containers` | drink stockpile with 0 barrels wanted | barrels of ale still accepted (they are containers); seeds need bags |

## 14 Buildings

| id | Scenario | Expected |
|---|---|---|
| `bd_room_tiers` | the bedroom and hearth hall examples in buildings-and-furniture.md | tiers bare → decent → fine; grand for the hall |
| `bd_door_lock` | locked door between a dwarf and a stockpile | job `unreachable`; unlock resolves |
| `bd_bridge` | drawbridge over a channel, lever inside, raise with a goblin on it | goblin crushed or displaced; raid loiters; lower → path exists |
| `bd_floodgate` | channel from a river through a floodgate to a pit | closed: pit dry; open: pit fills to level 7 |
| `bd_hearth` | build the hearth | `HearthLit`; everyone `hearth_lit` +12; second hearth rejected `hearth_exists` |
| `bd_burial` | dead dwarf, coffin in a tomb | `Buried`; `unburied_dead` cleared |
| `bd_support` | construct a wall on open space with no neighbor | rejected `bad_placement` |

## 15 Morale

| id | Scenario | Expected |
|---|---|---|
| `mo_floor` | every need met; every negative event thought applied at once; three dwarves: sensitive + timid, stoic + brave, neither | mood ≥ 20 for each; exactly 20 for the sensitive + timid dwarf |
| `mo_misery_needs` | 7 dwarves, no food, loose ale only, no beds or furniture, 14 days | mood < 20 for some dwarf by day 7; each dwarf sulks exactly on the days the sulk rule gives for its daily tiers (never twice within `SULK_DAYS`); ≥ 1 sulk; no dwarf dies |
| `mo_caps` | 20 positive thoughts | positives contribute ≤ 40 |
| `mo_hall_spirit` | good fortress (decent rooms, meals, ale, hearth hall decent) | hall spirit ≥ 65 within 7 days |
| `mo_grief` | a friend dies; buried within a day | `friend_died` −15 halving every ~4.7 days; `buried_friend` +8 |

## 16 Combat

| id | Scenario | Expected |
|---|---|---|
| `cb_hit_table` | 10,000 attacks, skill 5 vs dodge 5, equal agility, defender without weapon or shield | hit rate 50% ± 2% |
| `cb_armor` | a common iron axe (attacker Strength 50) vs a common iron mail shirt and tunic (defender Toughness 50), 1,000 torso hits | damage 7 on every hit; every wound light |
| `cb_worked_examples` | the four examples in weapons-and-armor.md | numbers match ±1 |
| `cb_ranged` | crossbow, skill 6, range 8, at a deer (a fresh deer replaces a dead one) | hit 33% ± 3% over 2,000 shots; 17–23% of the bolts break, the rest drop |
| `cb_squad_station` | squad active at a station, raid arrives | members engage within perception; civilians flee |
| `cb_training` | squad in barracks with training axes, 10 days | weapon skill rises; no wounds |
| `cb_alert_hearth` | `SetAlert hearth` | civilians reach the hearth hall; `lock_on_alert` doors lock within grace |

## 17 Health

| id | Scenario | Expected |
|---|---|---|
| `he_bleed` | a dwarf with Toughness 50 and a serious cut on the torso, no treatment | unconscious at 600 ± 10 ticks; dead at 800 ± 10 ticks |
| `he_bandage` | same, with a hospital, cloth (no thread) and a medic of medicine skill 20 | `stop_bleeding` within 300 ticks of admission; survives; `PatientHealed` at day 15 ± 1 |
| `he_fracture` | fracture untreated vs splinted | untreated: `badly_healed_*` permanent; splinted: none |
| `he_infection` | a serious untreated cut, the dwarf sleeping in a bed, no miasma, 10 days | 49–74% infected over 100 runs (model 1 − 0.9⁹ = 61%); brightleaf cures in 3 days |
| `he_limb` | 60 damage to an arm (maxHp 36) | `LimbLost`; cannot wield two-handed |
| `he_fall` | a dwarf falls 3 levels | 54 damage to the torso, or damage capped at the leg's hp − 1 to a leg; a fracture either way; never `LimbLost` |

## 18 Threats

| id | Scenario | Expected |
|---|---|---|
| `th_schedule` | peril 1 region, 3 years | no raid before autumn year 2; `size` 5–12 (the captain is added on top) |
| `th_warning` | peril 2, first raid | `ThreatWarning` exactly `WARNING_DAYS` before `RaidArrived`; half under fog |
| `th_loiter` | raid with the gate up | party loiters; `RaidEnded { withdrew }` after 2 days |
| `th_retreat` | raid loses half its members | `RaidEnded { repelled }`; `raid_repelled` thought |
| `th_thief` | snatcher, unattended barrel outdoors, no dogs | `ThiefEscaped` within a day; with a dog within 10 tiles: `ThiefSpotted` before pickup ≥ 80% of runs |
| `th_troll_door` | trollkin at a locked door | `DoorBroken` after `DOOR_BREAK_TICKS` |
| `th_deep` | mine 5 deepsilver tiles | `DeepStirred { 1 }`; 3 `hollow_crawler` emerge adjacent to the last mined tile |
| `th_restless` | `old_battlefield`, autumn night | `RestlessRose`; all collapse at dawn |

## 19 Defense

| id | Scenario | Expected |
|---|---|---|
| `df_stone_fall` | goblin walks over an armed stone-fall trap | `TrapTriggered`; damage to a part; `spent`; rearm job |
| `df_cage` | trollkin over a cage trap | caged (size 150 ≤ cap); wyrm over it: nothing |
| `df_plate_bridge` | plate linked to a bridge, goblin steps on the plate | bridge raises after `LINK_DELAY_TICKS` (+ up to 9) |
| `df_dwarf_safe` | dwarf walks over the fortress's traps in `enemies` mode | nothing triggers |
| `df_retreat_tile` | hearth hall unreachable | civilians retreat behind the nearest door |

## 20 Trade

| id | Scenario | Expected |
|---|---|---|
| `td_schedule` | 2 years | Hillfolk day 5–18 of summer year 1; Wildwood autumn year 1; Mountainhome spring year 2 |
| `td_no_depot` | no depot | `CaravanWaiting`; leaves after 3 days; reputation −2 |
| `td_offer` | the worked example in `balance.md` (30 fine stone crafts and 42 lavish meals for goods priced 2,000) | accepted; reputation +4; with 41 meals refused, shortfall 12 |
| `td_wood_penalty` | offer 3 oak chairs to the Wildwood | reputation −6; trade still accepted if value suffices |
| `td_attack` | kill a merchant | `CaravanLost`; reputation −60 (−50 for the killing, −10 for the lost caravan); no caravan for 2 years |
| `td_requests` | request iron bars from the Mountainhome | its next caravan carries ≥ 5 iron bars |

## 21 Immigration

| id | Scenario | Expected |
|---|---|---|
| `im_guaranteed` | year 1, hall spirit 30 | waves at summer and autumn regardless |
| `im_threshold` | year 2, spirit 50 vs 60 | 50: `ImmigrationSkipped { spirit }`; 60: a wave with probability ~70% (over 100 seeds: 58–82) |
| `im_cap` | cap 20, population 20 | skipped `cap` |
| `im_composition` | fortress with no medic | ≥ 1 medic in the next 2 waves (over 20 seeds, ≥ 90%) |

## 22 Pathfinding

| id | Scenario | Expected |
|---|---|---|
| `pf_ramp` | ramp between two levels | path exists both ways; large creature uses it; stairs refused for `large` |
| `pf_corner` | diagonal past a wall corner | not taken |
| `pf_labels` | wall off a room | labels differ; open a door → equal after the next tick |
| `pf_budget` | 500 simultaneous requests | all served within 30 ticks; no tick exceeds the node budget |
| `pf_water` | corridor with water level 4 | impassable for walkers; level 3 passable at ×2 cost |

## 23 Rendering and 24 UI (manual and snapshot tests)

| id | Scenario | Expected |
|---|---|---|
| `rd_snapshot_surface` | render a fixed seed's surface at z=32 | cell buffer matches the stored golden (glyph, fg, bg) |
| `rd_levels_below` | open shaft 3 deep | cell shows the floor 2 below dimmed twice; 3 below shows abyss |
| `rd_overlay_priority` | designation over a creature | creature glyph wins; bg tinted |
| `ui_keymap_parity` | every UI action | reachable by a key and by a mouse path (checklist in the keymap table) |
| `ui_danger_pause` | `RaidArrived` | speed 0; view centered on the edge |
| `ui_hints_once` | trigger `hint_still` twice | shown once; saved as shown |

## Performance

| id | Scenario | Expected |
|---|---|---|
| `perf_reference` | the reference fortress, 2,000 ticks at 4× headless | average tick ≤ 12 ms on CI (2× budget); worst ≤ 40 ms |
| `perf_gen` | standard world + local map | ≤ 4 s combined on CI |

## Traceability

Every bullet of the original brief maps to tests: world map (`wg_*`), 3D map and digging (`tr_*`, `pf_*`), water and lava (`fl_*`, `ma_*`), minerals and smelting (`tr_dig_room`, `ws_fuel`, `ws_steel`, `ws_magma`), animals/plants/hunting/gathering/farming/domestication (`an_*`, `pl_*`, `fo_*`), weather and seasons (`we_*`, `fl_freeze`), fighting (`cb_*`), health and medicine (`he_*`), cave monsters and raids (`th_*`), traps and defense (`df_*`, `bd_bridge`, `bd_floodgate`), storage and buildings (`it_*`, `bd_*`), jobs and priorities (`jb_*`), professions (`ws_*`), rooms and comfort (`bd_room_tiers`, `dw_sleep`), happiness without spirals (`mo_*`), embark loadout (`core_*` default embark, embark UI checklist), immigration (`im_*`), caravans (`td_*`), browser controls and ASCII (`rd_*`, `ui_*`).
