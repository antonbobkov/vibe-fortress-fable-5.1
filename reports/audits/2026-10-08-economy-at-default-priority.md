# Why the economy fortress fails at default priorities

Diagnosis for T-123, 2026-10-08. Examined at master `b838cdb`, seed `three-years` (peril 0, wealth 2, 48×48 map), 336 days. The earlier report is [the balance after F-17](2026-10-07-balance-after-f17.md); this one does not correct it, it re-measures on today's game and explains the result.

Every claim below is marked **[run]** (measured in a run of this audit) or **[code]** (read in the source or the spec). Where a cause is not established, the text says so.

## Summary

**The rewritten fixture is not simply a poor player. The game does not let a fortress at default priorities run a workshop chain.** Two measurements show it:

- **Each script works with urgent priorities and fails without them.** The old script falls from 19,154 marks to 5,161 when its priorities are shifted so that no job is urgent, with nothing else changed. The rewritten script rises from 4,925 marks to 16,054 when its priorities are shifted the other way. **[run]**
- **At default priorities a dwarf spends three quarters of its time on its own needs**, and most of that is travel, not eating or sleeping. About 20% is left for work, against 47% in the old fixture. **[run]**

The root cause is a mismatch of scale. A dwarf walks one tile in 10 ticks, so 120 tiles in a day of 1,200 ticks. The needs table asks for about 4.3 errands a day. Each errand is a walk of 10 to 25 tiles and the same back. **With dwarves walking twice as fast, and nothing else changed, the rewritten fixture at default priorities makes 17,242 marks in year 1 with a mood of 64.** **[run]**

Three game faults make it worse, and each breaks a chain on its own:

1. A hostile standing near the entrance stair traps every civilian on the stair. Eleven days in this run; the broker died. **[run]**
2. The job that opens a trade session outlives its caravan and its broker. After the broker died, no trade was possible for the remaining 196 days. **[run]**
3. A build job that is interrupted loses the materials already carried to the site. The carpenter's workshop took 113 days to build. **[run]**

The rewritten script also has faults of its own. They are real, but they are not the reason it produces little: with urgent priorities the same script makes beds, gems and lavish meals.

Urgent priorities are not a way to play either. They make dwarves wait for food, drink and sleep until the critical threshold, and mood stays near 36.

## Method

The instrument is a scratch test that runs the scenario's own loop and reads the game through its readers. It changes no world state. Its source is kept as [`2026-10-08-economy-at-default-priority-probe.ts.txt`](../data/2026-10-08-economy-at-default-priority-probe.ts.txt); copy it to `test/scenarios/t123-probe.test.ts` to run it. A summary of every run is in [`2026-10-08-economy-at-default-priority-data.json`](../data/2026-10-08-economy-at-default-priority-data.json).

- **Time accounting.** Every 5 ticks, each living fortress dwarf is put in one class from its brain behavior, its job state and its need plan.
- **Old fixture** is `test/scenarios/three_years*.ts` on master. **Rewritten fixture** is the same files from the branch `f-17` (`ffbc723`), checked out over master's. They compiled against today's game without change.
- **The instrument does not disturb the run.** With the old fixture it gives the same wealth and the same recipe counts as `npx vitest run test/scenarios/m8.test.ts -t three_years`. **[run]**

The variants change priorities only, by intercepting the script's commands:

| Variant | What changes | Effect |
|---|---|---|
| Old, unchanged | nothing | 97–99% of job time is on jobs of effective priority ≤ 2 **[run]** |
| Old, no urgent jobs | every labor priority +5, capped at 9 | the order between jobs is kept; no job is at effective priority ≤ 2 |
| Rewritten, unchanged | nothing | 0% of job time is on jobs of effective priority ≤ 2 **[run]** |
| Rewritten, urgent | every labor priority −3 | the order between jobs is kept; every routine job is at effective priority ≤ 2 |

Effective priority is the job's priority plus its labor's shift (`11` § Assignment). A dwarf with an open job at effective priority ≤ `NEED_DEFER_PRIORITY` (2) serves a need only at its critical threshold (`10` § Behavior selection, step 6; `src/systems/dwarves/brain.ts:229, 244–247`; `src/systems/jobs/board.ts:667–676`). **[code]**

## Before → after

