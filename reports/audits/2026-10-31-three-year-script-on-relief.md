# Measurement: the three-year script on relief (T-451)

**Task:** T-451 · **Date:** 2026-10-31 · **Commit examined:** `ea02f58` with the script's changes · **Kind:** fixture change with rows; nothing tuned · **Source:** [the sweep on relief 1](2026-10-30-instrument-relief.md)

## The answer

- **19 of 20 seeds now pass at relief 1**, against 11 of 20 on `ea02f58` before these changes. Every fault found was in the script, not the game.
- **The one left is `three-years-p4-3`, which dies out on day 78.** It is the game being hard on a slower fortress, not a fault I can name. It has died out in every run at relief 1. An exemption is not mine to give, so `THREE_YEARS_RELIEF` stays 0 and T-451 stays open until that is decided.
- **Relief 0 is unchanged:** 158 deaths, 867 living, 20 of 20, every seed's figures equal to the T-448 row.
- **Relief 1 is harder at perils 2 and 4, even with the script working:** 226 deaths and 531 living against 158 and 867, and 8 seeds end with nobody alive against 2. Peril 0 is not harder: 1 death in both, 370 living against 385.

## Rows

Deaths / living at the end of year 3. All figures for relief 1 are on the changed script, each peril group in its own process ([data](../data/2026-10-31-t451-sweep.json)).

| Seed | Relief 0 | Relief 1, `ea02f58` | Relief 1, now | Outcome now |
|---|---:|---:|---:|---|
| p0-1 | 0 / 59 | 0 / 14 | 0 / 26 | pass |
| p0-2 | 0 / 40 | 0 / 71 | 0 / 71 | pass |
| p0-3 | 0 / 47 | 0 / 63 | 1 / 46 | pass |
| p0-4 | 0 / 73 | 4 / 8 | 0 / 53 | pass |
| p0-5 | 1 / 54 | 0 / 72 | 0 / 65 | pass |
| p0-6 | 0 / 32 | 0 / 70 | 0 / 57 | pass |
| p0-7 | 0 / 80 | 0 / 80 | 0 / 52 | pass |
| p2-1 | 10 / 51 | 10 / 44 | 10 / 44 | pass |
| p2-2 | 16 / 36 | 18 / 0 | 14 / 0 | pass |
| p2-3 | 4 / 43 | stopped | 27 / 0 | pass |
| p2-4 | 4 / 48 | stopped | 20 / 0 | pass |
| p2-5 | 1 / 65 | 14 / 0 | 14 / 0 | pass |
| p2-6 | 13 / 0 | stopped | 12 / 12 | pass |
| p2-7 | 8 / 65 | 14 / 0 | 17 / 27 | pass |
| p4-1 | 3 / 57 | stopped | 22 / 0 | pass |
| p4-2 | 25 / 28 | 42 / 0 | 20 / 38 | pass |
| **p4-3** | 10 / 15 | 12 / 0 | **12 / 0** | **fails: extinct in year 1** |
| p4-4 | 6 / 53 | stopped | 22 / 0 | pass |
| p4-5 | 6 / 21 | 19 / 48 | 6 / 40 | pass |
| p4-6 | 51 / 0 | 41 / 0 | 29 / 0 | pass |

| By peril | Relief 0 | Relief 1, now |
|---|---:|---:|
| 0 (seven seeds) | 1 / 385 | 1 / 370 |
| 2 (seven seeds) | 56 / 308 | 114 / 83 |
| 4 (six seeds) | 101 / 174 | 111 / 78 |
| All | **158 / 867** | **226 / 531** |

"Pass" asserts what the file asserts. A peril-2 or peril-4 fortress that survives year 1 and dies later still passes.

## What was wrong, seed by seed

All script faults. The journal is [this probe](../data/2026-10-31-t451-journal.probe.ts.txt).

| Seed | What it showed | Fix |
|---|---|---|
| p0-1, p0-4 | Not a shortage of logs, as T-448 guessed: 149 logs sat in stock. The script looked for workshop sites only at the wagon's level; a plateau has none, so **no workshop was ever placed**, no door or table was made, and ten buildings waited for ever. | A workshop with no room at the fortress's level goes to the nearest surface level the dwarves can walk to. p0-1 reaches 26 living, p0-4 53. |
| p2-3 | A sapling had taken root on the gate's door tile, and placing a door on it is refused. | The door waits for the tree and fells it. |
| p2-4, p2-6 | A haul was blocked with its work tile on the site of a gate wall. I infer a moved zone lay under the wall; the journal shows the work tile, not the zone. | A moved zone keeps two tiles off the gate, and stays on the wagon's walker label. Both seeds then pass. |
| p4-1 | The planned kitchen stood among trees on all four sides, with its corners forbidden by the script while it is built, so nobody could step in. Every felling job failed on a walk to one tile on that site, I take it for the axe. Labels do not count forbidden tiles, so the jobs stayed blocked for over a day. | Where trees close all four sides, the script fells the ring around the site. |
| p4-4 | A build job blocked the same way on `ea02f58`. It passes after the changes above; I did not trace it further. | |
| all | Trees on other surface levels were never felled. | Felling covers every surface level the dwarves reach. On level ground this changes nothing. |

**Game faults found: none.** Two behaviours met on the way are correct as specified and need no row:
- a door refused on a sapling;
- a job blocked by tiles a player has forbidden, since forbidding is the player's own choice.

## `three-years-p4-3`

It fails "alive at the end of year 1". It dies out on day 78, and the script is doing what it should: the gate's walls and doors are built and five dwarves stand in the squad.

| | Relief 0 | Relief 1 |
|---|---:|---:|
| Raids to day 77 | thieves on 20, 45, 69; bandits (3) on 71; raid (13) on 77 | thieves on 20, 40, 64; bandits (3) on 71; raid (12) on 77 |
| Squad armed, day | 52 | 69 |
| Dwarf deaths to day 77 | 4 | 12, all of them |
| Living, year 1 | 10 | 0 |

- **Why it dies:** the same parties arrive, but the fortress is armed 17 days later. Four dwarves die to one attacker on days 59 and 60, and the twelve-strong raid on day 77 kills everyone left.
- **Why it is armed later:** the opening keeps pace with relief 0 to about day 20. In a journal of each, after that the pantry comes on day 42 against 26 and the first short sword on day 56 against 36. That journal's cadence is not the sweep's, and its armed days (62 and 56) differ from the table's. I did not find why the pantry comes later, and no blocked job explains it.
- **Not a flip by T-334's rule:** it has died in all seven runs at relief 1 across T-448, T-449 and T-451, while the rule covers a seed whose outcome flips under changes that do not aim at it. So listing it in `YEAR_ONE_FLIPS` would be a different kind of exemption from p4-2's.

## Not done

`THREE_YEARS_RELIEF` is still 0, so the file still gates level maps. The script's changes are committed, since relief 0 is unchanged by them. The decision on p4-3 is the owner's:

1. print p4-3's outcome and take relief 1 at 19 of 20 asserted;
2. keep T-451 open and find what delays its arming.
