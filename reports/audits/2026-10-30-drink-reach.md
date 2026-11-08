# Measurement: river sites have water a dwarf can reach (T-449, review fixes)

**Task:** T-449 · **Date:** 2026-10-30 · **Commit examined:** `9495380` with the review's fixes · **Kind:** fix with measurement · **Source:** the review of `9495380`; follows [the bank diagnosis](2026-10-30-drowning-at-the-bank.md)

## The answer

- **The review was right.** The first fix ended the flood, but it could leave a map with nowhere to drink: the reviewer measured 4 of 180 maps with no drink bank at all, and 14 of 180 with none in the largest walkable area. The water surface took its minimum over the wet columns too, so it could lie below every bank. Rivers in deep cuts had nowhere low enough to stand.
- **After these fixes, every one of 600 measured maps has a bank reachable from the arrival point, by the game's pathing.** All 600 also have a bank to fish from. The tutorial region has one too.
- **The real drink search finds water from the arrival point on 590 of the 600.** The other 10 are all a river from the south edge ending in a lake, whose nearest bank is 64 tiles or more from a wagon on the north edge. Those banks can be walked to. Filed as a new row, since 10's drink rule was not to change.
- **The search's radius is 64 tiles**, as 10's table says, not 32. It is `DRINK_SEARCH_RADIUS` in the code, used on both axes. An existing test walks a dwarf 45 tiles to a bank, and another finds nothing at 66. It also looks only 8 levels up or down, which is what 10 says too.

## What changed

- **At least one bank at drinking height.** The water surface is the lowest ground among the *dry* columns beside the water. A river column lower than that is set to its bed; a lake column keeps its lower floor. Both fill to the same top.
- **Drinking steps.** In 03 stage 2, along a river every `DRINK_STEP_SPACING` tiles (12, *unmeasured*), on both banks and across the way it runs: a lane one column wide, from one level above the water, rising one level a column to the ground. A lake has one lane from its centre in each cardinal direction. A lane that would leave the map or meet water is not cut. From relief 1 a lane holds no tree, shrub or boulder.
- **Source marks.** `carvePath` now sets a column's marks before skipping a column already carved to that bed, so a second inflow keeps its edge's sources. A new test fails with the old order.
- **Rock strata in cuts.** Left as it is, as decided: the walls of a cut show the layers as generated, and this is only cosmetic.

## Reach by relief

96 × 96, temperate forest, peril 0, from the wagon of a real embark. 40 seeds on each of five shapes, so 200 maps per relief: brook west to south, river from north and west to east, major river east to north, brook from a spring to the south, river from the south into a lake. ([data](../data/2026-10-30-t449-drink-reach.jsonl); `T449_SEED_COUNT=40 T449_REACH_OUT=<file> npx vitest run test/unit/terrain/t449-drink-reach.test.ts`.)

A bank counts only if it is a floor or ramp, dry, walkable and reachable by 22's labels from the wagon.

| Relief | Maps | No bank reachable | Banks, min / median | No fishing bank | Fishing banks, min / median | Search finds water from the arrival | Most levels from the wagon to the nearest bank's water |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 200 | 0 | 9 / 47.5 | 0 | 22 / 73 | 197 | 3 |
| 2 | 200 | 0 | 9 / 31.5 | 0 | 17 / 53.5 | 196 | 5 |
| 3 | 200 | 0 | 7 / 24 | 0 | 14 / 38 | 197 | 8 |

**The stand tile the search chose:**

| Relief | Floor | Ramp | Shrub | None |
|---:|---:|---:|---:|---:|
| 1 | 67 | 130 | 0 | 3 |
| 2 | 46 | 149 | 1 | 4 |
| 3 | 13 | 184 | 0 | 3 |

- The one shrub is a tile the game accepts as walkable; that map has floor and ramp banks too.
- The level distance reaches the search's limit of 8 at relief 3, so a higher wagon could fall outside it. None did in this sample.

**The 10 maps where the search finds nothing from the wagon** are all "river from the south into a lake": seeds 7, 9 and 10 at relief 1; 7, 9, 10 and 18 at relief 2; 7, 9 and 10 at relief 3. Their nearest banks lie 64 to 73 tiles away. The distance comes from where the lake's centre falls, which is why the same seeds repeat at each relief. Filed as [a far lake](../../docs/archive/tasks/T-453-lake-beyond-the-drink-search.md).

