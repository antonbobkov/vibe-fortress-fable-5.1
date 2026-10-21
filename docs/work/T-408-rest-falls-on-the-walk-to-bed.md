# T-408 — Rest falls on the walk to bed

**Source:** T-369, [the sleep measurement](../../reports/audits/2026-10-21-sleep-hours.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

10 § Needs: rest rises 5 an hour awake and falls 15 an hour asleep. The code (`src/systems/dwarves/index.ts`, the hourly need update) counts a dwarf as asleep when its behaviour is `need` and its activity `sleep`, and the activity is `sleep` from the start of the sleep errand, so rest falls at the sleeping rate on the walk to the bed. Measured at `a5cd51c` in the first year of the economy fixture: a dwarf walks 3.9 to 4.7 hours a day to its bed and lies in it 1.7 to 2.3; the walk takes 39 to 45 off its rest; 20% to 29% of sleep errands end the moment the dwarf lies down, with rest already 0. On screen, a dwarf walks to its bed and gets straight up again.

The measured time budget of the game, the 37% work share T-140 asked for, is built on this: if the walk stopped counting and nothing else changed, a dwarf would lie in bed 6 hours a day and walk 3 to 4 more, and the work share would fall by about a fifth of the day.

## Decisions

1. **Rest falls at the sleeping rate only while the dwarf lies asleep** (its rest plan in the `use` phase), as 10 § Needs says. The walk to the bed counts as awake.
2. **The time in bed stays where it is measured.** `REST_ASLEEP_PER_HOUR` becomes −45: at Endurance 50 rest then balances at 24 × 5 / (45 + 5) = 2.4 hours asleep a day, against 1.7 to 2.3 in bed now. The value is confirmed or adjusted (in steps of 5) with the work-share probe of T-140 (`reports/data/2026-10-18-t140-share-probe.ts.txt`): year-1 work share 35% to 39% and the sleep share in use 8% to 11%.
3. `SLEEP_HOURS` stays 7, the longest sleep; it is not reached.
4. `balance.md` § Needs and consumption (the rest row and the sleep sentence) and 10's rest row are restated in the same commit, with the remeasured shares.

## Done

- A unit test pins that a dwarf walking to its bed gains awake rest at the hourly boundary and loses the sleeping rate once in bed.
- The work-share probe and the annual wildlife instrument are run before and after; the share rows of `balance-status.md` are replaced with the new figures in a new dated report.

## Parked, 2026-10-21

The change (rest held on the walk to bed, falling only in bed) is on branch `t408-wip3` (`1432941`, on `c3e76ce`). Decision 1 was amended in it: counting the walk as awake made the walk add tiredness and cut the year-1 work share to 32%; holding rest on the walk keeps the time budget. The figures are in `reports/data/2026-10-21-t408-population-check.json`, all on `c3e76ce`.

- **The change raises the time a dwarf is tired.** The share of dwarf-time with rest at or above its want threshold (the `tired` thought) rises from 18–19% to 31–35% in every seed and at both rates: a dwarf now walks to its bed with the rest it set off with, and stays tired the whole walk, where before its rest fell on the way.
- **Population and mood, three seeds of the economy fixture, 224 days** (population at days 112 / 224, year-1 mood): before `three-years` 14 / 33, 53.7; `p0-2` 12 / 12, 52.1; `p0-3` 16 / 45, 60.5. At −45: 10 / 13, 49.6; 12 / 12, 50.8; 17 / 44, 60.8 (two early deaths in `three-years` and a lower hall spirit miss four waves). At −40: 15 / 34, 57.2; 13 / 16, 55.8; 17 / 57, 61.0, with no death in any seed.
- **The annual instrument** (before, the T-405 row: 13 / 2 / 8 / 140 / 8 / 0 / 0): at −45, 11.5 / 5 / 7 / **139** / 6 / 0 / 0, nobody starving but the sum below the before row and three figures worse together; at −40, 11.5 / 0 / 2 / **122** / 5 / **1** / 0 (forest seed 3 extinct to boars and wolves), the sum bound failing.
- So −45 does not hold the sum and loses population in two seeds of three; −40 holds population but fails the instrument. Neither meets the orchestrator's conditions (hold the sum, nobody starving, population and mood holding), and T-408 stays parked. The four scenario witnesses that failed at −45 (`homestead_year`, `pp_drink`, `pp_pasture`, the T-197 hall errand) were not diagnosed.
- **What would unblock it is a design decision, not a constant:** whether a dwarf walking to its bed counts as tired (a `tired` thought suspended on the sleep errand), or whether rest should go back to falling from the moment a dwarf sets off, as the code did before (the rule 10 would then state). Either is a rule change of 10 and 15 for the owner.
