# Fix: every step of a slope can be walked (T-454)

**Task:** T-454 · **Date:** 2026-10-30 · **Commit examined:** `099ee40` with the changes · **Kind:** fix with instrument rows · **Source:** [the drink reach](2026-10-30-drink-reach.md)

## The answer

- **The fault is real but small on real maps.** `stageRamps` skipped a floor whose upper neighbour had already become a ramp. On 78 embarkable regions of `world-0` to `world-2` (all relief 1), 449 one-level steps were left as a floor under a ramp, on 66 of the maps. From the game's pathing, 7 of those could not be walked up by any route. Columns reachable from the wagon rise from 642,158 to 642,246 of about 642,600. After the fix no step is left.
- **The starvation is the fixture's script, not the game.** With ramps fixed on all ground, `wildlife-taiga-1` dies out, because the script farmed one tile.
- **The new row passes by the T-308 rule, with every figure better:** 11.5/5/5/130/5/0/0 → **13/8/9/148/8/0/0**. The target of median 11, no seed below 8 and no need death is met. This is one run on deterministic maps. The rise of 18 in the sum is wider than the 12 the guard allows for noise.

## Why `wildlife-taiga-1` starved

Journal of the seed, without and with the fix to the ramps:

| | Without | With |
|---|---:|---:|
| Surface plots: turnip / barley tiles | 7 / 6 | **1** / 8 |
| Cave tiles | 18 | 27 |
| Harvests | 88 | 66 |
| Dwarf deaths before day 100 | 6, bled out | 1, killed |
| Population, day 80 | 7 | 12 |
| Plant food in stock, day 80 / 88 / 96 | 56 / 43 / 15 | 14 / 0 / 0 |
| Plant food gone at | day 104 | day 88 |
| Maximum hunger at the end | 100 | 100, all dead by day 112 |
| Living at the end | 7 | 0 |

- **The site moved under the script.** The script draws its plots as fixed rectangles beside the wagon and keeps whichever tiles qualify. Ramps do not qualify for a farm plot, and the fix turned more of that rectangle into ramps, so the 12-tile turnip plot kept 1 tile. A player would not farm that one tile.
- **The fortress was already on the edge.** Without the fix the larder is also empty at day 104 and the hungriest of the seven living is at hunger 100 when the year ends. It survives the count because six had bled out and the year stops. With the fix, far fewer die early, so twelve eat from a smaller harvest and the food runs out sixteen days sooner.
- **Better walking did not reach a far hunt or farm:** hunts are 1 against 2, and the cause of the larder running out is the plot.

## What changed

- **03 stage 9:** a floor one level below a neighbour's `floor` *or* `ramp` becomes a ramp, so a slope of several steps is walked up every step, in all four directions. The drinking steps need no exception any more.
- **The instrument's script:** a surface plot with under half its twelve tiles farmable moves to the nearest place within 12 tiles that has more, as an empty rectangle already did. A plot stays where it was drawn if at least 6 of its tiles qualify.
- **Golden:** `test-1|603`, the generated local map of `test-1` region 603, moves by exactly the ramps above. Flat-test hashes and world maps do not move.

## Instrument rows

Median/worst/second-worst/sum/wildlife-free/extinct/need deaths:

| Change | Row | Forest / taiga / grassland | Allowed |
|---|---|---:|---|
| Reference (T-448, T-449) | 11.5/5/5/130/5/0/0 | 45 / 27 / 58 | |
| Ramps on all ground, script unchanged | 12.5/0/8/135/7/1/12 | 42 / 35 / 58 | **no** |
| Plot rule alone, ramps unchanged | 12/5/5/130/4/0/0 | 45 / 27 / 58 | yes |
| **Both (taken)** | **13/8/9/148/8/0/0** | **42 / 48 / 58** | **yes** |

Living per seed, forest 1–4, taiga 1–4, grassland 1–4:

- reference: `12, 9, 11, 13, 7, 5, 10, 5, 15, 14, 15, 14`
- taken: `9, 12, 13, 8, 13, 11, 13, 11, 15, 14, 15, 14`

Surface plots (turnip, barley) in the taken row, by seed: `8,11  8,6  11,11  11,11  8,12  11,7  8,10  8,10  11,10  11,11  12,9  11,10`.

- **Where the gain comes from.** All of it is in taiga, and only with both changes together. The plot rule alone leaves taiga at 27, so more walkable slopes are doing something there as well, and this journal does not say what. Taiga's early deaths are T-450's subject, which should be re-read against this row.
- **Forest loses 3 in the sum** and stays within the guard. Its seed 4 is now the worst, with 8.
- **New reference and guards:** reference and best measured figures are 13/8/9/148/8/0/0, so the guards become median 12, sum 136, wildlife-free 6, extinction cap 1, need-death cap 1. That raises the bar for later changes by 18 in the sum, and the next timeline-only change that moves taiga will test whether 148 is typical.

[Rows](../data/2026-10-30-t454-wildlife.json).
