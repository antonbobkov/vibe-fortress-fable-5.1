# Audit: do the scripted playthroughs cover the game's major features?

**Task:** T-114 · **Date:** 2026-10-08 · **Commit examined:** `c625aa8` · **Kind:** audit; no source, test, fixture or spec file was changed

## The answer

No. The long playthroughs exercise one fortress: dig, farm, brew, cook, build rooms, smelt iron, forge, trade. That is about a third of the game. The rest is reached only by single-rule acceptance scenarios and unit tests, or by nothing.

- **Commands.** The four long runs accept 25 of the 78 simulation commands. 52 more are applied only by scenarios, unit or property tests. One, `ReleaseCage`, is applied by no test.
- **Content.** The long runs complete 27 of 151 recipes, 17 of 57 building types and 16 of 44 job types, and create 7 of 14 zone types. They plant 3 crops.
- **UI.** The browser year (`full-year`) drives the real UI only up to the embark. After that it sends every command with `host.world.applyCommand` and steps the simulation with the hook. The other browser specs are short, and each tests one interaction on a paused or freshly embarked fortress. No spec does anything in the stocks, jobs, animals, threats, population, mood, log, look or help panels, or reaches the legend screen.
- **Danger.** `year_one`, `three_years` and `full-year` run at peril 0. Perils 2 and 4 are reached only by the 20-seed sweep. The sweep is not part of `npm test`, asserts almost nothing at those perils, and its fortress does not survive there (T-140 to T-145).

Would a playthrough notice a broken feature? Only for the peril-0 economy chain, the caravan and immigration calendar, and the mood floor. Everything else would stay green.

## How this was established

- **Measured.** A recorder patched `World.applyCommand` and `World.step` and counted, for each test, every command result and every delivered event, with the recipe, building, job, zone or raid kind where the payload has one. It ran over all of `npm test` (201 files, 1,902 tests, all passing), over `buildPlayedReference` and `buildScriptedReference` (the performance fixtures), and over one sweep seed at each of perils 2 and 4 (`three-years-p2-1`, `three-years-p4-1`), which play exactly what `three_years_seeds` plays. The 20-seed sweep itself was not run. The counts are in [`../data/2026-10-08-playthrough-coverage-counts.txt`](../data/2026-10-08-playthrough-coverage-counts.txt) and the recorder is in [`../data/2026-10-08-playthrough-coverage-recorder.ts.txt`](../data/2026-10-08-playthrough-coverage-recorder.ts.txt).
- **Read.** The browser specs were read. They were not run and not instrumented. Every statement about `test/e2e/` is marked *read*.
- **Limits of the recorder.** It sees a command only when it goes through `World.applyCommand`, and an event only when a `World` delivers it during `step`. A unit test that calls a system or a rule function directly is invisible to it. "No recorded test" therefore means "no test that steps a world". Where that matters, the report adds a text search of `test/`.

"Long runs" below means `year_one` (flat-test map, peril 0, one year), `three_years` (generated 48 × 48 map, peril 0, three years) and the two sweep seeds (the same fortress at perils 2 and 4, three years).

## The ten largest gaps

Ranked by how much of the game sits behind each.

