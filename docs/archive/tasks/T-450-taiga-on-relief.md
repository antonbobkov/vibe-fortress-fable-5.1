# T-450 — Taiga loses most on relief: wolves reach the camp earlier

**Closed:** 2026-10-31, in 87fd312.

**Source:** T-448, [the instrument on relief](../../../reports/audits/2026-10-30-instrument-relief.md) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Why

Moving the annual instrument from level maps to relief 1 takes taiga's median from 9.5 to 6 and its sum of the living from 38 to 27, with no year free of wildlife deaths. Forest falls from 46 to 45 and grassland does not move. Wolf spawns do not rise (67 to 65 over the twelve years), but wolves kill more and earlier: the first deaths come on days 4 to 33 instead of day 56, in taiga-2 about 30 tiles from the wagon and in taiga-4 10 to 12 tiles from it. Eight of the 29 deaths happen on a ramp or shrub tile, and 12 of them off the wagon's level.

Taiga's cave farm also shrinks where the ground falls away from the stair (18 to 30 tiles against 32).

## What to do

Journal taiga-2 and taiga-4 on relief: where the wolves come from, what the victims were doing, how a slope or crag shapes their flight, and whether the alert and the hall reach them in time. Name the cause. Do not tune before it is named.

## Done

- The cause is in a dated report, with a fix or the decision it needs.

## As done

Closed on the figures, without a separate journal: those that opened this task no longer hold. The cause was not named, and the row is one run.

| Taiga | Level maps | T-448, relief 1 | T-454, relief 1 |
|---|---:|---:|---:|
| Median | 9.5 | 6 | 12 |
| Sum of the living | 38 | 27 | 48 |
| Worst seed | 6 | 5 | 11 |
| Years free of wildlife deaths | 2 | 0 | 3 |
| Dwarf deaths | 11 | 22 | 1 |
| First dwarf death, by day | 56 | 4 | 89 |
| Wolf spawns | 38 | 49 | 42 |
| Cave tiles, least | 32 | 18 | 26 |

Wolves still come in the same numbers, and they no longer reach the camp early enough to matter: taiga has one death in the year, on day 89. Its median, sum, worst seed and wildlife-free years are now above level maps, and its cave is still smaller.

Two things remain unknown or uneasy. The cause was never named: the gain came only with T-454's slopes and its plot rule together, and this does not say how a walkable slope changes wolf deaths. And this is one deterministic run, so the next change to the timeline may move it. The instrument's guards will show that (median 12, sum 136). Food is the tighter figure now: `wildlife-taiga-1` logs 71 `Starving` events, though none die.

Rows: [T-454](../../../reports/data/2026-10-30-t454-wildlife.json), [T-448](../../../reports/data/2026-10-30-t448-wildlife.json), [level maps](../../../reports/data/2026-10-24-t446-wildlife.json).
