# Measurement: why perils 2 and 4 are harder on relief (T-455)

**Task:** T-455 · **Date:** 2026-10-31 · **Commit examined:** `b67afec`, then `e6ee9cf` with the script's fixes · **Kind:** diagnosis with script fixes; no game change · **Source:** [the script on relief](2026-10-31-three-year-script-on-relief.md)

## The answer

- **The gate did not seal the fortress on sloped ground, and that was mostly the script's fault.** The fortress's dug rooms, mainly the cave farm one level under the surface, broke out of the hillside on to ground at their own level. On 5 of 9 sampled seeds raiders could walk round the locked gate over a ramp. A player could seal these, with a wall or by digging elsewhere, so the game is not at fault. With the fix, the rooms no longer leak in any of the nine. One seed, p2-3, still has a gate that cannot be finished, for a reason a player could not get round either.
- **Arming is not later on relief.** The median day the squad is armed is 81 on level maps and 78 on relief. p4-3's 52 against 69 is one seed in a wide spread (52 to 152 on level maps).
- **The deaths were inside.** Before the fix, 79 of 147 were indoors by raiders, against 5 of 60 on level maps. After it, indoor deaths by raiders fall to 47.
- **After the fix the file is close but not green:** 237 deaths, 771 living; 20 of 20 alive at year 1; 7 of 7 peril-0 seeds grown; 2 seeds extinct at year 3. It fails one per-seed check: `three-years-p0-3` has 6 dwarves starve on days 334–335, with 67 alive. This needs a decision.
- **Deaths outdoors remain high and are not explained:** 99 by raiders in the sample, against 47 on level maps.

## Method

[Probe](../data/2026-10-31-t455-journal.probe.ts.txt): read-only, at the sweep's cadence. Sample: p2-1 to p2-5, p4-1, p4-3, p4-4 and p4-5, over three years.

- **The seal:** when each raid arrives, a breadth-first search over the game's own walker edges for a raider, from the foot of the gate's stair out to a map edge. It runs once with the doors as they are and once with the gate's doors counted as locked. If it gets out with the doors locked, the fortress leaks, and the search names the tile where the path leaves.
- **A death** is indoors or outdoors by the tile's outdoor flag at the dwarf's last sample. A dwarf wounded outside who bleeds out inside counts as indoors.

The whole-file figures are from `three_years_seeds` in one process. The journal's cadence differs a little from the sweep's, so its runs do not match the sweep's seed by seed.

## 1. Does the ring seal?

| Nine seeds | Level maps | Relief 1, `b67afec` | Relief 1, `e6ee9cf` |
|---|---:|---:|---:|
| Raids journalled | 151 | 80 | 129 |
| Sealed if the doors are counted locked | **151** | **59** | **129** |
| Seeds that leak | 0 | 5 (p2-2, p2-4, p2-5, p4-1, p4-3) | 0 |
| Open as found, through the gate | 2 | 6 | 4 |
| Seeds with hostiles indoors | 0 | 7 | 2 |

**The leak**, by the path's last indoor tile and first outdoor tile:

| Seed | Indoors | Outdoors |
|---|---|---|
| p2-2 | (20, 8, 31), floor | (21, 7, 31), ramp |
| p2-4 | (17, 6, 32), floor | (18, 5, 32), ramp |
| p2-5 | (38, 7, 32), floor | (39, 8, 32), ramp |
| p4-1 | (30, 2, 31), floor | (30, 1, 31), ramp |
| p4-3 | (24, 6, 32), floor | (24, 5, 32), ramp |

All five are one level below the fortress's surface, where the script digs its cave farm and later strips. It assumed the ground stands at the wagon's level all round, but on a slope the neighbouring ground is at the level being dug. In p4-3 the journal's first raid reached the cave 14 steps from the map's edge.

**Whose fault: the script's.** Nothing in the game prevents sealing: a player would dig elsewhere or wall the gap. No ramp in the sample needed walling off at the gate. The ring itself holds.