1. **Defence is not played.** No long run builds a trap, a lever, a bridge, a floodgate, a fortification or a hatch. Measured: none of those buildings is completed, and `TrapTriggered`, `MechanismToggled` and `PullLever` never occur. The squad is created with mode `off`. It is never equipped (`SetSquadEquipment` never sent), never trains (`TrainingSession` 0), and has no barracks or archery range. The only orders it gets are `station` and `cancel`; `kill` and patrol are never given. At peril 4 the measured seed had 17 thief parties, 7 ambushes, 5 raids, 2 bandit parties and 1 siege; 19 ended `looted`, 13 `withdrew`, none `repelled`. Every rule of system 19 rests on the `df_*` scenarios, each a hand-built room.
2. **Health and burial are not played.** At peril 4, 13 patients were admitted and none was treated. No long run has a hospital zone, so `TreatmentDone`, `PatientHealed` and `InfectionStarted` never occur. Thirteen fortress creatures died and none was buried (`Buried` 0); no coffin, tomb or memorial is ever built. The medical jobs `diagnose`, `clean_wound`, `set_bone` and `stop_bleeding` are completed only in the `he_*` scenarios. `suture`, `dress_burn` and `give_crutch` are completed in no test that steps a world; their rules have unit tests in `test/unit/health/health.test.ts`.
3. **`full-year` is not a UI playthrough.** *Read:* after the embark it issues its commands at 22 call sites through `host.world.applyCommand` inside `page.evaluate`, never opens a panel, and advances time with `h.step`, not the frame loop. `testing-strategy.md` says browser tests "never call `submit` except to set up state faster" and describes `full-year` as a year played through the UI. It also never trades. It does not assert that no dwarf died: its comment says so, but the assertion is only that more than seven are alive.
4. **Animals, hunting, fishing and gathering are not played.** No long run slaughters, butchers, milks, shears, collects eggs, tames, trains, hunts, fishes or gathers (measured: 0 completions of those job types). `AssignPasture` is sent and rejected `not_tame` three times in every run, and nothing checks the result. No butcher, tannery, leatherworks, kennel, nest box, farmer's workshop, loom or clothier is built. The whole chain is covered by `an_*`, `fo_*` and unit tests only.
5. **The Deep, the caverns and magma are not played.** No long run breaches a cavern, mines deepsilver, stirs the Deep or builds a magma workshop (`CavernBreached`, `DeepsilverMined`, `DeepStirred`, `MonsterEmerged`, `MagmaContact`: 0). `th_deep`, `tr_discovery` and `tr_deepsilver_gate` cover the rules on flat-test maps. `MonsterSpawned` is delivered in no stepped test at all.
6. **Perils 2 and 4 are outside `npm test`, and the sweep cannot fail there.** Above peril 0, `three_years_seeds` asserts only the population cap, the wave cap and the mood floor of the survivors. The measured peril-2 seed completed 2 build jobs in three years, dug nothing (`TilesDiscovered` 0), completed no trade, and lost 20 fortress creatures. The test passes. T-140 to T-145 cover why that fortress dies. Nothing covers the fact that the sweep would not notice.
7. **Most panels and three screens are opened and never used.** *Read:* `panels-open-and-close` opens every registered panel and checks its title. No spec does anything in stocks (forbid, dump, melt), jobs (cancel, priority), animals, threats, population (the cap), mood, log, look or help, in any overlay other than fluid levels, or in the standing orders. The legend screen is never reached and nothing retires a fortress. The embark screen is used only for "Balanced preset, Enter": skills, supplies, animals, reroll and rename are not touched.
8. **Fifty-two commands have no playthrough.** The command table lists them. Among them are things a player does every session: `UndoDesignation`, `CancelBuilding`, `DeconstructBuilding`, `RemoveZone`, `ForbidItem`, `DumpItem`, `SetStandingOrder`, `AssignTitle`, `SetWorkshopWorker`, `SuspendWorkshop`, `RemoveWorkOrder`, `CancelJob`.
9. **The scripts do not check their own steps.** The three-year script ignores command results. At peril 0 it had 2,872 rejected `PlaceBuilding` commands (1,442 `bad_placement`, 1,430 `footprint_blocked`). It retries three of its six gate walls on every check for three years, never places the gate doors, and so never sets a door mode. The scenario passes. A script step that silently stops happening removes coverage and nobody sees it.
10. **Content that no test names.** A text search of `test/` finds no mention of the job types `bandage_animal`, `clean_trap` and `carve_ramp`, the buildings `weapon_rack` and `armor_stand`, or the event `DangerAnnounced`. `ReleaseCage` is checked only as "the panel sends it". The events `TrapJammed`, `TrapRearmed`, `AmbushSprung`, `HuntAbandoned` and `FishPoolDepleted` appear only in the announcement-registry and UI tests; no running system emits them in any test.

Smaller gaps:

- No long run saves and reloads.
- No long run is on a map with temper above 0. Cold snaps and heatwaves occur only in the `we_*` scenarios.
- 124 of the 151 recipes are unplayed: everything in wood beyond barrels, beds and tables, and all bone, shell, cloth, leather and non-iron metal work.
- `year_one` builds a depot and receives two caravans at it, and never trades (`TradeCompleted` 0, measured).
- No long run ever sees a non-guaranteed immigration wave. Every later evaluation is skipped for `spirit`. The balance rows B-008 to B-012 already track that.

## What the long runs reach

Measured, as distinct accepted command types, distinct delivered event types, and distinct ids.

| Run | Map, peril, length | Commands (of 78) | Events (of 168) | Recipes (of 151) | Buildings completed (of 57) | Job types (of 44) | Asserted |
|---|---|---|---|---|---|---|---|
| `year_one` | flat-test 48 × 48, peril 0, 1 year | 8 | 64 | 3 | 7 | 7 | bootstrap bounds to day 20; caravan and wave calendar; no raid; no dwarf death; population above 7 |
| `three_years` | generated 48 × 48, peril 0, 3 years | 22 | 84 | 27 | 16 | 12 | seven recipes completed; engraving happened; a trade with every caravan; mood floor; thought caps; no dwarf death; population above 7 and under the cap |
| sweep seed, peril 2 | the same fortress, 3 years | 20 | 85 | 3 | 3 | 7 | population cap, wave cap, mood floor of survivors |
| sweep seed, peril 4 | the same fortress, 3 years | 25 | 113 | 20 | 17 | 16 | the same three |
| performance fixtures | generated; built by setup helpers, then 4,200 ticks played | 8 | 57 | 5 | 13 | 3 | budgets; `played_behavior` (dwarves alive, the lake settles, orders and hauling run) |
| `full-year` (browser) | generated `e2e-year`, peril 0, 1 year | 8, all by direct `applyCommand` (*read*) | not measured | 4 ordered (*read*) | not measured | not measured | caravan and wave calendar; no raid; population above 7; no page error |