**The tutorial region** (`TUTORIAL_WORLD_SEED`, relief 1): 20 banks reachable, 53 fishing banks, the search chooses a floor tile, and the nearest bank is 48 tiles and 2 levels from the wagon. A test now holds this. The other river rows of the summary and the tutorial's ranking read the same generation, so these figures are what stand behind "has water" for those shapes. The rows were not re-measured one by one.

The test keeps a representative set, 2 seeds per shape at each relief. It asserts a reachable floor or ramp bank, a fishing bank, and that the search succeeds wherever the nearest bank is inside its limits.

## A change tried and taken back

Multi-level lanes need every rise to be a ramp, and `stageRamps` skipped a floor whose upper neighbour had already become a ramp, which happens on lanes climbing north or west against the scan. I first fixed this for all ground. That failed the annual instrument:

| | Row | Forest / taiga / grassland |
|---|---|---|
| Reference | 11.5/5/5/130/5/0/0 | 45 / 27 / 58 |
| Ramps fixed on all ground | 12.5/0/8/135/7/1/12 | 42 / 35 / 58 |

`wildlife-taiga-1` starved out, and the golden `test-1|603` moved. Natural ground has nothing to do with this task, so the rule now applies only to the columns of a drinking step. The natural fault is real and its starvation is untraced: filed as [slopes of several steps](../../docs/archive/tasks/T-454-slopes-of-several-steps.md).

## Gates

- **The annual instrument:** 11.5/5/5/130/5/0/0, allowed, all twelve hashes identical to the first T-449 commit. Its maps have no river, so it does not exercise this fix.
- **Relief 0 maps:** of 120 maps (20 seeds × 6 river shapes), generated before T-449 and now, the 100 with one inflow or a spring are byte-identical, and the 20 with two inflows differ. Those 20 differ because the junction pit is gone and the source marks are kept. The three-year fixture has one inflow, so 158/867/20 of 20 stands without a re-run.
- **Goldens:** none moved.

**Three-year sweep at relief 1**, each peril group in its own process ([data](../data/2026-10-30-t449-sweep-review.json)). Deaths / living:

| Seed | Before T-449 | First fix | These fixes | Drowned now |
|---|---:|---:|---:|---:|
| p0-1 | 0 / 14 | 0 / 14 | 0 / 14 | 0 |
| **p0-2** | **33 / 12** | 0 / 66 | **0 / 71** | **0** |
| p0-3 | 0 / 68 | 0 / 69 | 0 / 63 | 0 |
| p0-4 | 11 / 1 | 12 / 0 | 4 / 8 | 0 |
| p0-5 | 0 / 66 | 0 / 74 | 0 / 72 | 0 |
| p0-6 | 0 / 55 | 0 / 55 | 0 / 75 | 0 |
| p0-7 | 0 / 76 | 0 / 52 | 0 / 80 | 0 |
| p2-1 | 21 / 48 | 9 / 47 | 10 / 44 | 0 |
| p2-2 | 19 / 0 | 17 / 0 | 14 / 0 | 0 |
| p2-3 | 16 / 23 | 20 / 43 | stopped, day 4 | |
| p2-4 | stopped | stopped | stopped | |
| p2-5 | 14 / 0 | 14 / 0 | 14 / 0 | 0 |
| p2-6 | stopped | stopped | stopped | |
| p2-7 | 7 / 17 | 10 / 10 | 6 / 33 | 0 |
| p4-1 | 14 / 0 | 14 / 0 | 20 / 0 | 0 |
| p4-2 | stopped | 21 / 49 | 42 / 0 | 0 |
| p4-3 | 12 / 0 | 12 / 0 | 12 / 0 | 0 |
| p4-4 | stopped | stopped | stopped | |
| p4-5 | 12 / 39 | 18 / 6 | 19 / 48 | 0 |
| p4-6 | 23 / 0 | 45 / 0 | 41 / 0 | 0 |

- **Drownings stay at 0**, and **13 of 20 pass**, against 12 before. Relief 1 is still not ready to take.
- **The seven that fail:**
  - p0-1 and p0-4: T-156 witnesses (p0-4 no longer starves);
  - p2-3: the script's door placement rejected on tick 4602, new here and a script fault on the changed ground, for T-451;
  - p2-4, p2-6 and p4-4: T-176;
  - p4-3: extinct in year 1.
- p4-2 ends with 0 living and still passes, since its year-one check is printed and not asserted. One dwarf starved there. No other finished seed has a hunger or thirst death.
