# T-573 — A plant job keeps a worker who has fallen unconscious

**Source:** T-571's sweep of the dormitories, shifts 200 to 350 (Measure run 43769154757, branch `t571-growth-slowdown`) · **Size:** S · **Needs:** — · **Status:** open

## What was seen

`three-years-p2-4` at shift 200 broke the T-176 invariant `job.worker-unconscious (plant)` at tick 277200 (year 3, peril 2). The message was "job 6739 plant state fetching worker 150995535 unconscious". A `plant` job in its `fetching` state still named a worker whose body was unconscious. Every other invariant held. The timeline is new: T-571's dormitories moved it. The rule the invariant checks is 11's, and it is older than T-571: a job whose worker goes down is released.

## What to do

Find the path where a fetching job's worker loses consciousness and the job keeps them. Likely a blow or a faint while carrying a seed to the plot, and the farming (07) side of release. Fix it with a unit test that knocks out a worker mid-fetch on a plant job. Replay the seed and shift first: `THREE_YEARS_SHIFT=200`, seed `three-years-p2-4`, on `t571-growth-slowdown` or master after T-571.

## Done

The job releases its unconscious worker on every path. The test covers the fetch. `three-years-p2-4` at shift 200 holds its invariants.
