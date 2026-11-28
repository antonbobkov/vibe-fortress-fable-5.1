# T-812 — A dedicated crafter reaches masterwork by Year 3

**Closed:** 2026-11-27, in aeacc0b3, 73700b4d.

**Source:** T-803-stone-for-the-crafters (its measure, with playtest 9's driver, and its sweeps) · **Size:** M · **Needs:** — · **Status:** done

## Why

No fortress reaches masterwork by Year 3 (`balance.md` § Wealth curve). T-803 tried more stone and did not take it: a dug rock tile still gives a stone three times in ten (`MINING_STONE_DROP_PERMILLE` 300). Its twenty-seed sweeps, each with a set of stone that gathered its stones as they came:

| Drop | Living at year 3 | Dwarf deaths | Raw stone at year 3 (median) | Items (median) |
|---|---|---|---|---|
| 300 (base 61723338, run 45911220303) | 1,139.75 | 108.5 | | |
| 500 (run 45949777523) | 1,152.5 | 122.25 | 189 | 1,592 |
| 1000 (run 45928628497) | 1,093.25 | 135.75 | 611 | 2,167 |

Deaths rose with the stone, and at 500‰ the best crafting at year 3 was still a median 8 with no masterwork. The stone a fortress cannot use is hauled, and the crafts made of it are wealth that draws bigger raids; which of these costs the deaths is not known.

With 1000‰ the dedicated crafter of playtest 9's driver trained faster:

Playtest 9's driver ([drive.test.ts.txt](../../../reports/data/2026-11-26-playtest-9/drive.test.ts.txt), seed `pt9-1`, peril 1), the same dedicated crafter at the craftsdwarf's workshop from day 4 with a 999-crafts order:

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

## Decided while doing it

- **More experience a craft, and nothing else: `craft_stone` gives 24 a job, 8 for each of its three crafts** (was 8 a job). It changes no death path. The stone rate stays 300‰, no stone stockpile is added to the script or the hint, and no set of stone gathers.
- **Why not the walk or the stone first.** At 300‰ playtest 9's crafter is starved, not slow: the fortress held 0 to 15 raw stones all year and none at all from day 84 to 112, so a shorter walk buys nothing, and more stone is what cost T-803 its deaths. Raising the experience is the one lever that works on the stone a fortress already has.
- **Why 24.** Playtest 9's driver ([drive.test.ts.txt](../../../reports/data/2026-11-26-playtest-9/drive.test.ts.txt), seed `pt9-1`, peril 1, crafter on stone crafts from day 4, crafting 5 then), run to day 336 with the experience overridden in the driver's registry:

  | `craft_stone` xp | Crafting at day 336 | Level 13 on | First masterwork | Masterworks by 336 |
  |---|---|---|---|---|
  | 8 (base) | 8 (6 on d48, 7 on d156, 8 on d277) | — | — | 0 |
  | 24 | 14 (8 on d53, 10 on d155, 12 on d267, 13 on d296, 14 on d318) | day 296 | day 312 | 4 (21 exceptional) |
  | 40 | 17 by day 322 | day 241 | day 274 | 18 by day 322 |

  16 would fall short: two thirds of 24's gain leaves the crafter at about 11 by day 336. 24 is the least that reaches 13 inside year 3, and it reads as a rule: a stone craft job makes three crafts and gives each one's 8.
- **The other crafts keep 8.** The same driver with a wood-crafts order (`craft_wood`, 8): crafting 11 at day 336 (6 on d36, 8 on d113, 10 on d228, 11 on d306), no masterwork. Logs come without digging, so a wood crafter already trains nearly twice as fast as a stone one did; at 24 wood would bring masterworks in year 2. Bone, shell and ivory crafts stay with wood.
- **The sweep.** The base 4c8e61d7 was swept on a temporary branch (`t812-base`, run 46071452774): living 1,093.75, deaths 121.75, extinct 0.25, need deaths 0.5 (the base had moved from 9a13599a's 1,139.75 / 108.5). With 24 (aeacc0b3, run 46073533820): living 1,084.75, deaths 118.25, extinct 0, need deaths 0.25; verdict pass. Paired: deaths −3.5, living −9, within the bars (8 deaths, 30 living). Crafts at year 3: best crafting a median 11 (0 to 15) against 7 (0 to 10); 17 masterworks in 7 fortress-timelines of 80 (first on day 325 median, 313 to 334) against none; items a median 1,493 against 1,518. Both verdicts were computed locally from the runs' seed artifacts (`THREE_YEARS_SWEEP_SAMPLES`), as their `sweep-verdict` jobs sat queued on GitHub for hours after every seed job had finished.
- **The annual instrument** at aeacc0b3 (run 46073536524): pooled median 13, worst 8.5, second-worst 9.38, sum of the living 151.5, wildlife-free 9, extinct 0; verdict pass (computed locally from its shift artifacts, `WILDLIFE_SAMPLES`, for the same reason).
- **The crafter eats the statues** (`fun-features.md`): decided **keep**. The stone stays as scarce as it was, so the crafter still takes each stone before a statue's three gather; but the crafter now gives masterworks for it, so it is a builder's choice, and its levers are suspending the crafter or digging more.
- **Spec edits:** `workshops-and-recipes.md` (the `craft_stone` row, and a paragraph under Craftsdwarf), `skills-and-professions.md` § Skill levels, 12 § Quality, `balance.md` § Wealth curve (Year 3), `fun-features.md`.

## Done

- [x] A decision with its measurement; `balance.md` § Wealth curve agrees with it.
