# T-263 - A dead dwarf leaves an orphan personal drink reservation

Closed by `T-263: cancel personal reservations before weeping and on death`.

**Source:** T-139 three-year diagnosis, [removal trace](../../../reports/data/2026-10-11-t139-removal-trace.json) and [invariant failure](../../../reports/data/2026-10-11-t139-before-invariants.log), 2026-10-11 | **Size:** S | **Needs:** none | **Status:** open; diagnosis first

## Finding

The unmodified three-year fixture on `73dc67c` reports `item.reserved-by-missing-job`
at tick 336000: drink 150995102, one unit, `reservedBy=150995335`, contained in
50331755. Neither that job nor a living creature exists. Dwarf Saga Granitefell
150995335 died from bleeding at tick 335727; its corpse is created at 335731.
The personal reservation still survives 273 ticks later. This is separate from
the clothing handoff corrected by T-139; it must not be hidden in that commit.

## What to do

Trace this reservation from the dwarf's drink plan through fleeing, admission,
interruptions and save/load to find when it loses its owning plan. Turn the exact
lost release into a small failing stepped regression first. Repair the abandoned
need path and, if required, death cleanup so every reservation still held under
that dwarf's id is released through the item API with ItemReleased. Preserve any
other holder's reservation and do not change need rates, death rules or the fixture.

Fold any missing cleanup rule into 10 Needs and 13 Ownership. Verify six static
checks, npm test, the whole e2e suite and the annual instrument; record the before
and after rows and full-year end states. Name any golden change.
