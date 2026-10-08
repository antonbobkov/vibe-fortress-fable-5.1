# T-125 — Peril 4's first ambush and raid can come on day 28; the balance document says day 56

**Source:** F-17 re-measure, [`../../../reports/audits/2026-10-07-balance-after-f17.md`](../../../reports/audits/2026-10-07-balance-after-f17.md) § Remaining findings (MODEL GAP) · **Size:** S · **Needs:** — · **Status:** open

## What is wrong

In `src/content/threatSchedules.json` the peril-4 rows for `ambush` and `raid` have `earliest.year = 1, season = 1`. Seasons are counted from 0, so that is the start of summer, elapsed day 28. [`../../03-content/balance.md`](../../03-content/balance.md) gives day 56 as the first raid window, and F-17h planned the squad's first kit against day 56.

## Decision

`balance.md` is the rule: the first peril-4 ambush or raid is not before day 56. A fortress cannot smelt and forge three kits in 28 days, so day 28 leaves no play that survives.

## What to do

1. Confirm the reading: find where the schedule's `earliest` is turned into a tick, and check which day `season = 1` gives.
2. Change `earliest.season` to 2 in both peril-4 rows, in the content source that `src/content/threatSchedules.json` is exported from, and regenerate.
3. Check the other peril rows against `balance.md`'s table in the same way, and list any other disagreement in the commit body.
4. Add a content test: no schedule row's earliest day is before the day `balance.md` gives for its peril.

## Done

- The peril-4 rows give day 56, and the test holds.
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green. Golden files that move are named in the commit body.