Two later ways in, both through the gate:
- **p2-3 has no south door at all, in every run, and the eleven-strong raid on day 119 walks in and ends it.** A sapling took root on the door tile before the walls stood, within its first days. Wall and door are refused on a sapling, and the script's fix, growing the ring a row, is refused too, because a shrub stands where the extra wall must go. A player would meet the same two refusals, since neither a sapling nor a shrub can be cleared. **This one is the game's limit, not the script's**, and it is decision 3 below.
- **p4-3 (siege of 31, day 185) and p4-4 on `b67afec` (siege of 22, day 183):** the door is lost (`built` to `none` in p4-3's journal) and the party goes down the stair. The parties have trollkin, so I read this as the game working, though I did not see the door break.

## 2. Why arming is later

It is not, in general. Day the squad is armed, nine seeds:

| | Level maps | Relief 1, `b67afec` | Relief 1, `e6ee9cf` |
|---|---:|---:|---:|
| Median | 81 | 78 | 74 |
| Range | 52–152 | 54–104 | 61–118 |
| Never armed | 1 | 1 | 0 |

- **The opening keeps pace:** across the nine seeds, level against relief, first blocks on days 4–6 against 2–7, smelter 5–8 against 6–11, first mine day 30 in both. The first mail shirt comes by day 14 in eight of nine. The exception is p4-4, whose forge came on day 132 on `b67afec`; on `e6ee9cf` it comes on day 12, and I did not trace the first.
- **Walks over slopes do not show:** the share of dwarves walking on days 20–60 is 0.55–0.82 on level maps and 0.63–0.77 on relief, at the 5-day samples.
- **Wood and ore do not show:** no seed lacks logs; ore varies by seed in both directions.
- **p4-3:** its 52 against 69 comes with less food and fewer logs on relief (31 against 116 food, 84 against 248 logs, mean of days 20–60), and its short sword on day 58 against 36. It is one seed, and on `e6ee9cf` it arms on day 63. No fault found.

## 3. Where the deaths happen

Dwarf deaths in the nine seeds, by the tile of the last sample:

| | Level maps | Relief 1, `b67afec` | Relief 1, `e6ee9cf` |
|---|---:|---:|---:|
| Indoors, by raiders | 5 | **79** | 47 |
| Outdoors, by raiders | 47 | 53 | **99** |
| Other | 8 | 15 | 23 |
| Total | 60 | 147 | 169 |
| Seeds alive at year 3 | 9 of 9 | 2 of 9 | 7 of 9 |

- **Before the fix** the extra deaths are all indoors: 74 more than level maps, and 7 of 9 fortresses die.
- **After it** most fortresses live, so raids have dwarves to kill for two more years, which is part of why the total rises. Deaths outdoors are still twice those on level maps. 40 of the 47 indoor deaths are in p2-3 and p4-3, the only two seeds with hostiles indoors; the other 7 are dwarves who bled out inside. I have not measured why more die outdoors. Candidates are a spread-out camp on slopes and longer runs to the gate.

## The script's faults, fixed

| Fault | Fix |
|---|---|
| Rooms dug through the hillside | No dig that has a dry outdoor tile beside it |
| The cave farm lost those tiles, so "all tiles dug" never held and **the plot was never made**: this first fix alone starved p0-1 (14), p4-3 (10) and p2-2 (5) | The cave takes the side of the stair and the level, down to three below the surface, with the most soil that can be shut and joined to the stair |
| Field strips read their level from the cave | They use the fortress's level |
| A strip with few tiles was thrown away, and 16 tries capped the land | Strips move nearby or to the next surface level; the cap is on tiles |
| A sapling on a door tile stopped the script (T-451) or left the gate open | The door waits, and the ring grows a row round it where the ground allows. It does not in p2-3 |
| A stale trade offer stopped the script (p2-4) | It offers again at the next look |
| The set rule missed a seed that failed its food check | It counts first (my error in T-451) |

One T-176 stop on the way (p4-1, a haul to a tile on the stockpile, day 260) did not recur once the timeline moved. I could not name its cause, so it may come back.

## The whole file

| Seed | Relief 0 | Relief 1, T-451 | Relief 1, `e6ee9cf` |
|---|---:|---:|---:|
| p0-1 | 0 / 59 | 0 / 26 | 0 / 61 |
| p0-2 | 0 / 40 | 0 / 71 | 0 / 58 |
| **p0-3** | 0 / 47 | 1 / 46 | **6 / 61, fails: starved** |
| p0-4 | 0 / 73 | 0 / 53 | 1 / 63 |
| p0-5 | 1 / 54 | 0 / 65 | 0 / 67 |
| p0-6 | 0 / 32 | 0 / 57 | 0 / 61 |
| p0-7 | 0 / 80 | 0 / 52 | 0 / 79 |
| p2-1 | 10 / 51 | 10 / 44 | 24 / 36 |
| p2-2 | 16 / 36 | 14 / 0 | 12 / 18 |
| p2-3 | 4 / 43 | 27 / 0 | 27 / 0 |
| p2-4 | 4 / 48 | 20 / 0 | 16 / 11 |
| p2-5 | 1 / 65 | 14 / 0 | 4 / 28 |
| p2-6 | 13 / 0 | 12 / 12 | 15 / 26 |
| p2-7 | 8 / 65 | 17 / 27 | 16 / 20 |
| p4-1 | 3 / 57 | 22 / 0 | 18 / 36 |
| p4-2 | 25 / 28 | 20 / 38 | 10 / 48 |
| p4-3 | 10 / 15 | 12 / 0 | 35 / 0 |
| p4-4 | 6 / 53 | 22 / 0 | 29 / 17 |
| p4-5 | 6 / 21 | 6 / 40 | 4 / 42 |
| p4-6 | 51 / 0 | 29 / 0 | 20 / 39 |

| By peril | Relief 0 | T-451 | `e6ee9cf` |
|---|---:|---:|---:|
| 0 | 1 / 385 | 1 / 370 | 7 / 450 |
| 2 | 56 / 308 | 114 / 83 | 114 / 139 |
| 4 | 101 / 174 | 111 / 78 | 116 / 182 |
| All | 158 / 867 | 226 / 531 | **237 / 771** |

[Data](../data/2026-10-31-t455-sweep.json). The set rule holds: 20 of 20 alive at year 1, 7 of 7 grown. p4-3 is alive at year 1 now, so it no longer spends the allowance. Living at perils 2 and 4 goes from 161 to 321, against 482 on level maps. Extinct seeds at year 3 go from 8 to 2 (p2-3, p4-3), the same count as level maps.

**p0-3's starvation.** Six dwarves starve on days 334 and 335, at the end of the third winter, with 67 alive. The land is 248 surface and 32 cave tiles, 4.2 a dwarf, which is the script's own target, and only 30 are sown in winter. The stock of meals and plants is gone by then. It is at the edge of the food chain the script builds: the seed grows to 67, while p0-7 reaches 79 in this same run with no hunger. I did not find a script fault to fix here.

## A failure the script's fixes exposed

`three_years` (the single scenario, pinned to level ground) passed before these fixes and now stops on T-176 at tick 339,600, day 283: `job 11416 craft blocked unreachable for 1300 ticks (failedWalk false, workTile 74424)`. A path to the work tile exists, and the job was not reopened for over a day. The fixes move this scenario's timeline, since its fields now grow differently, so the fixture may only have uncovered this. It looks like a game fault in how a blocked craft job retries, but I have not traced it, so it is not named as one.

`npm test` does not run this scenario, so it passes. `npm run test:perf` would fail.

## Decisions needed

1. **p0-3's "no hunger or thirst at peril 0":** the file is red on it. Keep the per-seed assertion and look for what holds the larder at 67 dwarves; or move this check to a set rule too. T-334's evidence ("none in the 19 cohort runs") is about the annual instrument, not this file.
2. **Deaths outdoors, twice level maps:** measure next, or stop here?
3. **A sapling or shrub on a building site:** neither can be cleared, and a sapling takes years to become a tree that can be felled, so p2-3's gate can never close. Should a player be able to clear one? That is a game change to 07 or 14, and I would expect it to bring p2-3 back. Until then p2-3 stays extinct.
4. **The reference row** would become 237 / 771 once the file is green.
5. **The T-176 stop above:** trace it next (a run of about five minutes). The fixes should not merge to master before it is understood, since they turn the performance tier red.
