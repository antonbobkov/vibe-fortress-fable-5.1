# Walking speed against the need cycle

Measurement for T-140, 2026-10-09. Examined at master `3f781b2`, 336 days, seed `three-years` (peril 0, wealth 2) unless a row says otherwise. The earlier report is [why the economy fortress fails at default priorities](2026-10-08-economy-at-default-priority.md); this one re-measures its baseline on today's game and measures the speed factor it asked for.

Every figure is marked **[run]** (measured in a run of this audit; the run is named) or **[code]** (read in the source or the spec). Where a cause is not established, the text says so.

## Summary

**Every creature now walks 1.5 times as fast (dwarf 0.10 → 0.15 tiles per tick). That fixes mood and lets a fortress at default priorities run its workshop chains. It does not raise the share of time a dwarf works, and no factor up to ×2 does.**

- **Mood reaches the band.** Rewritten fixture, default priorities: daily mood mean 45.3 → 57.6 (model 55–60). Old fixture: 35.2 → 56.5. A second peril-0 seed: 50.9 → 61.7. **[run]**
- **The chains run.** At ×1.0 the rewritten fixture makes 3 beds, no cut gem and no lavish meal. At ×1.5 it makes 20 beds, 9 cut gems and 115 lavish meals. **[run]**
- **Year-1 wealth is 11,234, above the model's 4,000–8,000.** 6,420 of it is 107 lavish meals in stock. Without them it is 4,814. On the second peril-0 seed year 1 is 6,162. **[run]**
- **The work share does not move: 22.0% of dwarf time in year 1 at ×1.0, 22.7% at ×1.5, 22.7% at ×1.75, 23.3% at ×2.** T-140 asked for 35%. Need errands take 74% of the time at ×1.5: 30% in use, which speed cannot change, and 44% in travel, which fell from 50%. Dwarves walk faster and walk further. **[run]**
- **Years 2 and 3 stay far below the wealth model** (6,087 and 8,846 against 15,000–25,000 and 35,000–60,000). **[run]**

T-140's rule was "work share at least 35%, mood mean at least 55, year-1 wealth inside 4,000–8,000 or explained". ×1.5 meets the second, the third with the explanation above, and not the first. ×1.75 and ×2 do not meet the first either, overshoot year-1 wealth further, and are not needed for mood. So ×1.5 is the factor, and the work share is left to T-144.

Two findings are new and are not about speed:

1. **A fortress can die of thirst with a still, brewers and plants in stock.** At ×1.0 all 12 dwarves of the rewritten fixture die on days 150–152; at ×1.75 all 30 die on days 275–277. In both runs the still's brew job stops being done for weeks. At ×1.5 and ×2 it does not happen on this seed. The cause is not established. Filed as T-188. **[run]**
2. **The three-year scenario now takes far longer to run.** The old fixture grows to 43 dwarves at ×1.5 (12 at ×1.0). `npx vitest run test/scenarios/m8.test.ts -t three_years` took 1,402 s on a loaded machine, against a `timeoutMs` of 300,000; it passed, because every assertion held. The whole `npm test` took 1,270 s at ×1.5 and 772 s at ×1.0 on the same machine. **[run]**

## Method

The instrument is the T-123 probe, extended. Its source is [`2026-10-09-walking-speed-probe.ts.txt`](../data/2026-10-09-walking-speed-probe.ts.txt). A summary of every run is in [`2026-10-09-walking-speed-data.json`](../data/2026-10-09-walking-speed-data.json).

