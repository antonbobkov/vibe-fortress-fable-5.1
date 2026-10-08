# T-144 — Talking, sitting and the hearth visit take a quarter of the day

**Source:** T-123 and its report, [`../../reports/audits/2026-10-08-economy-at-default-priority.md`](../../reports/audits/2026-10-08-economy-at-default-priority.md) (§ Where the time goes, cause 2) · **Size:** M · **Needs:** T-140 · **Status:** open

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

## What to do

1. Amend `10` §§ Eating and drinking; Social, comfort, joy; Behavior selection. Amend `creature-brains.md`.
2. Implement in `dwarves/activities.ts` and `brain.ts`.
3. Scenario: seven dwarves, a hall with tables and a hearth, food and drink beside it, no job at priority ≤ 2. Over 10 days each dwarf's social, comfort and joy are under their want threshold at least 70% of the time, and no `social`, `comfort` or `joy` errand starts while a job is open for that dwarf.
4. Re-measure the three-year run and write a dated report.

## Done

- The scenario passes, with `describe('T-144 …')`.
- The re-measure is filed and `balance-status.md` updated.
