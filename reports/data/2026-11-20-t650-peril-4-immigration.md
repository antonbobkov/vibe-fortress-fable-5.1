# T-650: peril-4 immigration with the second smelter

**Task:** T-650 · **Date:** 2026-11-20 · **Code:** none changed; master `3246e207` · **Source:** [the T-650 work file](../../docs/work/T-650-peril-4-immigration-with-the-second-smelter.md), [T-642's sweep](2026-11-19-t642-iron-for-steel.md)

Four sweeps read, each four shifts of the twenty seeds, from their seed jobs' `[three_years_economy]` immigration records and `[three_years_ambush]` lines and their verdict jobs:

| Run | Code | Living y3 | Deaths |
|---|---|---|---|
| 44599385650 | master before T-639 and T-642 (`6aeaea32`) | 1067.5 | 111.25 |
| 44638661890 | T-639 alone | 1090 | 110.25 |
| 44646912929 | T-642 alone (`2cd2b957`) | 1031.5 | 105.25 |
| 44661428169 | both, master `b9cbb113` | 1033 | 121.75 |

## The immigrants: the rolls, not the steel

**The fortresses enter year 3 alike.** At the end of year 2 the 24 peril-4 fortress-timelines of master and of T-642 hold 22.3 and 22.7 dwarves, 24,400 and 24,000 marks, hall spirit 58 and 58. Years 1 and 2 bring the same waves (205 and 205 immigrants, then 296 and 305). The whole difference is year 3: 526 immigrants against 398.

**Fewer waves were rolled, not skipped.** In year 3 the evaluations skipped for hall spirit (13 against 14), wealth (2 against 3) and battles (12 against 11 deferred) are alike; the waves lost are rolls that failed (`luck`, 14 against 21). Every eligible evaluation rolls under `IMMIGRATION_PERMILLE + reputation × REP_PERMILLE_PER_POINT`, here 703 out of 1000.

**Master's rolls were lucky.** Rebuilding each wave's size from the journal (21 § Wave size: wealth, the hall spirit's tier and reputation, a winter wave halved; the rebuilt size matches every recorded peril-4 wave), the chance times the size, summed over the eligible evaluations, gives the immigrants expected:

| Peril 4, year 3 | Eligible rolls | Waves | Waves / rolls | Immigrants expected | Came | Came − expected |
|---|---|---|---|---|---|---|
| Master | 73 | 59 | 81% | 444 | 526 | +82 |
| T-639 alone | 77 | 64 | 83% | 489 | 582 | +93 |
| T-642 alone | 71 | 50 | 70% | 419 | 398 | −21 |
| Both | 76 | 54 | 71% | 463 | 463 | 0 |

At a 70.3% chance, 59 waves of 73 rolls is about two standard deviations high. T-642 and the merged master roll at the chance; master and T-639 rolled well above it. Of the 128 fewer year-3 immigrants (32 a sweep, nearly all of the 36 living T-642 lost), about 103 are master's luck and T-642's slight bad luck. The 25 left in the expectation follow the year's earlier rolls (master's spring and summer waves raise the wealth and the population that its autumn evaluation sizes from: 135 expected in autumn against 117). At peril 2, with the same second smelter, ore store and requests, the expectation is unchanged (621 against 618 in year 3).

**Why two runs share their luck.** The rolls and the waves' composition draw from one stream, 21's. A wave whose plan differs by one immigrant (one wealth step of 3,000 marks crossed or not at that tick) draws a different number of times, and every later roll of that fortress differs. Each of 20 of the 24 timelines kept master's rolls exactly until such a wave (6 in year 2, 14 in year 3; 4 never diverged) and drew different ones after it, for example `p4-1` at shift 0: the spring wave of year 3 rolled 521 in both, came 12 strong in master (26,000 marks) and 9 in T-642 (17,000), and master's next rolls were 510 and 684 (waves), T-642's 868 and 763 (none). T-639 changes the timeline only from its first stalled fight, so it kept master's rolls throughout in 15 of the 24 timelines, and the merged master T-642's in 8 (master and T-642 share them in 5, the ones with no wave of a different size). The four runs are nearer two draws of the rolls than four.

So the peril-4 drop is not the steel's price and there is nothing in T-642 to fix. The sweep reads a change's living through rolls that any wave of a different size reshuffles; a follow-up gives the roll a stream of its own so that two codes are compared on the same rolls: [the immigration roll on a stream of its own](../../docs/work/T-NEW-immigration-roll-own-stream.md).

**A battle at the turn of the season costs the wave.** Seen in every run alike, so no part of this drop: an evaluation deferred by a battle (21 § Evaluation, step 2) is made on the first clear day, 1.6 to 1.8 days later, when the hall spirit is still low from the fight (38.5 at the season's turn, 49.9 at the re-check, in master's perils 2 and 4). Of 16 such re-checks per run, 11 to 13 were skipped for the hall spirit, against about one in ten evaluations at the season's turn. Immigrants not walking into a hall in mourning reads as a trade-off of character, and is left.

## The deaths: two ambushes at the all-clear

The merged master's deaths rose by 11.5 a sweep over T-639's and 16.5 over T-642's, nearly all at peril 4 (74.25 a sweep against 56.25 and 58.25). Per seed the rise is in four timelines (`p4-1` at shift 100: 45 dead against 12 and 11; `p4-4` at 150: 23 against 6 and 9; `p4-6` at 50 and 100: 19 and 19 against 3 to 18). By the script's answer, the ambushes stood down for carried it (188 dead against 134 and 131); the gate, the halls and the fights were as before.

Split by when the ambush sprang, the ambush deaths of every other kind are flat across the four runs (229 to 234 in 244 to 248 ambushes); the rise is in two kinds:

| Ambushes, 80 fortress-timelines | Master | T-639 | T-642 | Both |
|---|---|---|---|---|
| Sprang 40 to 100 ticks after the alert came down: ambushes, deaths | 5, 26 | 5, 27 | 4, 19 | 6, **53** |
| Sprang while another alert was up, the gate's lock never seen: ambushes, deaths | 6, 5 | 4, 5 | 4, 6 | 5, **19** |
| All others: ambushes, deaths | 244, 234 | 247, 230 | 248, 229 | 245, 234 |

- `p4-1` at shift 100, day 295: a raid of 20 looted and left; the alert came down at tick 353,280 and an ambush of nine sprang 40 ticks later on the dwarves coming out. Twelve were outside when the gate locked; 31 died in two days, the worst single ambush of the four runs.
- `p4-4` at shift 150, day 261: an ambush of eight sprang during a wolf alert, with three soldiers out on the hunt and twelve dwarves on the surface; no alert of its own was raised (the alert was already up) and 13 died.

Neither turns on what T-639 or T-642 changed: the same answers were there before, and a timeline moved by either change happens to meet them where the others did not (master's own worst, 10 dead in `p4-2` at shift 100, sprang 40 ticks after an all-clear too). An ambush that waited out the alert hidden by the gate and springs on the first dwarves out is a clear, repeated cause, 5 to 13 deaths a sweep in every run, and worth a script answer of its own: [an ambush springs as the alert comes down](../../docs/work/T-NEW-ambush-at-the-all-clear.md). Without the two ambushes the merged master's deaths are 110.75 a sweep.

## Verdict

No code changed, so no sweep was run for this task. The merged master's sweep (44661428169, `b9cbb113`) passed: pooled 19.75 alive, 7 grown, 0 hungry, 1033 living, 121.75 deaths, 0.5 extinct, 0.75 need deaths; bounds 887.75 living and 161.88 deaths.

The scripts used for these figures read the downloaded seed logs only; the figures can be rebuilt from the four runs' `seed-*` artifacts while GitHub keeps them (14 days).
