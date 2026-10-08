# T-167 — No command throws: four that do reject instead

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) (bug 8) · **Size:** S · **Needs:** — · **Status:** open

## Why

`SetHuntable` with an unknown species, `AddWorkOrder` with `order: null`, `EditWorkOrder` with `patch: null` and `DesignateStairwell` with a fractional coordinate throw. The throw leaves `World.step`, the tick does not advance, and every command queued behind the bad one is lost.

## Reproduction

[`commands.probe.ts`](../../reports/data/2026-10-08-bug-hunt-commands.probe.ts.txt), the first four blocks. Each shows the throw, `tick 401 -> 401`, and a `RenameFortress` queued behind it that is never applied.

## What to do

**Decision.** A command handler validates the type of every field it reads before it uses it and rejects with a reason from the fixed list: `not_found` for an unknown species, `precondition_failed` for a missing or non-object `order` or `patch`, `out_of_bounds` for a coordinate that is not an integer in the map. And the core does not trust handlers: `World.commandPhase` catches a throw from `applyCommand`, records the command as rejected with `precondition_failed`, and goes on with the queue, so that one bad command can never cost a tick or the commands behind it.

1. Amend `command-catalog.md` (first paragraph) and `simulation-core.md` § Commands with the second rule.
2. Implement in `src/systems/foraging/index.ts`, `src/systems/workshops/orders.ts`, `src/systems/terrain/commands.ts` and `src/core/world.ts`.
3. Tests: T-176 adds the fuzz as a permanent test; here, four unit tests named `T-167`.

## Done

- The tests pass, and the shortened fuzz of T-176 reports no throw.
