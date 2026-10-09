# T-177 — Three rules of the spec have no code

## Progress - 2026-10-09

Parked under the owner's no-long-fixture-tuning rule. Implementation, spec edits and regressions are preserved in stash `fd3ab03598c7773039ac5925941b5815a9a44278` (`T-177 parked: unchanged full-year dies in winter`). No implementation commit was made, no fixture was changed, and generated screenshots were restored.

The final twelve new regressions failed five cases on the original combat and hint code (two kiting, three daily-hauling hints), with seven controls passing. With the fixes, those twelve cases and the twenty-two catalog tests pass. The six static checks passed. The first full suite passed 2,056 tests and failed only the event-count assertion: removing the unused DangerAnnounced event requires 168 to become 167. That assertion is corrected in the stash and passes in the focused run. The other deliberate assertion change is the hint row count, 20 to 21; dwarf-speed and metal-yield numeric expectations are preserved after removing unused constants.

The full e2e suite passed nineteen cases and failed only full-year. An isolated comparison restoring the original combat and hint implementation, with its original hint unit fixture for the build, failed the same population assertion. Both games ran out of meals and plant food around day 80 and reported the same starvation deaths on days 108-112, ending with zero dwarves at tick 133,221. This is the unchanged winter food/drink failure already recorded for T-174, not a demonstrated effect of kiting or the new hint. No capacity, farm, timing or balance change was attempted; no golden moved. The failure comparison took less than ten minutes.

Next: after the owning full-year or stalled-workshop fix lands (T-150/T-188), merge master, restore this stash, run the full suite with the corrected catalog assertion and the unchanged e2e suite, then close T-177. The current implementation also checks sight from the soldier's tile before treating a nearby creature as a visible kiting threat.

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) ("Spec against code") · **Size:** S · **Needs:** — · **Status:** open

## Why

Reading 11, 16 and the event catalogue against the code found three rules that nothing implements. A missing feature is not a bug, so the audit only lists them. The spec and the code must agree, one way or the other.

## Reproduction

Read: `IDLE_HAULER_WARNING` (`src/systems/jobs/constants.ts:19`) and `RANGED_KEEP_DISTANCE` (`src/systems/combat/constants.ts:11`) are defined and used nowhere. `DangerAnnounced` is in `src/core/event-types.ts` and no file under `src/` emits it.

## What to do

**Decisions.**

1. **11 § Hauling: "The player is warned by a hint when more than `IDLE_HAULER_WARNING` items want hauling and fewer than three dwarves have hauling enabled."** Implement: one hint of `03-content/hints`, shown once per fortress, checked on `DayPassed`. It is cheap and it tells a new player why nothing gets carried.
2. **16 § Targeting: "Ranged soldiers keep `RANGED_KEEP_DISTANCE` tiles away from melee threats when possible."** Implement in the on-duty brain: an on-duty ranged soldier with a hostile within 2 tiles steps to an adjacent tile that is at least `RANGED_KEEP_DISTANCE` from it and keeps line of sight, if there is one.
3. **`DangerAnnounced { text, focus }` (24 emits, 23 centres).** Remove the event from `event-catalog.md` and from 23 § Events consumed: the announcement log pauses and centres through its own path, and the event has no emitter. This takes the `DangerAnnounced` item out of T-157.

Also remove the constants that only repeat content values and are used nowhere (`BARS_PER_ORE`, `CHARCOAL_PER_LOG`, `COAL_PER_ORE`, `SILVER_FROM_GALENA_PERMILLE` in 12; `DWARF_SPEED` in 22) from the code and from the tuning tables, or wire them in (`agent-workflow.md` § Working, "One definition").

## Done

- Tests named `T-177` for items 1 and 2; `interface:check` green after item 3.
