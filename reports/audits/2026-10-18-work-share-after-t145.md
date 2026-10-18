# The work share on the closed T-145 fixture (T-140)

**Date:** 2026-10-18 · **Commit:** `88119f4` (master, with T-145, T-387, T-156, T-383 to T-388) · **Task:** T-140 · **Earlier:** [2026-10-10, after T-196](2026-10-10-wants-without-errands-after-t196.md)

## What was measured

The economy fixture (`test/scenarios/three_years_fortress.ts`) played as the sweep plays it, seed `three-years`, peril 0, 336 days, the game's own wild animals, default priorities. Every 10 ticks the instrument reads each living fortress dwarf's brain and puts the 10 ticks under one of: work at a job, work at a haul, a need in use, a need in travel (by need, from 10's activity plan), idle with no work, idle with a want, or another behaviour (duty, flight, retreat, patient). It also sums each dwarf's mood. It reads only, so the run is the fixture's own. The instrument is [`2026-10-18-t140-share-probe.ts.txt`](../data/2026-10-18-t140-share-probe.ts.txt) and its output [`2026-10-18-t140-share.json`](../data/2026-10-18-t140-share.json). The run at `a9a21dd`, before T-383 to T-388 were merged, gave the same year 1 to the tenth of a point.

## Results

| Share of dwarf time | Year 1 | Year 2 | Year 3 |
|---|---:|---:|---:|
| **Work** | **37.4%** | 37.0% | 30.0% |
| of it at a job / at a haul | 27.8% / 9.6% | 16.9% / 20.1% | 10.7% / 19.3% |
| Needs in use | 19.8% | 21.2% | 22.3% |
| Needs in travel | 40.8% | 41.6% | 47.6% |
| Idle, no work | 0.9% | 0.2% | 0.2% |
| Other (duty, retreat, flight) | 1.0% | 0.1% | 0.0% |
| Dwarf-days | 1,140 | 4,002 | 6,271 |
| Population at the year's end | 14 | 44 | 56 |
| **Mood, mean over dwarf time** | **54.0** | 57.0 | 54.3 |

Year 1, by need (in use / in travel): sleep 9.4% / 16.7%; food 1.9% / 9.8%; drink 2.0% / 8.0%; talk, sit and hearth visit 6.6% / 6.3%.

Year-1 wealth is 23,969 marks.

## Findings

1. **The work share holds: 37.4% in year 1**, against T-140's 35%, 28.4% on 2026-10-10 and 22.7% before T-144. The gain is the fixture's: T-145 gave it enough work (idle with no work fell from 6.3% to 0.9%). Needs take what they took (60.6% against 64.8%). Year 2 holds at 37.0%; year 3 falls to 30.0% as need travel grows to 47.6% in a fortress of 44 to 56 dwarves (drink 13.9% and food 10.9% of it: the stores and the stills lie farther from the work).
2. **Mood is 54.0 in year 1, 57.0 in year 2 and 54.3 in year 3** on this seed. The peril-0 sweep of 2026-10-17 measured the daily time mean on seven seeds at a median of 57.4 (52.0 to 63.5); this seed lies inside that spread. One seed's year is one chaotic sample (testing-strategy.md § What may be a gate); the sweep's median is above 55.
3. **Year-1 wealth is three times the model** (23,969 against 4,000 to 8,000). This is T-380's question (the fixture's export crafts and kitchen), not walking speed's.
