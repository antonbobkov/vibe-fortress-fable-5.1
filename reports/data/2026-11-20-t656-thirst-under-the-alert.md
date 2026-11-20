# T-656: the thirsty go out under the alert

**Task:** T-656 · **Date:** 2026-11-20 · **Code:** branch `t656-thirst-under-alert` · **Source:** [the T-656 work file](../../docs/work/T-656-thirst-under-the-alert.md), [T-653's report](2026-11-20-t653-ambush-at-the-all-clear.md)

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

Keeping the thirsty in until the watch has looked was not done: the look (T-653) already holds the alert until the watch has been out, and after it a dwarf at critical thirst with no drink below has nowhere else to drink. The game gives a player no water inside the gate: no water lies under the halls, there is no aquifer yet, and a well stands only over open water (14), so over the brook. That is [a follow-up](../../docs/work/T-NEW-water-inside-the-gate.md).

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

The figures follow once both sweeps have run.
