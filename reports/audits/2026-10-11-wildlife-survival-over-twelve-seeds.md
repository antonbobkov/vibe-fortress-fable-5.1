# Wildlife survival over twelve generated years — 2026-10-11

**Runtime:** `a390b2ddc5a63625a8bce849bfceac122e86d441` (T-216 wall clearance, no wildlife/need/balance change). **Instrument:** [test](../data/2026-10-11-t136-wildlife-year-wildlife_year.test.ts.txt), [fixture](../data/2026-10-11-t136-wildlife-year-wildlife_year_fixture.ts.txt), and [accounting](../data/2026-10-11-t136-wildlife-year-wildlife_year_measurements.ts.txt) snapshots beside the [raw data](../data/2026-10-11-t136-wildlife-year.json).

## Method

Run `npm exec -- vitest run -c vitest.perf.config.ts test/perf/wildlife_year.test.ts`. Twelve distinct seeds, four each in temperate forest, taiga and temperate grassland; 96×96×64 generated local maps, relief 0, west arrival, wealth 2, peril 0, temper 0, no traits, no river or lake. All natural wildlife remains. This controls the regional shape and compares three biome populations; it does not sample arbitrary terrain or climate. Balanced embark uses the real preset and arrival path. All construction, zoning, farming, orders, squad membership and alerts are commands, with no spawned supplies or prebuilt defence.

The opening mirrors the browser: a 4×4 stockpile, turnip/barley 4×3 surface rectangles, the six-level entrance, an 8×4 soil cave farm and 5×5 stone room, nearby trees, carpenter/mason/still, barrel 20 and drink 100 maintain orders and four blocks once, then hearth/kitchen, easy meals 60, meeting/bedroom zones and a three-member off-duty squad after day 3; dimcap and depot at day 10; wildlife response from day 20. The alert looks every 20 ticks, with the browser’s 40-tile proximity, 300-tick minimum hearth hold, 1,500-tick cooldown and 600-tick calm rule. No doors, armour or hospital are added.

The cave plot keeps 32 tiles, one level down in taiga’s two soil layers and two in the other biomes. Surface rectangles retain only green qualifying tiles, exactly as the UI does; actual turnip/barley areas range from 6 to 12 tiles and are included below. This site variation is a qualification of the distribution. No existing long fixture, farm capacity, supply count, production target, simulation constant or formula changed.

Each complete seed is persisted. Extinct fortresses stop at the next observation boundary. The first measurement checked the proposed target and failed at the minimum (0 versus 8). The data also showed two need-related deaths against a zero target. The accepted work file permits measured bounds beside the target; the final run asserts median ≥ 12.5, minimum ≥ 0, at least 8/12 wildlife-free years, at most one extinction and at most two hunger/thirst deaths. The zero minimum is not a successful survival result: the extinction cap and median still constrain regressions, while the desired minimum remains 8.

## Distribution

| Biome | Seeds | Median living | Worst | No wildlife dwarf death | Extinct | Hunger/thirst deaths |
|---|---|---|---|---|---|---|
| temperate_forest | 4 | 10 | 8 | 1/4 | 0 | 0 |
| taiga | 4 | 11.5 | 0 | 3/4 | 1 | 2 |
| temperate_grassland | 4 | 14.5 | 14 | 4/4 | 0 | 0 |
| All | 12 | 12.5 | 0 | 8/12 (66.7%) | 1 | 2 |

The target is median at least 11 of the nominal twelve, no seed below 8, and no hunger/thirst death. The overall median meets it, but the worst year and need-related deaths do not; forest alone has median 10. Arrivals vary from 11 to 15, so the grassland sample’s larger halls also raise the pooled median. The per-biome row must be read with the pooled row.

There are 24 dwarf deaths: 22 to wildlife (badger 5, boar 3, wolf 14) and two labelled `starvation`. There are 93 Starving events and 3 fortress-animal deaths (all dogs killed by wolves). The health death label does not distinguish hunger from thirst; personal need durations still need tracing.

