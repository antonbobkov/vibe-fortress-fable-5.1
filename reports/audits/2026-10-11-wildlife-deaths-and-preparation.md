# Wildlife deaths, preparation and the pack-feeding transition

**Measured:** 2026-10-11. Runtime base `182d2fd`, before and after the T-220 patch. No balance constant, farm capacity, food supply or existing long fixture changed.

## Method and limits

The original wolf-only reproductions use the compact 48 by 48 three-year fortress for one year, with the source commands unchanged. The four traced cases are forest seed 2 and taiga seed 1, ignore and react. The observer reads each victim just before each tick and at attack/death dispatch. Every death retains first and last attacks, wounds, needs, held job and tool, door distances, squad positions and tame dogs in [the trace records](../data/2026-10-11-t220-original-death-traces.json). A first recorded attack is not the first threat scan: a victim already fleeing has already released its job. Do not infer its earlier labor from that empty job.

The annual before/after comparison is the permanent T-136 instrument: twelve generated 96 by 96 maps, four distinct seeds in each biome, Balanced embark, the browser opening and its alert policy starting on day 20. All species remain. [Before](../data/2026-10-11-t136-wildlife-year.json) and [after](../data/2026-10-11-t220-baseline-after.json) preserve every row and hash. The before runtime and commands are described in [the twelve-seed report](2026-10-11-wildlife-survival-over-twelve-seeds.md).

## Original reproductions

| Seed | Mode | Wolves arrive on days | Wolf dwarf deaths | Other dwarf deaths | Living at endpoint |
|---|---|---|---|---|---|
| t212-temperate_forest-2 | ignore | 4, 9, 57 | 5 | 1 | 7 (day 113) |
| t212-temperate_forest-2 | react | 4, 9, 71, 92 | 12 | 1 | 0 (day 108) |
| t212-taiga-1 | ignore | 16, 56, 86, 95 | 8 | 0 | 4 (day 113) |
| t212-taiga-1 | react | 16, 56, 86, 103 | 5 | 0 | 6 (day 113) |

The forest pack arrives on day 4 and the first casualty is on day 7. There is no squad before day 10. The first five reacting casualties have no built door anywhere; its dogs are untrained and unassigned. The first victim is already fleeing, then fights with no weapon and dies at tick 7957. Sending a squad later cannot save it. At the late taiga attack (tick 102815, day 86), the quarry has an axe but the reacting squad has three unarmed members; dogs are untrained below ground. No built door is present at any of the taiga deaths. The first quarry dies at tick 102997 without a completed treatment; its recorded serious cuts are unbandaged.

The previous six-seed data explain why arrival count alone is insufficient: taiga seed 2 and forest seed 3 record no wolf hunts at all; taiga seed 3 and forest seed 1 record eight and three dwarf quarries but no wolf casualty. All four controls record zero wolf attack attempts, including those with a recorded hunt: they avoid melee rather than survive a stream of bites. The two losing ignore cases record 31 and 32 wolf hits on civilians. Forest seed 2 is exposed to hunger in the opening week; taiga seed 1 meets a late pack while civilians are exposed and the guard is unarmed. Those four no-death controls are the frozen T-253 measurements, not newly claimed current-runtime traces: [raw rows](../data/2026-10-11-t253-year-runs.json). The current four traced cases above replace only their matching rows.

### Every original dwarf death

Coordinates and activity here are the last pre-death state. Full first/last attack states, medical jobs, squad and dog coordinates are in the linked JSON. Door distance is horizontal Chebyshev and the door level is stated; it does not certify a safe route. "none" means no built door. Tools can be held civilian tools rather than squad weapons.

