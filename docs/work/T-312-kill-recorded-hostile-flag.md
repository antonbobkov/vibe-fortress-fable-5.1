# T-312 — KillRecorded's hostile flag is always false

**Source:** T-279 (found while giving `KillRecorded` its victim's name) · **Size:** S · **Needs:** — · **Status:** open

## Why

`src/systems/combat/index.ts` computes `hostile` in its `CreatureDied` handler from the victim's `Creature` and `Wild` components. The health system destroys the victim before combat handles the event, so those components are gone and `hostile` is false for every kill. The `killed_hostile` thought (`03-content/personality-and-thoughts.md`, read by `src/systems/morale/thoughts.ts`) therefore never fires.

## What to do

**Decisions.**
- `hostile` is computed from the death event's `faction` and the killer's faction, with `isFactionHostile`. A wild victim counts as hostile when it was in the `attack` state, so `CreatureDied` also carries that state (`wildState`), taken when the death is emitted.
- The change moves the morale of soldiers, so the twelve-seed wildlife instrument runs before and after, and scenario goldens that record thoughts are named in the commit.

1. Amend `event-catalog.md` (`CreatureDied` fields) and `02-systems/16-combat.md` § Concepts if the rule is not already stated.
2. Implement in `src/systems/health/tick.ts` and `src/systems/combat/index.ts`.
3. Tests, `describe('T-312 …')`: a fortress dwarf killing a goblin, and an attacking wolf, records `hostile: true`; a hunted deer, `false`; the thought fires once.

## Done

- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
