# T-664: small fortresses starve beside their harvest

**Task:** T-664 · **Date:** 2026-11-20 · **Code:** branch `t664-small-fortress-starves`, swept at `411b454e` (master `1eb078c7`, T-661, merged) · **Source:** [the T-664 work file](../../docs/archive/tasks/T-664-small-fortress-starves.md), [T-656's report](2026-11-20-t656-thirst-under-the-alert.md), [T-659 and T-660's report](2026-11-20-t659-t660-steel-trips.md)

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

In the script, as a player would (testing-strategy.md § The long scenarios; `test/unit/t664-food-first.test.ts`):

- **A famine is answered** (`keepFoodFirst`): under three units of food a dwarf (`FAMINE_FOOD`, about nine days of eating: a dwarf eats a unit in about three days) with a ripe crop left a day in the field, every adult but the smith and the furnace workers is given farming, and farming's labor priority goes to 2, ahead of the kit and of the raised work; with six units a dwarf, or three and no crop waiting, both go back. `[three_years_famine]` marks each start and end.
- **Somebody hauls** (`keepAHauler`): when nobody out of the hospital holds hauling, everyone out of it is given it.
- **The farmer keeps the farm** (`keepAMiner`): the pick goes to the founding farmer last, as T-660 did for the defence script.
- **The farm grows** (`checkFarm`): where no ground by the gate is left, a strip goes to its place west of the first field.
- **A remnant keeps a woodcutter** (`keepWoodcutter`): under nine adults, with the founding woodcutter dead, in the hospital or at drill, an immigrant takes his trade (woodcutting, carpentry, farming) until he is back or the fortress has nine again.
- **A spent trap is raised** (`raiseWaitingWork`, met only in `defence_year`): a trap's rearming and cleaning are raised when they wait.

**On the way.** The first sweep (`44835275951`, famine at ten units a dwarf, no remnant woodcutter) starved one dwarf in four sweeps, but `p4-1` at shift 50, extinct in year 1 on master, now lived: five dwarves who grew again to nineteen and ended year 3 with six bedrooms, failing the rooms witness. Its probe found sixteen chops open for fifty days with two axes in stock and two dwarves holding woodcutting among all their labors (a chop is routine work everything else comes before): hence the remnant woodcutter. CI's `defence_year` then rearmed no trap (its only civilian mechanic a bench specialist whose raised crafts came first; the traps stood spent from day 75); raised, it rearmed three. The second sweep (`44844451308`) passed with every seed green and no dwarf starved, but the steel smelted fell from 27.5 bars a peril-2 or peril-4 timeline to 23.2: at ten units a dwarf the famine held the farm ahead of everything for 24 to 26 days of each such fortress's three years with a month of food in store. The threshold went to three units and the metal chain was left at the steel.

## Probes, before and after

"Before" is master's sweep `44811760127` (the probe replays it exactly); "after" is the final rules.

| Timeline | Before: starved (days) | Before: end | After: starved | After: alive at the probe's end | Famines (start days) |
|---|---|---|---|---|---|
| `p4-1` @ 50 | 3 (day 32) | extinct in year 1 | 0 | 9 (day 200) | 21, 30, 138 |
| `p4-2` @ 0 | 9 (days 76 to 102) | extinct day 102 | 0 | 5 (day 200) | 22, 55 |
| `p4-2` @ 100 | 8 (days 142 to 145) | extinct day 145 | 0 | 19 (day 200) | 22 |
| `p4-3` @ 100 | 10 (days 188 to 191) | extinct day 191 | 0 | 18 (day 220) | 21, 137 |
| `p2-4` @ 0 | 22 (days 238 to 335) | 38 alive | 0 | 51 (day 336) | 22 |

In `p2-4` the farm grows to 22 plots of 328 tiles against four plots of 51. The first famine comes at the opening's lean days (day 21 or 22, the embark food gone as the first crops ripen).

## The sweep

Before: T-659/T-660's `44811760127` (master `5869b08f`) and T-661's `44830514124` (master `1eb078c7`, the base of the final sweep). After: `44851035279` on `411b454e`, all 80 seed jobs green; CI `44851038456` on the same commit green.

| Run | Alive y1 | Peril-0 grown | Peril-0 need deaths | Living y3 | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| T-659/T-660 `44811760127` | 19.5 | 7 | 0 | 1095 | 126.75 | 1.25 | 13.25 |
| T-661 master `44830514124` | 19.5 | 7 | 0 | 1096 | 124.75 | 1.25 | 7.75 |
| T-664 first `44835275951` (base `5869b08f`) | 20 | 7 | 0 | 1146.25 | 106.25 | 0.25 | 0.25 |
| T-664 second `44844451308` | 20 | 7 | 0 | 1109.25 | 90 | 0.25 | 0 |
| **T-664 final `44851035279`, shifts 0 / 50 / 100 / 150** | 20 | 7 | 0 | 1094 / 1082 / 1076 / 1158 | 149 / 92 / 117 / 96 | 0 | 0 |
| **T-664 final, pooled** | 20 | 7 | 0 | **1102.5** | **113.5** | 0 | **0** |

**Verdict: pass** (bounds 887.75 living, 161.88 deaths).

Starvation deaths, four sweeps: 53 on T-659/T-660's master (`p2-4` @ 0 22, `p4-3` @ 100 10, `p4-2` @ 0 9, `p4-2` @ 100 8, `p4-1` @ 50 3, `p2-1` @ 100 1; peril 4: 30), 31 on T-661's (peril 4: 29), **none** in the final sweep (the only starvation lines are three mules). No fortress went extinct.

The economy, a peril-2 or peril-4 timeline (52), from each seed's `[three_years_economy]` line:

| | T-659/T-660 | T-661 master | T-664 final |
|---|---|---|---|
| Steel smelted (alloy jobs) | 28.0 | 27.5 | 25.2 (peril 2: 35.8 → 30.7; peril 4: 17.8 → 18.8) |
| Steel kit pieces forged | 16.3 | 16.0 | 15.2 |
| Brews | 273.6 | 275.1 | 279.2 |
| Drinks of water | 272 | 246.5 | 178.7 |
| Famine days a timeline (peril 2 / 4) | | | 2.6 / 8.0 |

The drink is kept and better (fewer drinks of water). The steel is kept at peril 4 and is a seventh lower at peril 2 than on master; at three units a dwarf the famine is rare (2.6 days a peril-2 timeline), so it is not the famine's hands. The peril-2 fortresses now farm more (the farm strips that failed by the gate now go west of the first field, and the farm grows with the fortress) and live longer; where the smith's and furnace workers' hours went at peril 2 was not traced (the coordinator's quota stop), which is left to [a follow-up](../../docs/work/T-668-peril2-steel-after-farm.md).

## Follow-ups

- [A patient is watered only with drink](../../docs/work/T-666-patient-water.md).
- [The three-year farm stops growing at its strips' cap](../../docs/work/T-667-farm-strip-cap.md).
- [Peril-2 steel after T-664](../../docs/work/T-668-peril2-steel-after-farm.md).