- **Time accounting** is the earlier report's: every 5 ticks each living fortress dwarf is put in one class from its brain behavior, its job state and its need plan. "Use" is the plan's `use` phase (eating, drinking, sleeping, talking, sitting, standing at the hearth). "Travel" is every earlier phase: the walk to the target, for a meal the walk from the food to a seat, and for a talk the wait of up to `SOCIAL_WAIT_TICKS` for a partner (`src/systems/dwarves/activities.ts`, `step`). **[code]**
- **Added: moving or still.** At each sample the probe compares the dwarf's position and path progress with the previous sample. In the travel phases of every need but the talk, the dwarf is moving in 98% of samples or more, at a mean `Motion.speed` of 93 at ×1.0 and 140–144 at ×1.5 (the species speed times the agility, wound and carry modifiers). On the way to a talk it stands still in about a fifth of the samples at ×1.0 and a tenth at ×1.5: the wait for a partner. Travel is walking, not waiting. **[run: rewritten ×1.0 and ×1.5]**
- **Added: wealth by item type** at each year end, from the items reader's `value`.
- **Old fixture** is `test/scenarios/three_years*.ts` on master. **Rewritten fixture** is the same files from the branch `f-17` (`ffbc723`), copied beside master's. They ran against today's game without change. Neither was edited.
- **The speed factor** was a scratch hook that multiplied the `speed` of every row of `src/content/creatures.json` at load and rounded to the nearest thousandth of a tile. For ×1.5 every product is exact, and the values are the ones now in `creatures.md`. For ×1.25 and ×1.75 some rows were rounded.
- **Baseline check.** At ×1.0 the old fixture gives 11,050 / 15,404 / 28,223 marks in the probe. The earlier report gave 11,165 / 16,454 / 19,154 at `b838cdb`. Master has moved (T-141 to T-143, T-160 to T-168, T-180 to T-183); which change moved year 3 was not examined.
- One run per cell. No seed sweep.

## Baseline at ×1.0, today's master

All figures **[run: old ×1.0, rewritten ×1.0]**.

| | Old fixture | Rewritten fixture |
|---|---|---|
| Wealth, years 1 / 2 / 3 | 11,050 / 15,404 / 28,223 | 3,749 / 3,750 / 3,726 |
| Population, years 1 / 2 / 3 | 12 / 12 / 12 | 12 / 0 / 0 |
| Mood, daily mean, days 21–336 | 35.2 | 45.3 (to day 152) |
| Food / drink per living dwarf-day | 0.25 / 0.41 | 0.34 / 0.44 |
| Trades / arrivals | 8 / 8 | 1 / 8 |
| Dwarf deaths | 0 | 12, all `starvation`, days 150–152 |
| Beds / cut gems / lavish meals / forge jobs | 19 / 9 / 168 / 75 | 3 / 0 / 0 / 0 |
| Work, year 1 | 46.5% | 22.0% |
| Needs, year 1: use / travel | 14.2% / 39.1% | 27.3% / 49.7% |
| Work, three years | 47.5% | 19.7% (to day 152) |
| Needs, three years: use / travel | 11.0% / 41.4% | 27.9% / 49.3% |

