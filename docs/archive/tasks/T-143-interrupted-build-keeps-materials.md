# T-143 — An interrupted build loses the materials already delivered

Closed by the T-143: retain delivered build and workshop inputs through interruptions commit.

**Source:** T-123 and its report, [`../../../reports/audits/2026-10-08-economy-at-default-priority.md`](../../../reports/audits/2026-10-08-economy-at-default-priority.md) (§ Beds, causes 5 and 6) · **Size:** M · **Needs:** — · **Status:** open

## Why

The carpenter's workshop of the rewritten fixture was placed on day 0 and built on day 157. One dwarf claimed its build job six times between days 43 and 66. Each time it carried one or both logs to the site, a need reached its critical threshold, and the job went back to open. The dwarf returned after about 1,800 ticks of need errands. The job keeps its reservations for `RESERVE_KEEP_TICKS` (600). By then the delivered logs were free again, and the job started from nothing.

Two rules produce this:

- `11` § Job steps, Interruptions: reserved items stay reserved for `RESERVE_KEEP_TICKS`. Delivered inputs stay at the work tile, but after the lapse they are no longer the job's (`src/systems/jobs/board.ts:511–540, 604–612`).
- `10` § Needs and § Behavior selection: wants are checked only between jobs, and a critical need interrupts any job. A dwarf whose rest is at 48 takes a job that needs 750 ticks; rest reaches the critical 90 in about 400.

With urgent priorities the dwarf comes straight back after sleeping, inside the 600 ticks. The old fixture never showed the fault.

## Decision

- **Materials delivered to a building site belong to the site.** They stay reserved to the build job until the building is finished or cancelled. `RESERVE_KEEP_TICKS` applies to items that are reserved and not yet delivered. The same holds for inputs delivered to a workshop for a craft job: they stay with the job while its order stands.
- **When a dwarf may take a job does not change.** The builder claimed the job with rest at 48, under the want threshold of 60, so step 6 did not apply, and a rule that estimates a job's length against every need is more than this fault needs. With the first rule an interruption costs the walk back and nothing else.

## What to do

1. Amend `11` § Job steps (Interruptions) and `12` § Operation for delivered inputs.
2. Implement in `jobs/board.ts` (`lapseReservations`, `revalidateDelivered`). Haulers must not carry off an item that is delivered and still reserved.
3. Unit test: a two-input build, interrupted after the first delivery and resumed 2,000 ticks later by another dwarf, fetches one input and not two. Keep the F-17 stale-input test passing: a job must still never consume an item it does not hold.

## Done

- The tests pass, with `describe('T-143 …')`.
- In the three-year run at default priorities the carpenter's workshop is built within 10 days of placement.
- `npm run test:perf` passes, since the change touches the board.
