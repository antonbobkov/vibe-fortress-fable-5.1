# Measurement: the instrument and the three-year fixture on realistic relief (T-448)

**Task:** T-448 · **Date:** 2026-10-30 · **Commit examined:** `84ae6d6` (T-436 in) with the changes · **Kind:** fixture change with before and after rows; nothing tuned · **Source:** T-436

## The answer

- **Real relief is 1.** Over twelve standard worlds (`world-0` to `world-11`), the median relief of every embarkable biome is 1, and almost every region has it. Temperate forest has 2,102 of 2,111 regions at relief 1, taiga 2,992 of 3,019, grassland 697 of 702. No region is relief 0.
- **The annual instrument on relief 1:** 13/6/7/142/8/0/0 → **11.5/5/5/130/5/0/0**. This row is the new reference, and the bounds restart from it by the orchestrator's decision: median 10.5, sum 118, wildlife-free 3, extinction cap 1, need-death cap 1.
  - The instrument is deterministic: a second run at relief 1 gave the same twelve hashes, so no second sample was needed for noise.
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

Results on relief 1 are in the next section.
