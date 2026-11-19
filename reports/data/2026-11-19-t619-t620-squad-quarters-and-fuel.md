# T-619 and T-620: the squad's quarters, and fuel for its steel

**Tasks:** T-619, T-620 · **Date:** 2026-11-19 · **Code:** branch `t619-t620-squad` on master `c093b876` (T-632, T-634); the sweep below ran on `5d0d1ad2` (branch `t619-t620-wip`), whose script is the branch's · **Source:** [the T-619 work file](../../docs/work/T-619-soldiers-quarters-by-the-barracks.md), [the T-620 work file](../../docs/work/T-620-fuel-for-the-squads-steel.md), [T-615's measurement](../audits/2026-11-18-t615-soldiers-needs.md), [T-616's sweep](2026-11-18-t616-strong-squad-steel.md)

## T-619: the soldiers' beds

T-606's pace probe (`test/perf/t606_pace_probe.test.ts`) now also prints, for each soldier, how far from the barracks (horizontal steps plus levels, from its middle) each sleep, meal and drink ended, and its sleeps in a bed of its own. Shift 0, to day 280 (`p4-4`) or 250; shares are of the calm day (the alert down).

```
T606_PROBE=1 T606_SEED=three-years-p4-4 T606_PERIL=4 T606_DAYS=280 npx vitest run -c vitest.perf.config.ts test/perf/t606_pace_probe.test.ts
```

Before, the soldiers who owned a bedroom slept 20 to 36 steps from the barracks; those without one slept in a dormitory, 4 to 6 steps away where the dormitory had been dug beside the barracks, 23 to 25 where not. A soldier who slept beside the barracks stood there 26 to 44% of the calm day, one who walked to its bedroom 12 to 25%. The script now digs quarters beside the barracks (2 × 4, entered from it), a single-bed bedroom on each tile, and gives each soldier and marksdwarf one:

| Seed | Soldier-days | At the barracks (calm) | Sessions a day | Weapon xp a day | Steps to bed | Soldiers under 10% |
|---|---|---|---|---|---|---|
| p4-4 before | 124 | 11.7% | 0.49 | 19.7 | 16 | 2 of 6 (0.5%, 2.3%; Agility 58) |
| p4-4 after | 362 | **32.4%** | 1.56 | 75.8 | 4 | 0 of 9 (Agility 47 to 66: 23.5 to 25.2%) |
| p4-1 before | 802 | 19.8% | 1.03 | 46.9 | 25 | 0 of 9 (own rooms 12.4 to 24.3%) |
| p4-1 after | 148 | **27.0%** | 1.26 | 53.9 | 8 | 0 of 6 |
| p2-2 before | 537 | 29.7% | 1.68 | 74.0 | 14 | 0 of 9 (own rooms 15.6 to 21%) |
| p2-2 after | 318 | **38.6%** | 1.74 | 81.2 | 4 | 0 of 7 |
| p4-6 before | 841 | 32.8% | 1.60 | 60.1 | 15 | 0 of 9 (own rooms 15.7 to 35.1%) |
| p4-6 after | 671 | **39.0%** | 1.77 | 67.2 | 3 | 0 of 9 |
| p2-3 before | 724 | 27.2% | 1.48 | 59.0 | 15 | 0 of 9 (own rooms 18.3 to 24.6%) |
| p2-3 after | 527 | **36.0%** | 1.88 | 77.4 | 3 | 0 of 10 |

The timelines differ from the squad's forming on (in `p4-1` after, the squad formed later; in `p2-1` it had not trained by day 250). Walking back to drill fell from 11 to 17% of the calm day to 6 to 10%.

A drink stockpile of six tiles beside the barracks was measured with the quarters and left out: the soldiers drank as far from the barracks as before (12 to 16 steps), since haulers take a drink to the nearest stockpile with room (13 § The "wants hauling" set), the larder's and the dining hall's before it. Food is no better: a meal is carried to the nearest dining-hall chair (10 § Eating and drinking), 6 to 17 steps away.

## T-620: where the fuel went

From T-632's sweep (44518211541, the 52 peril-2 and peril-4 fortress-timelines): 183 charcoal a timeline, burned by 59 iron smelts, 51 iron forge jobs, 10 steel alloys (two each) and 8.5 steel kit pieces; the wood went to that charcoal, 48 barrels, 41 beds and some 30 other goods. Logs were seldom short (13 of 52 under fifteen on a weekly average) while charcoal was (31 under five): the burner made too little.

`test/perf/t620_fuel_probe.test.ts` (the sweep's own cadence at a shift) shows why, on `three-years-p4-6` at shift 50, whose logs stood at 40 to 80 from day 175 while its charcoal was 0: the burner was at its job (fetching and burning) 15 to 47% of each ten days and made 4 to 9 charcoal in them, at 100 ticks a charcoal. Once ambushes are possible the furnaces stand in the workshop hall below (T-580) while the logs, ore and bars went to the surface stockpile, so each charcoal was a walk out to the surface and back, and none while an alert locked the gate (Retreating 16 to 31% of some ten days).

`test/perf/t620_coal_census.test.ts`: every peril-2 and peril-4 map has 207 to 556 tiles of bituminous coal and lignite, on levels 26 to 30, between the halls and the soil. The script's mines reached 2.8 of them a timeline, in passing, and smelted none.

The script now, as a player who has chosen steel:

- digs the coal: from the day the smelter makes steel, the miners drift from the gate's stair to the nearest twenty coal faces above the halls (none that would open to the hillside), and twenty more, once a season at most, when the coal ore runs under six; the smelter keeps thirty bars of coal after the steel and before the iron (a coal smelt burns no fuel and gives two bars, lignite one);
- keeps the fuel by the furnaces: once the fortress works below, up to three free sites of the workshop hall nearest the wood furnace (two always left for workshops) are a stockpile of wood, ore and bars, and the surface stockpile takes none of them; on `p4-6` at shift 50 the burner then made 7 to 18 charcoal in ten days before the coal came;
- asks the Mountainhome for coal and charcoal in place of the steel helm, greaves and sword (0.6 kit pieces a timeline came in T-632's sweep).

It does not fell further trees: the logs were not what ran short, and the woods beyond the settlement are where ambushes spring.

## The sweep

Before: T-632's sweep (44518211541, on `8b6cea32`); after: 44550544871 on `5d0d1ad2`, all 80 seed jobs passed. Figures read from the verdict jobs.

| Run | Alive y1 | Peril-0 grown | Peril-0 need deaths | Living y3 | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| T-632 (44518211541) | 19.75 | 7 | 0 | 1072.5 | 118.75 | 1 | 4 |
| T-619 + T-620 (44550544871) | 19.75 | 7 | 0 | 1073.5 | 109.5 | 0.25 | 0.5 |
| Reference | 19.5 | 7 | 0 | 1010.5 | 137 | 1.75 | 6.25 |

Verdict: pass (bounds 887.75 living, 161.88 deaths). The reference is not moved.

**The steel ledger**, the 52 peril-2 and peril-4 timelines, a timeline (from each seed's `[three_years_economy]` and weekly `[three_years_steel]` lines):

| | Before | After |
|---|---|---|
| Steel bars smelted | 10.1 | **14.4** |
| Steel bars bought | 5.6 | 6.2 |
| Steel kit pieces forged / bought | 8.4 / 0.6 | 10.6 / 0.4 |
| Charcoal burned / fuel bought | 183 / 6.8 | 174 / 5.7 |
| Coal ore mined / coal smelts | 2.8 / 0 | 57.6 / 44.4 |
| 50 steel bars or more (smelted and bought) | 3 | 4 |
| 30 or more | 10 | 14 |
| Under five charcoal on a weekly average | 31 | **7** |
| Under fifteen logs | 13 | 10 |
| Under five iron bars | 19 | **38** |
| Soldiers in steel at Proficient, at their best (sum) | 5 | 15 |

**Bars:** the soldiers' bar and the full squad's both on day 279 in `three-years-p4-6` at shift 50 (five soldiers in steel and two marksdwarves at Proficient), none in the other 51 (none of 52 before).

Fuel no longer binds the steel; iron does, in 38 of the 52: on `p2-1` at shift 0 and `p4-6` at shift 50 the furnaces held 38 to 40 charcoal and 28 to 30 coal at day 300 and no iron bar. That is a follow-up: [iron for the squad's steel](../../docs/work/T-NEW-iron-for-the-squads-steel.md).

## The other gates

On the final head; see the commit closing T-620.
