# T-370 — The held-job release: spec wording, the away flicker, a longer world-order guard

**Source:** the review of T-356 (2026-10-17) · **Size:** S · **Needs:** — · **Status:** open

## What to do

- 10 and 11 describe the release for jobs "that are not interruptible"; the code releases any job held while its worker is away. Reword: "a job held while its worker is away (in practice one that is not interruptible)".
- A worker whose behaviour reads `work` for one think between two absences restarts `awaySince`, so a worker bouncing in and out can hold a job past `JOB_HOLD_TICKS`. Decide whether a short return should keep the timer (e.g. clear `awaySince` only after the worker has worked for some ticks), and test it.
- The world-order guard test (T-356) compares hashes over 2 days only. Extend it past the first season turn and the first caravan (day 34 or so), or say its limit in its comment.
- T-331's held-job invariant fires after `TICKS_PER_DAY`; tie it to `JOB_HOLD_TICKS` (held while away longer than that is a fault) so the two rules cannot drift apart.

## Done

- The four points are done or decided here; gates as for a simulation change.
