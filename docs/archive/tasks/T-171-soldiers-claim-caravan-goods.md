# T-171 — Soldiers do not claim a caravan's goods

Closed by `T-171: squads claim fortress gear and clear destroyed equipment`.

## Progress - 2026-10-09

Parked under the owner's no-long-fixture-tuning rule; no T-171 commit was made. Implementation, specification edits and six regressions are saved in stash `5cc12547727d7d86a065efb330c0c8311d6e5ada` (`T-171 parked: fortress equipment; three-year raw thought cap assertion`). The backlog row and work file remain open. No fixture or assertion was changed, and no goldens moved.

Before the fix, five new tests failed and the forbidden-item case passed. After the fix, focused checks passed 3 files / 20 tests, and lint, typecheck, content:check, strings:check, interface:check and docs:check passed (50 tables / 1,621 rows, 1,104 string keys, 24 interfaces without differences, 225 documentation files without broken links). The full suite passed 2,022 tests and failed only the three-year scenario (492.37 s).

At tick 403,200 (end of day 336), the fixture's final thought-cap assertion sums raw active positive thought values and gets 41.6 against a limit of 41. System 15's mood calculation correctly caps their contribution at 40; its spec does not cap the raw thought list. The isolated repeat failed identically (376.74 s). Fixing that assertion is outside this equipment decision and would change an existing assertion, so no such edit was made. The isolated comparison with the original combat code passed (374.00 s, 12 dwarves, no dwarf deaths). The equipment fix therefore changes the final raw thought sum and exposes this incorrect cap assumption; this is not a flaky failure. No further fixture experiments were made.

Next: merge master's announced movement/fixture-tier changes, then resume the stash and rerun the required checks and the original peril-0 equipment/container invariant reproduction. Keep the fixture's capacity, timing and assertions unchanged; the fragile economy fixture belongs to T-145/T-156.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 12) · **Size:** S · **Needs:** T-162 · **Status:** open

## Why

When a caravan arrives, squad members claim merchant goods as their gear: a pick, a short sword, an axe, metal boots. The items are then in two containers (the wagon and the depot), and when the caravan leaves they are destroyed. The soldier's equipment slot names an item that no longer exists for up to three days. What became of the gear it held before was not established.

## Reproduction

[`long.probe.ts`](../../../reports/data/2026-10-08-bug-hunt-long.probe.ts.txt) with `T115_SEED=three-years T115_PERIL=0 T115_SAVE=1 T115_EVERY=100` (seven minutes). Ticks 148,900 to 155,100 and 289,400 to 299,200: `equip.item-in-container`, `item.in-two-containers`, `container.content-mismatch [wagon]`, then `equip.item-missing [weapon]` and `[armor.feet]`.

## What to do

**Decision.** A squad claims only fortress items: never one flagged `merchant`, `at_depot`, `foreign` or `forbidden`. That is 13's meaning of "available"; `canEquip` (`src/systems/combat/equipment.ts:110–120`) must use it. And an equipment slot that names an item that no longer exists is cleared when the item is destroyed (`ItemDestroyed`), not at the next daily check.

1. Amend 16 § Equipment ("the best available items", with 13's definition of available).
2. Tests, `describe('T-171 …')`: a squad of one, a caravan at the depot with a better sword: the soldier keeps its own. An equipped item destroyed by `items.destroy` leaves the slot 0 in the same tick.

## Done

- The tests pass.
- `equip.item-missing`, `equip.item-in-container` and `item.in-two-containers` are absent from the peril-0 long run.
