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
