# T-649: the furnace workers' needs

**Task:** T-649 · **Date:** 2026-11-20 · **Code:** none changed; master `3246e207` · **Source:** [the T-649 work file](../../docs/work/T-649-furnace-workers-needs-time.md), [T-642's measurement](2026-11-19-t642-iron-for-steel.md)

T-642 found the smelter's worker at its job about a third of the day, asleep a quarter and at hunger, thirst and "comfort" 7 to 19% each, with the smelter's job waiting. This measures whether that is unusual and where the time goes.

## How

`test/perf/t649_furnace_needs_probe.test.ts` plays a three-year seed at a sweep shift on the sweep's cadence and, from day 70 to day 336, samples every fortress dwarf every 20 ticks, grouped by the workshop it is assigned to: `smelter` (either smelter: the smelter's hand, and the smith once it works the second smelter), `forge`, `wood_furnace`, `shop` (any other workshop) and `none` (every other dwarf). Each sample is the dwarf's own workshop's job (at the bench, `working`, or fetching and walking for it), other work, or a need errand split into travel and use (10's activity plan phase). Every need errand is journalled: its ticks in travel and in use, and how far from its workshop it began and ended. "Hall" is the hall errand of 10 § Behavior selection step 6 (a sit in the hearth hall at `LEISURE_MARK`; the plan's need is `comfort`, which is what T-642's probe called comfort).

```
T649_PROBE=1 T649_SEED=three-years-p2-1 T649_PERIL=2 T649_SHIFT=0 T649_DAYS=336 T649_FROM=70 npx vitest run -c vitest.perf.config.ts test/perf/t649_furnace_needs_probe.test.ts
T649_PROBE=1 T649_SEED=three-years-p4-6 T649_PERIL=4 T649_SHIFT=50 T649_DAYS=336 T649_FROM=70 npx vitest run -c vitest.perf.config.ts test/perf/t649_furnace_needs_probe.test.ts
```

One run each, 19 minutes locally. Each group's smelter figures cover 423 dwarf-days; `none` covers about 8,800.

## The share of the day: an ordinary dwarf's

Percent of samples, `three-years-p2-1` at shift 0 / `three-years-p4-6` at shift 50:

| | Smelter | Forge | Wood furnace | Other workshops | Every other dwarf |
|---|---|---|---|---|---|
| Sleep (walk to bed + in bed) | 27.4 / 25.7 | 28.9 / 26.2 | 28.4 / 26.5 | 27.3 / 26.8 | 26.8 / 25.8 |
| Meals | 12.7 / 11.0 | 7.1 / 9.3 | 13.0 / 10.5 | 10.1 / 10.0 | 11.6 / 9.9 |
| Drinks | 11.4 / 11.3 | 7.2 / 8.6 | 12.8 / 8.9 | 9.0 / 8.1 | 10.8 / 9.1 |
| Hall errands, talks, joy, comfort | 13.5 / 12.7 | 12.1 / 12.0 | 14.9 / 11.6 | 12.6 / 12.1 | 14.5 / 13.1 |
| **All needs** | **65.0 / 60.7** | **55.3 / 56.1** | **69.1 / 57.5** | **59.0 / 57.0** | **63.7 / 57.9** |
| Own workshop's job: working | 3.4 / 3.5 | 3.4 / 4.6 | 4.6 / 3.7 | 2.7 / 2.3 | — |
| Own workshop's job: fetching, walking | 22.2 / 20.3 | 21.6 / 29.0 | 22.1 / 29.1 | 7.6 / 7.1 | — |
| Other jobs | 6.0 / 6.3 | 17.0 / 0.3 | 0 / 0 | 27.3 / 23.0 | 27.2 / 26.2 |
| Sheltering under the alert, on duty | 3.2 / 9.2 | 2.7 / 10.0 | 4.3 / 7.9 | 3.1 / 9.0 | 8.3 / 13.0 |

The smelter's workers spend 61 to 65% of the day at their needs, every other dwarf of the same fortress 58 to 64%. That is the needs model: [balance.md § Needs and consumption](../../docs/03-content/balance.md#needs-and-consumption) measures three fifths of a dwarf's time on need errands in year one, most of it travel, and more as a fortress grows. Nothing is wrong with the smelter's worker: one dwarf at one bench keeps it busy about a third of the day, and the job waits the rest.

**Sleep is the same whatever the walk.** The smelter's workers walk 217 to 219 ticks to bed and lie in it 58 to 87 (every other dwarf: 121 to 153 and 110 to 129), since their beds lie along the south corridor, a level up and across the halls from the workshop hall. Rest falls at the sleeping rate from setting off (10 § Sleeping), so the long walk is rest, and the sleep errands take 26 to 27% of the day for both. Bedding the furnace workers by the workshop hall would shorten the walk and lengthen the lie-in, not give the smelter an hour.

**The walk to meals, drinks and the hall costs 3 to 6 points of the day.** The rates are the model's: 0.35 to 0.36 meals and 0.54 to 0.56 drinks a day (0.38 to 0.40 and 0.58 to 0.59 for everyone; the model's 0.48 and 0.77 are at Endurance 50 and the full want rise). No need is refilled in small sips: a meal is 59 ticks of eating and a drink 43 to 45, as for everyone. What is longer is the walk: 315 to 358 ticks to a meal against 250 to 292, and 202 to 208 to a drink against 141 to 177. The meal ends 12 to 15 steps from the smelter (the dining hall), the drink 13 to 15 (the drink annex beside it), up the workshop hall's stair. The extra walk is 41 ticks a day at `p2-1` and 76 at `p4-6` (hall errands included), 3.4% and 6.3% of the day. The forge's smith in its months at the forge alone walked less than anyone (155 ticks to a meal, 114 to a drink at `p2-1`).

