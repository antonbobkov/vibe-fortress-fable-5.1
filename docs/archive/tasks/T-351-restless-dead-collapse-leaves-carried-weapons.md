# T-351 — The restless dead that collapse at dawn leave their weapons carried by nobody

**Closed:** 2026-10-17, in a8d6746.

**Source:** T-331 (the end-of-scenario invariant `item.carrier-dead` and `item.no-place` fail in `th_restless`) · **Size:** S · **Needs:** — · **Status:** open

## Why

Restless dead rise at dusk on an old battlefield, and one in three carries a rusted iron short sword: `src/systems/threats/caverns.ts` spawns the sword, writes it into the creature's `Equipment.weapon` and calls `attachToCarrier(weapon, creature)`. At dawn `collapseRestlessDead` spawns a bone pile on the creature's tile, emits `CreatureDied` and calls `entities.destroy(creature)`. The sword keeps `carriedBy` set to the destroyed creature: it has no tile, no container and no living carrier.

## Trace

`th_restless` (seed `th-restless`, old battlefield, temper 2, one dwarf), run to tick 68,900 (the scenario's end), reports:

- `item.carrier-dead` ×2: item 16777238 and item 16777240, `short_sword`, `carriedBy` 16777237 and 16777239, not alive, no position, `flags 0`.
- `item.no-place` ×2 for the same items (the T-331 invariant 4).

The swords exist in the stock counts, are not reserved or forbidden, and cannot be found by a hauler (they are on no tile). Every other death of a hostile goes through 17's death handler, which drops what the creature wears and carries onto its tile; the collapse path does not.

## What to do

**Decisions.**
- A collapsing restless dead drops what it carries and wears on its tile before it is destroyed, through the same items call that a death uses, so the sword lies on the ground where the creature stood and a hauler can pick it up. The sword is not destroyed (it is an ordinary item once dropped).

1. Amend `02-systems/18-threats-and-raids.md` § Restless dead with the sentence about the dropped weapon.
2. Fix `collapseRestlessDead`.
3. Tests, `describe('T-351 …')`: a restless dead with a sword collapses at dawn and the sword lies on its tile with no carrier.
4. Remove `todo: 'T-351'` from `test/scenarios/th_restless.scenario.ts`, and the `RestlessRose` exception from `test/scenarios/inventory.test.ts` with it (`test/unit/threats/t331-restless-rose.test.ts` can stay).

## Done

- `th_restless` runs again in `npm test` and ends without invariant findings.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
