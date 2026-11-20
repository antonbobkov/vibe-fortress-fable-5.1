# T-664: small fortresses starve beside their harvest

**Task:** T-664 · **Date:** 2026-11-20 · **Code:** branch `t664-small-fortress-starves` on master `5869b08f` (T-659, T-660) · **Source:** [the T-664 work file](../../docs/work/T-664-small-fortress-starves.md), [T-656's report](2026-11-20-t656-thirst-under-the-alert.md), [T-659 and T-660's report](2026-11-20-t659-t660-steel-trips.md)

## How

`test/perf/t664_farm_probe.test.ts` (local, `T664_PROBE=1`) plays a three-year seed at a sweep shift as the sweep plays it and writes a line a day: the dwarves, the food (plants, meals, the rest; a merchant's goods left out), the seed by species, the crops by stage, the plots and their bare tiles, the plant and harvest jobs by state, priority and whether they lie outdoors, the kitchen, every dwarf with farming or cooking and the job it holds, the ten most common open jobs, the patients' feed and water jobs, every dwarf's behaviour, hunger and labors, the script's farm strips, and the day's harvests, sowings, crop deaths, food lost and meals eaten.

```
T664_PROBE=1 PROBE_SEED=three-years-p4-2 THREE_YEARS_SHIFT=100 PROBE_TO=174000 npx vitest run -c vitest.perf.config.ts test/perf/t664_farm_probe.test.ts
```

Master's sweep `44811760127` (T-659/T-660's, on master's game) had 53 starvation deaths in four sweeps, all of them in six timelines: `p2-4` at shift 0 (22), `p4-3` at 100 (10), `p4-2` at 0 (9), `p4-2` at 100 (8), `p4-1` at 50 (3) and `p2-1` at 100 (1). `p4-6` at shift 150, which T-656's sweep starved, does not starve on this master. The probe replays the sweep's timelines exactly (the same deaths on the same days), so the first five were traced.

## Why they starved

**No farmer left.** The script makes one founder the farmer; the other founders hold no farming (the miners mine, the woodcutter, the mason and the cook keep their trades), and the immigrants hold it by default until the script dedicates them to a workshop or puts them in the squad. A fortress that raids had cut to a dozen lost its farm with its farmer:

- `p4-1` at shift 50: the farmer lay in the hospital from day 9 and died on day 20; no survivor held farming, and 37 ripe crops stood in the field with their harvest jobs `blocked: no_worker` while the plants ran out on day 22.
- `p4-3` at shift 100: the farmer was killed on day 100; the only dwarves with farming were soldiers of the strong squad at drill, which does no civilian work (16). Thirty ripe crops stood unharvested from day 117 to the end; the fortress starved to the last of ten on days 188 to 191.
- `p4-2` at shift 0: the farmer died of an infection on day 41; from day 47 38 to 40 harvest jobs stood open, with one civilian and three soldiers holding farming; the fortress starved to the last on days 76 to 102.

**The farm behind the raised work.** Where a civilian with farming was left, it worked other jobs first. The script keeps farming a step ahead of routine work (labor priority 4), but T-570's `raiseWaitingWork` raises a workshop's or a building's job that waits five days, up to the squad's kit's priority (3): in a fortress of nine nearly every such job waits, so the farm came last. In `p4-2` at shift 100 the farmer was killed on day 64, and the two civilians with farming worked craft jobs at priority 3, builds at 3 and stair carving at 3 while 28 to 30 ripe crops stood in the field from day 97 to the end; the fortress starved to the last of eight on days 142 to 145.

**Patients starved beside the stores.** `feed_patient` (17, labor hauling) took only a meal. In `p4-1` at shift 50 the cook died on day 15, so no meal was made after; three patients in the hospital went hungry from day 17 with their feed jobs `blocked: missing_input`, and starved on day 32 with 70 plants in stock (and the two miners on their feet held no hauling either). This is the game's: a dwarf on its feet eats raw food when there is no meal (10 § Eating and drinking), and nothing told the player why the patients were not fed.

**The farm did not grow.** In `p2-4` at shift 0 the farm stayed at four plots of 51 tiles from day 76 to day 248 while the fortress grew from 11 dwarves to 58, with 100 to 177 turnip seed in stock; the plants and meals ran out about day 213 and 22 starved on days 238 to 335. Once ambushes are possible each new strip goes on the free ground nearest the gate (T-580), and the search found no free four by four of sunlit soil there; each day's failed search counted as a strip, so the strips' cap (32 tries) was reached within a month with one strip sown. T-659's report, which traced this timeline, saw the open farm work run out from day 176: the plots were planted, there were too few of them.

**Not the cause.** The seed did not run out (each timeline kept seed to sow); no plot was lost to a raid; the second woodcutter and the brewer did not take the last farm hands (the farm hands were gone to death and the squad, or busy with raised work); `keepAMiner` did not fire in these timelines, but it would hand the pick to the farmer as freely as to anyone.

## The answer

In the game (17 § Patients and hospitals): `feed_patient` brings a meal, or, when no meal is to be had and other food is, any edible item; a job made for a meal that is blocked `missing_input` while that holds is cancelled and made again for the food. `test/unit/health/t664-patient-fed-raw-food.test.ts`.

In the script, as a player would (testing-strategy.md § The long scenarios):

- **A famine is answered** (`keepFoodFirst`): with food for fewer than ten days for the dwarves and a ripe crop left a day in the field, every adult is given farming and farming's labor priority goes to 2, ahead of the kit and of the raised work; with twenty days in the stores, or ten and no crop waiting, both go back.
- **Somebody hauls** (`keepAHauler`): when nobody out of the hospital holds hauling, everyone out of it is given it.
- **The farmer keeps the farm** (`keepAMiner`): the pick goes to the founding farmer last, after any bench, as T-660 did for the defence script.
- **The farm grows** (`checkFarm`): where no ground by the gate is left, a strip goes to its place west of the first field.

`test/unit/t664-food-first.test.ts`.

## Probes, before and after

The famine starts and ends are in the logs as `[three_years_famine]`. "After" is the whole answer.

| Timeline | Before: starved (days) | Before: end | After: starved | After: alive at the probe's end |
|---|---|---|---|---|
| `p4-1` @ 50 | 3 (day 32) | extinct in year 1 | 0 | 5 (day 200) |
| `p4-2` @ 0 | 9 (days 76 to 102) | extinct day 102 | 0 | 9 (day 200) |
| `p4-2` @ 100 | 8 (days 142 to 145) | extinct day 145 | 0 | 22 (day 200) |
| `p4-3` @ 100 | 10 (days 188 to 191) | extinct day 191 | 0 | 31 (day 220) |
| `p2-4` @ 0 | 22 (days 238 to 335) | 38 | 0 | 68 (day 340) |

In `p2-4` the farm now grows to 17 plots of 174 tiles; the famine rule fired four times there (days 22 to 25, 30, 122 to 145, 225 to 252). In the small fortresses it fires at the opening's lean days (day 21 or 22, as the first crops ripen with the embark food gone) and then whenever the ripe crops wait while the stores are low, often for a day or two.

## The sweep

*(to follow)*