The 25 commands accepted in a long run: `Designate` (dig, chop, smooth, engrave), `SetTraffic`, `DesignateStairwell`, `SetPlotCrop`, `SetLabor`, `SetLaborPriority`, `SetJobPriority`, `AddWorkOrder`, `EditWorkOrder`, `SetStockpileFilter`, `SetStockpilePriority`, `PlaceBuilding`, `CreateZone`, `SetDoorMode`, `CreateSquad`, `SetSquadMembers`, `SetSquadMode`, `SquadOrder`, `SetAlert`, `MoveToDepot`, `RemoveFromDepot`, `TradeOpen`, `TradeOffer`, `TradeCancel`, `SetRequests`.

The performance fixtures place their buildings with the instant `build` helper and spawn their dwarves, so they are setup, not play. They are the only long fixture with a mechanic's workshop, a statue, a chain post and paved floor.

## Feature table: systems

"Asserted there" means an assertion in that playthrough would fail if the feature broke. P0, P2 and P4 are the perils reached.

| System | Long playthrough | Through | Asserted there | Perils, years | Otherwise covered by |
|---|---|---|---|---|---|
| 01 World generation | `full-year` generates a world (*read*); the headless runs use a region spec | UI in the browser | region filter text only | — | `wg_*` scenarios, `test/unit/worldgen`, world-hash golden |
| 02 Embark and loadout | Balanced preset everywhere; the sweep buys an anvil through `EmbarkSession` at P2 and P4 | UI for the preset (*read*); app commands headless | "Spent 1,480" in the browser | P0–P4 | `test/unit/embark`. Skills, supplies, animals, reroll, rename: unit only |
| 03 Terrain and mining | dig, stairwell, chop, smooth, engrave; ore, gems and coal mined | commands | room dug by day 8 (`year_one`); engraving above 0 (`three_years`) | P0–P4, 3 years | channel, ramp, single stairs, remove, cavern breach, collapse, deepsilver: `tr_*` and unit |
| 04 Fluids | the brook flows, freezes and thaws; in `three_years` nobody drinks water (`DrankWater` 0) | simulation only | freezing only in the cold seasons (`year_one`) | P0–P4 | `fl_*`, property test, `fl_perf`. Pressure, drowning, wells: scenarios only |
| 05 Materials and temperature | temperature ticks; lightning fires at P2 and P4 (34 and 25 `FireStarted`) | simulation only | no | P2, P4 | `ma_*`. Magma, melting, fire spread: scenarios and unit |
| 06 Weather and seasons | the six ordinary states; never cold snap or heatwave | simulation only | no | P0–P4, 3 years | `we_*`, `pl_frost` |
| 07 Plants and farming | barley, turnip and dimcap planted and harvested, on surface and cave plots | commands | a crop by day 20; the cave farm sows in winter; the surface plot does not | P0–P4, 3 years | `pl_*`. 31 of 34 plant rows are never planted in a long run. `DesignateHarvest`: unit only |
| 08 Animals | embark animals breed, starve and give `ProductReady` twice; no animal command succeeds | simulation only (`AssignPasture` rejected) | no | P0–P4 | `an_*`, `test/unit/animals` |
| 09 Hunting, gathering, fishing | nothing | — | no | — | `fo_*`, `test/unit/foraging` |
| 10 Dwarves | needs, sleep, talk, sit, hearth visits, skill gains | simulation only | at least 10 `Talked` by day 20; no death | P0–P4, 3 years | `dw_*`. Titles, schedules, rename, children: scenarios and unit |
| 11 Jobs and labor | labor toggles, labor priorities, job priority | commands | at most 200 `missing_input` blocks by day 20 | P0–P4 | `jb_*`. `CancelJob`, standing orders: unit and property |
| 12 Workshops | 9 workshop types, 27 recipes, maintain and once orders, material filter, order edit | commands | seven recipes above 0 (`three_years`); first brew by day 20 | P0, P4 | `recipe-smoke` and the workshop unit tests complete each of the 151 recipes at least once; `ws_*`. Remove, reorder, suspend, assigned worker: unit and property |
| 13 Items and storage | stockpiles with three filters and priorities; rot, miasma, wealth | commands | no (wealth is printed) | P0–P4 | `it_*`. Forbid, dump, melt, containers, links: scenarios and unit |
| 14 Buildings and rooms | 17 building types; bedroom, dining hall, hearth hall, meeting area; room tiers; 12 rooms assigned by the game | commands | workshop build bounds (`year_one`) | P0, P4 | `bd_*`. Deconstruct, cancel, resize, remove, mechanisms, coffins: scenarios and unit |
| 15 Happiness and morale | mood tiers, sulks, hall spirit | simulation only | mood floor, thought caps | P0–P4, 3 years | `mo_*`, property test. Which of the 87 thoughts a long run produces was not established |
| 16 Combat | at P2 and P4 hostiles attack; one squad is stationed on alert | commands (`SetAlert`, `SquadOrder`) | no | P2, P4 | `cb_*`, `test/unit/combat`. Training, equipment, ranged, kill order: scenarios and unit |
| 17 Health and medicine | wounds, bleeding, unconsciousness; 13 admissions at P4; no treatment | simulation only | no | P2, P4 | `he_*`, `test/unit/health` |
| 18 Threats | thieves at P0; bandits, ambushes, raids and one siege at P4 | simulation only | no raid at P0 in year 1 | P0–P4 | `th_*`. The Deep, restless dead, trolls at doors, cavern monsters: scenarios and unit |
| 19 Defence and traps | two gate doors set to `lock_on_alert`, at P4 only | commands | no | P4 | `df_*`, `test/unit/defense` |
| 20 Trade and caravans | eight caravans in three years; depot, requests, offers, purchases carried home | commands | every arriving caravan completes a trade (`three_years`, P0 only); caravan windows (`year_one`) | P0–P4 | `td_*`. Gifts, refusals, an attacked caravan, no depot: scenarios. UI: `trade-session` |
| 21 Immigration | the two guaranteed waves; every later evaluation skipped for spirit | simulation only | wave count, size and season; caps | P0–P4, 3 years | `im_*`. `SetPopulationCap`: scenario and unit |
| 22 Pathfinding | used by everything | — | no | all | `pf_*`, property tests, performance tier |
| 23 Rendering | `full-year` takes three screenshots (*read*) | — | no page error | P0 | render goldens, `rd_*`, `test/unit/render` |
| 24 UI and input | see the next two tables | | | | |

