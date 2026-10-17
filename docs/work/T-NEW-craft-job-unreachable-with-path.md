# T-NEW — A workshop craft job stays blocked as unreachable for over a day while a worker reaches its work tile (peril-2 sweep seeds)

**Source:** the peril-2/4 sweep of 2026-10-17 at `3b75d98`, [data](../../reports/data/2026-10-17-t381-peril-2-4-sweep.json); the invariant is `job.unreachable-with-path` (T-331 check 2) · **Size:** M · **Needs:** — · **Status:** open

## Why

Two seeds stop on it, each in year 3 with a living fortress:

| Seed | Tick (day) | Job | Blocked for | Work tile | Workshop |
|---|---|---|---|---|---|
| `three-years-p2-1` | 344,400 (288) | 11934 `craft` | 1,917 ticks, `failedWalk` | 74,389 = (37, 13, 32) | 251659447 |
| `three-years-p2-7` | 334,800 (280) | 18359 `craft` | 2,234 ticks, `failedWalk` | 74,522 = (26, 16, 32) | 117440787 |

A craft job whose walk failed once is not reopened although a worker with its labor reaches a stand tile, so the workshop's order stops. Both work tiles are surface workshops. One possible cause, not checked: the walk failed while a gate door was locked under a hearth alert, and no retry came after the door opened.

## What to do

1. Diagnosis first: rerun the seed alone (`-t "p2-1'"`, about 23 minutes) with a probe that, from 3,000 ticks before the finding, logs the job (state, `blockedReason`, `failedWalk`, its retry tick), the workshop's assigned worker and where that worker stands, the alert, the gate doors' lock, and the connectivity labels of the work tile and of the workers with the labor.
2. Name the cause: a retry that is never scheduled after a failed walk (11), a block that connectivity rebuilds do not clear (22), a workshop worker assignment that excludes every reachable worker (12), or the checker counting a worker who cannot take the job.
3. A game fault: a failing stepped test first, the fix, the spec section. A checker fault: fix the checker with a unit test, and say why in testing-strategy.md.

## Done

- `p2-1` and `p2-7` pass their daily checks past the ticks above, or this file records why the block is legitimate.
