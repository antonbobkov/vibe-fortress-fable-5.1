# T-187 — Cosmetic findings of the spec reading

Closed by `T-187: preserve order identity and retry failed walks only on a trigger`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md) (C13 to C24, and "Suspected") · **Size:** M · **Needs:** T-186 (it decides the rule for items 2, 3, 6 and 9) · **Status:** open

## Why

Twelve small faults and four suspected ones, none of which ends a fortress. Most were read and not run. They are grouped so that one agent can clear them in one pass. Five of the twelve are closed by T-180 or T-186 and are listed only so that the count matches the report.

## Reproduction

Read, with the file and line for each in the report. Measured: C21 ([`tools-fixture.probe.ts`](../../../reports/data/2026-10-09-bug-hunt-tools-fixture.probe.ts.txt), peril 2, day 29) and C22 ([`toolswap.probe.ts`](../../../reports/data/2026-10-09-bug-hunt-toolswap.probe.ts.txt), [`cagetrap.probe.ts`](../../../reports/data/2026-10-09-bug-hunt-cagetrap.probe.ts.txt)).

## What to do

**Closed elsewhere:** C14 (T-186 item 12), C16 (T-186 item 10), C19 (T-186 item 2), C20 (T-186 item 9), C21 (T-180), C22 (T-186 item 6 and T-181), C23 (T-186 item 9).

Each remaining item with its decision:

1. **C13. An order command cancels the workshop's current job, whichever order it belongs to.** `EditWorkOrder`, `RemoveWorkOrder` and `ReorderWorkOrder` cancel the current job only when it belongs to the order that is edited or removed; a reorder cancels nothing and renumbers `orderIndex` on the running job. The same for global orders, where the job key carries the index: key the job by a per-order serial instead (`WorkOrder.serial`, in `components.md`), so that an index never goes stale. Amend 12 § Work orders.
2. **C15. Raiders loot while in `engage`.** Remove `engage` from the condition in `src/systems/threats/ai.ts:936`: 18 gives looting to `loiter`. A member with a target does not loot today either, so the change is small.
3. **C17. `twilight_pass` sends two thieves.** Spec: 18 § Schedule says "halves every interval and sends thieves in pairs". The second thief is the trait's flavour and the halved interval already doubles the frequency. Then fix the suspected fault below (item 6), which only a pair can show.
4. **C18. The saved copy of a job drops `wholeItem`.** Keep the field in `structuredCopy` (`src/systems/jobs/board.ts:979–986`) and add it to the job input in `system-state.md` if it is not there. Test: a melt job of a stack of two saved before it is claimed reserves the whole stack after the load.
5. **C24. Three literals.** Use 15's `UNBURIED_DAYS` in `src/systems/items/index.ts:174` (import the constant from its owner, or move it to `src/core/constants.ts` if the layer rule forbids the import); use the calendar's ticks per hour in `src/systems/combat/training.ts:85`; the dog test of `src/systems/threats/ai.ts:55` goes with T-185's spotter rule.

**Suspected; run each first and fix only what reproduces:**

6. **The first of two thieves to leave reports the whole party's loot** (`ai.ts:389`). Expected fix: `ThiefEscaped` only for what the leaving member carries.
7. **A job the labels call reachable and the path search does not is claimed again every 100 ticks** (`steps.ts:124–153`, `board.ts:447–453`). Build it with a forbidden-traffic tile between a dwarf and a dig job. Expected fix: a job unclaimed as `unreachable` by a failed walk keeps the block until its trigger fires, instead of opening at the next retry because the labels agree.
8. **A dwarf's corpse moved by a hunter** (bug 19): after T-183 it cannot happen; nothing to do unless T-183 is not done first.
9. **A workshop whose assigned worker died**: T-186 item 5.

Tests, `describe('T-187 …')`, one for each of items 1 to 4 and for each suspected item that reproduces.

## Done

- The tests pass. Each suspected item is either fixed with its test, or recorded in the closing commit as not reproducible with what was tried.
