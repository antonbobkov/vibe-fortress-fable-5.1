# Social, comfort and joy after T-196: the re-measure that lands T-144

Measurement for landing T-144, T-197 and T-198 on `cloud/T-144`, 2026-10-10. It extends [Social, comfort and joy without an errand each](2026-10-10-wants-without-errands.md), which measured T-144 alone; that report is not changed.

Every figure is marked **[run: name]** (a run named in [Method](#method)) or **[code: file:line]**. Where a cause is not established, the text says so.

## Summary

**In the rewritten economy fixture without wild animals, the three tasks hold up over three years: mood 58.8 in year 1 and about 60 after, and no dwarf dies. The work share in year 1 is 28.4%, against 22.7% before T-144. With wild animals the economy fixtures still die out to boars, with T-196 and with or without T-144: on seed `three-years` three boars kill eight of the rewritten fixture's nine dwarves on days 19 to 32 on `cloud/T-144`, and boars kill all nine of the old fixture's on days 24 to 35 on `cloud/main`.**

- **T-196 changes nothing without wild animals.** The branch `t-144` before T-196 and `cloud/T-144` after it give the same figures, to the mark and the tick, over 336 days with no wild arrivals. **[run: new-nowild-t144, new-nowild-cloud]**
- **Year 1, rewritten fixture, no wild arrivals: mood 58.8, work share 28.4%.** Before T-144 57.7 and 22.7%; after T-144 alone 49.9 and 30.5%. These are the figures commit `c8307e2` gave for T-197 (58.8 and 28.4%). **[run: new-nowild-main, new-nowild-cloud; the T-144-alone column is the earlier report's run `new-nowild-after`]**
- **Years 2 and 3, the first time after T-144:** mood 61.1 and 59.8, no death, population 33. The work share falls to 13.8% and 17.1%, with 18.4% and 16.5% of dwarf time idle for lack of work. Before T-144 the same years gave mood 60.5 and 59.3 and work 17.2% and 14.5%. **[run: new-nowild-main, new-nowild-cloud]**
- **The three wants take 14.9% of dwarf time in year 1** (27.4% before T-144, 10.4% after T-144 alone). Each is over its want threshold less often than after T-144 alone: social 51.4%, comfort 17.8%, joy 39.3% (65.6%, 66.2%, 65.9%). **[run: new-nowild-cloud]**
- **With wild animals, every as-is run of either fixture on `cloud/T-144` lost most or all of its dwarves to boars.** Rewritten fixture, seed `three-years`: 8 bled out to three boars on days 19–32, one starved on day 50, nobody left from day 51. Seed `three-years-p0-1`: it lives two years (28 dwarves on day 224), then three boars kill 24 dwarves on days 246–267; one is left on day 336. Old fixture: 15 bled out to boars on days 45–117; nobody left by day 224. **[run: new-asis-cloud, new-p01-asis-cloud, old-asis-cloud]**
- **On `cloud/main`, without T-144, the rewritten fixture on seed `three-years` lost one dwarf to a badger in three years** and grew to 35; boars were on its map too, and no dwarf was wounded in the first 60 days. **[run: new-asis-main, spawns-main]** **The old fixture on `cloud/main` died out**: boars killed all nine dwarves on days 24–35. **[run: old-asis-main]** So the boars are not a consequence of T-144: which fortress meets them, and when, differs from run to run, and why was not established. Without wildlife the share of time dwarves spend on the surface is the same within 1.2 points before and after T-144 (33.6% and 34.8% in year 1). **[run: new-nowild-main, new-nowild-cloud]**
- **Two traced deaths** show wounded dwarves and a medic staying within reach of the boars at the hospital on the surface: a patient alternating between its hospital bed and fleeing, with the boar one or two tiles behind, until it bled out; a medic cleaning a wound two tiles from a boar. **[run: trace-hrolf, trace-freydis]** Filed as T-214.
- **The old fixture without wild arrivals: four dwarves starved on days 251–255** of year 3. Before T-144 nobody died in the same run, though dwarves were over the critical hunger mark 13.4% of year 3. **[run: old-nowild-cloud, old-nowild-main]** Cause not established. Filed as T-215.

## Method

- **Instrument.** The saved probe [`2026-10-10-wants-without-errands-probe.ts.txt`](../data/2026-10-10-wants-without-errands-probe.ts.txt), unchanged, copied outside the committed tree (`.probe/f17/probe.test.ts` beside copies of `origin/f-17`'s `three_years_fortress.ts`, `three_years_economy.ts` and `three_years_measurements.ts` at `ffbc723`; `.probe/old/probe.test.ts` importing the committed `test/scenarios/three_years_*.ts`), run with a scratch Vitest config whose `include` is `.probe/**/*.test.ts`. Only the import paths were changed. `T144_NOWILD=1` makes 08's spawner see a full map, so no wild animal arrives **[code: probe line 72; `src/systems/animals/spawn.ts:166`, `:186`]**.
- **A second scratch probe** for the wild arrivals, [`2026-10-10-wants-without-errands-after-t196-spawns.ts.txt`](../data/2026-10-10-wants-without-errands-after-t196-spawns.ts.txt), logs `AnimalSpawned`, dwarf deaths and wounds, and the wild animals on the map each day, for 60 days. It steps the fixture in chunks of 300 ticks and so plays a different trajectory from the main probe (which steps 5 at a time and checks the fixture every 100 ticks); its runs are evidence about which animals come, not a replay of the main runs.
- **Code under test.**
  - `main`: `cloud/main` at `a1ed087` (T-196 landed, before T-144).
  - `t144`: branch `t-144` at `f952eab` (T-144, T-197, T-198; no T-196).
  - `cloud`: `cloud/T-144` at `38c59f6` (`t-144` merged onto `cloud/main`, `year_one` with wildlife again; no change under `src/` since the merge).
  - `main` and `t144` were run from `git archive` copies in a scratch directory with the same `node_modules`.
- **Fixtures.** "Rewritten" (`new`) is the default-priority fixture of `origin/f-17`; "old" is `test/scenarios/three_years_fortress.ts` as committed (urgent priorities).
- **Runs**, 336 days each unless named otherwise, peril 0, seed `three-years` unless named `p01` (`three-years-p0-1`). One run per cell; no seed sweep.

| Run | Code | Fixture | Wild arrivals |
|---|---|---|---|
| new-nowild-main | main | rewritten | none |
| new-nowild-t144 | t144 | rewritten | none |
| new-nowild-cloud | cloud | rewritten | none |
| new-asis-main | main | rewritten | as is |
| new-asis-t144 | t144 | rewritten | as is |
| new-asis-cloud | cloud | rewritten | as is |
| new-p01-asis-cloud | cloud | rewritten, seed `three-years-p0-1` | as is |
| old-nowild-main | main | old | none |
| old-nowild-cloud | cloud | old | none |
| old-asis-main | main | old | as is |
| old-asis-cloud | cloud | old | as is |
| spawns-main, spawns-cloud | main, cloud | rewritten, 60 days, scratch spawn probe | as is |
| trace-hrolf, trace-freydis | cloud | rewritten, 20 and 22 days, the probe's `T140_STUCK` watch on dwarves `16777293` and `16777298` | as is |

- **Summaries** of every run except the traces and the spawn runs: [`2026-10-10-wants-without-errands-after-t196-data.json`](../data/2026-10-10-wants-without-errands-after-t196-data.json). The full probe outputs (2–3 MB each) are not committed; each is reproduced by `T140_OUT=<file> [T144_NOWILD=1] [T140_SEED=…] npx vitest run --config <scratch config> <f17|old>/probe` on the code named above.
- **Accounting** is the earlier reports': every 5 ticks each living fortress dwarf is put in one class. "Work" is every job and haul state. The hall errand of T-197 is a comfort plan and is counted as comfort **[code: `src/systems/dwarves/activities.ts` `startHallErrand`]**; the probe does not tell it from a comfort errand at step 8.
- **Mood** is the mean of the daily fortress means: days 21–112 for year 1, 113–224 and 225–336 for years 2 and 3.

## Without wild animals

### Year 1, rewritten fixture

| | Before T-144 | T-144 alone | T-144, T-197, T-198 (with or without T-196) |
|---|---|---|---|
| Run | new-nowild-main | earlier report, `new-nowild-after` | new-nowild-t144 = new-nowild-cloud |
| Wealth, day 112 | 11,234 | 17,517 | 15,584 |
| Population, day 112 | 14 | 12 | 15 |
| Dwarf deaths | 0 | 0 | 0 |
| Mood, daily mean (lowest day) | 57.7 (38.2) | 49.9 (36.3) | **58.8** (47.5) |
| **Work** | **22.7%** | **30.5%** | **28.4%** |
| – work step / fetch / walk to job / haul | 6.3 / 9.2 / 4.2 / 3.1 | 8.9 / 11.0 / 5.6 / 4.9 | 8.0 / 11.0 / 5.1 / 4.2 |
| **Needs: use / travel** | 29.7% / 44.0% | 16.8% / 44.5% | 20.1% / 44.7% |
| – sleep: use / travel | 11.8 / 13.6 | 7.6 / 19.4 | 8.5 / 18.0 |
| – food: use / travel | 1.8 / 10.0 | 1.9 / 11.1 | 1.9 / 10.9 |
| – drink: use / travel | 1.9 / 7.1 | 2.0 / 8.9 | 2.0 / 8.7 |
| – social: use / travel | 4.3 / 5.5 | 2.5 / 2.7 | 3.0 / 1.1 |
| – comfort (with the hall errand): use / travel | 5.1 / 4.0 | 1.2 / 1.1 | 4.0 / 5.4 |
| – joy: use / travel | 4.7 / 3.9 | 1.5 / 1.4 | 0.8 / 0.6 |
| **– the three wants, total** | **27.4%** | **10.4%** | **14.9%** |
| Idle, no work available | 3.0% | 7.6% | 6.3% |
| Idle with a want it cannot serve | 0.5% | 0.5% | 0.4% |
| Over the want threshold: social / comfort / joy | 27.4 / 38.9 / 35.7% | 65.6 / 66.2 / 65.9% | 51.4 / 17.8 / 39.3% |
| Over the want threshold: hunger / thirst / rest | 22.9 / 23.9 / 19.2% | 21.1 / 21.4 / 15.6% | 21.4 / 21.7 / 16.8% |
| Errands started per dwarf-day: social / comfort / joy | 0.68 / 0.61 / 0.56 | 0.48 / 0.15 / 0.17 | 0.62 / 0.49 / 0.09 |
| `Talked` / `Sat` / `HearthVisited` per dwarf-day | 0.64 / 0.61 / 0.56 | 0.38 / 0.43 / 0.30 | 0.57 / 0.75 / 0.57 |
| Food / drink per living dwarf-day | 0.36 / 0.58 | 0.37 / 0.60 | 0.37 / 0.60 |

The before column reproduces the earlier reports' before figures to the mark (11,234 marks, 22.7%, 57.7) on `cloud/main`, so T-196 and the commits since `3095a3e` did not move this fixture without wildlife either. **[run: new-nowild-main]**

What T-197 bought, read from the last two columns **[run]**:

- **Mood back from 49.9 to 58.8**, inside the model's 55–60, and the lowest daily mean up from 36.3 to 47.5.
- **Comfort is served by the hall errand**: comfort errands rose from 0.15 to 0.49 a dwarf-day, `Sat` from 0.43 to 0.75, and comfort is over its threshold 17.8% of the time (38.9% before T-144). The sit is also the hearth visit: `HearthVisited` rose from 0.30 to 0.57 while joy errands fell to 0.09.
- **Social is the least served of the three**: over its threshold 51.4% of the time, against 27.4% before T-144. `Talked` is 0.57 a dwarf-day against 0.64 before. Mood is in the band all the same.
- **It cost 2.1 points of the work share** (30.5% → 28.4%), and 4.5 points of dwarf time on the three wants (10.4% → 14.9%).
- **Sleep travel stays high**: 18.0% of dwarf time against 13.6% before T-144, and sleep use 8.5% against 11.8%. Time over the rest threshold is lower than before T-144 (16.8% against 19.2%). Why sleep errands take longer to reach and are used for less time was not examined, as in the earlier report.

### Three years, rewritten fixture

| | Before T-144 (new-nowild-main) | After (new-nowild-cloud) |
|---|---|---|
| Wealth, days 112 / 224 / 336 | 11,234 / 16,629 / 10,463 | 15,584 / 7,591 / 8,234 |
| Population, days 112 / 224 / 336 | 14 / 29 / 36 | 15 / 33 / 33 |
| Dwarf deaths | 0 | 0 |
| Mood, years 1 / 2 / 3 | 57.7 / 60.5 / 59.3 | 58.8 / 61.1 / 59.8 |
| Mood, days 21–336; at day 336 | 59.3; 59.4 | 60.0; 59.7 |
| Work, years 1 / 2 / 3 | 22.7 / 17.2 / 14.5% | 28.4 / 13.8 / 17.1% |
| Idle with no work, years 1 / 2 / 3 | 3.0 / 4.8 / 12.0% | 6.3 / 18.4 / 16.5% |
| The three wants, years 1 / 2 / 3 | 27.4 / 29.7 / 26.3% | 14.9 / 16.6 / 16.1% |
| Over the threshold in year 3: social / comfort / joy | 24.3 / 26.5 / 27.9% | 22.6 / 11.6 / 30.8% |
| Food / drink per living dwarf-day, three years | 0.36 / 0.59 | 0.38 / 0.61 |
| Caravans: trades / arrivals | 6 / 8 | 5 / 8 |
| Immigration waves after year 1's three | year 2: 5, 5, 5, then refused for wealth; year 3: spring 7, then refused for wealth | year 2: 7, 5, 6, then every later season refused for wealth |

All **[run: new-nowild-main, new-nowild-cloud]**.

- **From year 2 the fixture runs out of work.** After the change, 18.4% and 16.5% of dwarf time is idle for lack of work, more than the time spent working in year 2. The work share of years 2–3 is the fixture's work supply, which is T-145's subject.
- **Wealth falls from 15,584 to 7,591 in year 2**, and the waves stop for wealth from the winter of year 2. Which goods were consumed or traded away was not traced.

### Year 1, old fixture (urgent priorities)

| | Before T-144 (old-nowild-main) | T-144 alone (earlier report) | After (old-nowild-cloud) |
|---|---|---|---|
| Wealth, day 112 | 19,755 | 19,206 | 21,066 |
| Mood, days 21–112 | 49.1 | 51.9 | 53.0 |
| Work | 34.2% | 33.9% | 32.9% |
| The three wants | 19.5% | 13.8% | 13.1% |
| Over the threshold: social / comfort / joy | 62.7 / 67.8 / 68.3% | 59.0 / 56.4 / 57.6% | 57.1 / 42.4 / 56.5% |

**[run: old-nowild-main, old-nowild-cloud; the middle column is the earlier report's `old-nowild-after`]**

### Three years, old fixture

| | Before T-144 (old-nowild-main) | After (old-nowild-cloud) |
|---|---|---|
| Wealth, days 112 / 224 / 336 | 19,755 / 26,881 / 16,828 | 21,066 / 14,524 / 28,247 |
| Population, days 112 / 224 / 336 | 16 / 16 / 38 | 16 / 28 / 30 |
| Dwarf deaths | 0 | **4, starvation, days 251, 252, 252, 255** |
| Mood, years 1 / 2 / 3 | 49.1 / 58.4 / 54.9 | 53.0 / 61.5 / 50.4 |
| Lowest daily mean | 21.8 (day 332) | 21.0 (day 253) |
| Over the critical hunger mark, year 3 | 13.4% | 16.6% |
| Work, three years | 20.6% | 19.6% |

**[run: old-nowild-main, old-nowild-cloud]**

- In the after run the stocks held no meal on day 224 and no drink on day 224, and the mood mean fell to 25.7 that day; the four starvation deaths followed in days 251–255. **[run: old-nowild-cloud, daily stocks]**
- The before run had no death but its dwarves were over the critical hunger mark 13.4% of year 3, and its mood mean fell to 21.8 on day 336. **[run: old-nowild-main]**
- So the old fixture's food supply in year 3 is short with either code. Whether T-144 or T-197 made it worse, or the two runs only diverge, is not established: one run each, and the populations differ from the autumn of year 2 (day 168), when only the after run got a wave (16 against 28 dwarves on day 224). Filed as T-215.

## With wild animals

### Deaths

| Run | Code | Deaths, by cause and killer | Days | Population, days 112 / 224 / 336 |
|---|---|---|---|---|
| new-asis-main | main | 1: badger (bled out) | 83 | 13 / 28 / 35 |
| new-asis-t144 | t144 (no T-196) | 15: badger 11, boar 2 (bled out); 2 starved | 16–160 | 3 / 0 / 0 |
| new-asis-cloud | cloud | 9: boar 8 (bled out); 1 starved | 19–50 | 0 / 0 / 0 |
| new-p01-asis-cloud | cloud, seed `three-years-p0-1` | 27: boar 24 bled out and 2 of infection; 1 of infection with no killer | 246–312 | 14 / 28 / 1 |
| old-asis-main | main | 9: boar 8 bled out, 1 killed | 24–35 | 0 / 0 / 0 |
| old-asis-cloud | cloud | 16: boar 15 (bled out); 1 starved | 45–172 | 6 / 0 / 0 |

All **[run]**. Killers are the probe's species of the `killerId` on `CreatureDied`.

- **In new-asis-cloud the eight deaths are from three boars** (`killerId` 16777700, 16777701, 16777702), and seven of the eight died on the surface at x 22–27, y 5, near the north edge of the 48 × 48 map, where the trace below finds the hospital beds. **[run: new-asis-cloud]**
- **In new-p01-asis-cloud 24 of the 27 deaths are from three boars** (218104827, 285213698, 352322554) and two more from two later boars; 16 of the dwarves died on the surface on row y 4 (x 7–24). **[run: new-p01-asis-cloud]**
- **In old-asis-cloud 14 of the 15 boar deaths are from two boars** (16778301, 16778302), at places spread over the surface and the hall level. **[run: old-asis-cloud]**
- **Mood with wildlife** in new-asis-cloud is 20.3 over the 30 days that had dwarves; in new-asis-main 57.2 / 56.9 / 54.9 for years 1–3. **[run]**

### What the boars did, in two traced deaths

Rewritten fixture, `cloud`, seed `three-years`, the probe's `T140_STUCK` watch. **[run: trace-hrolf, trace-freydis]**

- **Hrolf (16777293), died tick 22,582 (day 18.8) at (22, 5, 32).** On a drink errand to (26, 17, 32) he met a boar near (30, 13, 32) and fled. He then started for his bed at (33, 7, 26), fled again, and from tick 22,321 alternated between `patient` ("Resting in hospital", at (27, 5, 32) and (26, 5, 32)) and `flee`, moving back and forth between x 21 and x 27 on row y 5, with boar 16777702 one or two tiles behind him the whole time, until he bled out. The fortress alert stayed `calm` throughout.
- **Freydis (16777298), died tick 26,082 at (26, 5, 32).** At tick 25,200 she was on a `Clean wound` job at (18, 1, 32) with boar 16777700 at (17, 3, 32), two tiles away. She then slept on that tile, and from tick 25,585 fled with two boars (16777700, 16777702) within two tiles, along row y 5 again.

So, in these two deaths, a patient walked back to a hospital bed and a medic worked on a patient, each within two tiles of a boar. Which rule should have kept them away (10's remembered danger, 17's patient and medic jobs, or 08's defending animal letting go) was not established; T-214 is to find out.

### Which animals came

Spawn probe, 60 days, seed `three-years`. **[run: spawns-main, spawns-cloud]**

- **Both codes got boars.** `main`: one boar on day 9 and three on day 15; they roamed the surface and were gone by day 50. No dwarf was wounded in the 60 days. `cloud`: three boars on day 33 and three more on day 48; seven dwarves were wounded and four died on days 49–55 (to the second three).
- This trajectory is not the main probe's (see Method), so its deaths are not those of new-asis-cloud. It shows that the `main` fortress shared its map with boars for weeks without a wound, and the `cloud` fortress did not. Why was not established.
- Without wildlife the two codes keep their dwarves on the surface for the same share of time: 33.6% (`main`) and 34.8% (`cloud`) of year 1 at z ≥ 31. **[run: new-nowild-main, new-nowild-cloud]** So the obvious explanation, that T-144's talks and hall sits keep dwarves outside longer, is not supported; nothing else was measured.

## The long scenarios on `cloud/T-144`

- `year_one` now runs with natural animal arrivals: 21 rabbits, 6 deer, 3 badgers and 2 foxes came, no dwarf died, 5 hunts killed. **[run: `npm test`, `year_one` stdout]**
- `homestead_year` passes; the first birth comes on day 42, after the 40-day script. 4 hunts killed. **[run: `npm test`]**
- `hospital_run` passes on its seed `hospital-run-4`. **[run: `npm test`]**
- **The perf-tier `three_years` (`test/perf/three_years_main.test.ts`) fails after 3 seconds** on `cloud/T-144`, `cloud/main` and `origin/master` (`4fbe72c`) alike, at its invariant check of tick 3600: `item.inside-wall`, "item 16777328 log at (33,9,32)". So it measures nothing at present, before and after this change. **[run: three_years_main on the three commits]** Filed as T-216.

## Not established

- Why some runs meet the boars early and fatally and others share the map with them unharmed (the rewritten fixture on `main` against `cloud`; the old fixture dies out on both). One run per cell; trajectories diverge from the first day the code differs.
- Which rule should keep a patient or a medic away from an animal still nearby (T-214).
- Why the old fixture runs short of food in year 3, and whether the change made it worse (T-215).
- Why sleep travel is higher and sleep use lower than before T-144 while rest is served as well or better.
- What the perf-tier `three_years` scenario would show after day 3 (see [The long scenarios](#the-long-scenarios-on-cloudt-144)).
- Wall-clock figures: the machine ran up to four probes at once.

## What is still off the model

| Measure | Model | `cloud/T-144`, rewritten fixture, no wild arrivals | |
|---|---|---|---|
| Work share at default priorities | T-140 asked for 35% | 28.4% in year 1 (idle 6.3%); 13.8% and 17.1% in years 2–3 (idle 18.4%, 16.5%) | T-145 (work supply) |
| Mood, daily mean | 55–60 | 58.8 / 61.1 / 59.8 | fits |
| Wealth, years 1 / 2 / 3 | 4,000–8,000 / 15,000–25,000 / 35,000–60,000 | 15,584 / 7,591 / 8,234 | B-008, T-145 |
| Food / drink per living dwarf-day | 0.48 / 0.77 | 0.38 / 0.61 | B-012 |
| Survival at peril 0 with wildlife | about one dwarf per animal for a careless fortress, never the whole group | extinct on `three-years`; 27 dead on `three-years-p0-1` in year 3; old fixture extinct | T-214 |
