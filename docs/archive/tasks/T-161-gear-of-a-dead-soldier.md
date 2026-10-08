# T-161 — A dead dwarf's claimed gear is nobody's

Closed by `T-161: release dead dwarves' claims and preserve civilian tools`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 2) · **Size:** S · **Needs:** T-160 · **Status:** open

## Why

A squad member's claimed weapon and armour keep `flags = owned` and `ownerId` = the dead dwarf for ever. After the corpse rots they lie on the ground and no dwarf, squad or job can take them. In the probe the lost item was the fortress's only pick.

## Reproduction

[`death.probe.ts`](../../../reports/data/2026-10-08-bug-hunt-death.probe.ts.txt), seed `t115-death`: the soldier that claimed the pick is killed at tick 2,411. On day 28 the pick lies at (21, 20, 32) with `flags=16 ownerId=<dead id>`, `pick: total 1 available 0`, and six channel jobs are `blocked: no_tool`. Copy the probe files from `reports/data/` into `t115-scratch/` at the repository root as the report's section "The probes" says, then run `node node_modules/vitest/vitest.mjs run -c t115-scratch/vitest.config.ts t115-scratch/death.probe.ts`.

## What to do

**Decision.** Ownership ends with the owner. On `CreatureDied` of a fortress creature, every item whose `ownerId` is that creature loses the `owned` flag and its `ownerId`, through `items.setOwner(itemId, 0)`. That covers claimed gear (16), worn clothing and chest contents (13, 14). Items worn by the corpse stay with the corpse as 13 says; they are simply not owned.

The audit also saw a soldier claim the only pick as a weapon, which 16 § Equipment allows ("then any melee class"). **Decision:** a squad member does not claim a pick or an axe as a weapon while any dwarf has the `mining` or `woodcutting` labor on and no tool of that kind. Write that into 16 § Equipment.

1. Amend 13 § Forbid, dump, melt, claim (`owned`) and 16 § Equipment.
2. Implement in 13's `CreatureDied` handler (`src/systems/items/index.ts`) and in `canEquip` (`src/systems/combat/equipment.ts`).
3. Tests, `describe('T-161 …')`: the probe's scenario; a squad of one with one pick and one miner does not take the pick.

## Done

- The tests pass.
- No item is owned by an entity that no longer exists at the end of a three-year long run at any peril.
