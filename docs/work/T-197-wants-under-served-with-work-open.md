# T-197 — Social, comfort and joy are under-served when work is always open

**Source:** T-144 and its report, [`../../reports/audits/2026-10-10-wants-without-errands.md`](../../reports/audits/2026-10-10-wants-without-errands.md) (§§ What the three wants cost now; Recommended next step) · **Size:** M · **Needs:** T-144 · **Status:** open (needs the owner's decision)

## Why

After T-144 a dwarf takes an errand for social, comfort or joy only when it has no work. In the rewritten three-year fixture at default priorities each of the three is over its want threshold about 66% of the time (27% to 39% before), and the daily mood mean is 49.9 (57.7 before; the model is 55–60). The work share rose from 22.7% to 30.5%.

Passing relief cannot cover the needs table. Comfort asks for 0.6 sits a day and a dwarf eats 0.33 meals a day at a table. Joy asks for 0.6 hearth visits a day and meals in the hall add up to about 0.2. Social asks for 1.2 talks a day and gets 0.38.

## Proposal, not yet decided

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
