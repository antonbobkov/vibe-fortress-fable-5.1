# Measurement: the three-year file after T-455

**Task:** T-455 · **Date:** 2026-11-01 · **Commit examined:** `89aa5a5` · **Kind:** final row; follows [the measurement](2026-10-31-perils-on-relief.md)

## The answer

- **The whole file passes in one process, 21 of 21, at relief 1.** The new reference row is **215 deaths, 790 living**, against 226 and 531 at T-451 and 158 and 867 on level maps.
- **The set rule:** 20 of 20 alive at year 1, 7 of 7 peril-0 seeds grown, 1 of 7 peril-0 seeds with need deaths (`three-years-p0-3`, 17), which is the rule's whole allowance.
- **Two seeds end extinct** (p2-3, p4-3), the same count as level maps but not the same seeds. p2-3 stays extinct because its gate cannot be finished; the owner is filing that gap.
- **`three_years_main` passes** by `npm run test:perf`, with the doorway fix in `38af068`.

## Rows

Deaths / living ([data](../data/2026-11-01-t455-final-sweep.json)):

| By peril | Relief 0 | T-451 | Now |
|---|---:|---:|---:|
| 0 | 1 / 385 | 1 / 370 | 18 / 435 |
| 2 | 56 / 308 | 114 / 83 | 105 / 148 |
| 4 | 101 / 174 | 111 / 78 | 92 / 207 |
| All | 158 / 867 | 226 / 531 | **215 / 790** |

| Seed | Now | Seed | Now |
|---|---:|---|---:|
| p0-1 | 0 / 61 | p2-4 | 16 / 11 |
| p0-2 | 0 / 58 | p2-5 | 4 / 28 |
| p0-3 | 17 / 48, all starved | p2-6 | 15 / 26 |
| p0-4 | 1 / 63 | p2-7 | 16 / 20 |
| p0-5 | 0 / 67 | p4-1 | 2 / 52 |
| p0-6 | 0 / 61 | p4-2 | 10 / 48 |
| p0-7 | 0 / 77 | p4-3 | 35 / 0 |
| p2-1 | 15 / 45 | p4-4 | 29 / 17 |
| p2-2 | 12 / 18 | p4-5 | 4 / 42 |
| p2-3 | 27 / 0 | p4-6 | 12 / 48 |

## The T-176 stop in `three_years_main`

It was a game fault, now fixed. A brew job's walk was given up on the gate's south door. The retry skipped the job while any creature stood on that tile, and with 54 dwarves there was someone in the door at nearly every look, each only passing through. The retry now waits only while one creature stays there. `38af068`: 15 lines added and 5 removed in `src/systems/jobs/board.ts`, with a test that fails on the old code. Instrument hashes are unchanged.

## What holds p0-3's larder

One bounded look, from the logs of the previous whole-file run, where p0-3 had 6 starving at 61 living. I did not find a plain script fault, so the check moved to the set rule as decided.

| Three years, whole run | p0-3 | p0-7 | p0-1 |
|---|---:|---:|---:|
| Meals eaten, and other food | 4,216 | 5,157 | 3,482 |
| Alcoholic drinks | 6,359 | 4,375 | 4,803 |
| Water drinks | 789 | 3,487 | 568 |
| Dwarf-days | 12,195 | 13,911 | 9,264 |

- **Land:** at the script's target, 248 surface and 32 cave tiles at 67 dwarves.
- **Kitchens and stills:** they do not stall, and cooking follows what plants there are. In p0-3 the plants stock stands near zero from day 224; in p0-7 it stands at 111 to 1,033.
- **Brewing against cooking:** p0-3 drinks 12% water against 44% in p0-7, so its stills use the plants, at about 4 plants a brew. Over days 168 to 308 p0-3 brews 215 times and p0-7 130 times. p0-1 also drinks little water and has no hunger, at fewer dwarf-days, so this is pressure and not a full explanation.
- I did not measure why p0-3 drinks so little water. It may be how far its brook lies from the camp. Changing the land target would be tuning, so I left it.

## Deaths outdoors

Not measured further, by the owner's decision. The figures stand as [measured](2026-10-31-perils-on-relief.md#3-where-the-deaths-happen): in nine seeds, 99 by raiders outdoors at relief 1, against 47 on level maps.