## Feature table: balance chains

| Chain (`balance.md`) | Long playthrough | Asserted there |
|---|---|---|
| Food | `three_years`: farm, kitchen, three meal grades; 942 meals in 3,808 dwarf-days | no; the rate is printed (0.25 against a model of 0.48; T-140) |
| Drink | `three_years`: still, barrels, drink stockpiles; `year_one` also water from a spring | first brew by day 20 |
| Metal | `three_years`: charcoal, hematite and limonite smelted, iron tools and armour forged, steel alloyed in year 3 | yes: seven recipes above 0 |
| Trade | `three_years`: eight trades | yes at P0; nothing at P2 and P4 |
| Defence | P4 seed: alert, doors, a stationed squad | no |
| Immigration | every long run: the guaranteed waves | yes |
| Rooms and mood | `three_years`: 14 bedrooms, two halls, smoothing, engraving | mood floor and caps only; room tiers are not asserted |
| Health | none | no |
| The Deep | none | no |

## Feature table: screens and panels

All *read* from `test/e2e/`. "Opened" means `panels-open-and-close` presses the hotkey and checks the title. Every panel also has a jsdom unit test under `test/unit/ui`, and most have a render golden. Those are not playthroughs.

| Screen or panel | Browser spec | Through | Asserted | Not exercised |
|---|---|---|---|---|
| `main_menu` | every spec that generates a world; `export-import`, `quick-save-load` | keys | screen id | Legends, About, Continue |
| `world_gen` | the `generateWorld` helper | keys | "Stage: names" | size, preview |
| `world_map` | `generate-and-embark`, `full-year` | keys | region panel text, filter panel text | biome legend |
| `embark` | every spec that generates a world | keys | "Balanced", "Spent 1,480" | tabs, skills, supplies, animals, reroll, rename, fortress name |
| `fortress` | all | keys, mouse | — | see the panels |
| `trade_session` | `trade-session` | keys | `TradeCompleted`, reputation | gift, refusal |
| `labor_manager` | `labor-manager` | keys, mouse | the labors of two dwarves | priority keys, row and column toggles |
| `legend` | none | — | — | never reached; no fortress is retired |
| `settings` | `save-load-settings`, `game-menu` | keys | zoom, one rebound key | palette, auto-pause, hints, autosave |
| `load` | `quick-save-load`, `export-import`, `save-load-settings` | keys, mouse | world hash after the load | deleting a save |
| `confirm` | `quick-save-load`, `game-menu` | keys | screen id | — |
| `text_input` | `labor-manager` | keys | the new name | — |
| `game_menu` | `game-menu` | keys | entries, pause | its Save, Load and Retire entries |
| Designate `d` | `designate-by-drag`, `farm-plot-and-orders`, `game-menu` | keys, mouse drag | the designation exists; status text | every kind but dig; priority; undo; stairwell |
| Build `b` | `build-and-stockpile`, `drag-place` | keys, mouse | ghost refusal text; a wall completes; three beds placed | workshops, rotation, most categories |
| Zones `z` and the stockpile editor | `build-and-stockpile`, `zones-editor`, `farm-plot-and-orders` | keys, mouse | filter, containers, priority, quality, materials, room owner, plot crops | 11 of 14 zone types; resize; remove; hospital, pasture and squad settings |
| Building panel (click) | `building-panel` | mouse, keys | door mode; a lever link started | workshop, trap, cage, coffin and plate panels |
| Units `u` | `labor-manager` | keys | rename | titles, schedule |
| Labors `l` | `labor-manager` | keys | opens the manager | — |
| Jobs `j` | opened | keys | title | cancel, priority |
| Orders `o` | `farm-plot-and-orders` | keys, mouse | order added, mode, material, drink made | remove, reorder, standing orders |
| Stocks `s` | opened | keys | title | forbid, dump, melt, the tree |
| Military `m` | `military-and-alert`, `labor-manager` | keys, mouse | squad, member, station, alert, door locked, civilian indoors | equipment, leader, mode, barracks, patrol, kill order, disband |
| Animals `n` | opened | keys | title | everything |
| Threats `t` | opened | keys | title | everything |
| Civilizations `c` and the depot | `trade-session` | keys | texts, reputation | requests (the spec sends `SetRequests` directly) |
| Population `p` | opened | keys | title | the cap |
| Mood `e` | opened | keys | title | everything |
| Log `a` | opened | keys | title | filters, combat tab |
| Look `k` | opened | keys | title | inspection |
| Overlays `f` | `fluid-overlay` | keys | fluid digits drawn | the other overlays |
| Help `?`, Debug `F12` | opened if registered | keys | title | — |

