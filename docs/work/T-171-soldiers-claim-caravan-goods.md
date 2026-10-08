# T-171 — Soldiers do not claim a caravan's goods

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) (bug 12) · **Size:** S · **Needs:** T-162 · **Status:** open

## Why

When a caravan arrives, squad members claim merchant goods as their gear: a pick, a short sword, an axe, metal boots. The items are then in two containers (the wagon and the depot), and when the caravan leaves they are destroyed. The soldier's equipment slot names an item that no longer exists for up to three days. What became of the gear it held before was not established.

## Reproduction

[`long.probe.ts`](../../reports/data/2026-10-08-bug-hunt-long.probe.ts.txt) with `T115_SEED=three-years T115_PERIL=0 T115_SAVE=1 T115_EVERY=100` (seven minutes). Ticks 148,900 to 155,100 and 289,400 to 299,200: `equip.item-in-container`, `item.in-two-containers`, `container.content-mismatch [wagon]`, then `equip.item-missing [weapon]` and `[armor.feet]`.

## What to do

**Decision.** A squad claims only fortress items: never one flagged `merchant`, `at_depot`, `foreign` or `forbidden`. That is 13's meaning of "available"; `canEquip` (`src/systems/combat/equipment.ts:110–120`) must use it. And an equipment slot that names an item that no longer exists is cleared when the item is destroyed (`ItemDestroyed`), not at the next daily check.

1. Amend 16 § Equipment ("the best available items", with 13's definition of available).
2. Tests, `describe('T-171 …')`: a squad of one, a caravan at the depot with a better sword: the soldier keeps its own. An equipped item destroyed by `items.destroy` leaves the slot 0 in the same tick.

## Done

- The tests pass.
- `equip.item-missing`, `equip.item-in-container` and `item.in-two-containers` are absent from the peril-0 long run.
