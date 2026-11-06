# Measurement: idle dwarves gather round the hearth instead of jamming the hall's way in

**Task:** T-508 · **Date:** 2026-11-05 · **Commits examined:** master `d96cfc9c` (T-482) for the probe before and for four instrument samples of master's own noise; the T-508 branch (`t508-idle-spread`) at `1c3401ed` (a first version, idle dwarves only, ties by the nearest to the dwarf; not kept) and at `0348c100` (the change as kept), each with the same code shifted 1 to 3 ticks before the opening for further instrument samples (`t508-idle-spread-shift*`, `t508-master-shift*`, not kept). The branch then took master's T-486 (a sprung ambush pauses arriving immigrants: nothing the instrument plays; the sweep's peril-2 and peril-4 rows below are T-508's on the master before it); `ci.yml` ran again on that merge · **Kind:** a fault fixed · **Source:** [the T-508 work file](../../docs/archive/tasks/T-508-idle-dwarves-crowd-the-hall-entrance.md), [T-482's crowd watch](2026-11-05-t482-pets-heap.md#the-crowd-watch)

## The answer

- **The cause is confirmed.** On `three-years-p0-6`, played as the sweep plays it to day 340 on master, the crowded hall tile 60272 holds a dog and up to 19 dwarves; of the 3,566 dwarves counted on crowded hall tiles (every 300 ticks), 1,537 are idle with that very tile as their goal, and most of the rest are asleep there (rest without a bed takes the nearest hall tile too, but sleepers do not count for a crowd) or on a comfort, joy or social errand that also took the nearest hall tile. Every idle dwarf's goal was the reachable hall tile nearest to it, ties by the lowest index: everyone who came in the same way got the same tile.
- **The fix.** A dwarf that stands in the hall without a seat (idle; on a joy errand; on a comfort or hall errand with no chair to sit on) takes a *stand tile* of its own (10 § Behavior selection, step 9): it keeps the hall tile it stands on while no other creature stands there (a dwarf of a higher id does not move it, a passer-by does not count), and otherwise takes the reachable hall tile with no building on it that has the fewest creatures on it or heading to it, ties by the nearest to the hearth, then the lowest index. So idle dwarves gather round the hearth, each on a tile of its own, and step off a tile a dog stands on (the dog does not move for passers-by, T-463). A dwarf's goal is read from its brain, not from its recorded walk: a walk left for a nearer goal stays recorded, the same stale-walk trap T-482 found for animals.
- **The hall's crowd is nearly gone.** Over the twenty seeds the hall's slowed samples fall from 146,109 to 98,579 (1.3% to 0.9%), the capped ones from 23,546 to 5,450, and the seeds with a hall tile crowded for more than a day from 5 to 1; the longest stretch from 23,220 ticks (19 days) to 2,120 ticks (1.8 days, `p0-6`). The work file's "no hall tile crowded for more than a day" is met on 19 of 20 seeds; on the one left, the three-year probe finds cats, not dwarves, standing together ([The crowd watch](#the-crowd-watch)).
- **The twenty-seed file keeps the set rule:** 20/20 alive at year 1, 7/7 peril-0 grown, 1/7 peril-0 seeds with need deaths (`p0-3`, one dwarf; T-482's file had 23 there, T-507 is open on its food).
- **The annual instrument passes in the first sample and misses one bound by one seed in the second:** 13/6/11/148/7/0/0 and, one tick later, 12.5/7/9/144/6/0/0 (wildlife-free 6 against its floor of 7), against the reference 13/7/10/149/7/0/0. Master's own code fails the bounds in 2 of 4 such samples, one of them with 11 dwarves starved, so the bounds are inside master's timeline noise ([T-NEW](../../docs/work/T-509-instrument-bounds-inside-timeline-noise.md)). Judged over the samples, T-508's rows are no worse than master's: see [The annual instrument](#the-annual-instrument).

## What was run

| Run | What | Data |
|---|---|---|
| Unit tests | `test/unit/dwarves/t508-idle-spread.test.ts` (new, 3 tests: six idle dwarves on six tiles that they keep; a dwarf leaves a tile a pig stands on; dwarves on a joy errand on tiles of their own). The first two fail on master, the third on the first version | — |
| One-seed probe | `three-years-p0-6` to day 340, a look every 10 days and a count every 300 ticks of who stands on each crowded hall tile and why; on master, on the first version and on the change; and on the change to day 1,080, with every stretch of 1,200 ticks or more | [probe](../data/2026-11-05-t508-idle.probe.ts.txt), [output](../data/2026-11-05-t508-probe-p0-6.txt) |
| Annual instrument | `measure.yml` suite `instrument`, see below | [rows](../data/2026-11-05-t508-wildlife.json), [one tick later](../data/2026-11-05-t508-shift-wildlife.json) |
| Twenty seeds | `measure.yml` suite `sweep`, run 42133468774 (`0348c100`); the first version, run 42128002519 (`1c3401ed`) | [summary](../data/2026-11-05-t508-sweep-summary.md), [seeds](../data/2026-11-05-t508-sweep.json) |
| `npm test` and e2e | `ci.yml`, run 42133471680 on `0348c100`: all six jobs pass, 3,562 tests in four shards, e2e 39 passed | the run's page |

## The probe

On master, `p0-6`'s idle dwarves come in from the west and all take tile 60272, the hall's first; from day 290 the 10-day looks find it holding a dog and 8 to 19 dwarves, nearly all `idle` with 60272 as their goal, or asleep there. The first version (ties by the nearest to the dwarf) spread the idle dwarves: crowded samples fell from 618 to 443 and idle dwarves on them from 1,537 to 103, but joy, comfort and social errands still took the nearest hall tile, so 60272 still held a dog and three joy errands at day 300. With the change as kept, crowded samples fall to 285 and the looks find only brief knots of two or three: comfort sitters, a cat, a sleeper.

## The crowd watch

The hall's figures, summed over the seeds. Before: [T-482's file](../data/2026-11-05-t482-sweep.json) (`bba82dfc`, the master code before T-508).

| | Before (T-482) | First version (`1c3401ed`) | After (`0348c100`) |
|---|---|---|---|
| Slowed tile-samples | 146,109 of 10,997,700 (1.3%) | 122,175 (1.1%) | 98,579 (0.9%) |
| At the cap (6 standing) | 23,546 | 8,260 | 5,450 |
| Seeds with a hall tile crowded over a day | 5 (`p0-3`, `p0-4`, `p0-6`, `p2-1`, `p2-7`) | 4 (`p0-3` 1,360, `p0-4` 1,300, `p0-6` 1,500, `p2-7` 1,680 ticks) | 1 (`p0-6`, 2,120 ticks) |
| Longest a hall tile stayed crowded | 23,220 ticks (`p2-7`) | 1,680 ticks | 2,120 ticks |
| Worst crowd | 6 | 6 | 6 |

Doors: 2,532 slowed samples of 756,310 (2,318 of 738,417 before), longest 280 ticks (80), worst 6 (6). Stations and fighting are unchanged in kind.

**Who is on the one long stretch left: cats.** `p0-6` played to day 1,080 on the change, sampled every 300 ticks, has 20 stretches of a hall tile crowded for 1,200 ticks or more, the longest 2,400 ticks. 16 are on tile 60368, on the hall's west column where everyone walks in, and nearly all have two or three cats standing there while dwarves walk through; at days 334, 683 and 822 the tile holds three cats and nothing else. No stretch has idle dwarves standing together. Cats that adopted a dwarf follow it loosely and are not moved by T-463's spreading rule, which is the likely cause ([T-NEW: cats stand together on one tile of the hall's walking line](../../docs/work/T-510-cats-stand-together-in-the-hall-way.md)). So the work file's "by dwarves or animals" is met for dwarves and left for those cats.

## The sweep

| Peril | Deaths | Living at year 3 | Extinct |
|---|---|---|---|
| 0 | 6 (T-482: 23) | 413 (427) | 0 |
| 2 | 62 (78) | 240 (291) | 0 |
| 4 | 69 (116) | 275 (165) | 0 (2) |

Every timeline moves from the first idle dwarf, so single seeds swing as the T-308 rule expects: `p2-4` and `p2-5` end at 8 and 3 living (42 and 9 in the first version's file), `p4-3`, wiped out in T-482's file, ends at 55. The one need death at peril 0 is `p0-3`'s, the seed T-507 is open for.

## The annual instrument

Median / worst / second-worst / sum of the living / wildlife-free / extinctions / need deaths. The bounds: median at least 12, sum at least 137, wildlife-free at least 7, extinctions at most 1, need deaths at most 1.

| Code | Shift | Run | Row | Bounds |
|---|---|---|---|---|
| Reference (T-481) | 0 | — | 13/7/10/149/7/0/0 | — |
| Reference (T-481) | 1 | — | 12/6/9/143/7/0/0 | — |
| master `d96cfc9c` (T-482) | 0 | 42099055474 | 12.5/9/10/149/7/0/0 | pass |
| master | 1 | 42099089334 | 12.5/3/9/139/7/0/0 | pass |
| master | 2 | 42129676042 | 10.5/2/3/118/7/0/**11** | median, sum, need deaths fail |
| master | 3 | 42129679703 | 12/3/8/136/6/0/0 | sum fails |
| first version `1c3401ed` | 0 | 42127994630 | 12.5/5/6/135/7/0/0 | sum fails |
| first version | 1 | 42127999123 | 11.5/10/10/146/5/0/0 | median fails |
| first version | 2 | 42129683740 | 12/10/10/145/5/0/0 | wildlife-free fails |
| first version | 3 | 42129688396 | 11.5/10/10/143/4/0/0 | median fails |
| **T-508 `0348c100`** | 0 | 42133462526 | **13/6/11/148/7/0/0** | pass |
| **T-508** | 1 | 42133465607 | **12.5/7/9/144/6/0/0** | wildlife-free fails by one seed |

Living by seed (forest 1-4, taiga 1-4, grassland 1-4): `11, 13, 13, 13, 11, 11, 13, 6, 14, 14, 15, 14` and, one tick later, `13, 11, 13, 11, 12, 10, 7, 9, 15, 14, 15, 14`. The grassland seeds, with no predators, barely move; the forest and taiga seeds, where wolves decide who lives, move by up to seven a seed in both directions under every shift, on master as on the branch.

Read with the T-308 rule: the first sample passes with the median and wildlife-free unchanged and the sum one dwarf lower; the second, against the reference one tick later (12/6/9/143/7), is better in median and sum and one seed worse in wildlife-free. Master's code itself, shifted two and three ticks, fails the bounds (at two ticks with eleven dwarves of `wildlife-taiga-3` starved on days 110 to 112), so a single failed bound on one sample does not tell a change from the timeline. Over the samples, T-508's need deaths are 0 in all six (master: 11 in one of four), its sum 135 to 148 (master 118 to 149) and its worst 5 to 10 (master 2 to 9). The instrument's reference row is left as it is; [T-NEW: the instrument's bounds are inside master's own timeline noise](../../docs/work/T-509-instrument-bounds-inside-timeline-noise.md) asks for the starvation to be explained and the bounds set from a measured spread.

## Fun behaviour noticed

- Idle dwarves now stand in a ring round the hearth, one to a tile, the ring growing outward as the fortress grows; the pets' heap lies among them, since its four curled pets make its tile the fullest in the hall. Joy errands ("a hearth visit") stand in the same ring, so the hearth visit is now literally at the hearth.
- Gathered round the hearth, dwarves keep their wants lower: in `t144`'s twelve-hauls scenario the seven take two hall errands at the high mark in ten days instead of six, and none of them while work is open, so that scenario's witness for "the sit comes before work" now rests on its unit test (`wants-in-passing.test.ts`).
- Cats keep their own company: two or three sit together on one tile of the hall's way in for a day or two at a time, with dwarves stepping round them. Characterful, but it slows the way in; filed as a T-NEW, which may well make it a cats' corner of their own rather than spread them.
- Sleepers with no bed still all lie on the hall's first tile, one heap of snoring dwarves in the doorway; they count for no crowd, so it slows no one, and it was left as it is.
