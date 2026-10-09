# T-165 — A dead dwarf's bedroom is free again

Closed by `T-165: release dead owners bedrooms and pets`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 6) · **Size:** S · **Needs:** — · **Status:** open

## Why

`Room.ownerId` keeps naming a dead dwarf. The daily auto-assignment offers only rooms with no owner, so the room is never given to anyone. After a raid that kills half the fortress, half the bedrooms are lost.

## Reproduction

[`death2.probe.ts`](../../../reports/data/2026-10-08-bug-hunt-death2.probe.ts.txt): `AssignRoom` to a dwarf, the dwarf is killed on day 2; on day 29 the line `rooms:` still shows `owner <dead id>` while three living dwarves have no bedroom.

## What to do

**Decision.** 14 subscribes to `CreatureDied`. A dead creature's bedroom has no owner from that tick; a coffin kept for it (`AssignCoffin`) keeps its assignment, because that is what the assignment is for. The pet of a dead owner has `petOf = 0` (08) and can be adopted again.

1. Amend 14 § Ownership and § Events consumed, and 08 § Pets.
2. Implement in `src/systems/buildings/rooms.ts` and 08's `CreatureDied` handler.
3. Tests, `describe('T-165 …')`: the probe's scenario; the room goes to another dwarf at the next daily assignment.

## Done

- The tests pass.
- `room.owner-dead` and `tame.pet-owner-dead` are absent from the long runs.
