# T-656: the thirsty go out under the alert

**Task:** T-656 · **Date:** 2026-11-20 · **Code:** branch `t656-thirst-under-alert`, swept at `1c6fcc97` (master `59ca43b4` merged) · **Source:** [the T-656 work file](../../docs/archive/tasks/T-656-thirst-under-the-alert.md), [T-653's report](2026-11-20-t653-ambush-at-the-all-clear.md)

## Why the drink ran short

Master's sweep `44741164080` (commit `4c7263d3`, the code of master `ea398d9e`) writes the drink and the plants in stock every 28 days. In five of its 24 peril-4 timelines the fortress had almost no drink for months of year 2 and 3 while the plants piled up:

| Timeline | Days | Dwarves | Drink | Plants |
|---|---|---|---|---|
| p4-4 @ 50 | 224 to 280 | 19 to 32 | 0 to 30 | 191 to 358 |
| p4-4 @ 150 | 224 to 308 | 28 to 34 | 0 | 68 to 349 |
| p4-5 @ 0 | 196 to 308 | 30 to 34 | 0 to 51 | 215 to 1,105 |
| p4-5 @ 50 | 224 to 280 | 25 to 26 | 0 | 387 to 530 |
| p4-5 @ 100 | 196 to 252 | 18 to 20 | 10 to 18 | 36 to 160 |

`test/perf/t656_drink_probe.test.ts` (local, `T656_PROBE=1`) plays a seed as the sweep does and writes a line a day: the drink, the brewable plants, the barrels and what they hold, the stills' orders and jobs, the brewer's day, the carpenter's queue, the logs, the timber, and the drinks of water taken outdoors. Traced on `p4-4` at shift 150, `p4-5` at shifts 0 and 50 and `p4-1` at shift 100:

- **The stills waited for barrels.** A brew takes four plants and an empty barrel. With 100 to 370 brewable plants in stock both stills reported `no_empty_container` for weeks; the fortress held 4 to 20 barrels in all.
- **The carpenter made none.** Its barrel order stood behind two chairs, two tables and the beds owed to each wave of immigrants, and it had no logs to make them with: 0 to 15 logs for most of days 100 to 250, while 130 to 150 trees stood in the timber the script fells. The founder who came with the axe fells and works the carpenter's bench alone, between his drill, his meals and his sleep, and felled a few trees a month; the wood furnace burnt what came in to charcoal.
- **The raids carried barrels off.** In `p4-5` at shift 0, thieves and bandits took 20 barrels in a year (`ItemDestroyed`, reason `stolen`), the full ones with their drink.
- **The brew order's stock was written to the wrong order.** The Thane's batch of spirits goes ahead of the brew, and the script wrote the brew's threshold to the first order of the still, so the brew kept the stock of a smaller fortress.

With no drink below, the dwarves drink at the brook (10 § Eating and drinking): in `p4-4` at shift 150 the fortress drank water outdoors 1,008 times between days 100 and 250. Under an alert nobody brews (the still is outside the hearth hall the civilians shelter in, 11 § Assignment) and nobody drinks until thirst is critical (10 § Behavior selection, step 2); then all 28 to 33 dwarves of the fortress were at critical thirst, and they went to the brook together when the gate opened. Not every timeline was short: `p4-1` at shift 100, which T-653 traced on an older master, kept 300 to 600 drinks through year 3 on this one.

## The answer

As a player would, in the script (testing-strategy.md § The long scenarios):

- **Barrels first.** While the drink is under seven days for the dwarves (`DRINK_RESERVE_DAYS`: a raid's alert holds the fortress four days) and no empty barrel is free, the carpenter makes four barrels ahead of its furniture and beds, and the wood furnace waits while they want the logs, unless the squad's kit is being forged.
- **A second woodcutter.** Once the logs fall under a quarter of the 40 the script fells for, a dwarf no role holds takes the woodcutter's trade beside the founder (woodcutting, carpentry and hauling), and the forge makes him an axe.
- **The brew's stock on the brew.** The still's standing brew is found by its recipe.

Keeping the thirsty in until the watch has looked was not done: the look (T-653) already holds the alert until the watch has been out, and after it a dwarf at critical thirst with no drink below has nowhere else to drink. The game gives a player no water inside the gate: no water lies under the halls, there is no aquifer yet, and a well stands only over open water (14), so over the brook. That is [a follow-up](../../docs/archive/tasks/T-663-water-inside-the-gate.md).

## Probes, days 100 to 250

| Timeline | Code | Days under 4 days of drink | Days with none | Water drunk outdoors | Brews | Dwarves dead | Most at critical thirst |
|---|---|---|---|---|---|---|---|
| p4-4 @ 150 | master | 81 | 49 | 1,008 | | 19 | 31 |
| | barrels first | 94 | 28 | 405 | 64 | 15 | 21 |
| | and the woodcutter | 45 | 9 | 284 | 115 | 14 | 34 |
| p4-5 @ 0 | brew order only | 39 of 122 | 10 | 94 | 47 | 8 | 10 |
| | barrels first | 45 | 9 | 93 | 68 | 10 | 10 |
| | and the woodcutter | 3 | 0 | 0 | 100 | 7 | 6 |
| p4-1 @ 100 | all three | 0 | 0 | 0 | 123 | 13 | 7 |

(The `p4-5` brew-order-only probe ran to day 221.)

## The sweep

The sweeps' logs carry the thirst journal: `[three_years_thirst]` as each alert goes up, as the watch looks and as it comes down (the dwarves, the drink, those at want and critical thirst, those outdoors, the most seen outdoors while it was up and the water drunk outdoors meanwhile), `[three_years_thirst_death]` for each dwarf that dies (its thirst, whether outdoors, the alert), and `[three_years_drink]` weekly (the drink, the plants, the barrels, the logs, the brews and the barrels stolen).

**Before:** sweep `44780191075`, branch `t656-before` at `b0acc909`: the journal alone on master `59ca43b4` (T-652's immigration rolls), so the game is master's. **After:** sweep `44796007697` at `1c6fcc97`, the same master with the answer. The same seed and shift meet the same immigration luck in both (T-652), but the timelines part as soon as the script acts differently.

Peril 4, all 24 timelines (each alert's end is a `clear`, `shutOut` or `wildQuiet` line; "outdoors under them" sums the most dwarves seen outdoors during each alert):

| | Before | After |
|---|---|---|
| Alerts ended | 547 | 515 |
| Alerts ending with 5 or more dwarves at critical thirst | 57 | 39 |
| Dwarves at critical thirst as alerts ended, summed | 890 | 599 |
| Dwarves outdoors under the alerts, summed | 3,091 | 2,062 |
| Drinks of water taken outdoors under the alerts | 1,007 | 277 |
| Weeks with less than four days of drink, of 1,176 | 240 | 98 |
| Weeks with no drink | 119 | 35 |
| Brews | 3,912 | 4,839 |
| Barrels stolen | 281 | 367 |
| Dwarves dead | 333 | 275 |
| of them at critical thirst (outdoors) | 34 (18) | 25 (8) |
| of them starved (hunger or thirst) | 29 | 55 |

By run:

| Run | Alerts ending with 5+ at critical thirst | Outdoors under the alerts | Water drunk outdoors under them | Weeks under 4 days of drink | Weeks with none | Dwarves dead | Dead at critical thirst | Starved |
|---|---|---|---|---|---|---|---|---|
| p4-1 @ 0 | 4 → 2 | 227 → 103 | 104 → 0 | 22 → 6 | 2 → 0 | 6 → 8 | 0 → 0 | 0 → 0 |
| p4-1 @ 50 | 2 → 1 | 40 → 37 | 13 → 8 | 11 → 9 | 8 → 8 | 17 → 17 | 0 → 2 | 11 → 12 |
| p4-1 @ 100 | 2 → 3 | 156 → 128 | 8 → 0 | 10 → 2 | 2 → 0 | 15 → 5 | 1 → 1 | 0 → 0 |
| p4-1 @ 150 | 2 → 0 | 94 → 71 | 34 → 0 | 10 → 6 | 5 → 0 | 20 → 5 | 0 → 0 | 0 → 0 |
| p4-2 @ 0 | 0 → 0 | 125 → 32 | 2 → 9 | 0 → 2 | 0 → 2 | 15 → 15 | 1 → 2 | 0 → 10 |
| p4-2 @ 50 | 2 → 3 | 53 → 62 | 0 → 0 | 0 → 0 | 0 → 0 | 6 → 16 | 1 → 1 | 0 → 0 |
| p4-2 @ 100 | 2 → 1 | 96 → 55 | 37 → 2 | 10 → 0 | 2 → 0 | 10 → 14 | 0 → 0 | 0 → 0 |
| p4-2 @ 150 | 1 → 0 | 52 → 31 | 28 → 23 | 8 → 8 | 8 → 8 | 17 → 17 | 2 → 4 | 7 → 12 |
| p4-3 @ 0 | 0 → 1 | 81 → 92 | 0 → 0 | 1 → 0 | 0 → 0 | 6 → 6 | 3 → 0 | 0 → 0 |
| p4-3 @ 50 | 3 → 3 | 172 → 88 | 2 → 0 | 2 → 0 | 0 → 0 | 4 → 7 | 0 → 0 | 0 → 0 |
| p4-3 @ 100 | 0 → 0 | 69 → 96 | 0 → 0 | 0 → 0 | 0 → 0 | 10 → 5 | 0 → 0 | 0 → 0 |
| p4-3 @ 150 | 1 → 0 | 87 → 90 | 0 → 0 | 0 → 0 | 0 → 0 | 8 → 9 | 0 → 0 | 0 → 0 |
| p4-4 @ 0 | 0 → 0 | 59 → 59 | 19 → 19 | 10 → 10 | 4 → 4 | 17 → 17 | 6 → 6 | 5 → 5 |
| p4-4 @ 50 | 4 → 5 | 153 → 91 | 92 → 5 | 29 → 4 | 15 → 1 | 20 → 15 | 2 → 3 | 0 → 0 |
| p4-4 @ 100 | 2 → 3 | 142 → 84 | 1 → 9 | 9 → 0 | 1 → 0 | 22 → 8 | 1 → 0 | 0 → 0 |
| p4-4 @ 150 | 2 → 5 | 289 → 187 | 144 → 85 | 23 → 20 | 15 → 6 | 22 → 20 | 2 → 2 | 0 → 0 |
| p4-5 @ 0 | 6 → 3 | 238 → 115 | 165 → 0 | 27 → 6 | 17 → 1 | 32 → 5 | 5 → 0 | 0 → 0 |
| p4-5 @ 50 | 6 → 2 | 184 → 125 | 126 → 38 | 30 → 3 | 22 → 1 | 22 → 25 | 2 → 0 | 0 → 0 |
| p4-5 @ 100 | 12 → 3 | 395 → 173 | 198 → 62 | 26 → 17 | 13 → 1 | 20 → 11 | 3 → 0 | 1 → 0 |
| p4-5 @ 150 | 0 → 0 | 59 → 86 | 20 → 15 | 8 → 2 | 5 → 1 | 12 → 5 | 3 → 0 | 5 → 0 |
| p4-6 @ 0 | 1 → 3 | 62 → 68 | 9 → 0 | 4 → 0 | 0 → 0 | 5 → 6 | 0 → 0 | 0 → 0 |
| p4-6 @ 50 | 1 → 1 | 71 → 98 | 0 → 1 | 0 → 0 | 0 → 0 | 10 → 11 | 0 → 0 | 0 → 0 |
| p4-6 @ 100 | 2 → 0 | 122 → 66 | 0 → 1 | 0 → 3 | 0 → 2 | 6 → 14 | 0 → 4 | 0 → 5 |
| p4-6 @ 150 | 2 → 0 | 65 → 25 | 5 → 0 | 0 → 0 | 0 → 0 | 11 → 14 | 2 → 0 | 0 → 11 |

The thirst at the alerts' ends falls where the drink ran short (`p4-4` at 50, `p4-5` at 0, 50 and 100: 50 to 165 drinks of water outdoors under the alerts down to 0 to 62). The dead at critical thirst are few in both (34 and 25 of the peril-4 dead): the crowd T-653 traced in `p4-1` at shift 100 is not in that timeline on this master, which kept its drink. `p4-4` at shift 0 is the same in both: nothing of the answer changed its course.

The starved rose: `p4-6` at shift 150, 29 dwarves at the end before, starved to the last of 11 on days 198 to 201 with 110 drinks in stock and no plant or meal after day 168, and `p4-2` at shift 0 (eight dwarves, days 70 to 80), while `p4-5` at 100 and 150 no longer starved. These are hunger, not thirst, in fortresses raids had cut small; whether the second woodcutter cost such a farm a hand is [a follow-up](../../docs/archive/tasks/T-664-small-fortress-starves.md).

### Verdict

From the after-sweep's `sweep-verdict` job:

| | Alive | Grown | Hungry | Living | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| Pooled | 19.5 | 7 | 0 | 1099 | 110.75 | 1.5 | 13.75 |
| Before `44780191075` | 19.75 | 7 | 0 | 1081.25 | 123.75 | 1.25 | 7.5 |

Bounds 887.75 living and 161.88 deaths; **Verdict: pass**, every seed green.
