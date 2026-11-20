# T-660 — The smith's steel jobs are fetched again and again

**Source:** [T-655's measurement](../../reports/data/2026-11-20-t655-furnace-jobs-fetch.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

The smith works both the forge and the second smelter (T-642). T-655's probe found its `alloy_steel` jobs at the second smelter claimed only once in 0 to 7 of every 10 to 18 jobs and making 8 to 13 trips each against the recipe's four inputs: the job is interrupted (a need, the forge's job, an alert) and its undelivered inputs, released after `RESERVE_KEEP_TICKS`, are reserved and fetched again at the next claim. In `three-years-p4-6` at shift 50 the second smelter's job stood fetching at 17 to 21% of the samples and working at 1.3 to 2%; the first smelter's steel jobs, by a worker of its own, made 4.4 to 6.6 trips.

## What to do

Journal the smith's steel jobs at the second smelter: why each is interrupted (need, alert, the forge, the hold timeout), what is delivered and what is let go, and where the worker goes between. Decide whether the rule (11 § Job steps: interruptions and `RESERVE_KEEP_TICKS`; 11 § Assignment: a worker assigned to two workshops) or the three-year script (who works the second smelter) is what to change, and change it.

Spec: 11 § Job steps, § Assignment; 12 § Operation; testing-strategy.md § The long scenarios.

## Done

The second smelter's trips per steel job, its claims per job and the smith's work share before and after; the sweep's steel ledger and verdict if anything changes.
