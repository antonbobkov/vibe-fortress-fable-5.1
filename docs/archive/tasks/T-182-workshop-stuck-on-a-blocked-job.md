# T-182 — A workshop does not wait on a job it cannot supply

Closed by `T-182: a workshop lets go of a job blocked on a missing input and starts the next runnable order`.

**Source:** T-115 and its report, [`../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md) (bug 18, G5) · **Size:** S · **Needs:** — · **Status:** open

## Why

A workshop creates the job of its first runnable order when the inputs are counted as available. The inputs are reserved only when a worker claims the job. If something else takes an input in between, the claim fails, the job is `blocked: missing_input`, and the workshop keeps it as its current job. It starts no other order while that job exists, and it emits no `WorkshopBlocked`, because it never looks at its orders again.

## Reproduction

[`orders.probe.ts`](../../../reports/data/2026-10-09-bug-hunt-orders.probe.ts.txt), first test: a `craftdwarf` workshop with the orders `craft_bone` and `make_mug_stone` × 2, one bone pile, two stones. The bone is forbidden after the job exists and before a dwarf arrives. Twenty days later the job is still `blocked: missing_input`, no mug has been made, and `isRunnable` says the second order is runnable.

Read: `src/systems/workshops/operate.ts:336` (`if (ws.currentJobId !== 0) continue`).

## What to do

**Decision.** The spec's step 2 is the intent ("the first order that is *runnable*"); step 1 ("If it has a `currentJobId`, nothing to do") needs its exception written down.

- **The rule (12 § Operation, step 1):** if the current job is `blocked` with `missing_input` and its order is no longer runnable, the workshop cancels the job (`JobCancelled { reason: 'order_not_runnable' }`), which releases what it had reserved and leaves delivered inputs where they lie, and goes on to step 2 in the same tick. A job that is blocked for another reason (`no_worker`, `unreachable`, `no_tool`, `no_magma`) is kept: those are not about the order.
- **Step 3 then applies as written:** when no order is runnable the workshop reports `WorkshopBlocked` once, with the reason of the first order.
- **Why cancel and not skip ahead with two jobs:** 12 gives a workshop one job. A cancelled job costs nothing: a craft job that has not been claimed has no progress, and one that was interrupted keeps its delivered inputs at the workshop, where the next job for the same order finds them first.

1. Amend 12 § Operation.
2. Implement in `WorkshopOperator.produce` (`src/systems/workshops/operate.ts`).
3. Tests, `describe('T-182 …')`: the probe's scenario makes two mugs and reports the first order as waiting; when the bone is allowed again the first order runs. A job blocked `no_worker` is not cancelled.

## Done

- The tests pass.
