# T-NEW — Why three-years-p4-4's plant job cannot walk its seed to the plot

**Source:** [T-487](T-487-failed-fetch-walk-never-retried.md) (its one probe run of `three-years-p4-4`) · **Size:** M · **Needs:** T-487 · **Status:** open

T-487 found that job 4988 (`plant:74899`, the surface plot tile 19, 24, 32) in `three-years-p4-4` is not stopped by a failed fetch walk. A probe that wrapped `JobBoard.unclaim` and logged every fetch walk that failed while the labels joined the worker to the item logged none in the whole run to day 251, yet the job was blocked `unreachable` with `failedWalk` at tick 301,200 exactly as before (same job id, same tick: the T-487 fetch change did not move the timeline). The walk that failed is therefore the delivery walk: the job is `fetching` while the worker carries the seed to the plot, and a plant job's delivery tile is the plot tile itself (`workTile` `at`). The pathfinder found no route to it although the connectivity labels joined the worker to it, and all 28 workers with the labor had a reachable stand tile.

T-487 makes such a job retry after `FAILED_WALK_RETRY_TICKS` when no trigger comes, so it is no longer lost: with it, `three-years-p4-4` plays its three years without the finding. It does not say why the route failed. Candidates, none checked:

- the labels do not see forbidden traffic, and the pathfinder does (the script forbids workshop corners while it builds them);
- a `lock_on_alert` gate door whose lock depends on the tick and on its doorway (`doorLocked` during an alert's grace), so that the pathfinder and the labels disagree for a while;
- `PATH_NODE_LIMIT` (`too_far`) on the way from the halls at z 26 up to the surface;
- more than `REPATH_LIMIT` blocked steps or falls on the way.

## Decisions

- Probe `three-years-p4-4` once, logging at each unreachable unclaim of job 4988: the walk's path failure reason (`unreachable` or `too_far`), the forbidden and burning tiles and locked doors on the straight way, and the door modes and alert. Fix the cause if it is a game fault; if the route really is too long, say so in 22.

## Done

- The cause is named in a report, and fixed or filed.
- `three-years-p4-4` still plays its three years without the finding.