- **The three faults of the earlier report are gone from the trace.** Longest uninterrupted flee in the old fixture's scenario at ×1.5: 32 ticks. **[run: `m8.test.ts -t three_years` at ×1.5]**
- **The rewritten fixture is worse than on 2026-10-08** (4,925 marks and one death then). It now dies out. See [the thirst collapse](#a-fortress-dies-of-thirst-beside-its-still). The cause code `starvation` covers hunger and thirst (`src/systems/dwarves/index.ts:210–211`, `src/systems/health/index.ts:245`). **[code]**
- Year-1 figures of the rewritten fixture are before the collapse (the brew job stalls on day 121) and can be compared across factors.

## The factor

Rewritten fixture, default priorities, seed `three-years`. All figures **[run: rewritten ×1.0, ×1.25, ×1.5, ×1.75, ×2]**. ×1.25 is outside T-140's list and was run to see where the chains start.

| | ×1.0 | ×1.25 | **×1.5** | ×1.75 | ×2 |
|---|---|---|---|---|---|
| Wealth, year 1 | 3,749 | 4,129 | **11,234** | 13,550 | 24,164 |
| – of which meals and drink | 20 | 70 | **6,890** | 8,860 | 18,590 |
| Wealth, years 2 / 3 | 3,750 / 3,726 | 5,347 / 5,821 | **6,087 / 8,846** | 11,337 / 6,720 | 16,075 / 11,747 |
| Population, years 1 / 2 / 3 | 12 / 0 / 0 | 12 / 15 / 15 | **14 / 19 / 30** | 14 / 30 / 0 | 16 / 29 / 41 |
| Mood, daily mean, days 21–336 | 45.3 | 53.9 | **57.6** | 59.3 | 63.7 |
| Mood, daily mean, days 21–112 | 47.8 | 54.4 | **57.7** | 60.8 | 63.1 |
| Food / drink per living dwarf-day | 0.34 / 0.44 | 0.33 / 0.44 | **0.35 / 0.54** | 0.38 / 0.55 | 0.39 / 0.63 |
| Trades / arrivals | 1 / 8 | 6 / 8 | **3 / 8** | 4 / 8 | 6 / 8 |
| Dwarf deaths | 12 (days 150–152) | 0 | **0** | 30 (days 275–277) | 0 |
| Beds / cut gems / lavish meals / forge jobs | 3 / 0 / 0 / 0 | 21 / 0 / 0 / 0 | **20 / 9 / 115 / 0** | 20 / 9 / 166 / 0 | 19 / 9 / 246 / 24 |
| **Work, year 1** | 22.0% | 22.5% | **22.7%** | 22.7% | 23.3% |
| – work step / fetch / walk to job / haul | 4.7 / 9.7 / 5.1 / 2.5 | 5.6 / 9.1 / 5.5 / 2.4 | **6.3 / 9.2 / 4.2 / 3.1** | 7.1 / 8.8 / 3.8 / 2.9 | 7.8 / 8.3 / 3.8 / 3.3 |
| **Needs, year 1: use / travel** | 27.3% / 49.7% | 28.5% / 47.0% | **29.7% / 44.0%** | 28.0% / 44.2% | 30.2% / 39.8% |
| – sleep: use / travel | 11.4 / 14.5 | 11.5 / 14.2 | **11.8 / 13.6** | 10.4 / 15.1 | 12.1 / 13.4 |
| – food and drink: use / travel | 3.5 / 21.9 | 3.6 / 19.3 | **3.8 / 17.1** | 3.9 / 15.7 | 4.0 / 14.1 |
| – talk, sit, hearth: use / travel | 12.4 / 13.3 | 13.4 / 13.6 | **14.1 / 13.3** | 13.7 / 13.5 | 14.2 / 12.2 |
| Idle with no work, year 1 | 0.3% | 1.4% | **3.0%** | 4.3% | 6.1% |
| Work, three years | 19.7% | 16.3% | **16.3%** | 16.5% | 14.5% |
| Needs, three years: use / travel | 27.9% / 49.3% | 24.0% / 58.8% | **29.4% / 48.6%** | 30.9% / 42.7% | 34.1% / 34.0% |
| Idle with no work, three years | 0.3% | 0.6% | **4.6%** | 7.8% | 16.9% |

The old fixture (urgent priorities) at the chosen factor **[run: old ×1.0, old ×1.5]**:

| | Old, ×1.0 | Old, ×1.5 |
|---|---|---|
| Wealth, years 1 / 2 / 3 | 11,050 / 15,404 / 28,223 | 20,398 / 24,746 / 18,860 |
| – year 1, of which meals and drink | 6,540 | 12,820 |
| Population, years 1 / 2 / 3 | 12 / 12 / 12 | 16 / 21 / 43 |
| Mood, daily mean, days 21–336 | 35.2 | 56.5 |
| Mood, daily mean, days 21–112 | 35.3 | 49.7 |
| Food / drink per living dwarf-day | 0.25 / 0.41 | 0.36 / 0.57 |
| Trades / arrivals | 8 / 8 | 8 / 8 |
| Dwarf deaths | 0 | 0 |
| Beds / cut gems / lavish meals / forge jobs | 19 / 9 / 168 / 75 | 19 / 9 / 244 / 116 |
| Work, year 1 / three years | 46.5% / 47.5% | 33.7% / 19.5% |
| Needs, year 1: use / travel | 14.2% / 39.1% | 22.3% / 38.5% |
| Needs, three years: use / travel | 11.0% / 41.4% | 30.2% / 37.0% |
| Idle with no work, year 1 / three years | 0.0% / 0.0% | 5.1% / 12.9% |

Two more seeds, rewritten fixture **[run: rewritten `three-years-p0-1` ×1.0 and ×1.5; rewritten `three-years-p2-1` (peril 2) ×1.0 and ×1.5]**:

| | `p0-1`, ×1.0 | `p0-1`, ×1.5 | `p2-1`, ×1.0 | `p2-1`, ×1.5 |
|---|---|---|---|---|
| Wealth, years 1 / 2 / 3 | 3,709 / 4,569 / 4,802 | 6,162 / 12,897 / 16,697 | 3,943 / 3,372 / 2,986 | 6,528 / 7,603 / 5,839 |
| Population, years 1 / 2 / 3 | 14 / 14 / 14 | 14 / 22 / 29 | 3 / 0 / 0 | 13 / 0 / 0 |
| Mood, daily mean, days 21–336 | 50.9 | 61.7 | 33.9 | 45.6 |
| Food / drink per living dwarf-day | 0.35 / 0.50 | 0.37 / 0.59 | 0.32 / 0.53 | 0.35 / 0.46 |
| Trades / arrivals | 5 / 8 | 7 / 8 | 0 / 8 | 4 / 8 |
| Dwarf deaths | 0 | 0 | 17 (killed 4, bled out 10, starvation 3; days 61–118) | 17 (killed 2, bled out 4, starvation 11; days 61–194) |
| Beds / cut gems / lavish meals / forge jobs | 13 / 20 / 0 / 0 | 20 / 30 / 200 / 20 | 13 / 0 / 3 / 12 | 21 / 0 / 2 / 34 |
| Work, year 1 / three years | 24.9% / 18.2% | 21.3% / 16.9% | 31.1% / 30.7% | 25.6% / 21.9% |
| Needs, year 1: use / travel | 27.1% / 44.7% | 26.7% / 46.8% | 20.3% / 43.8% | 26.6% / 42.0% |

- **Peril 0, second seed:** every measure but the work share improves, and year-1 wealth is inside the model.
- **Peril 2:** the fortress loses 14 dwarves to the day-61 bandits and the day-67 ambush at ×1.0 and 4 at ×1.5 (2 more in later attacks), then dies out in both. At ×1.5 eleven die of hunger or thirst on days 190–194, with no drink in stock at any six-day sample from day 174. This fixture arms no squad in time at either speed (the earlier sweep found the same); the run says nothing about combat balance.

## Why ×1.5

1. **It is the first factor at which mood is in the band** (57.6; ×1.25 gives 53.9) and at which the kitchen and the jeweler work at default priorities.
2. **×1.75 buys nothing T-140 asked for.** The work share is the same (22.7%). Year-1 wealth is further over (13,550). Mood is already in the band at ×1.5.
3. **T-140's own rule goes to ×1.75 only if year-1 wealth is under 4,000 or mood is under 55.** Neither holds at ×1.5.
4. **It breaks nothing.** The suite at ×1.5 fails two tests, both by design: the world-hash golden, and a unit test that had the dwarf's species speed written as a literal. No scenario bound is exceeded ([below](#every-bound-checked)).

### Year-1 wealth above the range

Year-1 wealth at ×1.5 is 11,234. By item type, day 112 **[run: rewritten ×1.5, 112 days]**: lavish meals 6,420 (107 at 60 marks), logs 505, tunics 336, trousers 336, ore 326, fine meals 300, drink 282, bars 255, boots 224; items 11,056 in all.

- **The overshoot is one stock.** The script orders "maintain 120 lavish meals" from day 56. Without the lavish meals the fortress holds 4,814 marks, inside the model.
- **The model expects the cook to be the first wealth engine** (`balance.md` § Food chain: "a lavish meal from four cheap ingredients is worth 60 marks") but lists only "first meals" among the year-1 drivers. 107 lavish meals is not "first meals". Whether the model or the meal's value should move is a question for the B-008 review after T-145; no constant is proposed here.
- At ×1.0 the same order exists and is never reached (no lavish meal is cooked), which is why year 1 was 3,749.
- On `three-years-p0-1` at ×1.5 year 1 is 6,162 with 1,775 marks of meals and drink.

### Why the work share does not move

All **[run: rewritten ×1.0 and ×1.5, year 1]** unless marked.

| Need | Errands started per dwarf-day, ×1.0 → ×1.5 | Straight distance at start, tiles | Ticks on the way, per errand | Ticks in use, per errand |
|---|---|---|---|---|
| sleep | 1.14 → 1.20 | 8.8 → 11.8 | 153 → 136 | 121 → 118 |
| hunger | 0.42 → 0.40 | 10.6 → 13.6 | 347 → 298 | 50 → 54 |
| thirst | 0.54 → 0.59 | 12.6 → 11.5 | 218 → 145 | 38 → 40 |
| social | 0.66 → 0.68 | 4.3 → 5.9 | 104 → 97 | 74 → 77 |
| comfort | 0.54 → 0.61 | 5.7 → 6.2 | 95 → 78 | 95 → 100 |
| joy | 0.50 → 0.56 | 4.1 → 6.4 | 79 → 82 | 98 → 100 |
| **All** | **3.80 → 4.04** | | | |

- **Use is fixed by the need rates.** It is 27% to 30% of the time at every factor. With no walking at all, needs would still take that much.
- **Travel time per errand falls by 11% to 33%, not by a third across the board.** Speed rose by half; the walks got longer. At ×1.5 the fortress has 20 beds in bedrooms where at ×1.0 it had 3 and dwarves slept on the hall floor. The straight distance to bed rises from 8.8 to 11.8 tiles. Why the walks to the hall (social, joy) are longer was not examined.
- **A dwarf walks about 55 tiles a day for its needs at ×1.0 and about 75 at ×1.5** (travel share × 1,200 ticks × the mean moving speed).
- **More errands complete.** 3.80 → 4.04 started per dwarf-day.
- **The time that speed frees goes to idling, not to work.** "Idle, no work available" is 0.3% of year 1 at ×1.0 and 3.0% at ×1.5, 6.1% at ×2. Over three years it is 4.6% at ×1.5 and 16.9% at ×2. The script does not hand out more work when its dwarves finish sooner.
- **Talking, sitting and the hearth visit take 27.4% of year 1 at ×1.5** (14.1% in use, 13.3% in travel), more than work (22.7%). This is the share T-144 addresses.

So 35% cannot come from walking speed. At ×1.5 work plus idle is 25.7% of year 1; the other 74% is need errands, and 30 points of that are use.

## Every bound checked

The whole suite was run twice with the scratch hook, at ×1.0 and at ×1.5, with every `TestWorld.until` call logging the ticks it took against its limit: 319 distinct call sites. **[run: `npm test` ×1.0, 220 files and 2,003 tests passed; ×1.5, 2,001 passed and 2 failed]**

- **No limit is exceeded at ×1.5.** No bound was changed. Each is kept.
- **The two failures** are `test/golden/world-hashes.test.ts` (the flat-test world hashes) and `test/unit/dwarves/dwarves.test.ts` (it had the dwarf's species speed as the literal 100). No render golden moved.

The bounds that include walking, ticks taken against the limit:

| Test | Bound | ×1.0 | ×1.5 | Decision |
|---|---|---|---|---|
| `tr_dig_room`, 3×3 room, one miner (`acceptance-tests.md` § 03) | 2,500 | worst of 101 runs 2,438, mean 2,031 | worst 1,868, mean 1,410 | kept |
| Two-pick dig at default priority (C-005, `test/unit/items/search.test.ts`) | 2,200 after both picks are equipped | 2,057 | 992 | kept |
| `jb_tool`, dig after fetching a pick | 3,000 | 474 | 341 | kept |
| `jb_hauling`, 20 items to a stockpile | 4,000 | 1,211 | 567 | kept |
| `dw_stair_flee`, flee and drink | 350 | 156 | 119 | kept |
| `dw_stair_threat_return`, eat at critical hunger | 500 | 100 | 88 | kept |
| `dw_stair_threat_return`, level changes in 500 ticks | at most 2 | passes | passes | kept |
| `dw_critical_interrupt`, drink | 200 | 53 | 50 | kept |
| `cb_alert_hearth`, retreat to the hall | 350 | 23 | 16 | kept |
| `he_bandage`, treated after admission | 300 (350 in the wait) | 94 | 91 | kept |
| `fo_hunt`, kill / butchery | 1,200 / 1,200 | 12 / 202 | 12 / 179 | kept |
| `th_thief`, thief escapes | 1,200 | 252 | 170 | kept |
| `th_loiter`, raid ends | 3,500 | 2,431 | 2,431 | kept; set by `LOITER_DAYS_RAID` |
| `th_retreat`, raid ends | 1,500 | 1 | 1 | kept |
| `td_depot`, caravan at the depot / departs | 24,000 / 7,200 | 7,613 / 6,481 | 7,476 / 6,321 | kept; set by the stay in days |
| `td_attack`, caravan at the depot / departs | 24,000 / 1,200 | 11,213 / 478 | 11,076 / 318 | kept |
| `td_schedule`, arrival windows in days | by day | passes | passes | kept |
| Raid party at a locked door (`test/unit/threats/ai.test.ts`) | 4,500 | 2,605 | 2,548 | kept |

Five call sites took more ticks at ×1.5 than at ×1.0, none near a limit except the three long waits, which moved by 3 to 50 ticks: `he_bandage` healing (17,905 → 17,908 of 20,000), `pl_cave_cycle` (18,441 → 18,491 of 21,600), `he_infection` (4,229 → 4,233 of 4,500), a furniture deconstruction (21 → 124 of 2,000), an egg haul (4 → 7 of 20).

Constants read for an assumed pace **[code]**:

| Constant | Value | Depends on walking speed? |
|---|---|---|
| `DWARF_SPEED` (`22` § Tuning constants, `src/core/path-constants.ts`) | 0.1 → **0.15** | It is the documented baseline of the content value. Changed with it. Nothing reads it but a test. |
| `PROJECTILE_SPEED` (16) | 3 tiles per tick | No. A charging creature now covers `RANGED_KEEP_DISTANCE` and a bow's range in two thirds of the time, so an archer gets fewer shots before melee. Not measured. |
| `THREAT_RADIUS`, `PERCEPTION_RADIUS`, `SPOT_RADIUS`, `LOOT_RADIUS`, `FOLLOW_RADIUS`, `DINING_SEARCH_RADIUS`, `WANDER_RADIUS`, `Z_DISTANCE_WEIGHT` | tiles | No: distances. A given radius is now crossed sooner. |
| `ARRIVAL_TICKS` (18), `ARRIVAL_INTERVAL_TICKS` (21) | 100, 20 | No: spawn spacing at the map edge. |
| `WARNING_DAYS`, `LOITER_DAYS_*`, `CARAVAN_STAY_DAYS`, `DEPOT_WAIT_DAYS` | days | No. A caravan reaches the depot 137 ticks sooner in `td_depot`. |
| `CIVILIAN_COMBAT_TIMEOUT_TICKS`, `TARGET_LOSE_TICKS`, `ENGAGE_IDLE_TICKS`, `FLEE_TICKS` (08), `HUNT_GIVE_UP_TICKS`, `WANDER_TIMEOUT_TICKS`, `CAVE_RETURN_TICKS`, `ALERT_LOCK_GRACE_TICKS` | ticks | Each is a time limit on something that includes a walk. Each now allows half again as many tiles. Every creature moved by the same factor, so pursuit and flight keep their ratios. None was changed. |
| `RESERVE_KEEP_TICKS`, `NEED_RETRY_TICKS`, `BLOCKED_RETRY_TICKS`, `SOCIAL_WAIT_TICKS` | ticks | Waits, not walks. Unchanged. |
| `REPATH_WAIT_TICKS` (22) | 5 | No. |
| Need rates, `EAT_TICKS`, `DRINK_TICKS`, `SLEEP_HOURS`, `TALK_TICKS`, `SIT_TICKS`, `HEARTH_VISIT_TICKS` | | Left alone by T-140's decision. |
| `balance.md` § Combat pace | | No figure there is a walking time. Unchanged. |
| `balance.md` § Time and pace | "10 seconds to cross 20 tiles, 48 seconds to cross the map" | Rewritten: 7 seconds and 32 seconds. |

## A fortress dies of thirst beside its still

Rewritten fixture, seed `three-years`.

**At ×1.0** **[run: rewritten ×1.0, and a 152-day trace of the brew job]**:

- Brew job 2206 is claimed on day 121.21 and reaches `working` on day 121.43 with 2 of its 4 plants delivered and its barrel delivered. On day 121.55 it is `open` again with no worker.
- It stays `open`, not blocked, with no worker, until day 151. Five dwarves have `brewing` enabled. Plants in stock: 66 to 129 at every sample. The order's problem reads as none.
- Drink in stock: 74 on day 120, 12 on day 132, 0 from day 136. No water is drunk in the whole run.
- Thirst is at its critical threshold for 43% of dwarf time in year 2. All 12 dwarves die on days 150–152.
- A thief arrives on day 124, after the job stalled.

**At ×1.75** **[run: rewritten ×1.75]**:

- A thief arrives on day 236. Drink in stock: 331 on day 234, 156 on day 250, 0 from day 262. Meals of every kind are 0 from day 246, with 71 to 118 plants in stock.
- Brew job 4323, created on day 244, is in `fetching` with a different worker at each four-day sample from day 246 to day 272. Nineteen dwarves have `brewing` enabled.
- All 30 dwarves die on days 275–277.

At ×1.5 and ×2 the same seed has thieves on days 124, 206 and 276 and nobody dies. **[run]**

**Not established:** why an open, unblocked job is not claimed for 30 days; why a job in `fetching` makes nothing for 26 days; whether the two are one fault; whether the thief has any part in the second. Filed as T-188.

## Not established

- **The cause of the thirst collapse**, above.
- **Why the walks to a talk and to the hearth are longer at ×1.5** than at ×1.0.
- **Why trades are 3 of 8 at ×1.5** and 6 of 8 at ×1.25 and ×2. The script's trade routine has known faults (T-145).
- **Why year-2 wealth falls** from 11,234 to 6,087 at ×1.5. The lavish-meal stock is 5 on day 224; who ate or sold them was not traced.
- **Why the old fixture's year 3 falls** from 28,223 at ×1.0 to 18,860 at ×1.5 while its population goes from 12 to 43.
- **Combat pace.** No combat scenario bound moved, but ranged fights against a charging enemy were not measured.
- **The 20-seed sweep was not run.** One seed for the factor table, two more for ×1.0 against ×1.5.
- **Wall-clock figures** are from a machine that was running other test suites.

## What is still off the model

| Measure | Model | ×1.5, rewritten, `three-years` | |
|---|---|---|---|
| Work share at default priorities | T-140 asked for 35% | 22.7% year 1, 16.3% three years | T-144 |
| Wealth, year 1 | 4,000–8,000 | 11,234 (4,814 without lavish meals) | B-008, after T-145 |
| Wealth, year 2 | 15,000–25,000 | 6,087 | T-144, T-145 |
| Wealth, year 3 | 35,000–60,000 | 8,846 | T-144, T-145 |
| Food per living dwarf-day | 0.48 | 0.35 | B-012 |
| Drink per living dwarf-day | 0.77 | 0.54 | B-012 |
| Trades | every visit | 3 of 8 | T-145 |
| Survival at peril 2 | a prepared squad holds | extinct by day 194 | T-145, T-151 |

Food and drink per dwarf-day are still 70% to 73% of the model at ×1.5. Time above the want threshold in year 1 is 23% for hunger and 24% for thirst (29% and 32% at ×1.0). **[run]**

## Recommended next step

1. **T-144 next, in full.** Its work file says to do only the "in passing" rules if the work share is already 35% after T-140. It is 22.7%. The three wants take 27.4% of the time.
2. **T-188 before T-145.** The fixture cannot keep a "no dwarf dies" assertion while a still can stall for a month.
3. **T-145 then**, with a farm and a work supply that follow the population: at ×1.5 the script leaves 4.6% of dwarf time idle over three years.
4. **Decide what a three-year scenario may cost in `npm test`.** With a fortress that grows as the model says, it is the slowest test by a wide margin. Filed with T-145.
5. Re-measure the work share after T-144. T-140 stays open for that one item.