Old fixture, today's master: **11,165 / 16,454 / 19,154** marks, every chain, 8 of 8 trades, no deaths. The filing note of the earlier report gave 15,107 / 18,638 / 23,698 for the same fixture; master has changed since (T-117, T-122, T-124, T-125, T-130). Which change moved it was not examined. **[run]**

| | Old, unchanged | Old, no urgent jobs | Rewritten, urgent | Rewritten, unchanged |
|---|---|---|---|---|
| Wealth, years 1 / 2 / 3 | 11,165 / 16,454 / 19,154 | 3,218 / 6,900 / 5,161 | 9,392 / 13,974 / 16,054 | 3,439 / 4,266 / 4,925 |
| Population, years 1 / 2 / 3 | 12 / 12 / 12 | 13 / 15 / 15 | 12 / 12 / 12 | 12 / 11 / 11 |
| Mood, daily mean from day 21 | 36.0 | 51.7 | 35.8 | 45.4 |
| Dwarf deaths | 0 | 1 (starvation, day 45) | 0 | 1 (starvation, day 140) |
| Trades / arrivals | 8 / 8 | 2 / 8 | 5 / 8 | 1 / 8 |
| Food / drink per dwarf-day | 0.25 / 0.41 | 0.36 / 0.59 | 0.24 / 0.41 | 0.32 / 0.49 |
| `make_bed` | 19 | 7 | 18 | 0 |
| `cook_lavish_meal` | 166 | 107 | 91 | 0 |
| `cut_gem` | 9 | 0 | 9 | 0 |
| `smelt_hematite` | 59 | 0 | 18 | 18 |
| Forge jobs, all recipes | 78 | 0 | 0 | 0 |

All figures **[run]**. Mood is the mean over living dwarves at each day boundary, days 21 to 336. The model is 55–60.

