# T-NEW — A dedicated crafter reaches masterwork by Year 3

**Source:** T-803-stone-for-the-crafters (its measure, with playtest 9's driver, and its sweeps) · **Size:** M · **Needs:** — · **Status:** open

## Why

No fortress reaches masterwork by Year 3 (`balance.md` § Wealth curve). T-803 tried more stone and did not take it: a dug rock tile still gives a stone three times in ten (`MINING_STONE_DROP_PERMILLE` 300). Its twenty-seed sweeps, each with a set of stone that gathered its stones as they came:

| Drop | Living at year 3 | Dwarf deaths | Raw stone at year 3 (median) | Items (median) |
|---|---|---|---|---|
| 300 (base 61723338, run 45911220303) | 1,139.75 | 108.5 | | |
| 500 (run 45949777523) | 1,152.5 | 122.25 | 189 | 1,592 |
| 1000 (run 45928628497) | 1,093.25 | 135.75 | 611 | 2,167 |

Deaths rose with the stone, and at 500‰ the best crafting at year 3 was still a median 8 with no masterwork. The stone a fortress cannot use is hauled, and the crafts made of it are wealth that draws bigger raids; which of these costs the deaths is not known.

With 1000‰ the dedicated crafter of playtest 9's driver trained faster:

Playtest 9's driver ([drive.test.ts.txt](../../reports/data/2026-11-26-playtest-9/drive.test.ts.txt), seed `pt9-1`, peril 1), the same dedicated crafter at the craftsdwarf's workshop from day 4 with a 999-crafts order:

| Day | 112 | 224 | 336 | 364 | 448 |
|---|---|---|---|---|---|
| Crafting, at 300‰ | 6 | 7 | 8 | 8 | — |
| Crafting, at 1000‰ with the set of stone | 7 | 9 | 10 | 11 | 12 |
| Items, at 300‰ | 535 | 973 | 1,986 | 1,935 | — |
| Items, at 1000‰ | 789 | 1,525 | 2,550 | 2,432 | 2,900 |

Level ups at 1000‰: 6 on day 40, 7 on 89, 8 on 140, 9 on 204, 10 on 261, 11 on 342, 12 on 419. About 10 experience a day, a little over one stone craft a day: the craftsdwarf's workshop stands on the surface and the stone lies in the halls six levels down, so each craft is a walk down and up. Level 13 (5,980 experience) would come about day 500, and the first masterwork, one roll in 41 at 13, about a month after. No item of masterwork quality was made by day 448 (25 exceptional ones).

The crafter in the driver is also the Thane, the Broker and a Gate Guard soldier ("One dwarf, four hats", `fun-features.md`), so some of the day is not crafting at all.

## What to do

Weigh the stone rate and the crafter's pace together, and measure (the driver, and the twenty-seed sweep's "Crafts at year 3" line, which T-803 added). Find first what in the stone costs the deaths (trace a seed whose deaths rose at 500‰):

- **Shorter walks.** A workshop fetches its next stone from the nearest stockpile; the three-year script (and the hint) could keep a stone stockpile beside the craftsdwarf's workshop. Measure the crafts a day with one.
- **More experience a craft.** Stone crafts give 8 (`craft_stone`'s recipe `xp`, `workshops-and-recipes.md`); 12 or 16 would bring level 13 to Year 3 for this crafter. It raises every crafted skill, so quality, wealth and renown rise with it: measure the wealth curve and the raid sizes that follow renown.
- **More stone only where it is wanted**, e.g. a stone drops at 300‰ but a dig designated with a standing stone order at the workshops drops more, or stone hauling waits behind food and drink.
- **The set of stone** (T-803's gathering rule) on its own at 300‰, measured apart from the drop rate.
- **Leave it**, and say in `balance.md` that masterworks are a Year 4 driver.

## Done

- [ ] A decision with its measurement; `balance.md` § Wealth curve agrees with it.