Not exercised by any browser spec (*read*): `Ctrl+Z`, `Delete` on a selection, `Ctrl+S`, the zoom keys, the traffic tool, a rectangle selection with forbid, dump or move to depot, right click, the wheel, double click.

## Feature table: commands

The counts are accepted commands (measured). The browser column is *read*. A dash means no browser spec sends the command through the UI.

| Command | Long playthroughs (accepted: p0 / p2 / p4 / year_one) | E2E through the real UI (read) | Otherwise applied by (measured) |
|---|---|---|---|
| `Designate` | 28 / 10 / 26 / 2 | designate-by-drag, farm-plot-and-orders | scenarios 120, unit 43, property 20, golden 5 |
| `UndoDesignation` | never | — | scenarios 6, unit 3, property 16 (`core_determinism`) |
| `SetDesignationPriority` | never | — | unit 2 |
| `SetTraffic` | 19 / 11 / 19 / 0 | — | scenarios 2, unit 4, property 16 |
| `DesignateStairwell` | 2 / 2 / 2 / 1 | — | scenarios 1, unit 1 |
| `DesignateHarvest` | never | — | unit 1 |
| `ConfirmDeepsilver` | never | — | scenarios 2, unit 2 (`tr_deepsilver_gate`, `th_deep`) |
| `SetPlotCrop` | 11 / 3 / 11 / 6 | farm-plot-and-orders | scenarios 4, unit 4, property 18, perf fixture 4 |
| `AssignPasture` | never | — | scenarios 4, unit 2, property 16 (`an_breed`, `an_pasture`) |
| `MarkSlaughter` | never | — | unit 3, property 14 |
| `UnmarkSlaughter` | never | — | unit 1 |
| `TrainAnimal` | never | — | unit 1 |
| `TameCaged` | never | — | scenarios 1, unit 1 (`an_tame`) |
| `AssignAnimal` | never | — | unit 4 |
| `SetBreedingCap` | never | — | unit 2 |
| `ReleaseCaged` | never | — | unit 2 |
| `SetHuntable` | never | — | unit 1 |
| `SetLabor` | 14 / 14 / 14 / 0 | labor-manager | scenarios 814, unit 273, property 16 |
| `SetLaborPriority` | 14 / 14 / 14 / 0 | — | scenarios 2, unit 9 |
| `CancelJob` | never | — | unit 5 |
| `SetJobPriority` | 191 / 1 / 89 / 0 | — | unit 1 |
| `SetStandingOrder` | never | — | unit 5, property 21 |
| `AssignTitle` | never | — | scenarios 3, unit 10, property 12 (`dw_title`, `td_offer`) |
| `RenameDwarf` | never | labor-manager | unit 3 |
| `SetSchedule` | never | — | unit 3 |
| `AddWorkOrder` | 30 / 3 / 30 / 3 | farm-plot-and-orders | scenarios 10, unit 185, property 36, golden 3, perf fixture 6 |
| `EditWorkOrder` | 4 / 2 / 8 / 0 | — | unit 18, property 16 |
| `RemoveWorkOrder` | never | — | unit 2 |
| `ReorderWorkOrder` | never | — | unit 2 |
| `SetWorkshopWorker` | never | — | unit 4, property 16 |
| `SuspendWorkshop` | never | — | unit 2, property 14 |
| `ForbidItem` | never | — | scenarios 1, unit 6, property 16 (`it_forbid`) |
| `ClaimItem` | never | — | scenarios 1, unit 1 (`it_forbid`) |
| `DumpItem` | never | — | unit 2 |
| `MeltItem` | never | — | unit 14, property 13 |
| `SetStockpileFilter` | 4 / 2 / 4 / 1 | build-and-stockpile, zones-editor | scenarios 8, unit 35, property 22, golden 2, perf fixture 2 |
| `SetStockpileContainers` | never | zones-editor | scenarios 1, unit 8 (`it_containers`) |
| `SetStockpilePriority` | 3 / 1 / 3 / 0 | zones-editor | unit 2 |
| `LinkStockpile` | never | — | unit 2 |
| `PlaceBuilding` | 40 / 10 / 45 / 6 | build-and-stockpile, drag-place | scenarios 190, unit 442, property 178, golden 9, perf fixture 605 |
| `CancelBuilding` | never | — | unit 11, property 9 |
| `DeconstructBuilding` | never | — | unit 5 |
| `SetBuildingPriority` | never | — | unit 3 |
| `CreateZone` | 26 / 5 / 26 / 4 | build-and-stockpile, farm-plot-and-orders | scenarios 31, unit 118, property 112, golden 5, perf fixture 63 |
| `ResizeZone` | never | — | unit 1 |
| `RemoveZone` | never | — | unit 7, property 18 |
| `SetZoneSetting` | never | — | unit 9 |
| `AssignRoom` | never | zones-editor | scenarios 2, unit 5 (`dw_sleep`, `mo_hall_spirit`) |
| `LinkMechanism` | never | building-panel | unit 3 |
| `UnlinkMechanism` | never | — | unit 2 |
| `SetDoorMode` | 0 / 0 / 2 / 0 | building-panel | scenarios 6, unit 24, golden 1 |
| `SetHatchMode` | never | — | scenarios 1, unit 4 (`df_pattern_pit`) |
| `SetPlateTrigger` | never | — | unit 4 |
| `ReleaseCage` | never | — | **nothing** |
| `AssignCoffin` | never | — | scenarios 1, unit 1 (`bd_burial`) |
| `CreateSquad` | 1 / 1 / 1 / 0 | military-and-alert, labor-manager | scenarios 3, unit 36, property 45, golden 2, perf fixture 1 |
| `DisbandSquad` | never | — | unit 2 |
| `SetSquadMembers` | 1 / 1 / 1 / 0 | military-and-alert, labor-manager | scenarios 3, unit 16, golden 1, perf fixture 1 |
| `SetSquadLeader` | never | — | unit 3 |
| `SetSquadMode` | 1 / 1 / 1 / 0 | — | scenarios 2, unit 5, property 10, golden 1 |
| `SetSquadEquipment` | never | — | scenarios 1, unit 7 (`cb_training`) |
| `SetSquadStation` | never | military-and-alert | scenarios 2, unit 3, golden 1, perf fixture 1 |
| `SetSquadPatrol` | never | — | unit 1, golden 1 |
| `SquadOrder` | 0 / 3 / 28 / 0 | — | unit 3 |
| `SetAlert` | 0 / 3 / 28 / 0 | military-and-alert | scenarios 2, unit 15, property 12 |
| `SetHospitalSupplies` | never | — | unit 1, property 8 |
| `SetTrapMode` | never | — | unit 2, property 4 |
| `PullLever` | never | — | scenarios 3, unit 3, property 4 (`bd_bridge`, `bd_floodgate`, `df_pattern_gate`) |
| `MoveToDepot` | 142 / 0 / 69 / 0 | — | scenarios 4, unit 1, property 12, golden 1 |
| `RemoveFromDepot` | 8 / 0 / 7 / 0 | — | scenarios 1 |
| `TradeOpen` | 9 / 36 / 9 / 0 | trade-session | scenarios 3 |
| `TradeOffer` | 8 / 0 / 7 / 0 | trade-session | scenarios 6 |
| `TradeCancel` | 8 / 0 / 7 / 0 | — | scenarios 1 |
| `SetRequests` | 1 / 1 / 1 / 1 | — | scenarios 1, unit 1, property 12 |
| `SetPopulationCap` | never | — | scenarios 2, unit 11, property 10, golden 1 (`im_cap`) |
| `NameAnimal` | never | — | unit 1 |
| `RenameSquad` | never | — | unit 1 |
| `RenameFortress` | never | — | unit 21 |

