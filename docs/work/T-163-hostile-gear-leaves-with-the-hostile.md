# T-163 — A raider's gear is carried, and leaves with the raider

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) (bug 4) · **Size:** S · **Needs:** T-162 · **Status:** open

## Why

A hostile's gear is spawned on its arrival tile and marked carried without being lifted, so it lies on that tile for the whole raid. When the hostile leaves the map the gear stays for ever: `foreign | owned`, with an owner that no longer exists. At the end of the peril-2 run 176 items had both a position and a carrier, and 73 items were carried by an entity that no longer existed. The same leak, without the position, happens to caravan guards' daggers and arrows when a caravan leaves (peril 0, from tick 89,100).

## Reproduction

[`gear.probe.ts`](../../reports/data/2026-10-08-bug-hunt-gear.probe.ts.txt): `three-years-p4-1`, peril 4. Thief arrives at tick 25,201 on (0, 0, 32); at tick 25,405 it is at (11, 4, 32) and its axe, spear and leggings are listed on (0, 0, 32); it leaves at tick 25,431 and the three items are still there on day 30. Copy the probe files from `reports/data/` into `t115-scratch/` at the repository root as the report's section "The probes" says, then run `node node_modules/vitest/vitest.mjs run -c t115-scratch/vitest.config.ts t115-scratch/gear.probe.ts`.

## What to do

**Decision.** A hostile carries its gear from the moment it spawns (`items.attachToCarrier`, no `Position`). When a party member despawns at the edge, everything it carries is destroyed with it (`items.destroy(id, 'left_map')`), except loot, which `ThiefEscaped` already handles. The same holds for a caravan member that leaves: its own equipment goes with it.

1. Amend 18 § Party AI, Retreat ("despawn there, with what they carry") and 20 for departing caravan members.
2. Implement in `src/systems/threats/gear.ts`, `despawnMember` (`src/systems/threats/ai.ts`) and 20's departure.
3. Tests, `describe('T-163 …')`: a spawned hostile's gear has no `Position`; after the hostile leaves, no item names it as carrier or owner; a dead hostile's gear is still on its corpse (16).

## Done

- The tests pass.
- `item.two-places`, `equip.item-on-floor`, `item.carrier-dead` and `item.owner-dead` are absent from a three-year long run at perils 0, 2 and 4.
