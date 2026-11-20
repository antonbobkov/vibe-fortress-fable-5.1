# T-660 — The smith's steel jobs are fetched again and again

**Source:** [T-655's measurement](../../reports/data/2026-11-20-t655-furnace-jobs-fetch.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

The smith works both the forge and the second smelter (T-642). T-655's probe found its `alloy_steel` jobs at the second smelter claimed only once in 0 to 7 of every 10 to 18 jobs and making 8 to 13 trips each against the recipe's four inputs: the job is interrupted (a need, the forge's job, an alert) and its undelivered inputs, released after `RESERVE_KEEP_TICKS`, are reserved and fetched again at the next claim. In `three-years-p4-6` at shift 50 the second smelter's job stood fetching at 17 to 21% of the samples and working at 1.3 to 2%; the first smelter's steel jobs, by a worker of its own, made 4.4 to 6.6 trips.

## What to do

Journal the smith's steel jobs at the second smelter: why each is interrupted (need, alert, the forge, the hold timeout), what is delivered and what is let go, and where the worker goes between. Decide whether the rule (11 § Job steps: interruptions and `RESERVE_KEEP_TICKS`; 11 § Assignment: a worker assigned to two workshops) or the three-year script (who works the second smelter) is what to change, and change it.

Spec: 11 § Job steps, § Assignment; 12 § Operation; testing-strategy.md § The long scenarios.

## Done

The second smelter's trips per steel job, its claims per job and the smith's work share before and after; the sweep's steel ledger and verdict if anything changes.

- [x] **Journal** ([report](../../reports/data/2026-11-20-t659-t660-steel-trips.md), `test/perf/t660_smith_steel_probe.test.ts`): T-655's 8–13 "trips" were reservations; the smith walked 5.0–5.5 a steel job. 65 of 72 interruptions (`p2-1`) were rest at its critical mark during the long fetch, none the forge or an alert; half came with an input in hand, dropped and fetched again; the reservations lapsed while he slept (51 of 72) and he came back to the same job 57 times of 72, the forge 12. The first smelter's own worker shows the same: the rule, not the script, was what to change.
- [x] **Rule** (11 § Job steps, interruptions; `algorithms/jobs-and-hauling.md`): a critical need lets a worker carrying an input to a building deliver it first. A want served between trips was tried and reverted (it halved the steel jobs done). `test/unit/jobs/t660-deliver-before-need.test.ts`. On the way: the defence script now gives a labor taken off the squad to the founding farmer last (`defence_year` starved when he dug instead of planting).
- [x] **Before and after** (second smelter's steel, master → both tasks): trips 5.0 → 4.0 (`p4-6`) and 5.5 → 3.4 (`p2-1`), claims 3.4 → 3.4 and 3.7 → 2.9, inputs dropped 7 → 0 and 41 → 0; the smith's share there working / walking / carrying 0.8 / 5.8 / 3.1 → 0.5 / 3.1 / 1.8 and 2.5 / 14.4 / 9.2 → 2.4 / 9.2 / 6.0.
- [x] **Sweep**: measure.yml run 44811760127 on `4e99d2c1` (master `d0c00542` merged): Pooled 19.5 | 7 | 0 | 1095 | 126.75 | 1.25 | 13.25; **Verdict: pass**, all 80 seed jobs green (master 44780191075: 1081.25 / 123.75; T-656 44796007697: 1099 / 110.75). Steel ledger, master → this: steel smelted 25.3 → 28.0 a timeline, five kits 12 → 12, coal smelts 50.5 → 58.6, under five iron bars 24 → 38. The peril-2 rise is two timelines: a fire with no drink left (`p2-1` at 100) and a farm that did not grow with 48 dwarves (`p2-4` at 0, T-664's ground).