The app-level commands (`Save`, `Load`, `SetSpeed`, `SetSetting`, `ApplyPreset`, `ConfirmEmbark`) are sent through the UI by the browser specs (*read*). `RetireFortress`, `SetSkill`, `RerollDwarf`, `SetSupply`, `SetFortressName` and the embark `RenameDwarf` are sent by no browser spec; the sweep sends `SetSupply` headless.

## Never touched

All measured, from the counts file. "Long run" is the four runs defined above; the performance fixtures are named where they add something.

**Commands never accepted in a long run (53).** `UndoDesignation`, `SetDesignationPriority`, `DesignateHarvest`, `ConfirmDeepsilver`, `AssignPasture`, `MarkSlaughter`, `UnmarkSlaughter`, `TrainAnimal`, `TameCaged`, `AssignAnimal`, `SetBreedingCap`, `ReleaseCaged`, `SetHuntable`, `CancelJob`, `SetStandingOrder`, `AssignTitle`, `RenameDwarf`, `SetSchedule`, `RemoveWorkOrder`, `ReorderWorkOrder`, `SetWorkshopWorker`, `SuspendWorkshop`, `ForbidItem`, `ClaimItem`, `DumpItem`, `MeltItem`, `SetStockpileContainers`, `LinkStockpile`, `CancelBuilding`, `DeconstructBuilding`, `SetBuildingPriority`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`, `AssignRoom`, `LinkMechanism`, `UnlinkMechanism`, `SetHatchMode`, `SetPlateTrigger`, `ReleaseCage`, `AssignCoffin`, `DisbandSquad`, `SetSquadLeader`, `SetSquadEquipment`, `SetSquadStation` (the played performance fixture sends it once), `SetSquadPatrol`, `SetHospitalSupplies`, `SetTrapMode`, `PullLever`, `SetPopulationCap`, `NameAnimal`, `RenameSquad`, `RenameFortress`.

**Command never accepted in any recorded test (1).** `ReleaseCage`.

**Events never delivered in any recorded test (10).** `WorldGenerated`, `HuntAbandoned`, `FishPoolDepleted`, `DwarfNearSpring`, `LegendaryReached`, `AmbushSprung`, `MonsterSpawned`, `TrapJammed`, `TrapRearmed`, `DangerAnnounced`. Seven ambush parties arrived at peril 4 and `AmbushSprung` was not delivered once; see the last section.

**Events delivered only outside the playthroughs (42).** `CommandRejected`, `DeepsilverMined`, `CavernBreached`, `ConstructionCollapsed`, `MagmaContact`, `ItemMelted`, `ShrubRegrown`, `AnimalSpawned`, `AnimalLeft`, `GrassGrazed`, `AnimalTamed`, `AnimalTrained`, `HuntStarted`, `HuntKill`, `FishCaught`, `ButcheryDone`, `DwarfFeltMist`, `SawMasterwork`, `TitleAssigned`, `DwarfBecameAdult`, `ToolDropped`, `MasterworkCreated`, `DoorBroken`, `Buried`, `MechanismToggled`, `TrainingSession`, `CreatureConscious`, `InfectionStarted`, `InfectionCured`, `TreatmentDone`, `MonsterEmerged`, `DeepStirred`, `DoorBreakAttempt`, `RestlessRose`, `TrapTriggered`, `TrapSpent`, `CreatureCaged`, `MechanismTriggered`, `CaravanLost`, `TradeRefused`, `GiftGiven`, `Fell`. Three years of play produce no masterwork, no title, no child growing up and no dropped tool.

**Recipes completed in a long run (27 of 151).** The game has 129 recipe rows and 22 generated smelting, alloy and melting recipes; the counts file marks the generated ones "(not in table)". Completed: `brew`, `cook_easy_meal`, `cook_fine_meal`, `cook_lavish_meal`, `craft_stone`, `cut_gem`, `make_barrel`, `make_bed`, `make_table_wood`, `make_stone_block`, `make_door_stone`, `make_table_stone`, `make_chair_stone`, `make_charcoal`, `smelt_hematite`, `smelt_limonite`, `alloy_steel`, `forge_pick`, `forge_mail_shirt`, `forge_shield`, `forge_short_sword`, `forge_battle_axe`, `forge_helm`, `forge_greaves`, `forge_gauntlets`, `forge_metal_boots`, `forge_crafts`. All 27 come from the peril-0 run. The other 124 are each completed at least once by `test/unit/workshops/` (mostly `recipe-smoke.test.ts`, which orders the recipe in a prepared room). No recipe is completed by no test.

**Building types never completed in any recorded test (7 of 57).** `armor_stand`, `weapon_rack`, `magma_kiln`, `ramp`, `stairs_down`, `stairs_up`, `stairs_updown`. `magma_kiln` has unit tests that do not step a world. `armor_stand` and `weapon_rack` are named in no test.

**Building types completed only outside the long runs (33).** `archery_target`, `bowyer`, `butcher`, `cabinet`, `cage_building`, `cage_trap`, `chain_post`, `chest`, `clothier`, `coffin`, `drawbridge`, `farmers_workshop`, `floodgate_building`, `floor`, `fortification`, `hatch`, `kennel`, `leatherworks`, `lever`, `loom`, `magma_forge`, `magma_smelter`, `mechanic`, `memorial_slab`, `nest_box`, `paved_floor`, `pressure_plate`, `spike_trap`, `statue`, `stone_fall_trap`, `tannery`, `weapon_trap`, `well`.

**Job types never completed in any recorded test (7 of 44).** `bandage_animal`, `carve_ramp`, `clean_trap`, `dress_burn`, `give_crutch`, `rearm_trap`, `suture`.

**Job types completed only outside the long runs (21).** `bury`, `butcher`, `channel`, `clean_wound`, `collect_egg`, `deconstruct`, `diagnose`, `fish`, `gather`, `haul_to_dump`, `hunt`, `link_mechanism`, `milk_animal`, `pull_lever`, `remove_construction`, `set_bone`, `shear_animal`, `slaughter`, `stop_bleeding`, `tame_animal`, `train_animal`.

**Zone types never created in a long run (7 of 14).** `archery_range`, `barracks`, `dump`, `fishing`, `gather`, `hospital`, `tomb`.

**Other.** Designation kinds never used in a long run: channel, ramp, the three single stairs, remove. Alert level `watchful` and squad order `kill`: unit and property tests only. Raid outcomes `repelled` and `wiped`: scenarios and unit tests only. Trap kinds: none in a long run. Treatments: none in a long run. Weather `cold_snap` and `heatwave`: scenarios only. Immigration skip reasons `cap` and `luck`: one scenario and one unit test.

**Panels and screens never used by a browser spec** (*read*): the legend screen; the jobs, stocks, animals, threats, population, mood, log, look and help panels beyond their title.

## Recommended additions

Each is a backlog row. Sizes are S, M, L as in `agent-workflow.md`.

| Task | Addition | Kind | Size |
|---|---|---|---|
| T-150 | `full-year` plays its year through the real panels and the frame loop, trades once, and asserts that nobody died | new steps in an existing browser spec | M |
| T-151 | A defence year: traps, a lever and bridge, an equipped and trained squad, raids repelled, at peril 2 on a generated map | new long scenario | L |
| T-152 | A hospital and burial run: wounds treated by real jobs to a discharge, the dead buried | new long scenario | M |
| T-153 | A homestead year: livestock, butchery, leather, cloth, hunting, fishing, gathering | new long scenario | M |
| T-154 | A descent: caverns breached, deepsilver, the Deep stirring, magma workshops | new long scenario | L |
| T-155 | Browser specs for the panels and screens that are only opened: stocks, jobs, animals, threats, population, mood, log, look, the custom embark, retire and legend | new browser specs | L |
| T-156 | The long fixtures check their own steps, and the sweep asserts what it claims to exercise at perils 2 and 4 | new assertions in existing fixtures | M |
| T-157 | Every command, event, job type and building type is exercised by at least one test, or is recorded as unreachable | new scenarios and one inventory test | M |

T-151 needs T-140 and T-141, because the peril-2 fortress does not live long enough today. T-156 needs T-145, which rewrites the same fixture file. T-150 to T-157 otherwise touch different files.

## Things that look like bugs

Described with their evidence. None was fixed.

1. **The three-year fixture never finishes its gate at peril 0.** Measured on seed `three-years`: `PlaceBuilding` for `wall` is accepted 3 times, not 6; `door` is never placed; 2,872 `PlaceBuilding` commands are rejected (`bad_placement` 1,442, `footprint_blocked` 1,430). At peril 4 on `three-years-p4-1` all six walls and both doors are built and there are no such rejections. Read: `checkFortressDefense` in `test/scenarios/three_years_fortress.ts` retries every missing wall on every check and ignores the result. Which wall tiles are refused, and why at this site, was not established. A fixture fault; filed under T-156.
2. **`AssignPasture` is rejected `not_tame` three times in every three-year run** (measured at perils 0, 2 and 4). Read: `setupThreeYearsFortress` sends it for every entity that has the `Tame` component. Either three embark animals carry `Tame` and are refused as not tame, or the fixture selects the wrong entities. Not established which. Filed under T-156.
3. **Seven ambush parties arrive and `AmbushSprung` is never delivered** (measured, peril 4: `RaidArrived` with kind `ambush` 7 times, `AmbushSprung` 0; also 0 in every scenario and unit test that steps a world). The event may be emitted only when the ambush is discovered before it attacks, or it may never be emitted. Not established. Filed under T-157.
4. **`full-year` says it asserts that no dwarf died and does not** (*read*, `test/e2e/full-year.spec.ts`, the comment above the last assertion). Filed under T-150.
5. **`testing-strategy.md` describes `full-year` as a year played through the UI.** *Read:* the spec plays it through `applyCommand`. The document or the spec is wrong; T-150 makes the spec match.
6. **At peril 2 the fixture sends `TradeOpen` 36 times and completes no trade**, and `SetJobPriority` is rejected 35 times. This is the stale trade job of T-142 seen from the command side. No new task.

## Not established

- Which commands the browser specs actually send. The specs were read; the app was not instrumented in the browser, so the command column for the UI is inferred from the keys each spec presses and the state it asserts.
- Which of the 87 thoughts a long run produces. `ThoughtGained` is emitted for only a few of them, so the event count says nothing.
- Whether the 20-seed sweep behaves like the two seeds measured here. One seed at each of perils 2 and 4 was run.
- The causes of the three fixture and event findings above.
- Coverage of rules inside unit tests that never step a world. The recorder cannot see them. The text search in gap 10 is the only check made.
- Wall-clock cost of the recommended scenarios. Another agent was using the machine, so no timing is reported.
