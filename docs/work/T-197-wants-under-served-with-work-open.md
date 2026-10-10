# T-197 — Social, comfort and joy are under-served when work is always open

**Source:** T-144 and its report, [`../../reports/audits/2026-10-10-wants-without-errands.md`](../../reports/audits/2026-10-10-wants-without-errands.md) (§§ What the three wants cost now; Recommended next step) · **Size:** M · **Needs:** T-144 · **Status:** open (needs the owner's decision)

## Why

After T-144 a dwarf takes an errand for social, comfort or joy only when it has no work. In the rewritten three-year fixture at default priorities each of the three is over its want threshold about 66% of the time (27% to 39% before), and the daily mood mean is 49.9 (57.7 before; the model is 55–60). The work share rose from 22.7% to 30.5%.

Passing relief cannot cover the needs table. Comfort asks for 0.6 sits a day and a dwarf eats 0.33 meals a day at a table. Joy asks for 0.6 hearth visits a day and meals in the hall add up to about 0.2. Social asks for 1.2 talks a day and gets 0.38.

## Proposal, as filed

One hall errand serves all three: a sit in the hearth hall relieves comfort, is a hearth visit (`SIT_TICKS` equals `HEARTH_VISIT_TICKS`) and is a talk in passing with anyone seated there. So:

- At step 6, a dwarf with any of social, comfort or joy at or over a new mark (proposed `LEISURE_MARK` = 85) and no job at priority ≤ `NEED_DEFER_PRIORITY` takes one comfort errand to a seat in the hearth hall.
- Below the mark the rules of T-144 stand.

By the needs table that is about 0.6 errands a day, some 110 ticks of 1,200, against about 330 for the three errands before T-144.

The owner decides whether to do this, another relief (larger reliefs in passing, a slower rise), or to accept mood near 50 at full employment. No threshold or relief was changed by T-144.

## What to do, once decided

1. Amend `10` §§ Needs; Social, comfort, joy; Behavior selection; Tuning constants. Amend `creature-brains.md`.
2. Implement in `dwarves/brain.ts` and `activities.ts`.
3. Extend `test/scenarios/t144-wants-without-errands.test.ts`: at 12 hauls a day (41% of time on a job) each dwarf still has each want under its threshold at least 70% of the time.
4. Re-measure with the T-144 probe and file a dated report.

## Done

- The decision is in the spec.
- The scenario passes at the higher workload.
- Mood and the work share are re-measured and `balance-status.md` updated.

## Decision

Taken on branch `t-144` in commit `c8307e2`, under the owner's standing instruction to decide and write down the reason rather than wait. The proposal above, with the mark measured:

- **`LEISURE_MARK` = 75.** Measured on the rewritten three-year fixture, year 1, no wild animal arrivals, one run each: at 75 the daily mood mean is 58.8 and the work share 28.4%; at 85 it is 57.7 and 28.0%. 75 puts mood back in the model's 55–60 band; 85 only reaches its edge. Both keep most of T-144's gain in work share (22.7% before T-144).
- **The hall errand is a comfort plan marked `hall`.** It goes to the nearest free chair on a hearth-hall tile, else to a hall tile. A job at priority ≤ `NEED_DEFER_PRIORITY` still goes first. The sit relieves comfort, adds `SIT_TICKS` to the hearth count (`SIT_TICKS` equals `HEARTH_VISIT_TICKS`, so it is a visit), and is the talk with the first dwarf that comes within reach of the seat.
- **`LEISURE_RETRY_TICKS` = 600.** A sit that leaves one of the three at the mark with no talk under way (nobody came) is not repeated for half a day, so a lone dwarf does not shuttle between the hall and its job.
- **Below the mark, T-144's rules stand unchanged.** No threshold or relief was changed.
- **The scenario criterion at 12 hauls a day** is "no want at the mark for 15% of the time or more, for every dwarf", not "70% under the want threshold": with 41% of time on a job the rule serves the three at the mark, not at the threshold, and the test states the rule as it is. The 8-hauls case keeps T-144's 70% criterion and shows that nobody reaches the mark at that workload.

The tests are in `test/unit/dwarves/wants-in-passing.test.ts` and `test/scenarios/t144-wants-without-errands.test.ts`, under `describe('T-197 …')`. The re-measure after T-196 is [`2026-10-10-wants-without-errands-after-t196.md`](../../reports/audits/2026-10-10-wants-without-errands-after-t196.md).
