# T-162 — Squad equipping goes through the item API

Closed by `T-162: route squad equipment through the item API`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 3) · **Size:** M · **Needs:** — · **Status:** open

## Why

`claimItemForSoldier` and `dropItemAtBarracks` write `flags`, `ownerId`, `carriedBy`, `containerId` and `Position` on the item record. The stock count of available items is never updated and a container keeps listing an item that left it. In the peril-0 three-year run nine item types have a wrong `available` count by the end (mail shirt, shield, short sword, axe, helm, greaves, gauntlets, metal boots, pick).

## Reproduction

[`death.probe.ts`](../../../reports/data/2026-10-08-bug-hunt-death.probe.ts.txt), the block "after squad equip, nobody dead": `stock.available-drift [pick]: available 1 recount 0`, `[short_sword]: available 2 recount 1`; at the end `container … lists … but item.containerId=0`. In the long run: [`long.probe.ts`](../../../reports/data/2026-10-08-bug-hunt-long.probe.ts.txt) with `T115_SEED=three-years T115_PERIL=0`, `stock.available-drift` from tick 155,300.

## What to do

**Decision.** No system writes an `Item` record except 13 (the layer rule already says so; `refreshDerivedIndexes` was the exception that hid this). Claiming is `items.takeOut` (when contained), `items.attachToCarrier`, `items.setOwner`; dropping is `items.setOwner(id, 0)` and `items.dropAt`. Remove the direct writes from `src/systems/combat/equipment.ts`, `training.ts` and `ranged.ts`, and from `src/systems/threats/gear.ts` (T-163 does that file).

1. No spec rule changes: 13 § Stock counts already says the counts are maintained incrementally. Remove `refreshDerivedIndexes` from 13 § Interfaces if nothing needs it afterwards.
2. Tests, `describe('T-162 …')`: after a squad equips from the ground and from a barrel, `ItemCore.recount()` equals the counts and the barrel's contents do not list the item. Extend the property test `item accounting` with squad commands.
3. A saved game carries the wrong counts. On load, recount once (`save-format.md` § Load procedure) so that old saves heal.

## Done

- The tests pass.
- `stock.available-drift` and `container.content-mismatch` are absent from a three-year long run at peril 0.
- Goldens: world hashes of runs with squads move, because `available` is in 13's saved state. Say so in the commit.
