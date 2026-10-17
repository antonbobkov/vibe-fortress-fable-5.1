# T-356 — A job is held for over a day, with no progress, by a worker in `retreat` or `need`

**Source:** the T-331 review run of `test/perf/three_years_seeds.test.ts` (peril 2 and 4), 2026-10-16; the invariant is `holder.job-held-while-elsewhere` (T-331 check 1: a job held for over a day, with no progress and no step of its worker, by a worker whose brain is not `work`) · **Size:** M · **Needs:** — · **Status:** open

## Why

The sweep, in the order of its seeds, reports:

| Seed | Tick | Job | Worker | Behavior | Held for |
|---|---|---|---|---|---|
| `three-years-p2-3` | 285,600 (day 238, year 3) | 4914 | 50331892 | `retreat` | 2,200 ticks |
| `three-years-p2-6` | 87,600 (day 73, year 1) | 1921 | 16777285 | `retreat` | 1,400 ticks |
| `three-years-p4-4` | 151,200 (day 126, year 2) | 2516 | 520094281 | `need` | 1,500 ticks |

The brain moves a worker to flee, retreat, patient or a critical need without giving back a job that cannot be interrupted, and the job resumes (`brain.ts`); that is by design for minutes, not for more than a day. A held job blocks the work for everybody else (it has a worker), so a worker stuck in retreat or need for a day takes its job out of the fortress's work for as long.

The three do not reproduce in a standalone run of the same seed with the same script (two runs of `p2-6` and `p4-4` to the tick find nothing), only in the sweep's order of seeds in one process (the seeds before them ran in it), which is a second finding: two runs of one seed in one process and in a fresh one do not agree. The trace is therefore to be taken in the sweep: `npx vitest run -c vitest.perf.config.ts test/perf/three_years_seeds.test.ts -t "p2-[56]'"`, logging the worker every 100 ticks from 3,000 ticks before the finding.

## What to do

**Decisions.**
- A worker that retreats or satisfies a need while it holds a job that cannot be interrupted gives the job back to the board once the absence has lasted `JOB_HOLD_TICKS` (a tuning constant of 11, unmeasured; one day is the checker's bound). The job keeps its progress, as an interrupted job does.

1. Reproduce in the sweep order and trace the three workers: where each stands, what its alert or need is, why the retreat or the need does not end.
2. If it is a stuck retreat or need, that is the fault to fix (then drop the decision above); if the absence is legitimate, add the release and its constant to 11 § Interruption and 10 § Behavior selection.
3. Find why a single seed differs between a fresh process and the sweep's order, and file it if it is a fault of the harness or of a cache.

## Done

- The sweep seeds above no longer report `holder.job-held-while-elsewhere`, or the work file says which check is wrong.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
