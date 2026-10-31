# Diagnosis: dwarves drown at the bank on maps with relief (T-449)

**Task:** T-449 · **Date:** 2026-10-30 · **Commit examined:** `c46c336`, then the same with the fix · **Kind:** diagnosis and fix · **Source:** [the sweep on relief 1](2026-10-30-instrument-relief.md)

## The answer

- **The cause is in map generation.** A river's water stood at a level set separately for each stretch of the river. On sloped ground this had two effects:
  - A bank could be no higher than the water beside it, so nothing held the water in.
  - The river stepped down the map from a source that refills without limit, so the source kept feeding what spilled.
- **The ground floods soon after the game starts.** Water does not move until something first touches it. Once it does, dry ground beside the brook lies under a shallow sheet for the rest of the game.
- **The dwarves did not walk into deep water.** Pathing and the drink search both behave as specified. The sheet stands at level 3 and flickers to 4, so a dwarf can walk on at 3 and is then in deep water where it stands.
- **The fix:** all of a map's water now stands at one level, held below the lowest ground beside it. Drownings in the three-year sweep at relief 1 go **from 39 to 0**, and in p0-2 **from 33 to 0**, where the living go from 12 to 66.

## The bank of p0-2

The journal ([probe](../data/2026-10-30-t449-bank-journal.probe.ts.txt)) ran on the old code at the sweep's cadence. It had 34 drownings, on days 276 to 339, 30 of them by day 304. Where a tile is named below, the kind is `floor` or `ramp` at z = 31.

**The ground.** The brook's source is at the west edge, with water at z = 32. By (9, 30) the water is at z = 31, and the bank beside it at (10, 30) is a floor at z = 31, the same level as the water. That floor belongs to a dip of 73 floors and ramps at z = 31, between x 10–18 and y 29–42, reached through open tile sides.

**The water level over time.** Tiles of the dip by water level, 0 to 5:

| Day | 0 | 1 | 2 | 3 | 4 | 5 |
|---:|---:|---:|---:|---:|---:|---:|
| 0.8 | 73 | 0 | 0 | 0 | 0 | 0 |
| 20.8 | 3 | 9 | 25 | 20 | 16 | 0 |
| 101.5 | 4 | 7 | 33 | 26 | 3 | 0 |
| 181.8 | 3 | 9 | 22 | 25 | 13 | 1 |
| 281.8 | 3 | 5 | 30 | 22 | 12 | 1 |

The flood is there by day 20 and never drains: the brook carries away less than its source feeds in. Single tiles move between levels 3 and 4 every few ticks.

**The stand tile.** `water()` looks for the nearest tile beside drinkable water, and any water of level 1 or more counts as drinkable. The sheet counts, so the nearest water for dwarves coming from the fortress is the sheet. A dwarf is sent to a tile in the sheet, such as (15, 30, 31), chosen when it is at level 3 and reachable. At level 4 it is impassable and no longer reachable, and the next search picks another tile.

**How they walked.** Down the ramp from z = 32 to z = 31, on wading tiles only. For example, at tick 332270 a dwarf is at (15, 30, 31) at level 3, and at tick 332285 it is at (14, 30, 31) at level 3. No path in the journal enters a tile at level 4.

**How they die.** A dwarf finishes walking and stays on its tile to drink, then often to sleep or talk. The level flickers up to 4 around it, and drowning damage lands on each health tick at that level:

```
332285|14,30,31 k2 l3 need/thirst
332324|14,30,31 k2 l4 need/thirst
332326|14,30,31 k2 l4 need/sleep
332332|14,30,31 k2 l3 need/sleep
332352|14,30,31 k2 l4 need/sleep
```

The dwarf's last activity at death was thirst in 12 of the 34, social in 6, none in 6, sleep in 4, and work or comfort in the rest. 21 of the 34 died on a tile that was their own target.

**Why it bunches at days 276 to 304.** The flood has been there since day 20. The fortress grows from 24 to 48 dwarves between days 220 and 260, and in that time many more dwarves walk to the water. This timing is inferred from the population rows and thirst errands in the journal. The stock of drink was not measured.

## How common it is

Generation alone, with the water woken and nothing else on the map ([probe](../data/2026-10-30-t449-settle.probe.ts.txt)), on the old code. Water on dry columns after 20,000 fluid steps at relief 1, brook from west to south:

| Seed | Tiles wet | At level 4 or more |
|---|---:|---:|
| p0-1 | 186 | 64 |
| p0-2 | 76 | 10 |
| p0-3 | 7 | 0 |
| p0-4 | 268 | 43 |
| p2-1 | 0 | 0 |
| p2-2 | 6 | 0 |
| p4-1 | 284 | 62 |
| p4-2 | 62 | 0 |

The same fault holds for wider rivers and for a lake: a river with no outflow filled its lake from its source until the shore flooded.

