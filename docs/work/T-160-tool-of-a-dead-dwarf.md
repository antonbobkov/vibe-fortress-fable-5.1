# T-160 — A dwarf who dies holding a tool drops it

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) (bug 1) · **Size:** M · **Needs:** — · **Status:** open

## Why

A miner or woodcutter who dies takes the pick or axe out of the world. The item keeps `carriedBy` = the dead dwarf, has no position, and still counts as available. Every dig or chop job is then `blocked: no_tool`. A fortress embarks with two picks and two axes and cannot replace them before it has a forge and an anvil. This is the only bug of the hunt that breaks a fortress, and it happens in the three-year fixture at perils 2 and 4 (an axe on day 32 and a pick on day 33 of `three-years-p2-1`; a pick on day 23 of `three-years-p4-1`).

## Reproduction

[`death2.probe.ts`](../../reports/data/2026-10-08-bug-hunt-death2.probe.ts.txt): flat-test 48 × 48, seed `t115-death2`. A miner takes the only pick at tick 25, is killed at tick 2,430. Afterwards: `item … carriedBy=<dead id> pos=none tileOf=-1`, `pick: total 1 available 1`, and four new channel jobs `blocked: no_tool` for 27 days. Copy the probe files from `reports/data/` into `t115-scratch/` at the repository root as the report's section "The probes" says, then run `node node_modules/vitest/vitest.mjs run -c t115-scratch/vitest.config.ts t115-scratch/death2.probe.ts`.

## What to do

**Decision.** On `CreatureDied`, everything a creature holds that is not in its `Equipment` falls to the death tile: `Worker.toolId` and `Worker.carrying`. They are ordinary items again: not owned, not reserved, not forbidden (13 § Forbid, dump, melt, claim: "Items dropped by dead dwarves and hostiles are not forbidden by default"). Worn items keep going to the corpse as today.

1. Amend 13 § Forbid, dump, melt, claim and 11 § Job steps (the tool paragraph) to say that a held tool and a carried item drop at the death tile.
2. Implement in the death path (`src/systems/health/tick.ts` builds `wornItems`; 11's `board.workerDied` already knows the worker): drop through `items.dropAt`, clear `Worker.toolId` and `Worker.carrying`, emit `ToolDropped` so that `no_tool` jobs retry.
3. Tests, `describe('T-160 …')`: the probe's scenario as a unit test (the pick lies on the death tile and a second miner fetches it); a hauler killed mid-haul leaves its item on the tile. The hunt did not establish what a hauled item does today, so the second test may already pass.

## Done

- The tests pass.
- In the `three-years-p2-1` and `three-years-p4-1` long runs no item is `carriedBy` a creature that no longer exists (the checker of T-176, or the scratch `long.probe.ts`).
