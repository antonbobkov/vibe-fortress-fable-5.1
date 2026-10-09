# T-183 — A hunter carries its own kill and nothing else

Closed by `T-183: a hunter carries the corpse of its own kill and waits for it`.

**Source:** T-115 and its report, [`../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md) (bug 19, G17) · **Size:** S · **Needs:** — · **Status:** open

## Why

After a kill the hunt job looks for a corpse on the tile where the hunter last saw the quarry. The quarry's corpse is made by 13 on its next tick, up to ten ticks later, so the tile is empty, and the job falls back to the first corpse in the world. With any other corpse on the map the hunter walks to it, picks it up and carries it to the butcher's workshop: a dead dwarf, a raider, last week's kill. With no other corpse the job ends at once and the kill is left for the ordinary butcher job.

## Reproduction

[`orders.probe.ts`](../../../reports/data/2026-10-09-bug-hunt-orders.probe.ts.txt), second test: the setup of scenario `fo_hunt` and a dwarf killed at (45, 45) beforehand. `HuntKill` at tick 25; at tick 26 the job's `corpseId` is the dwarf's corpse; the hunter drops it on the butcher's workshop at tick 506.

Read: `src/systems/jobs/steps.ts:229–243`.

## What to do

**Decision.** The hunter carries the corpse of the creature it hunted, and waits for it.

- **The rule (09 § Hunting, and one line in 11 § Events emitted beside `HuntKill`):** when the quarry dies the hunt job waits for `CorpseCreated { creatureId: targetId }` and takes the corpse that event names. It then hauls it to the nearest built butcher's workshop, or ends where it stands if there is none. If no corpse has been made `CORPSE_WAIT_TICKS` (new, 20: twice 13's cadence) after the death, the job ends. The job never takes another corpse.
- 13 already emits `CorpseCreated { itemId, creatureId }` (`src/systems/items/rot.ts:173`). 11 subscribes to it and stores the item id on the hunt job whose target is that creature. No new component field is needed.

1. Amend 09 and 11; add the constant to 09's table.
2. Implement in `stepHunt` (`src/systems/jobs/steps.ts`): remove both fallbacks.
3. Tests, `describe('T-183 …')`: the probe's scenario leaves the dwarf's corpse at (45, 45) and delivers the deer; `fo_hunt` still passes.

## Done

- The tests pass.
