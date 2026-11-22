# T-687 — A planting job keeps a seed item that no longer exists

**Source:** [T-662's measurement](../../reports/data/2026-11-22-t662-sweep-noise.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

In T-662's sweep of master `f83df33f` (Measure run 45005782771), `three-years-p4-4` at shift 200 failed its invariant check: `job.delivered-item-missing (plant) from tick 321600: t321600: job 5550 plant state open delivered 50332672, not a living item`. A planting job still open lists as delivered a seed item that is gone, so the job can never finish and the plot's tile stays unplanted. The other 159 seed jobs of the eight shifts had no invariant finding. Recent merges touch how stacks join (T-682: an item with no home is offered again when a stack it could join arrives), so a delivered seed merged into another stack, or eaten or hauled, is a likely cause.

## What to do

Reproduce it: `THREE_YEARS_SHIFT=200` on `three-years-p4-4` (the seed job of `measure.yml`'s sweep), stopping near tick 321,600, and find what destroyed item 50332672 while job 5550 held it. Then fix the rule: a job's delivered item that leaves the world (merged, eaten, destroyed) either cancels the job or is replaced, the way the other jobs' delivered items are kept (`test/scenarios/invariants.ts`, `job.delivered-item-missing`). A unit test of the path found.

## Done

The seed's job at shift 200 passes its invariants, and a unit test covers the path.

## Note (orchestrator, 2026-11-22)

The failing sweep ran on master f83df33f (Merge T-680), which predates T-681/T-682 (68834723), so T-682 is not the cause; look at T-676 (loose goods), T-677 (foreign items set aside) and the T-659/T-660 delivery changes first.
