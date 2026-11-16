# T-555: why the sweep's deaths rise, eight shifts against master

T-555's sweep (43826997913, 4b9c52f9) was blocked on dwarf deaths: 161.25 against master's 137.25 (43836845395, df68548f, the same master merged). Both were played again at shifts 200, 250, 300 and 350 (T-555 43843562286 on e60ea120, master 43843566973).

## Deaths by shift (all twenty seeds)

| Shift | 0 | 50 | 100 | 150 | 200 | 250 | 300 | 350 | Mean |
|---|---|---|---|---|---|---|---|---|---|
| master | 142 | 132 | 114 | 161 | 133 | 132 | 92 | 104 | 126.25 |
| T-555 | 136 | 194 | 152 | 163 | 138 | 137 | 111 | 116 | 143.38 |

Living at year 3, eight-shift mean: master 989.75, T-555 978.25.

## Where the extra deaths are

| | Shifts 0–150 (sum) | Shifts 200–350 (sum) | Eight shifts |
|---|---|---|---|
| three-years-p4-1, master | 13 + 17 + 3 + 5 = 38 | 12 + 14 + 1 + 14 = 41 | 79 |
| three-years-p4-1, T-555 | 41 + 49 + 34 + 24 = 148 | 14 + 14 + 21 + 19 = 68 | 216 |
| the other 19 seeds, T-555 less master | −14 | +14 | **0** |

All of the rise, 137 deaths over eight sweeps (17.1 a sweep), is p4-1's. The other nineteen seeds die exactly as often on both branches; their seed-by-seed differences run both ways (p4-5 +56 and p2-1 +8 at shifts 0–150 against p2-5 −25, p4-6 −29 and p2-3 −18).

## Why p4-1 parts from master

At shifts 0 and 50, p4-1 plays identically on both branches up to the Wildwood's first caravan (day 71): the same population, wealth, meals and plants at days 28 and 56, and the same trade at the depot on day 74 or 75 (shift 0: given 25.4, received 21.6 on both; shift 50: 14.4 and 12). The fortress buys nothing T-555 adds. The timelines part during that visit: the Wildwood's list has two more sundries entries (honey and beeswax, weight 6 each), so the caravan's weighted draws pick other goods, the merchant brings other items (other entity ids, other draws on 20's stream), and everything after moves. In shift 0, p4-1's later raids come on other days (master's on days 231 and 286, T-555's on day 297); the day-297 raid kills 37.

So the rise is the timeline moving where a new list entry is drawn, not a T-555 rule acting on the fortress: no fixture builds a hive, the Hillfolk honey entry is not drawn (the fixtures' spec has no `civDistance`), and the trade the fixture makes is the same. The Wildwood's honey and beeswax are meant to be drawn everywhere (20 § Sundries), so there is nothing to make "draw nothing where it does not apply". p4-1 is worse at seven of its eight shifts, so its new timelines are a worse family for that one seed; over all twenty seeds and eight shifts the mean rises by 17.1 deaths (126.25 → 143.38), all of it p4-1.
