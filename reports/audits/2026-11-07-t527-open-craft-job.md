# Measurement: why the carpenter's open job waited two months, and a workshop rule for it

**Task:** T-527 · **Date:** 2026-11-07 · **Commits examined:** master after T-522 and T-526 (`7b4e9e8d`); the T-527 branch at `ef795ffa` (the rule) merged with master (`ae82c7e3`, `249eed9a`) · **Kind:** a fault found by a journal, a game rule fixed · **Source:** [the T-527 work file](../../docs/work/T-527-open-craft-job-no-worker.md), [T-522's report](2026-11-07-t522-defence-repel-rate.md)

## The answer

- **No filter, reservation, input search, labor or skill check stops the job.** On `defence-year` at cadence 20 the carpenter's `make_bed` job (job 1923, priority 5) is eligible for all four carpenters on every look from day 57: labor on, label joined to the work tile, one log needed and 152 in stock, no tool.
- **The carpenters were not idle; they were busy with more urgent work.** In days 57 to 62 they asked the board for work 35 times and took a job of effective priority 4 or better each time: 13 crafts at other workshops (3 of them priority 3), 7 harvests, 5 plantings, 5 builds, 3 mechanism links and 2 lever pulls, out of 465 to 499 open jobs each could take. The board's priority is strict and nothing ages, so a priority-5 job waits as long as a priority-4 job is open to its workers; in this fortress (the food chain's labors one step up, the defence orders at 4) that is always. T-522's journal looked once every ten days and saw "no job" between two jobs.
- **The fault is the workshop's one job.** The bed job was made on day 57 while the cage order at the head of the list was stocked. When the cage trap caught a raider the cage order became runnable, but the workshop held the untaken bed job, so the cage order waited behind an order the player put after it. A priority inversion: one less urgent job holds a workshop from its most urgent order.
- **Fix (12 § Operation, step 1).** Every `ORDER_AHEAD_TICKS` (100) after its creation, a workshop's current job that no worker holds, with no progress and nothing delivered, is cancelled (`order_ahead`) when an order ahead of its own is runnable; the workshop then starts the first runnable order. A job a worker holds, or one with progress or delivered inputs, keeps its place. 11 § Assignment now says that priority is strict and that a less urgent job waits, open and unblocked, while more urgent work is open.
- **Result.** `defence_seeds` 5.63 → **6.25** (cadence 20: 4 → 8 of 8); the sweep, the instrument and `ci.yml` pass. On the two seeds of T-522's losses, cadence 20: `defence-year` makes a cage on day 80 after the day-75 catch, and its raid of day 116 is `repelled` with the captain caged (on master it looted with its captain killed); `defence-year-7` makes a cage on day 87 after the day-74 catch, and its raid of day 122 is `repelled` (on master it looted, captain left).

## The journal

[Journal before](../data/2026-11-07-t527-journal-defence-year-20-before.txt) from [the probe](../data/2026-11-07-t527-journal.probe.ts.txt): every 500 ticks the carpenter's current job and, for each carpenter, its behaviour, its job, `hasWork`, `hasUrgent`, the board's own eligibility and the stand-tile check; and, for each assignment a carpenter asks for while the job is open, the job it got against the bed job (effective priority, distance, skill). A typical line:

`d58 t69251 ASSIGN 16777786 at 39,9,26 got craft#1941 p4 d42 s0 bed craft#1923 p5 d57 s0 elig true nOpen 492`

After: [`defence-year`](../data/2026-11-07-t527-raid-defence-year-20-after.txt) and [`defence-year-7`](../data/2026-11-07-t527-raid-defence-year-7-20-after.txt) at cadence 20 from [the raid probe](../data/2026-11-07-t527-raid.probe.ts.txt): cages crafted, catches, raids and every `order_ahead` cancel.

## Measured on GitHub

All four on `ae82c7e3` (the rule merged with master and T-522's commits; the later merge of master changes documents only).

| | Before | T-527 | Verdict |
|---|---|---|---|
| `defence_seeds`, seeds of 8 turning every raid back, mean of cadences 20 to 55 | 5.63 (4, 6, 6, 5, 6, 5, 6, 7; T-522 on master, run 42421159823) | **6.25** (8, 6, 6, 5, 8, 5, 6, 6) | pass (≥ 5); run 42429601762, [verdict](../data/2026-11-07-t527-defence-seeds.md) |
| `defence_seeds`, a soldier killed, mean | 7.50 | 7.13 | pass (≥ 4) |
| Sweep, pooled living at year 3 | 948.5 (reference); 943.5 (T-522, run 42421166022) | **983.75** | pass (≥ 848.5); run 42429599670, [verdict](../data/2026-11-07-t527-sweep-verdict.md) |
| Sweep, pooled deaths | 125.25 (reference); 130.75 (T-522) | 136 | pass (≤ 155.25) |
| Sweep, extinct; alive at year 1; peril-0 grown | 0.25; 20; 7 | 0; 20; 7 | pass |
| Instrument, pooled median; living; wildlife-free | 12.63; 143; 6.63 (reference) | 12.56; 146.38; 7.38 | pass, nothing worsened together; run 42429603810, [verdict](../data/2026-11-07-t527-instrument-verdict.md) |
| `ci.yml` | | 3,623 tests in four shards (935 + 962 + 842 + 884), e2e 39 | pass; run 42429605690 |

At cadence 20, the cadence of T-522's losses, 4 of 8 seeds turned their raid back before and all 8 do now. One seed job of the sweep failed on its own invariant, `three-years-p2-4` at shift 0: `dwarf.retreat-without-hearth-alert` at tick 403,200, the run's last tick (reproduced locally). The alert went up at 402,660 and came down on that tick; 16 lowers the alert after 10 has stepped the dwarves, so a sheltering dwarf is still in `retreat` at the end of the tick the alert falls, and the invariant, sampled once a day and at the end, saw that one tick. A one-tick lag the daily sample lands on by chance, not this rule's fault; the verdict counts the seed's figures and passes. Worth a small task: let the invariant pass the tick the alert falls, or have 10 drop `retreat` in the same tick.

## What this does not change

- A less urgent job still waits behind more urgent work: the player raises its order's priority or its labor's. Only the workshop's slot is freed for the orders ahead of it.
- The mechanic's `make_mechanism` job on `defence-year-7` (T-522's branch) that waited with no mechanics worker was not reproduced on today's timeline and not looked into.

## Reproduce

- Test: `npx vitest run test/unit/workshops/t527-unclaimed-job-gives-way.test.ts` (fails before the rule: no `order_ahead` cancel and no cage).
- Journal: copy the probe to `test/perf/`, `T527_SEED=defence-year T527_TICKS=74400 npx vitest run -c vitest.perf.config.ts test/perf/<file>` (about a minute); it writes `.vite/t527-<seed>-<cadence>.txt`.
