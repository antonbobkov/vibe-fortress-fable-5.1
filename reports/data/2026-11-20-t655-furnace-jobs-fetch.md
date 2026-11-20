# T-655: the furnace jobs' fetch

**Task:** T-655 · **Date:** 2026-11-20 · **Code:** branch `t655-furnace-fetch` on master `199a30ad` (T-648, T-653); the sweep ran on `a4a9ecaa` · **Source:** [the T-655 work file](../../docs/archive/tasks/T-655-furnace-jobs-fetch.md), [T-649's measurement](2026-11-20-t649-furnace-workers-needs.md)

T-649 found the furnace workers walking six ticks for each tick of work at their own workshop's job. This measures the trips each furnace recipe makes and why they are long, and fixes what was wrong.

## How

`test/perf/t655_furnace_fetch_probe.test.ts` plays a three-year seed at a sweep shift on the sweep's cadence and, from day 126 to day 336, journals every input a furnace job (the two smelters', the forge's, the wood furnace's) reserves: its type and units, its distance in steps (horizontal Chebyshev plus levels) from the workshop and from the worker when the job was claimed, and whether another free item the input would take lay nearer the workshop. Per completed job it counts the trips (items fetched) and, for a job claimed once, the ticks from the claim to the work and from the work to completion. It samples each furnace worker every 20 ticks as T-649 did, each furnace's job state, the fuel in stock, and what the stockpiles below hold.

```
T655_PROBE=1 T655_SEED=three-years-p4-6 T655_PERIL=4 T655_SHIFT=50 T655_DAYS=336 T655_FROM=126 npx vitest run -c vitest.perf.config.ts test/perf/t655_furnace_fetch_probe.test.ts
T655_PROBE=1 T655_SEED=three-years-p2-1 T655_PERIL=2 T655_SHIFT=0 T655_DAYS=336 T655_FROM=126 npx vitest run -c vitest.perf.config.ts test/perf/t655_furnace_fetch_probe.test.ts
```

Before: master `32c422b3`. After: the branch, with T-648 merged in. One run each, 25 minutes locally; one timeline each.

## What the trips were

**One stack or one unit a trip.** Every furnace input but the forge's bars is one unit (`make_charcoal` 1 log; a smelt 1 ore and 1 fuel; `alloy_steel` 1 iron bar, 1 flux stone, 1 fuel taken into the steel and 1 fuel burned), so a job makes one trip per input: 1 for charcoal and a coal smelt, 2 for an iron smelt, 4 for steel. The forge's 2-bar recipes took their bars as one stack when one lay to hand, and in 1.4 to 1.6 trips on average, the bars lying at the smelters in stacks of one and two (no bin was ever wanted in the fuel store, so the haulers never took the bars there). Trips above these counts are refetches after an interruption: the smith's steel jobs at the second smelter were claimed once in 0 to 7 of 10 to 18 jobs and made 8 to 13 trips each.

**Not the nearest input, twice over.** Two rules sent the workers past free inputs lying nearer:

- **The search began at the worker.** 11 § Assignment says a claim reserves the inputs nearest the workshop; the code searched from the worker's own tile. A furnace worker claims its next job wherever it is when it asks for work: back from a meal in the dining hall, from its bed or from the hall errand, 13 to 20 steps from the workshop on average. It took the input nearest the dining hall and carried it, heavy (ore and logs halve a dwarf's speed), the whole way back.
- **The largest stack won.** A unit input was taken from the largest stacks of the fortress, whatever their distance, with distance only breaking ties: for one bar of fuel the biggest stack of charcoal anywhere, never the single bar beside the furnace.

In `p4-6` 85 of the burner's 146 log trips, 60 of the coal smelts' 91 ore trips, 49 of the steel's 167 trips and 19 of the forge's 109 had a free match nearer the workshop than the one fetched; in `p2-1` 75 of 113, 7 of 40, 24 of 110 and 50 of 103.

**The burner's logs lay on the surface.** In `p4-6` the fuel store by the wood furnace (27 tiles, T-620) took wood, ore and bars, and from day 210 it held 21 to 27 ore and no logs; the ore store by the smelter (24 tiles, T-642) was full too. The felled logs found no stockpile below that would take them (the surface stockpile takes no wood once the fuel store stands) and lay where they fell, 13 to 43 of them loose on the surface: the burner walked 17 to 22 steps from its furnace for each, up the stair. In `p2-1` the fuel store is one site (9 tiles), held 3 to 7 logs, and the burner fetched from 15 steps.

