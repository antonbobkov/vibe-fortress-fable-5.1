# T-NEW — A job unclaimed for a worker with no tile is remembered as a failed walk

**Source:** [T-530](T-530-walks-the-labels-join.md) (its probe after the fix, [the log](../../reports/data/2026-11-09-t530-walks.probe-log.txt)) · **Size:** S · **Needs:** T-530 · **Status:** open

## Why

After T-530, the probe of 16 seeds at the four sweep shifts counts no failed walk between places the labels join, except two records of another kind: in `three-years-p4-1` at shift 50, day 254, two `craft` jobs held `travelling` were unclaimed `unreachable` while their worker had no `Position` (no walk was tried that tick). `unclaimNoStand` passes a stand tile, and `labelsApart` answers false for a worker with no tile, so each job took the failed-walk memory and waited `FAILED_WALK_RETRY_TICKS` instead of the periodic retry. Which state leaves a worker with a job and no tile (a cage trap removes a caught creature's `Position`, 19) was not checked.

## What to do

Find what took the worker's tile while it held the job; decide whether a worker with no tile should keep a job at all, and whether such an unclaim is a failed walk (it is not one between connected labels). Write it into 11.

## Done

- The probe counts no failed walk for a worker with no tile, or a dated report says why one remains.