Level maps never showed it, because on them every band has the same level and every bank is one above the water.

## The fix

03 § Local map generation, stage 2, with `algorithms/local-map-generation.md`: all of a map's water stands below one *water surface*, the lowest ground among the river's bands, the lake's disc and the columns cardinally beside them, before any carving. Each bed is carved from that surface, so a river through higher ground runs in a cut.

A staircase of channels was considered and rejected from the fluid rules; it was not tried. A step in the water lets the upper level spread on to the open tile over the lower water and from there on to any bank at that level, whenever the channel below carries less than the source supplies. One level has no steps, and it behaves as level maps always have.

### What it costs

- **Cuts.** On 66 river regions from `world-0` to `world-2` ([probe](../data/2026-10-30-t449-reach.probe.ts.txt)), all at relief 1, the highest bank stands this far above the water: one level on 1 map, 2 on 28, 3 on 30, 4 on 7.
- **Places to drink.** A bank can be drunk from only at one level above the water. The largest walkable area of every one of the 66 maps has such a bank, with a median of 66 banks and a minimum of 1. This was checked on the surface map, by walking steps of one level, and not by the game's pathing.
- **Two inflows on level ground.** The old code let a second inflow read the bed already carved by the first, which left a pit two levels deeper where the two met. That pit is gone. No rule asked for it, and the three-year fixture has one inflow.

## Measurements

**Three-year sweep at relief 1**, each peril group in its own process ([data](../data/2026-10-30-t449-sweep.json)). Deaths / living:

| Seed | Before | Drowned | After | Drowned |
|---|---:|---:|---:|---:|
| p0-1 | 0 / 14 | 0 | 0 / 14 | 0 |
| **p0-2** | **33 / 12** | **33** | **0 / 66** | **0** |
| p0-3 | 0 / 68 | 0 | 0 / 69 | 0 |
| p0-4 | 11 / 1 | 6 | 12 / 0 | 0 |
| p0-5 | 0 / 66 | 0 | 0 / 74 | 0 |
| p0-6 | 0 / 55 | 0 | 0 / 55 | 0 |
| p0-7 | 0 / 76 | 0 | 0 / 52 | 0 |
| p2-1 | 21 / 48 | 0 | 9 / 47 | 0 |
| p2-2 | 19 / 0 | 0 | 17 / 0 | 0 |
| p2-3 | 16 / 23 | 0 | 20 / 43 | 0 |
| p2-4 | stopped | | stopped | |
| p2-5 | 14 / 0 | 0 | 14 / 0 | 0 |
| p2-6 | stopped | | stopped | |
| p2-7 | 7 / 17 | 0 | 10 / 10 | 0 |
| p4-1 | 14 / 0 | 0 | 14 / 0 | 0 |
| p4-2 | stopped | | 21 / 49 | 0 |
| p4-3 | 12 / 0 | 0 | 12 / 0 | 0 |
| p4-4 | stopped | | stopped | |
| p4-5 | 12 / 39 | 0 | 18 / 6 | 0 |
| p4-6 | 23 / 0 | 0 | 45 / 0 | 0 |

- **Totals:** 39 drownings before and 0 after. Seeds that finished: 16 with 182 deaths and 419 living before; 17 with 192 deaths and 485 living after.
- **Still 12 of 20 pass, so relief 1 is not ready to be taken.** p4-2 now passes and p4-1 now fails its year-one check. The other seven failures are the same seeds and the same kinds as before:
  - p0-1 and p2-7: T-156 witnesses;
  - p0-4: hunger, now 4 starved of 12 deaths, with the wagon's stall already in T-451;
  - p2-4, p2-6 and p4-4: T-176 unreachable jobs;
  - p4-3: extinct in year 1.
- These belong to [the three-year script on relief](../../docs/archive/tasks/T-451-three-year-script-on-relief.md) and [taiga on relief](../../docs/archive/tasks/T-450-taiga-on-relief.md). None of them is a drowning.

**The annual instrument:** 11.5/5/5/130/5/0/0, identical to the reference, and allowed by the T-308 rule. Its twelve maps have no river, so this fix cannot reach them. It says nothing about the fix.

**Relief 0: the sweep was not re-run.** The map bytes, sinks, sources and column records of all 20 seeds, generated before and after the fix, are identical for the fixture's brook from west to south. The same holds for four other river shapes: a major river, a brook from a spring, and two rivers ending in lakes. Only two inflows differ, as above. The run is deterministic from its map, so 158/867/20 of 20 stands.

## Left open

The flood is gone, but a dwarf in water that rises around it still does not leave. A player's dam or channel can cause the same deaths. Filed as [a dwarf stays put in rising water](../../docs/archive/tasks/T-452-dwarf-stays-in-rising-water.md).
