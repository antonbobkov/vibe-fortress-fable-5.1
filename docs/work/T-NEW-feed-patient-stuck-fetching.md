# T-NEW — A feed_patient job stands in its fetching state for three days

**Source:** T-572's sweep (Measure run 43809709655, branch `t572-beds-narrow-band`, commit `424378bc`), seed `three-years-p2-5` at shift 100 · **Size:** S · **Needs:** — · **Status:** open

## What was seen

The seed's job failed two T-176 invariants. The sweep's verdict passed; each seed's own invariants fail only its job.

- `dwarf.frozen-2d (work/Feed patient)` from tick 339600: dwarf 50331847 at (38,21,33), behaviour `work`, job 9361, target tile 63300, unchanged since tick 336997. Its needs were hunger 83.6, thirst 100, rest 100, social 100, comfort 87, purpose 0, joy 100.
- `job.stuck-active-3d (feed_patient/fetching)` from tick 340800: job 9361 `feed_patient`, `fetching`, worker 50331847, unchanged since tick 336997.

The worker kept the job while its own thirst and rest stood at 100. Either it never walked, or the fetch has no reachable food and the job never gives up. This is year 3 at peril 2. T-572 changed only beds and the script's bed orders, so it moved the timeline but did not touch 17's care jobs. It looks like the same class as T-573 (a job that keeps a worker it should release), on a different job.

## What to do

Replay `three-years-p2-5` at `THREE_YEARS_SHIFT=100` on master after T-572. Find why job 9361 stays in `fetching` with the same worker and target for three days, and why the worker's critical needs do not interrupt it (10 § Behavior selection: a critical need interrupts any job). Fix it in 11 or 17 with a unit test that reproduces the stuck fetch.

## Done

A `feed_patient` job either reaches its food or is released on every path. The worker's critical needs interrupt it. The seed and shift hold their invariants.
