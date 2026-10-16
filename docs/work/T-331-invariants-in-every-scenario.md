# T-331 — More invariants, checked in every scenario

**Source:** the process review, [`../../reports/audits/2026-10-15-process-review.md`](../../reports/audits/2026-10-15-process-review.md) · **Size:** M · **Needs:** — · **Status:** open; after the medicine batch in worktree `sim` (the same systems)

## Why

The invariant checks are what exposed T-302 to T-304 in the sweep (process review § 2). Today they run only in the long fixtures, and they do not cover the faults that cost the most: orphan reservations (T-263), a job blocked for ever (T-301), an unreachable container.

## What to do

- Add these invariants to the existing invariant checks (T-176) and run them at the end of every scenario and at each observation boundary of the long ones:
  1. no reservation, claim or held job whose holder is dead, gone or doing something else;
  2. no job blocked as `unreachable` for more than one day while a path to its work tile exists;
  3. every built container with items or a stockpile slot has a reachable work tile;
  4. every item has a place: a tile, a container, a carrier or an inventory.
- Each invariant gets a unit test that builds the bad state by hand and sees the check fail.
- A scenario that now fails an invariant has found a fault: write a work file for it, and record the failure as expected only through the project's existing way of doing so. Do not fix the game here.

## Done

- The four invariants run in every scenario; each has its own failing-state test.
- Every invariant failure found has a work file.
