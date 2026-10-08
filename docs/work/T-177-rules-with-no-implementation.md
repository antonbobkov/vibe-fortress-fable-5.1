# T-177 — Three rules of the spec have no code

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
