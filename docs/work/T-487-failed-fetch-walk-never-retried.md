# T-487 — A plant job whose fetch walk failed is never retried, with every worker able to reach it

**Source:** [hexers measured](../../reports/audits/2026-11-04-t479-hexers.md) § The invariant in three-years-p4-4 · **Size:** M · **Needs:** — · **Status:** open

With hexers, `three-years-p4-4` (the twenty-seed file, peril 4) stops on day 251 on the T-176 invariant `job.unreachable-with-path`: job 4988, `plant:74899`, a surface plot tile (19, 24, 32), blocked `unreachable` with `failedWalk` for more than a day. Traced with the T-479 sweep probe (`reports/data/2026-11-02-t479-hexer-sweep.probe.ts.txt`, `T479_JOB=4988 T479_AT=299900`):

- tick 299,900: the job is `fetching` (claimed at 299,814), its seed input reserved, the alert `calm`, no party on the map (only cavern monsters, below z 22);
- tick 300,300 and 300,700: `blocked`, `unreachable`, `failedWalk: true`, nothing reserved, and all 28 workers with the labor have a reachable stand tile (`board.hasReachableStand`).

`JobBoard.unclaim` sets `failedWalk` when a walk ends `unreachable` while the labels still join the worker to the tile it walked to, and `retryBlocked` skips such a job until a reachability trigger clears it. Here no trigger came. The walk that failed was the fetch (the seed), not the walk to the plot. The same class was filed before for patient jobs (`balance-status.md`, survival at peril 4). Hexers do not cause it: they change which day each fight falls on, and this timeline reaches the state.

## Decisions

- Find why the fetch walk ended `unreachable` with the labels joined (a crowd, a door, an item on a tile a walker cannot stand on), and make a failed fetch walk retry on the timer, or on the next change that can open the way, so a job with a reachable stand tile is never lost.

## Done

- A stepped test reproduces a fetch walk that fails with the labels joined and shows the job reopened.
- `three-years-p4-4` with hexers plays its three years without the finding.
