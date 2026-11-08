# T-526 — A hunter who takes a pick keeps carrying the launcher it no longer holds

**Closed:** 2026-11-07, in HEAD.

**Source:** T-521 (`test/unit/jobs/t521-hunter-joins-squad.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

The specification is [09](../../02-systems/09-hunting-gathering-fishing.md) § Hunting and [11](../../02-systems/11-jobs-and-labor.md) § Assignment.

## What was found

Read from the code while doing T-521, not yet seen in a run. A hunter holds its crossbow as its tool (`Worker.toolId`) and keeps it after the hunt. If it then takes a mining or woodcutting job, it fetches a pick: `dropHeldToolBeforeEquip` (`jobs/items-adapter.ts`) drops only a held pick or axe, so the crossbow stays carried while `toolId` becomes the pick. `dropStrandedTools` also drops only picks and axes, so nothing puts the crossbow down. The crossbow is then neither the worker's tool nor free stock: that worker fetches another launcher for its next hunt, and with one crossbow in the fortress every hunt is `no_tool` for as long as it lives. 11 § Assignment says "a worker that equips a tool of another kind first drops the pick or axe it holds", which leaves the launcher out.

## What to do

Decide whether a worker that equips a pick or axe first drops a held launcher (and its ammunition) as it drops a pick, or whether a worker may hold a launcher beside one pick or axe (then `heldLauncher` and `hasTool` must find it when it is not `toolId`). Pin it with a test like T-521's: a hunter with mining on hunts, mines, and another dwarf then hunts with the crossbow.