## Every seed

| Seed | Living / arrivals | Wildlife dwarf deaths | Need deaths | Starving | Animal losses | Turnip/barley tiles | End tick |
|---|---|---|---|---|---|---|---|
| wildlife-temperate_forest-1 | 10/13 | 3 | 0 | 9 | 2 | 10/11 | 134400 |
| wildlife-temperate_forest-2 | 10/13 | 3 | 0 | 0 | 0 | 10/10 | 134400 |
| wildlife-temperate_forest-3 | 8/13 | 5 | 0 | 1 | 0 | 9/10 | 134400 |
| wildlife-temperate_forest-4 | 13/13 | 0 | 0 | 32 | 0 | 10/10 | 134400 |
| wildlife-taiga-1 | 11/13 | 0 | 2 | 38 | 0 | 9/8 | 134400 |
| wildlife-taiga-2 | 12/12 | 0 | 0 | 3 | 0 | 6/9 | 134400 |
| wildlife-taiga-3 | 13/13 | 0 | 0 | 0 | 0 | 11/9 | 134400 |
| wildlife-taiga-4 | 0/11 | 11 | 0 | 10 | 1 | 11/9 | 106600 |
| wildlife-temperate_grassland-1 | 15/15 | 0 | 0 | 0 | 0 | 10/12 | 134400 |
| wildlife-temperate_grassland-2 | 14/14 | 0 | 0 | 0 | 0 | 12/11 | 134400 |
| wildlife-temperate_grassland-3 | 15/15 | 0 | 0 | 0 | 0 | 12/11 | 134400 |
| wildlife-temperate_grassland-4 | 14/14 | 0 | 0 | 0 | 0 | 10/11 | 134400 |

The year boundary is tick 134400. `wildlife-taiga-4` ends at tick 106600 after eleven wolf deaths on days 40, 62, 67 (two), 70, 72, 73, 76, 79, 83 and 89. `wildlife-taiga-1` has two `starvation` deaths on days 46 and 74. Every death’s tick, victim, killer and tile is in the raw rows; end stocks do not establish food availability at an earlier death.

## The two traced states

The final instrument observes sleeping activities and nearby brains on delivered wild attacks, and records need maxima while hearth is held. In forest seed 1, seven attacks are delivered while Liv Mossgate’s brain activity is sleep; at tick 125593 five nearby dwarves are already in flee. Victim 16777291 subsequently bleeds out at tick 125807, with wolf 486539723 named as killer. These snapshots show the state at dispatch, not a proof that fleeing caused treatment to fail. The absence of a hospital and the alert’s radius also belong to the script qualification.

Forest seed 1 holds hearth for 17000 ticks; hunger and rest reach 100. Taiga seed 1 holds it for 2260 ticks, with hunger, thirst and rest all reaching 100. Taiga seed 4 has a 3140-tick hold and the same need maxima. These observations confirm that prolonged shelter and critical needs coexist; they do not alone identify the cause of either need-related death.

## Repetition and next work

Two complete twelve-seed runs produce identical hashes for every seed, and identical living/death/Starving/stock counts. The final run uses the paused command phase and extra read-only observations; their addition changes none of those hashes. The final instrument passes all twelve seed cases and the measured distribution bounds. Three unit controls verify median and extinction accounting, livestock versus dwarf wildlife deaths and hunger/thirst classification, and refusal of an empty distribution.

T-220 diagnoses the pack losses using this instrument. T-260 traces the two need-related deaths. Forest seed 2 loses three dwarves to a boar and forest seed 3 loses five to a badger; those are retained findings, not attributed to wolves. The earlier [isolated and compact-year probes](2026-10-11-wildlife-after-t219.md) remain a different fixture and endpoint; their figures are not pooled into this cohort. The passing measurement bounds do not mean that the survival target is met.
