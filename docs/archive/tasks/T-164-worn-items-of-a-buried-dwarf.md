# T-164 — A buried dwarf's worn items come back to the fortress

Closed by `T-164: bury worn clothing and return gear at the coffin`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 5) · **Size:** S · **Needs:** T-160 · **Status:** open

## Why

Burial destroys the corpse item. The items the corpse wore keep `carriedBy` = the corpse, have no position, and stay in the stock counts and in wealth for ever.

## Reproduction

[`death3.probe.ts`](../../../reports/data/2026-10-08-bug-hunt-death3.probe.ts.txt), first test: a dwarf is killed and buried at tick 118; its tunic, trousers and boots are `carriedBy=<destroyed corpse> pos=none` 20 days later, `tunic total 2` and wealth 142 before and after.

## What to do

**Decision.** A dwarf is buried in its clothes and without its gear. On burial, the corpse's worn clothing (`Equipment.clothing`) is destroyed with it (`ItemDestroyed { reason: 'buried' }`, out of the counts and of wealth); its weapon, shield, armour and quiver drop on the coffin's tile, not owned. `items.destroy` of any corpse does the same for a corpse destroyed another way.

1. Amend 13 § Forbid, dump, melt, claim ("until the corpse is buried, rots, or is butchered") and 14 § Burial with that rule.
2. Implement in `src/systems/buildings/burial.ts` and `ItemCore.destroy` (`src/systems/items/api.ts`).
3. Tests, `describe('T-164 …')`: the probe's scenario; a buried soldier's sword lies by the coffin and can be claimed.

## Done

- The tests pass.
- No item is carried by a corpse that no longer exists after a burial.