**Hall errands come oftener, as for every worker kept at a bench.** 0.53 to 0.56 a day, 125 to 142 ticks on the way and 100 seated, against 0.35 to 0.43 for every other dwarf, who relieve social, comfort and joy on the errands of step 8 when they have no work. A dwarf with a job always open never reaches step 8, so its leisure waits for `LEISURE_MARK` and the hall errand. The other workshops' workers and the wood furnace's take as many.

No hot-work rest exists in the rules, and none shows: the furnace workers' rest rises at the awake rate like everyone's (1.08 to 1.14 sleep errands a day against 1.22 to 1.24).

## What does bind the smelter: the fetch

At the smelter's own job, the workers spend 20 to 22% of the day fetching and walking and 3.4 to 3.5% working, six to seven ticks of walking for each tick at the furnace; the forge (21.6 to 29.0 against 3.4 to 4.6) and the wood furnace (22.1 to 29.1 against 3.7 to 4.6) are the same. At `p4-6` from day 126 to 210 the smelter's fetching was mostly walking empty-handed to an input 10 to 19 steps away (5.2% of the day), carrying ore from 0 to 19 steps (3.8%: the ore store works), and flux stone (1.4%) and fuel bars (0.8%) at fewer; the wood furnace's burner walked 20 steps and more for its logs (12.2% of the day) though the fuel store stands by the furnace. A job's inputs come one item per trip (11 § Job steps), so the more inputs a recipe has the more it walks. That is the lever on the furnaces' hours, not the needs: a follow-up, [the furnace jobs' fetch](../../docs/work/T-NEW-furnace-jobs-fetch.md).

## What a player does

A dining room and a drink store in the workshop hall would save at most the extra walk, 3 to 6% of the smelter's day, and T-619 found a drink stockpile beside the barracks drawing no soldier from the dining hall's (haulers fill the nearest stockpile with room). The second smelter T-642 gave the smith already doubles the furnace hours. Neither was tried: the needs are the model's, and the walking at the job itself is several times larger.

## Verdict

No code changed and no sweep was run. The needs model holds for the furnace workers; [balance.md § Needs and consumption](../../docs/03-content/balance.md#needs-and-consumption) and [testing-strategy.md § The long scenarios](../../docs/process/testing-strategy.md) now say so.