| Case | Dwarf | First attack tick / activity | Death tick / cause | Position / activity at death | Tool | Closest door |
|---|---|---|---|---|---|
| forest2-ignore | Ulrik Frostfist (16777292) | 7696 / Fleeing | 7957 / bled_out | 17,12,32 / Fighting | none | none |
| forest2-ignore | Varin Craggate (16777294) | 11335 / Fleeing | 11647 / bled_out | 20,12,32 / Fighting | none | none |
| forest2-ignore | Wulf Amberwall (16777291) | 13801 / Fleeing | 14122 / bled_out | 27,22,32 / Resting in hospital | pick | none |
| forest2-ignore | Marr Elkhall (16777297) | 14201 / Fleeing | 16497 / bled_out | 27,22,32 / Fighting | none | none |
| forest2-ignore | Liv Runewall (16777295) | 18422 / Fleeing | 18712 / bled_out | 29,18,32 / Resting in hospital | pick | none |
| forest2-ignore | Vali Shaleborn (16777293) | none | 21602 / starvation | 26,8,32 / No job | none | none |
| forest2-react | Ulrik Frostfist (16777292) | 7696 / Fleeing | 7957 / bled_out | 17,12,32 / Fighting | none | none |
| forest2-react | Varin Craggate (16777294) | 11335 / Fleeing | 11647 / bled_out | 20,12,32 / Fighting | none | none |
| forest2-react | Wulf Amberwall (16777291) | 14826 / Fleeing | 15147 / bled_out | 31,17,32 / Resting in hospital | pick | none |
| forest2-react | Otta Forgegate (16777296) | 17378 / Fleeing | 17782 / bled_out | 30,20,32 / Resting in hospital | pick | none |
| forest2-react | Liv Runewall (16777295) | 17711 / social | 17908 / killed | 23,23,32 / Resting in hospital | pick | none |
| forest2-react | Vali Shaleborn (16777293) | none | 21602 / starvation | 26,8,32 / No job | none | none |
| forest2-react | Alrik Cragpick (16777382) | 88039 / Fleeing | 88302 / bled_out | 28,11,32 / Resting in hospital | none | 1 tiles, z=32 |
| forest2-react | Inga Hawkfell (117440662) | 88441 / Fleeing | 88632 / bled_out | 29,18,32 / Fleeing | axe | 6 tiles, z=32 |
| forest2-react | Marr Elkhall (16777297) | 88639 / On duty | 89077 / bled_out | 24,18,26 / Resting in hospital | axe | 6 tiles, z=32 |
| forest2-react | Ottar Oakheart (16777386) | 92021 / Fleeing | 92297 / bled_out | 28,14,32 / Resting in hospital | pick | 2 tiles, z=32 |
| forest2-react | Yrsa Hollowshield (83886424) | 93452 / Fleeing | 93782 / bled_out | 28,12,32 / Fighting | none | 0 tiles, z=32 |
| forest2-react | Wulf Ironfoot (117440939) | 117100 / Fleeing | 117342 / bled_out | 24,20,32 / Fighting | crossbow | 8 tiles, z=32 |
| forest2-react | Ingolf Hearthfoot (16777378) | 91923 / Fleeing | 127927 / bled_out | 32,18,26 / Resting in hospital | axe | 6 tiles, z=32 |
| taiga1-ignore | Kari Bearshield (16777291) | 102815 / Fleeing | 103022 / bled_out | 33,9,26 / Resting in hospital | axe | none |
| taiga1-ignore | Gorm Veincloak (16777820) | 103727 / Fleeing | 104132 / bled_out | 33,27,26 / Resting in hospital | none | none |
| taiga1-ignore | Gyda Deepbrook (16777292) | 104096 / Fleeing | 104452 / bled_out | 33,31,26 / Resting in hospital | none | none |
| taiga1-ignore | Ludin Runestone (16777290) | 105997 / Fleeing | 106207 / bled_out | 28,7,32 / Fighting | pick | none |
| taiga1-ignore | Snorri Oakhelm (16777587) | 107427 / Chop tree | 108122 / bled_out | 37,34,26 / Resting in hospital | axe | none |
| taiga1-ignore | Sigurd Ravenbrow (16777591) | 109519 / Fleeing | 109872 / bled_out | 30,11,32 / Resting in hospital | axe | none |
| taiga1-ignore | Steinn Steelfist (16777289) | 109718 / Fleeing | 110107 / bled_out | 33,26,26 / Resting in hospital | pick | none |
| taiga1-ignore | Ragnhild Wolfhand (16777825) | 110705 / Fleeing | 111092 / bled_out | 31,10,32 / Resting in hospital | axe | none |
| taiga1-react | Kari Bearshield (16777291) | 102815 / Fleeing | 102997 / bled_out | 33,8,29 / Resting in hospital | axe | none |
| taiga1-react | Ludin Runestone (16777290) | 106023 / Fleeing | 106807 / bled_out | 37,34,26 / Resting in hospital | pick | none |
| taiga1-react | Sigurd Ravenbrow (16777591) | 125507 / Fleeing | 126097 / bled_out | 33,34,26 / Resting in hospital | none | none |
| taiga1-react | Steinn Steelfist (16777289) | 125744 / Fleeing | 126132 / bled_out | 33,15,26 / Resting in hospital | pick | none |
| taiga1-react | Thrain Forgehammer (16777293) | 126295 / sleep | 126457 / bled_out | 25,8,32 / sleep | none | none |

## Classification