Two things in this table are not explained by the priority change and are listed under [Not established](#not-established): the old fixture without urgent jobs stops mining before day 112, and the rewritten fixture with urgent priorities buys no anvil.

## Where the time goes

Share of all dwarf time over three years, in percent. **[run]**

| Activity | Old, unchanged | Old, no urgent jobs | Rewritten, urgent | Rewritten, unchanged |
|---|---|---|---|---|
| Working at the job (the work step) | 7.5 | 3.9 | 5.7 | 4.1 |
| Fetching the job's inputs or tool | 23.4 | 5.1 | 13.9 | 9.1 |
| Walking to the job | 11.7 | 3.0 | 8.3 | 4.8 |
| Hauling (stockpile, depot, refuse) | 4.4 | 2.8 | 8.2 | 2.6 |
| **Work, total** | **47.0** | **14.8** | **36.1** | **20.6** |
| Sleeping | 5.9 | 15.3 | 6.3 | 12.1 |
| On the way to bed | 21.9 | 10.7 | 20.5 | 12.7 |
| Eating and drinking | 2.6 | 3.8 | 2.7 | 3.3 |
| On the way to food or drink | 13.6 | 16.4 | 20.0 | 23.2 |
| Talking, sitting, hearth visit | 2.6 | 13.5 | 4.5 | 13.4 |
| On the way to a talk, a seat or the hearth | 6.3 | 12.5 | 8.0 | 12.2 |
| **Needs, total** | **52.9** | **72.2** | **62.0** | **76.9** |
| Idle with a want it cannot serve | 0.0 | 1.4 | 0.1 | 0.3 |
| Idle, no work available | 0.0 | 11.5 | 0.6 | 0.4 |
| Waiting for the board to assign a job | 0.0 | 0.3 | 0.0 | 0.0 |
| Fleeing | 0.0 | 0.0 | 1.2 | 1.9 |
| Dwarf-days observed | 3,803 | 4,296 | 3,803 | 3,607 |

How to read it:

- **"On the way" is the need plan's phase before use.** It is walking to the target. For food it includes carrying the meal to a seat. For a talk it includes waiting up to 200 ticks for a partner (`src/systems/dwarves/activities.ts:352–410`). **[code]**
- **Waiting on a need is small.** "Idle with a want it cannot serve" is at most 1.4%. Dwarves are not standing still. They are travelling.
- **Even the old fixture walks more than it works.** Its work step is 7.5% of all time; fetching inputs is 23.4%.

Need errands in the rewritten fixture, unchanged, per dwarf-day **[run]**:

| Need | Errands started | Completed | Mean straight distance at start, tiles | Ticks on the way, per errand | Ticks in use, per errand |
|---|---|---|---|---|---|
| sleep | 1.08 | 1.03 | 7.7 and 2.2 levels | 142 | 135 |
| hunger | 0.74 | 0.32 | 10.7 and 2.4 levels | 210 | 27 |
| thirst | 0.71 | 0.49 | 12.0 and 3.8 levels | 174 | 28 |
| social | 0.60 | 0.55 | 3.1 | 85 | 75 |
| comfort | 0.61 | 0.57 | 5.4 and 1.2 levels | 87 | 97 |
| joy | 0.57 | 0.55 | 3.8 and 1.3 levels | 75 | 100 |
| **All** | **4.3** | | | | |

- **4.3 errands a day is what the needs table asks for.** `balance.md` § Needs and consumption gives a meal every 50 hours, a drink every 31, a chat a day, a sit every 20 to 40 hours, a hearth visit every 40, and sleep each day. That is four to five errands a day. The model counts none of the walking. **[code]**
- **More than half of the hunger errands do not end in a meal** (0.74 started, 0.32 eaten). Why they are abandoned was not examined.

### The experiment that isolates walking

Scratch edit, not committed: the dwarf row of the creatures table with `speed` 200 instead of 100. Rewritten fixture, unchanged, default priorities. **[run]**

| | Speed 100 | Speed 200 |
|---|---|---|
| Wealth, year 1 | 3,439 | 17,242 |
| Wealth, year 2 | 4,266 | 15,507 |
| Population, years 1 / 2 | 12 / 11 | 15 / 34 |
| Mood, daily mean, year 1 / year 2 | 45 (three years) | 64.1 / 63.2 |
| Year 1: beds, cut gems, lavish meals | 0 / 0 / 0 | 19 / 9 / 54 |
| Forge | never | from year 2 (pick, mail, shields, swords) |
| Trades / arrivals | 1 / 8 | 7 / 8 |
| Time above the want threshold, year 1: hunger / thirst / rest | 29% / 33% / 23% | 18% / 19% / 15% |

- **Speed 200 overshoots.** Year-1 wealth is 17,242 against a model of 4,000–8,000; 12,200 of it is meals and drink. The value that fits the model lies between 100 and 200 and was not measured.
- **The fortress then starves in year 3.** Immigration takes it to 41 dwarves; food stock reaches zero near day 280; 41 dwarves die of starvation between days 315 and 328. The script's farm plots are a fixed size. This is the script, not the speed.
- **"On the way to bed" did not shrink** (13.1% → 13.6% in year 1), although walking was twice as fast. Something other than walking fills that phase. It was not examined.

A second scratch experiment gave little. With an open job available, a dwarf skipped social, comfort and joy errands unless the need was at 90 or more, and a meal at a table also relieved comfort, joy and (with a dwarf within 4 tiles) social. Result: 4,187 / 5,070 / 5,449 marks, mood 45.6, 6 of 8 trades. The test was crude: those three needs sat above 90 most of the time, so the errands still ran (about 1,000 sits and 1,000 hearth visits). It does not show what a proper version would do. **[run]**

## The missing chains

All of this section is the rewritten fixture, unchanged, unless it says otherwise.

### Beds

**The step that never happens: the carpenter's workshop is not built until day 157, and after that the bed order is never reached.** **[run]**

- The workshop is placed on day 0. Its build job is open from day 0. The first input is delivered on day 43.
- From day 43 to day 66 the same dwarf (the woodcutter) claims the job six times. Nobody else ever claims it. Each time it fetches one or both of the two logs and is then interrupted:

  | Tick | Job state | Delivered / needed | Dwarf |
  |---|---|---|---|
  | 51,970 | fetching | 0 / 2 | claims with rest at 48 |
  | 52,355 | open | 1 / 2 | rest reaches 93, critical; job dropped |
  | 54,150 | fetching | **0** / 2 | claims again after eight need errands |
  | 54,655 | open | 1 / 2 | rest reaches 95; dropped |
  | 67,655 → 68,505 | fetching → working → open | 2 / 2, progress 210 of 1,000 | dropped again |
  | 70,555 | fetching | **0** / 2 | starts over |

- Fetching one log took about 375 ticks. Rest rises from the want threshold (60) to the critical one (90) in about 300 to 370 ticks. A job taken just under the want threshold cannot fetch two logs before it is interrupted.
- Between the drop at 52,355 and the next claim at 54,150 the dwarf did eight need errands in 1,795 ticks. A dropped job keeps its reservations for `RESERVE_KEEP_TICKS` = 600. After that the delivered log is free for haulers and for other jobs, and the job starts from nothing (`src/systems/jobs/board.ts:511–540, 604–612, 647–662`). **[code]**
- The workshop is finished on day 157. From then on its first order, barrels, is always runnable (threshold 20, then 50, then 100; stock 5 to 40), and a workshop works its orders in list order (`12` § Operation, "executed in list order"; `src/systems/workshops/operate.ts:341–365`). Beds are second. 36 barrels and no bed are made in 179 days. The job is open with no worker at most day boundaries.
- Three beds exist, from the wagon. 2,817 of 3,708 sleeps are on the floor.

With urgent priorities the same script builds the workshop early and makes 18 beds. **[run]**

### Lavish meals

**The step that never happens: the easy-meal order is never stocked, so the kitchen never reaches the lavish order.** **[run]**

- Kitchen orders, in list order: easy meal (maintain 20), fine meal (maintain 10), lavish meal (maintain 120, added on day 56).
- Easy-meal stock is between 0 and 15 at every 14-day sample; it never reaches 20. Ingredients are not short: 73 to 154 plants in stock from day 42.
- The kitchen job is open with no worker at 14 of the 23 samples from day 28. Two to four dwarves have `cooking` enabled.
- 213 easy-meal jobs make 852 meals; the dwarves eat 1,150 times (291 of them raw plants).

With urgent priorities the same script cooks 91 lavish meals. **[run]**

### Gem cutting

**The step that never happens: no gem is ever mined.** **[run]**

- The jeweler is built on day 70. Its order waits for `rough_gem` at every sample to day 336.
- Minerals mined in three years: 63 hematite, 28 coal, 9 limonite, no gem.
- The dig queue never empties: 85 to 326 dig designations are still behind undug rock at every 28-day sample, 169 on day 336. Two to four dwarves mine.
- The script's safe shaft stops at z = 20, as the earlier report says. Whether the gem tiles it designated are in the upper band or below it was not checked.

With urgent priorities the same script mines the gems in year 1 and cuts 9. **[run]**

### Trade

**Four different steps fail, at four visits.** One of eight visits ends in a trade, and that trade is 2 marks for 1.2. **[run]**

| Visit | What happens |
|---|---|
| Day 33, hillfolk | The script names a broker only from immigrants who are not specialists; the first two immigrants are both made specialists. There is no broker. The trade job is open for four days at priority 4. One dwarf has `trading` enabled, and it never takes the job. |
| Day 69, wildwood | A session opens on day 70. The depot holds 49 items worth 28 marks: stone crafts. The trade is 2 marks given. |
| Day 124, mountainhome (carries an anvil) | A thief arrives the same day and stands 5 to 6 tiles from the entrance stair for 11 days. The broker never leaves the stair (see [the stair trap](#a-hostile-near-the-entrance-stair-traps-civilians-on-it)). The caravan leaves on day 129. The broker dies on day 140. |
| Days 144 to 293, five visits | The trade job created on day 125 is still on the board, assigned to the dead broker. `TradeOpen` succeeds each day and creates nothing. No session opens (see [the stale trade job](#the-trade-job-outlives-its-caravan-and-its-broker)). |

### Forging

**The step that never happens: the fortress never owns an anvil.** At peril 0 the wagon has none; the script buys one from the Mountainhome caravan. **[run]** **[code]**

- Day 124: the caravan carries an anvil. No session opens (the stair trap).
- Day 229: the caravan carries an anvil again. No session opens (the stale trade job). The depot holds 579 to 611 marks of goods; the anvil costs about 311 (iron 15 × 15 = 225, merchant markup 120%, margin 15%).
- 40 iron bars and 42 charcoal are in stock on day 336, unused.

With urgent priorities the same script still buys no anvil: see [Not established](#not-established).

## The causes

| # | Cause | Class | Evidence | Rule and code |
|---|---|---|---|---|
| 1 | **Dwarves walk too slowly for a day of needs.** 4.3 errands a day at 10 ticks a tile leave about 20% of the day for work. | BALANCE | Time table; speed-200 experiment: 17,242 marks and mood 64 in year 1 at default priorities. **[run]** | `creatures.md` dwarf `speed` 100; `22` § Movement helper; `10` § Needs; `balance.md` § Needs and consumption. `src/content/creatures.json`, `src/systems/dwarves/needs.ts:9–21`. |
| 2 | **Every want is its own errand, taken before work.** Talking, sitting and the hearth visit take 25.6% of all time, more than work. | GAME | Time table; 1.8 such errands per dwarf-day. **[run]** | `10` § Behavior selection step 6; `creature-brains.md` `select`. `src/systems/dwarves/brain.ts:244–247`, `activities.ts:325–338`. |
| 3 | **A hostile near the entrance stair traps civilians on it.** | GAME (fault) | 11 days, 3 to 5 dwarves fleeing at every half-day sample, 69 dwarf-days of fleeing in year 2, one death. **[run]** | `10` § Behavior selection step 1. `src/systems/dwarves/brain.ts:70–106` and `357–365`. |
| 4 | **The trade job outlives its caravan and its broker.** | GAME (fault) | Job 2250, created at tick 150,000, open and assigned to a dead dwarf until day 336; five visits lost. **[run]** | `20` § Trading, `TradeOpen`. `src/systems/trade/index.ts:254–266`, `src/systems/jobs/board.ts:737–739`. |
| 5 | **An interrupted build loses its delivered materials.** | GAME | Carpenter's workshop: six claims in 23 days, built on day 157. **[run]** | `11` § Job steps, Interruptions; `RESERVE_KEEP_TICKS` 600. `src/systems/jobs/board.ts:511–540, 604–612, 647–662`. |
| 6 | **A dwarf takes a long job just before a need turns critical.** Wants are checked only between jobs; rest goes from want to critical in about 300 ticks. | GAME | Builder trace: job claimed at rest 48, dropped at rest 93. **[run]** | `10` § Needs ("interrupts any job"); `src/systems/jobs/index.ts:144–150`. Filed with cause 5. |
| 7 | **The script leaves one dwarf to haul and one or two for each craft.** Hauling is enabled on 1 of 7 dwarves to day 56, then on 3 or 4 of 12. | FIXTURE | Labor counts per day. **[run]** | A player keeps `hauling` on for most dwarves (`11` § Hauling: "`hauling` labor on every dwarf is the default"). |
| 8 | **The script puts barrels before beds and easy meals before lavish ones**, in workshops that never satisfy the first order. | FIXTURE | Order problems per day. **[run]** | `12` § Operation: orders run in list order and the player reorders them. A player would order beds first, or give them their own bench. |
| 9 | **The script has no broker for the first caravan and none among the founders.** | FIXTURE | Day 33 visit. **[run]** | A player names a founder as broker on day 1. |
| 10 | **The script does not treat a thief as a threat.** No alert, no squad order; the thief stands by the gate for 11 days. | FIXTURE | Its hostile-purpose list has no `thief` (`three_years_fortress.ts`, defense step 4). **[code]** | A player sends the squad. Cause 3 is still a fault: one thief must not starve a fortress. |
| 11 | **The script's farm does not grow with the population.** | FIXTURE | Speed-200 run: 41 dwarves, food at zero by day 280, 41 deaths. **[run]** | A player adds plots as immigrants arrive. Not visible at 12 dwarves. |
| 12 | **Stone crafts buy nothing.** 49 crafts are worth 28 marks to the wildwood caravan. | BALANCE, not filed | Day 69 visit. **[run]** | Stone is worth 1 to 3 marks (`materials.md`). The old fixture's exports are lavish meals: 1,375 marks on day 127. No constant is proposed: with the kitchen working this does not bind. |

Causes 1 and 2 are the answer to the question. Causes 3 to 6 are faults that would hurt any fortress and that urgent priorities happen to hide. Causes 7 to 11 are the script.

### A hostile near the entrance stair traps civilians on it

Trace of the broker, dwarf 50332210, from tick 149,045 (day 124). **[run]**

- It wants a drink at (27, 17, 32) on the surface and climbs the stair at (31, 9).
- At (31, 9, 32) it is within `THREAT_RADIUS` (8) of the thief at (34, 14–15, 32). It flees. The nearest "safer" tile is one step down the stair, because a tile on another level than the threat counts as safer (`brain.ts:83–84`). **[code]**
- At (31, 9, 31) the threat counts as gone, because it is on another level (`brain.ts:361–362`). The dwarf selects its need again and climbs.
- This repeats about every 50 ticks: 31,9,32 flee → 31,9,31 thirst → 31,9,32 flee.
- The thief stays within 6 tiles of the stair from day 124.5 to day 135. Three to five dwarves are in `flee` at every half-day sample in that time.
- The broker's needs all reach 100 by day 127.9. It dies of starvation on day 140.

The escape across levels came with T-122 (`3cebc7a`). The earlier report's run, before T-122, had 4 of 8 trades and no death; this run has 1 of 8 and one death. That T-122 introduced the loop is an inference from the code and the dates, not a measured before-and-after.

### The trade job outlives its caravan and its broker

- `TradeOpen` creates the job `trade:<depot>` and writes the broker of that moment into it (`src/systems/trade/index.ts:258–265`). Nothing cancels it when the caravan leaves. **[code]**
- A job with an assigned worker is offered to that worker only (`src/systems/jobs/board.ts:737–739`). **[code]**
- Day 33: the job is created with no assigned worker; it disappears after the caravan leaves, completed late by some dwarf. Day 125: job 2250 is created for broker 50332210. The broker dies on day 140. Job 2250 is still open on day 293, the last visit, with the same creation tick. A new broker is named on day 141 and is never offered the job. **[run]**

## Not established

- **Why the old fixture without urgent jobs stops mining.** On day 112 and after, no dig job is open at any sample; 309 to 738 are blocked "unreachable"; nothing is ever mined; 11.5% of dwarf time is idle with no work. This is more than slow work. It may share a cause with the stair trap or be a separate fault. Its year-1 figures (3,218 marks, 4.5% idle) still show the collapse, but the three-year wealth of this variant should not be read as "needs only".
- **Why the rewritten fixture with urgent priorities buys no anvil.** On days 230 to 234 a session is open, the anvil is on offer at 311 marks, the depot holds 524 to 1,841 marks, and the script sends no `TradeOffer`. The old script bought the anvil on day 126 with the same game. The fault is somewhere in the rewritten script's trade routine; where was not found.
- **Why a dwarf with `trading` enabled ignores an open trade job for four days** (day 33).
- **Why more than half of the hunger errands are abandoned.**
- **What fills "on the way to bed"** when walking speed doubles and the share does not fall.
- **Whether the gem tiles are above the safe shaft's bottom.**
- **Which merged change moved the old fixture** from 15,107 / 18,638 / 23,698 to 11,165 / 16,454 / 19,154.
- **The speed that fits the wealth model.** Only 100 and 200 were run, on one seed.
- No seed other than `three-years` was run. The 20-seed sweep was not run.

## Recommendations

| Size | Task | What |
|---|---|---|
| S | [T-141](../../docs/work/T-141-stair-flee-livelock.md) | A civilian who fled from a hostile does not walk back into its radius while it is still there. Fix first: it kills dwarves. |
| S | [T-142](../../docs/work/T-142-stale-trade-job.md) | The trade job ends with the caravan's stay and follows the broker title. |
| M | [T-143](../../docs/work/T-143-interrupted-build-keeps-materials.md) | Materials delivered to a building site or a workshop stay with the job until it is finished or cancelled. Cause 6 is left as it is: with the materials kept, an interruption costs a walk. |
| M | [T-140](../../docs/work/T-140-walking-speed-and-need-errands.md) | Raise walking speed against the need cycle, measured at 150 first. This is the balance change everything else waits on. |
| M | [T-144](../../docs/work/T-144-wants-without-errands.md) | Talking, sitting and the hearth visit stop being separate errands taken before work. Do after T-140 and re-measure; it may no longer be needed in full. |
| M | [T-145](../../docs/work/T-145-economy-fixture-default-priority.md) | Merge the rewritten fixture once T-140 to T-143 are in, with its own faults fixed (causes 7 to 11 and the anvil purchase). |

**No balance constant other than walking speed should move before T-140.** Food and drink per dwarf-day, mood, immigration and wealth all moved together when speed changed.