## What changed

**In the game (11 § Assignment step 4, algorithms/jobs-and-hauling.md):**

- A claim searches for a job's inputs from the job: its delivery tile, or else a stand tile of the job, when the worker reaches it; otherwise from the worker's own tile. A sheltering civilian still searches from its own tile inside its shelter. The tool and a launcher's ammunition, which the worker carries away, are still searched from the worker.
- A unit input is taken from the fewest stacks (as many as the largest stacks need), and of the stacks that make it up in that many trips, the nearest: in search order a stack is taken while the stacks after it can still make up the rest in the trips left. One bar of fuel is the nearest stack holding one; four units come from the nearest stack of four or more before a larger one farther off; two near stacks of two still lose to one far stack of four, one trip against two.

**In the three-year script (as a player would):** once the ore store stands by the smelter, the fuel store takes no more ore, only wood and bars, so the logs come down beside the furnace.

**And on the way:** the sweep found a sapling grown into a tree on a watch post at `p2-7` and `p4-4` (shift 50, and master's own sweep at `p4-4` shift 150): T-653's look ordered the watch to a post nobody could stand on and 16 refused it (`bad_placement`), failing the seed. The script now fells a tree on a post, and the look counts a post nobody can stand on as unheld. A keeper for [fun-features.md](../../docs/fun-features.md).

## The trips before and after

Days 126 to 336. Steps are the input's distance from its workshop; "nearer" counts the trips that had a free match nearer the workshop; fetch and work are mean ticks of a job claimed once.

`three-years-p4-6` at shift 50:

| Recipe | Jobs | Trips a job | Steps | Nearer | Fetch : work |
|---|---|---|---|---|---|
| Charcoal | 118 → 46 | 1.2 → 1.0 | 17.5 → 3.6 | 85 → 0 | 498 : 86 → 165 : 95 |
| Coal smelt | 83 → 129 | 1.1 → 1.2 | 16.5 → 14.4 | 60 → 5 | 346 : 109 → 399 : 102 |
| Iron smelt (both smelters) | 23 → 13 | 2.0 → 4.0 | 7.4 → 5.6 | 23 → 1 | 371 : 106 → 1229 : 146 |
| Steel (both smelters) | 29 → 19 | 6.4 → 8.7 | 7.7 → 6.1 | 49 → 3 | 465 : 119 → (2 claimed once) |
| Forge | 39 → 17 | 2.9 → 3.3 | 7.1 → 6.5 | 19 → 0 | 436 : 139 → 599 : 129 |

`three-years-p2-1` at shift 0:

| Recipe | Jobs | Trips a job | Steps | Nearer | Fetch : work |
|---|---|---|---|---|---|
| Charcoal | 91 → 139 | 1.2 → 1.1 | 15.1 → 7.3 | 75 → 0 | 406 : 86 → 274 : 87 |
| Coal smelt | 36 → 51 | 1.1 → 1.2 | 23.1 → 21.3 | 7 → 0 | 706 : 95 → 462 : 122 |
| Iron smelt (both smelters) | 34 → 27 | 2.9 → 2.4 | 11.6 → 8.3 | 40 → 1 | 517 : 113 → 389 : 116 |
| Steel (both smelters) | 18 → 36 | 6.1 → 7.6 | 6.3 → 7.1 | 24 → 7 | 888 : 156 → 1094 : 156 (smelter) |
| Forge | 37 → 48 | 2.8 → 3.0 | 10.7 → 7.8 | 50 → 12 | 626 : 146 → 433 : 153 |

**The work share** (percent of the worker's day at its own workshop's job: working / walking empty / carrying):

| | `p4-6` before | after | `p2-1` before | after |
|---|---|---|---|---|
| Smelter | 5.8 / 12.9 / 10.2 | 6.3 / 13.4 / 12.3 | 2.5 / 10.0 / 7.7 | 5.2 / 16.0 / 10.5 |
| The smith (forge and second smelter) | 4.2 / 13.5 / 7.0 | 3.1 / 15.3 / 10.0 | 5.2 / 15.5 / 11.3 | 5.1 / 17.1 / 11.4 |
| Wood furnace | 4.5 / 12.8 / 14.0 | 1.7 / 2.5 / 0.6 | 4.0 / 10.6 / 10.0 | 5.8 / 15.7 / 6.4 |

The burner's walk fell by two thirds a job wherever the logs lay below, and in `p4-6` it now keeps the 40 charcoal its order maintains with time to spare: its furnace stood idle, stocked, 86% of the samples (none: 0% before), with 41 free charcoal on average against 29. The smelters' share of the day at work rose at `p2-1` (2.5 to 5.2%) and held at `p4-6`, where the coal ore still came from the drifts (14 to 21 steps: the ore store, full of iron ore, takes the coal ore only as room frees). What still binds the smelters is the job standing open while the worker is away (68 to 77% of samples at `p4-6`, unchanged) and the steel's four inputs; the second smelter's steel jobs, whose worker is also the smith, are interrupted and fetched again and again (a follow-up below). One timeline each; the jobs done move with the timeline, the sweep below is the measure.

## The sweep

Before: master's sweep 44715696949 on `199a30ad` (T-648 and T-653), not judged: its `p4-4` seed at shift 150 threw on the watch post's tree (above) and `p4-2` at shift 150 failed its rooms witness, so shift 150 pools 19 timelines. After: 44730019657 on `a4a9ecaa`, all 80 seed jobs green. Figures read from the verdict jobs.

| Run | Alive y1 | Peril-0 grown | Peril-0 need deaths | Living y3 | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| Master (44715696949), shifts 0 / 50 / 100 / 150 | 19 / 20 / 20 / 18 | 7 | 0 | 1070 / 960 / 1001 / 1044 | 100 / 111 / 141 / 114 | 1 | 10 / 8 / 2 / 10 |
| Master pooled | 19.25 | 7 | 0 | 1018.75 | 116.5 | 1 | 7.5 |
| T-655, shifts 0 / 50 / 100 / 150 | 19 / 20 / 20 / 20 | 7 | 0 | 1086 / 1096 / 1104 / 993 | 143 / 95 / 101 / 131 | 2 / 1 / 0 / 1 | 10 / 3 / 0 / 6 |
| **T-655 pooled** | 19.75 | 7 | 0 | **1069.75** | **117.5** | 1 | 4.75 |
| Reference | 19.5 | 7 | 0 | 1010.5 | 137 | 1.75 | 6.25 |

Verdict: pass (bounds 887.75 living, 161.88 deaths). The reference is not moved. The deaths are master's (117.5 against 116.5); the shifts swing by 100 living and 48 deaths on either commit, and at peril 4 part of that is the immigration rolls' luck ([T-650](2026-11-20-t650-peril-4-immigration.md)), so the living's gain is not claimed for the fetch.

**The steel ledger**, the peril-2 and peril-4 fortress-timelines (master 51, its `p4-4` at shift 150 missing; T-655 52), a timeline, read as T-642's was:

| | Master | T-655 |
|---|---|---|
| Steel bars smelted | 22.7 | **25.3** |
| Steel bars bought | 7.7 | 5.6 |
| Steel kit pieces forged / bought | 13.3 / 0.6 | 14.5 / 0.5 |
| Timelines with five kits | 9 | 10 |
| 50 steel bars or more / 30 or more | 9 / 27 | 9 / 26 |
| Iron ore mined / iron smelts | 119.7 / 64.7 | 125.7 / 65.8 |
| Coal smelts / charcoal burned | 52.7 / 174.5 | 50.4 / 185.1 |
| Under five iron bars on a weekly average | 24 | 31 |
| of which ten iron ore or more in stock | 18 | 24 |
| Under five charcoal | 10 | **7** |
| Under fifteen logs | 20 | **13** |
| Soldiers in steel at Proficient, at their best (sum) | 35 | **56** |
| Timelines that cleared a bar (full squad) | 4 (1) | 7 (5) |

The fuel binds less (7 timelines short of charcoal against 10, 13 short of logs against 20, 6% more charcoal burned) and the smelters make 11% more steel, but the iron binds more often: 31 timelines under five iron bars against 24, 24 of them with ten iron ore or more lying unsmelted. The smelter's coal ore still comes from the drifts, and the second smelter's steel waits on the smith (the follow-up below); what holds the smelters most is still the job standing open while their one worker is away, as T-649 found.

## Follow-ups

- [The steel's two fuels come in two trips](../../docs/archive/tasks/T-659-steel-fuel-in-one-trip.md).
- [The smith's steel jobs are fetched again and again](../../docs/archive/tasks/T-660-smith-steel-refetched.md).