| Link | Classification | Evidence / action |
|---|---|---|
| Pack hunger and quarry sharing | Existing rule | Wolves hunt visible eligible animals before dwarves. A dog below ground is not visible to a wolf above ground; a new nearer animal does not replace an already held quarry. Arrival counts and the presence of dogs alone do not establish defence. |
| Civilian flee and fight | Existing rule | Most first attacks are against a fleeing civilian; later records include Fighting. Tools differ by victim. A serious wound can continue bleeding after the attacker breaks off. Caught-state readings are added by the after traces below, rather than guessed from an activity label. |
| Day-10 squad / unarmed guard / missing doors | Fixture qualification | This is not the intended reacting fortress with a protected pasture and armed response. Original commands and assertion bounds are unchanged. |
| Medical delay | Preparedness plus existing tracked faults | Most reacting casualties have no completed treatment before death. T-211 owns admission interrupt for soldiers; T-137 owns restarted infection cures; T-260 owns the two need-related baseline deaths. Their fixes are not silently included here. |
| Critical sleep while a wolf attacks | Existing rule, measured hazard | In the baseline taiga extinction, Ivar first takes a bite at tick 73981 while sleeping with rest 90; critical needs outrank flight/duty. There is no bed or door. Changing that precedence here would change a simulation rule. |
| A fed pack member retains another living hunting quarry | Code fault, fixed | Two permanent regressions were red: hunt and hunting attack both still targeted the living quarry at kill dispatch. The genuinely defending control was green. Clear only newly fed hunting targets and paths. The baseline twelve rows remain identical, so this fix is not credited with preventing those recorded deaths. |
| General annual survival target | Unmet, no numeric tune justified | The base policy has an off-duty guard, no door/armour/hospital and no alert response for its first 20 days. A prepared comparison is measured separately below; the base minimum of zero is a regression bound, not a success target. |

## Work and caught-state controls

The enhanced read-only observer re-runs the original four cases after the patch. All four complete summaries are identical to the before runs. [Supplementary states](../data/2026-10-11-t220-after-death-traces.json) add the first recorded threat from the first attacker and the actual caught memory at attacks. A first matching threat may precede the fatal encounter; it is not assumed to be the job being performed at the final bite. A missing caught flag at death does not establish that the dwarf was never caught earlier.

| Case | Dwarf | First matching threat tick / activity / held job | Caught observed at an attack |
|---|---|---|---|
| forest2-ignore | Ulrik Frostfist | 7674 / Plant seed / plant fetching | yes |
| forest2-ignore | Varin Craggate | 11321 / sleep / none | yes |
| forest2-ignore | Wulf Amberwall | 13796 / Build / build fetching | yes |
| forest2-ignore | Marr Elkhall | 14195 / Haul / haul_to_stockpile fetching | yes |
| forest2-ignore | Liv Runewall | 14195 / Craft (recipe) / craft fetching | yes |
| forest2-ignore | Vali Shaleborn | none recorded | no |
| forest2-react | Ulrik Frostfist | 7674 / Plant seed / plant fetching | yes |
| forest2-react | Varin Craggate | 11321 / sleep / none | yes |
| forest2-react | Wulf Amberwall | 14804 / Build / build fetching | yes |
| forest2-react | Otta Forgegate | 17364 / Craft (recipe) / craft fetching | no |
| forest2-react | Liv Runewall | 17696 / social / none | no |
| forest2-react | Vali Shaleborn | none recorded | no |
| forest2-react | Alrik Cragpick | 88016 / Haul / haul_to_stockpile fetching | yes |
| forest2-react | Inga Hawkfell | 88426 / Craft (recipe) / craft working | yes |
| forest2-react | Marr Elkhall | 88613 / On duty / none | no |
| forest2-react | Ottar Oakheart | 91919 / Haul / haul_to_stockpile fetching | yes |
| forest2-react | Yrsa Hollowshield | 93447 / Craft (recipe) / craft fetching | yes |
| forest2-react | Wulf Ironfoot | 117091 / social / none | yes |
| forest2-react | Ingolf Hearthfoot | 91904 / Craft (recipe) / craft working | yes |
| taiga1-ignore | Kari Bearshield | 102809 / sleep / none | no |
| taiga1-ignore | Gorm Veincloak | 103721 / thirst / none | no |
| taiga1-ignore | Gyda Deepbrook | 104090 / Bandage / stop_bleeding fetching | no |
| taiga1-ignore | Ludin Runestone | 102830 / thirst / none | yes |
| taiga1-ignore | Snorri Oakhelm | 103861 / Chop tree / chop travelling | no |
| taiga1-ignore | Sigurd Ravenbrow | 109506 / Chop tree / chop working | yes |
| taiga1-ignore | Steinn Steelfist | 104090 / Water patient / water_patient fetching | yes |
| taiga1-ignore | Ragnhild Wolfhand | 106155 / Diagnose / diagnose travelling | yes |
| taiga1-react | Kari Bearshield | 102809 / sleep / none | no |
| taiga1-react | Ludin Runestone | 106006 / comfort / none | yes |
| taiga1-react | Sigurd Ravenbrow | 125502 / Craft (recipe) / craft fetching | no |
| taiga1-react | Steinn Steelfist | 125736 / Bandage / stop_bleeding fetching | no |
| taiga1-react | Thrain Forgehammer | 126276 / sleep / none | no |

