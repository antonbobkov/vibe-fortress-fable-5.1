# T-388 — A doorway that stays crowded sends workers on a retry loop

**Closed:** 2026-10-18, in 8ad4d9f.

**Source:** the review of T-385 (2026-10-18) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-385 blocks a job without `failedWalk` when its worker's walk gave up on creatures, so the periodic retry reopens it. A doorway held for good (a soldier stationed in it, which T-343 lets keep the door unlocked; two dwarves parked there; a hostile in a corridor) now gives a loop for every job behind it: reopened about every `BLOCKED_RETRY_TICKS`, a worker walks to the door, waits `REPATH_LIMIT` x `REPATH_WAIT_TICKS`, unclaims, blocked again. Bounded by `BLOCKED_RETRIES_PER_TICK`, so no storm, but each loop costs a worker the walk and the wait.

## What to do

Remember the crowded tile in `job.data` and let the retry reopen the job only when no creature stands on it (or back off by doubling the retry interval per crowded block); decide, write it in 11 § Blocked jobs, and test a doorway that stays blocked with several jobs behind it and a hostile in a corridor. Also measure T-384's per-tick `hospitalHasSlot` cost on the reference fortress with its items loose (the review's performance nit) and cache per item kind if it shows.

## Done

- No loop while the doorway stays crowded; the job reopens when it clears; gates as for a simulation change.
