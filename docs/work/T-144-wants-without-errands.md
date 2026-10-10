# T-144 — Talking, sitting and the hearth visit take a quarter of the day

**Source:** T-123 and its report, [`../../reports/audits/2026-10-08-economy-at-default-priority.md`](../../reports/audits/2026-10-08-economy-at-default-priority.md) (§ Where the time goes, cause 2) · **Size:** M · **Needs:** — · **Status:** open

## Why

At default priorities a dwarf takes 1.8 errands a day for social, comfort and joy. They cost 13.4% of all its time in use and 12.2% on the way. That is more than the 20.6% it works. Each of the three is its own trip, taken before work whenever the dwarf is between jobs (`10` § Behavior selection step 6; `creature-brains.md` `select`; `src/systems/dwarves/brain.ts:244–247`).

With urgent jobs the three are never served. They are above their want threshold 91 to 99% of the time, and mood is 36. So the game offers "all three, each as a trip" or "none".

A crude scratch test changed little: 5,449 marks against 4,925, mood unchanged. It skipped the three while work was available unless the need was at 90, and let a meal at a table relieve them. The three needs sat above 90 most of the time, so the errands still ran. It is not evidence against the idea.

## Decision

- **A meal at a table in a hall is also a sit.** It relieves comfort as a sit in that room would.
- **Time in the hearth hall is a hearth visit.** Eating, drinking or sitting there for `HEARTH_VISIT_TICKS` relieves joy once.
- **A talk needs no trip.** Two awake dwarves within 2 tiles of each other, neither walking, talk if either's social need is over its want threshold. `TALK_TICKS` and the relief are as now. Eating at the same table counts.
- **Step 6 serves hunger, thirst and rest. Social, comfort and joy are served at step 8**, when the dwarf has no work, and in passing as above.

Do this after T-140 and measure first. If the work share at default priorities is already 35% and mood is in the 55–60 band, do only the three "in passing" rules and leave the order of the steps alone.

**Measured after T-140** ([the walking-speed report](../../reports/audits/2026-10-09-walking-speed.md)): with every creature walking 1.5 times as fast, mood is 57.6 and the work share is 22.7% in year 1. The three wants take 27.4% of the time (14.1% in use, 13.3% on the way). So all four rules apply, the order of the steps included.

## What to do

1. Amend `10` §§ Eating and drinking; Social, comfort, joy; Behavior selection. Amend `creature-brains.md`.
2. Implement in `dwarves/activities.ts` and `brain.ts`.
3. Scenario: seven dwarves, a hall with tables and a hearth, food and drink beside it, no job at priority ≤ 2. Over 10 days each dwarf's social, comfort and joy are under their want threshold at least 70% of the time, and no `social`, `comfort` or `joy` errand starts while a job is open for that dwarf.
4. Re-measure the three-year run and write a dated report.

## Done

- The scenario passes, with `describe('T-144 …')`.
- The re-measure is filed and `balance-status.md` updated.

## Outcome

Done on branch `t-144` (commits `e1416e1`, `3744789`, `27e2dd7`) and landed on `cloud/T-144`.

- **All four rules, the step order included,** as decided above. Talks in passing are found through the spatial index every `TALK_CHECK_TICKS` (10), not by comparing every pair of dwarves each tick; the cost of system 10 stayed within its tolerance. Talks in passing and the hearth-hall tick counts are saved, and omitted from the save when empty.
- **The re-measure** ([`2026-10-10-wants-without-errands.md`](../../reports/audits/2026-10-10-wants-without-errands.md)) found the work share at 30.5% and mood at 49.9: the three wants were under-served with work always open. That became T-197, which restored mood without giving back the work share.
- **Fixtures, as the branch left them.** `year_one`: the player orders one barrel when the still is built (T-199 removes that order if it lets a brew empty a barrel). `hospital_run`: seed `hospital-run-4`, measured as the one roll of its staged fight that wounds two soldiers who live; no assertion changed (T-156 is to make it independent of the roll). `descent`: back to master's file.

### Decisions made while landing it (cloud agent, 2026-10-10)

- **`year_one` meets wild animals again.** Its `surfaceWildlife: 'none'` was a stopgap naming T-196. With T-196 on `cloud/main`, the fixture passes with natural arrivals (21 rabbits, 6 deer, 3 badgers, 2 foxes in the year; no dwarf died). No other fixture names T-196 as the reason for running without wildlife: the flat single-rule scenarios that use the option (`hospital_run`, `an_breed`, `an_pasture`, `t195_train_needs`, `fo_*`) had it from T-192 or for their own isolation, as `testing-strategy.md` allows.
- **`homestead_year` waits for its first birth.** The WIP commit `f952eab` let the world step on, with no new command, after the forty days until the first `AnimalBorn`. Kept, because conception is a daily roll and a fixed end day made the assertion depend on one random sequence (T-186 and T-144 both tripped it); every other assertion is still read at day 40, so nothing else was loosened. Finished: the limit (two gestations and ten days) reads the dog's gestation from the content instead of a literal 20; the birth is stamped by an event subscriber; `testing-strategy.md` and `acceptance-tests.md` say what the scenario now does. The first birth comes on day 42.
- **The landing re-measure** is a new report, [`2026-10-10-wants-without-errands-after-t196.md`](../../reports/audits/2026-10-10-wants-without-errands-after-t196.md); the earlier one is not edited.
