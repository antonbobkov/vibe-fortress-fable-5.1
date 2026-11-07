# T-521 — A hunter who joins a squad and takes a melee weapon keeps the fortress's launcher

**Closed:** 2026-11-07, in 8097d305.

**Source:** T-500 (`test/unit/jobs/t500-warband-hunt.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

The specification is [09](../../02-systems/09-hunting-gathering-fishing.md) § Hunting, [11](../../02-systems/11-jobs-and-labor.md) § Assignment (step 5) and [16](../../02-systems/16-combat.md) § Equipment.

## What was found

Since T-500 a worker whose weapon slot holds a weapon that is not a launcher is not offered a `ranged` job: 16 shoots only the weapon in that slot. A hunter keeps the launcher and its bolts after a hunt (`Worker.toolId`), as a miner keeps a pick. If that hunter then joins a squad that claims it a melee weapon (`weaponClass: any` or a melee class), it holds the axe in its weapon slot and the crossbow as its tool: it no longer hunts, and nothing makes it put the crossbow down, so every other hunter's claim fails with `no_tool` for as long as it lives. Not seen in a run yet; read from the code (`jobs/items-adapter.ts` `findRangedKit`, `combat/equipment.ts`).

## What to do

Decide where the launcher goes: 16's equipment step drops a held launcher (and its ammunition) at the barracks when a member claims a melee weapon, as it drops replaced gear; or 11 drops it when the worker is next idle and can no longer use it. Pin it with a test.