## Twelve-seed re-measure

| Opening | Median living | Minimum | No wildlife dwarf death | Extinctions | Hunger/thirst-labelled deaths |
|---|---|---|---|---|---|
| Browser opening, before | 12.5 | 0 | 8/12 | 1 | 2 |
| Browser opening, after | 12.5 | 0 | 8/12 | 1 | 2 |
| Early preparation comparison, after | 13 | 11 | 8/12 | 0 | 1 |

Every original T-136 metric and all twelve end hashes are identical before and after. The taiga-4 fortress still loses eleven dwarves to wolves and is extinct on day 89 with 106 drinks, 40 meals and 110 plant-food units left. Its off-duty guard starts with two unarmed members and one crossbow, no shelter door or hospital. This is not an economy food shortage or evidence for changing hunger, speed or damage constants.

## First-week player commands, actual readiness

This separate comparison orders three wooden clubs and a wooden door at the start, forms the last three adults into a squad immediately, requests mace-class equipment, and checks the same proximity/alert policy from the opening tick. Alert changes also activate/stand down the squad. It mines the same 25-tile stone room one tile east with a three-tile entrance corridor, puts the hearth and hall there instead of on the surface, and puts a lock-on-alert door in the entrance. Crops, soil depth, farm area, food quantities and food production orders remain the base instrument. It adds no anvil, armour, hospital, war training or extra food. This is a new measured comparison, not a repair or retiming of the browser/year-one/three-year fixtures.

Orders in the first week do not guarantee first-week readiness. The table records the actual ticks; day = floor(tick/1200)+1. A late door cannot be counted as protecting an earlier encounter. The comparison is not a fully armoured competent-player proof.

| Seed | Squad formed | Three clubs equipped | Door built | Living / arrivals | Wolf dwarf deaths | Other dwarf deaths |
|---|---|---|---|---|---|---|
| wildlife-temperate_forest-1 | 404 | 10841 | 11601 | 13 / 13 | 0 | 0 |
| wildlife-temperate_forest-2 | 404 | 7741 | 8461 | 13 / 13 | 0 | 0 |
| wildlife-temperate_forest-3 | 404 | 7921 | 8681 | 12 / 13 | 0 | 1 |
| wildlife-temperate_forest-4 | 404 | 9961 | 11001 | 13 / 13 | 0 | 0 |
| wildlife-taiga-1 | 404 | 13961 | 15361 | 11 / 13 | 1 | 1 |
| wildlife-taiga-2 | 404 | 7441 | 8381 | 11 / 12 | 1 | 0 |
| wildlife-taiga-3 | 404 | 7601 | 8581 | 12 / 13 | 1 | 0 |
| wildlife-taiga-4 | 404 | 8381 | 9081 | 11 / 11 | 0 | 0 |
| wildlife-temperate_grassland-1 | 404 | 6181 | 6901 | 15 / 15 | 0 | 0 |
| wildlife-temperate_grassland-2 | 404 | 8901 | 9561 | 14 / 14 | 0 | 0 |
| wildlife-temperate_grassland-3 | 404 | 7061 | 8121 | 15 / 15 | 0 | 0 |
| wildlife-temperate_grassland-4 | 404 | 6021 | 6701 | 14 / 14 | 0 | 0 |

The intended zero-loss reacting target remains a target, not a claim about either opening. No balance number changes on these rows. Subsequent patient, bed and other already filed rule fixes must re-run the unchanged twelve-seed instrument before considering a numeric adjustment.

## Reproduce

The [source metadata](../data/2026-10-11-t220-metadata.json) records UTF-8/LF SHA-256 values. Restore the six source snapshots named there to their `t220-*` names under `.vite/task-resume/`. Use the runtime base and the committed T-220 patch for the after runs; the original before traces were run on the unpatched base.

```powershell
$env:T212_SEED="t212-temperate_forest-2" # also t212-taiga-1
$env:T212_BIOME="temperate_forest" # also taiga
$env:T212_MODE="react" # also ignore
$env:T212_ONLY="wolf"
$env:T212_OUT=".vite/task-resume/original-trace.json"
npm exec -- vitest run --config .vite/task-resume/t220.config.ts
npm exec -- vitest run --config vitest.perf.config.ts test/perf/wildlife_year.test.ts
npm exec -- vitest run --config .vite/task-resume/t220-prepared.config.ts
```

The observer reads state only and restores the World step hook after a successful run. The prepared probe persists each finished row. The original probe removes non-wolf arrivals as its existing method specifies; the permanent instrument and prepared comparison retain all species.
