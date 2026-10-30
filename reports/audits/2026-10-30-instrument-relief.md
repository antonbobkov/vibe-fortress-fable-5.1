# Measurement: the instrument and the three-year fixture on realistic relief (T-448)

**Task:** T-448 · **Date:** 2026-10-30 · **Commit examined:** `84ae6d6` (T-436 in) with the changes · **Kind:** fixture change with before and after rows; nothing tuned · **Source:** T-436

## The answer

- **Real relief is 1.** Over twelve standard worlds (`world-0` to `world-11`), the median relief of every embarkable biome is 1, and almost every region has it. Temperate forest has 2,102 of 2,111 regions at relief 1, taiga 2,992 of 3,019, grassland 697 of 702. No region is relief 0.
- **The annual instrument on relief 1:** 13/6/7/142/8/0/0 → **11.5/5/5/130/5/0/0**. This row is the new reference, and the bounds restart from it by the orchestrator's decision: median 10.5, sum 118, wildlife-free 3, extinction cap 1, need-death cap 1.
  - The instrument is deterministic: a second run at relief 1 gave the same twelve hashes, so no second sample was needed for noise.
- **The three-year sweep on relief 1 falls sharply, and it is not taken:** 12 of 20 seeds pass, against 20 of 20 on level maps. The 16 seeds that finished total 182 deaths and 419 living, against 158 and 867 for all 20. The fixture stays on relief 0 until the rows filed below are decided. See [the sweep](#the-sweep-on-relief-1).
- **Where it falls.** Grassland does not move and forest barely does; taiga loses most. Taiga's median goes from 9.5 to 6, its sum from 38 to 27, and no taiga year is free of wildlife deaths.
- **Wolf arrivals do not rise, but wolves kill earlier.** See [the journal](#journal). The cause is not yet named, and it is filed as a new row.

## Instrument rows

Median/worst/second-worst/sum/wildlife-free/extinct/need deaths:

| Relief | Row | Forest sum | Taiga sum | Grassland sum |
|---|---|---:|---:|---:|
| 0 (level, `84ae6d6`; hashes identical to T-446) | 13/6/7/142/8/0/0 | 46 | 38 | 58 |
| **1 (taken)** | **11.5/5/5/130/5/0/0** | 45 | 27 | 58 |

Living per seed, forest 1–4, taiga 1–4, grassland 1–4:

- relief 0: `13, 13, 11, 9, 6, 12, 13, 7, 15, 14, 15, 14`
- relief 1: `12, 9, 11, 13, 7, 5, 10, 5, 15, 14, 15, 14`

## Journal

From the twelve years at each relief ([probe](../data/2026-10-30-t448-deaths.probe.ts.txt), [data](../data/2026-10-30-t448-deaths.json)):

| | Relief 0 | Relief 1 |
|---|---:|---:|
| Dwarf deaths | 17 | 29 |
| By wolf / boar / bear | 15 / 1 / 1 | 22 / 5 / 2 |
| First deaths (day) | 56, 63, 65, 66 | 4, 7, 11, 13 |
| Off the wagon's level | 0 | 12 |
| On a ramp or shrub tile | 0 | 8 |
| Median distance from the wagon | 43 | 34 |
| Wolf / boar spawns | 67 / 23 | 65 / 19 |

- Pressure at the map's edge did not rise; the deaths come earlier and closer. In taiga-2, four dwarves die on days 4 to 13, about 30 tiles from the wagon, before the fixture's response starts on day 20. In taiga-4, six die 6 to 12 tiles from it on days 30 to 60.
- The cave plots shrink in taiga, where the ground falls away from the stair: 18, 22, 30 and 26 tiles against 32. No dwarf starves (need deaths 0).
- The journal does not say why the wolves get there sooner. Ramps, crags and flight paths remain candidates. Filed as T-NEW, [taiga on relief](../../docs/work/T-NEW-taiga-on-relief.md).

## What changed in the fixtures

- **Instrument** (`wildlife_year_fixture.ts`): relief is `WILDLIFE_RELIEF` 1.
  - The opening's eight building patches keep the same scan, then fall back to the nearest patches on the map at the wagon's level, then one and two levels off.
  - An empty zone rectangle moves to the nearest place with tiles.
  - The stair falls back to the nearest floor at the wagon's level.
  - The cave goes on the side of the stair, and at the level, that has soil and a roof for at least half of it.
  - Digs take only what can be dug.
  - At relief 0 all of this is a no-op: the level row is unchanged.
- **Three-year fixture:** see below.

## The three-year fixture

**The refactor (`659a0f8`) is a no-op at relief 0.** The fixture reads its surface from the wagon's level and places its halls six below the gate's column. The whole twenty-seed file before and after: 20 of 20, 158 deaths, 867 living, all 20 hashes identical.

## The sweep on relief 1

The whole file alone at relief 1 (`THREE_YEARS_RELIEF` set to 1 for this run, then back to 0): **12 of 20 pass**. Four seeds stopped early on a T-176 invariant, so their totals are absent.

| Failure | Seeds | What the journal shows |
|---|---|---|
| T-156 witnesses | p0-1 (gate doors, both halls, bedrooms), p2-7 (no completed trade) | p0-1's wagon stands on a 208-column plateau at level 34. The script fells only trees at the fortress's level, and at day 30 only 10 of 26 buildings are built, waiting on inputs; no recipe ever runs. The missing input was not traced to logs by the probe. p2-7 was not journalled. |
| Hunger | p0-4 (one starved, 11 deaths, 1 living) | The same stall: wagon at level 31 on 192 columns, 10 of 29 buildings built at day 60. |
| T-176 `job.unreachable-*` | p2-4 (day 4), p2-6 (day 8), p4-2 (day 45), p4-4 (day 213) | A haul, plant or build job blocked over 1,800 ticks. In p2-6 the item lies on another walker label from the wagon, about 3 tiles away. Not yet separated into fixture (a moved zone across the brook) and game. |
| Year 1 extinct | p4-3 | Not journalled. |

**Drownings are new: 39 dwarves, 33 of them in p0-2.** On level maps there are none. A journal of p0-2 at the sweep's cadence has 27 drownings on days 277 to 299, all on floor or ramp tiles at (13–16, 29–32, 31). 23 of the 27 victims were last seen on the thirst errand, the others on comfort, social, planting or gathering. Dwarves walk to one bank to drink and drown there. In the sweep itself p0-2's drownings run from day 226 to 306; the journal's timeline differs from the sweep's, since its map survey before setup moves the run. That looks like a game fault on real maps, not yet confirmed, and it comes first.

Wildlife does not cause this fall: 2 wildlife deaths against 6. Parties killed 128 against 133. These counts include the seeds that stopped early, up to the point they stopped.

| Seed | Relief 0: deaths / living | Relief 1: deaths / living |
|---|---|---|
| p0-1 | 0 / 59 | 0 / 14 |
| p0-2 | 0 / 40 | 33 / 12 |
| p0-3 | 0 / 47 | 0 / 68 |
| p0-4 | 0 / 73 | 11 / 1 |
| p0-5 | 1 / 54 | 0 / 66 |
| p0-6 | 0 / 32 | 0 / 55 |
| p0-7 | 0 / 80 | 0 / 76 |
| p2-1 | 10 / 51 | 21 / 48 |
| p2-2 | 16 / 36 | 19 / 0 |
| p2-3 | 4 / 43 | 16 / 23 |
| p2-4 | 4 / 48 | stopped, day 4 |
| p2-5 | 1 / 65 | 14 / 0 |
| p2-6 | 13 / 0 | stopped, day 8 |
| p2-7 | 8 / 65 | 7 / 17 |
| p4-1 | 3 / 57 | 14 / 0 |
| p4-2 | 25 / 28 | stopped, day 45 |
| p4-3 | 10 / 15 | 12 / 0 |
| p4-4 | 6 / 53 | stopped, day 213 |
| p4-5 | 6 / 21 | 12 / 39 |
| p4-6 | 51 / 0 | 23 / 0 |

How much ground the wagon's walker label reaches does not change with relief (about 1,520 columns of 2,304 on level maps, 1,550 on relief 1, with about 230 in another label on both), so crags do not cut the map off.

New rows: [drowning at the bank](../../docs/work/T-NEW-drowning-at-the-bank.md), [the three-year script on relief](../../docs/work/T-NEW-three-year-script-on-relief.md), [taiga on relief](../../docs/work/T-NEW-taiga-on-relief.md). Data: [`2026-10-30-t448-sweep.json`](../data/2026-10-30-t448-sweep.json), probes `2026-10-30-t448-journal.probe.ts.txt`, `2026-10-30-t448-cutoff.probe.ts.txt` and `2026-10-30-t448-setup.probe.ts.txt`.
