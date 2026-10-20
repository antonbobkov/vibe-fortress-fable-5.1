# Hostiles open doors: the peril-2 and peril-4 sweep and the defence year, before and after

**Date:** 2026-10-18 · **Task:** T-400 (work file `T-400-hostiles-never-open-doors.md`) · **Before:** `06ba90b` (sim with master merged) · **After:** `6af2414` (the three movers read `flags.opensDoors`) · **Data:** [per seed](../data/2026-10-18-hostiles-open-doors.json)

## What was examined

No hostile had ever opened a door: the content exports the flag `O` of `creatures.md` under `flags`, and the movers read it at the top of the row. The fix lets the Gloam and the Hillfolk bandit pass an unlocked door. Measured, each before and after, on the same commits:

- the three-year sweep at perils 2 and 4 (`test/perf/three_years_seeds.test.ts -t "peril 2"` and `-t "peril 4"`, `--testTimeout=5400000`; seeds run two processes at a time);
- the defence year (`defence-year`, peril 2, two years) as its WIP script stood at `bf520cb` (the sally, the lever outside the hall), through the T-151 probe;
- the annual wildlife instrument (twelve seeds, peril 0).

## The sweep

Dwarf deaths, population at the end of years 1 / 2 / 3, and the parties' outcomes. A seed that stopped on an assertion wrote no figures.

| Seed | Before: pop, deaths | After: pop, deaths | Outcomes before → after |
|---|---|---|---|
| p2-1 | 16/45/45, 12 | 16/45/46, 11 | 6 withdrew, 5 looted → 7, 4 |
| p2-2 | 13/34/50, 3 | 13/34/49, 4 | 7, 5 → 6, 6 |
| p2-3 | 16/29/45, 10 | 16/29/45, 10 | 6, 6 → 6, 6 |
| p2-4 | 14/19/37, 8 | 14/48/60, 2 | 6, 6 → 6, 4 (10 parties) |
| p2-5 | 7/13/40, 10 | 7/13/40, 10 | 5, 6 → 5, 6 |
| p2-6 | 6/0/0 (dead day 157), 13 | the same | 2, 9 → 2, 9 |
| p2-7 | stops at tick 337,200: the script's `EditWorkOrder` rejected (`precondition_failed`) | the same | — |
| p4-1 | 6/23/59, 14 | stops at tick 228,000: T-176 `job.unreachable-with-path` (a `water_patient` job blocked 1,930 ticks) | 12 withdrew, 13 looted, 1 repelled → — |
| p4-2 | 2/0/0 (dead day 192), 15 | the same | 3, 19 → 3, 19 |
| p4-3 | 14/18/23, 18 | 14/17/23, 17 | 9, 13 → 10, 12 |
| p4-4 | stops at tick 288,000 on a T-176 finding | 13/25/43, 10 | — → 11, 13 |
| p4-5 | stops at tick 264,000: T-176 `item.nowhere` | 15/18/38, 9 | — → 12, 12 |
| p4-6 | 0/0/0 (dead day 110, year 1), 14 | 1/0/0 (dead day 210), 17 | 3, 19 → 3, 19 |

Over the six peril-2 seeds that finish both times: 56 dwarf deaths before, 50 after; five fortresses alive at the end both times. Over the three peril-4 seeds that finish both times: 47 before, 49 after; one alive both times. Raiders that may now open doors did not walk in: the fixture locks the gate's two doors (`lock_on_alert`) under the hearth alert, which it raises on a warning, a raid, a thief or a sighting, so a party finds the gate locked as a player would leave it. Several seeds end with the same figures and a different world hash. No outcome class moved but p4-6, which now dies in year 2 instead of year 1.

The stops are not caused by the doors: p2-7's rejection and p4-4's and p4-5's findings come before the fix; p4-1's `job.unreachable-with-path` comes after it, on a seed that passed before, which a change of timeline can do (the invariant is `T-176`'s and is reported for its own row).

## The defence year

| | Before | After |
|---|---|---|
| Dwarf deaths | 7: a starvation (day 57), 2 in the day-75 ambush, 4 in the day-116 raid of 9 | 12: the same starvation and ambush deaths, 5 in and after the day-116 raid, 1 on day 153, 3 starvations on days 205–207 |
| Day-116 raid | `withdrew` on day 118 | `repelled` on day 116 (four of it killed by soldiers) |
| Living on day 225 | 5 | 0 |

The script then opened the north door to sally on hostiles in the corridor, and a raider that opens doors comes through it. T-151 finishes the script: the lever in the hearth hall raises the bridge from a raid's warning, and the raid stays out.

## The instrument

Before and after alike: median 13, sum of the living 143, second-worst 9, worst 5, 8 of 12 without a wildlife death, no extinction, no hunger or thirst death (peril 0 sends no party).
