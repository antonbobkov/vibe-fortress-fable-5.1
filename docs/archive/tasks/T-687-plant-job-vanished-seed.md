# T-687 — A planting job keeps a seed item that no longer exists

**Closed:** 2026-11-22, in 36ec1e8f,f5ffd35e.

**Source:** [T-662's measurement](../../../reports/data/2026-11-22-t662-sweep-noise.md) · **Size:** S · **Needs:** — · **Status:** done

## Why

In T-662's sweep of master `f83df33f` (Measure run 45005782771), `three-years-p4-4` at shift 200 failed its invariant check: `job.delivered-item-missing (plant) from tick 321600: t321600: job 5550 plant state open delivered 50332672, not a living item`. A planting job still open lists as delivered a seed item that is gone, so the job can never finish and the plot's tile stays unplanted. The other 159 seed jobs of the eight shifts had no invariant finding. Recent merges touch how stacks join (T-682: an item with no home is offered again when a stack it could join arrives), so a delivered seed merged into another stack, or eaten or hauled, is a likely cause.

## What to do

Reproduce it: `THREE_YEARS_SHIFT=200` on `three-years-p4-4` (the seed job of `measure.yml`'s sweep), stopping near tick 321,600, and find what destroyed item 50332672 while job 5550 held it. Then fix the rule: a job's delivered item that leaves the world (merged, eaten, destroyed) either cancels the job or is replaced, the way the other jobs' delivered items are kept (`test/scenarios/invariants.ts`, `job.delivered-item-missing`). A unit test of the path found.

## Done

The seed's job at shift 200 passes its invariants, and a unit test covers the path.

- [x] **Cause.** Reproduced on `f83df33f` with the sweep's loop: job 5550 (`plant:75035`) was interrupted after its worker had dropped seed stack 50332672 at the plot; at t312,102 the reservation lapsed (`RESERVE_KEEP_TICKS`; only build and workshop inputs keep theirs), which released the seed but left it in the job's `delivered`. At t320,579 haul job 6482 carried the free seed to a stockpile and merged it into stack 16778268; a merge ends the item with no `ItemDestroyed`, so nothing pruned it, and the open job held a dead id from the next daily check (t321,600). Not T-676/T-677/T-659/T-660: the lapse has always kept `delivered`; only a merge made it visible.
- [x] **Fix.** `JobBoard.releaseReservations` (`src/systems/jobs/board.ts`): a job that stays (a lapse, an unclaim) delivers only what it still holds; a released input leaves `delivered` and is fetched anew when the job is taken. Build and workshop inputs it retains are unchanged. 11 § Job steps says so.
- [x] **Unit test.** `test/unit/jobs/t687-lapsed-delivered-seed.test.ts`: a planting job interrupted at the plot, the lapse releases the seed and empties `delivered`, the seed merged into a stack leaves no job finding, and the job plants from the stack (fails without the fix).
- [x] **The seed.** `THREE_YEARS_SHIFT=200` `three-years-p4-4` (`three_years_seeds.test.ts`) passes locally on `36ec1e8f`, invariants watched over the three years. CI `45021041131` green; sweep `45021762632` (shifts 0 to 150) on `36ec1e8f`: Pooled 20 / 7 / 0 / 1140.25 living / 118 deaths / 0 extinct / 0 need deaths; **Verdict: pass.** Bounds exceeded: none; worth tracing: none.

## Note (orchestrator, 2026-11-22)

The failing sweep ran on master f83df33f (Merge T-680), which predates T-681/T-682 (68834723), so T-682 is not the cause; look at T-676 (loose goods), T-677 (foreign items set aside) and the T-659/T-660 delivery changes first.
