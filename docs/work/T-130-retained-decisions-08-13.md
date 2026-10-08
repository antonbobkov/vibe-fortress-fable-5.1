# T-130 — Resolve retained animal/job decisions and catalog mirrors

**Source:** [T-105 triage](../archive/tasks/T-105-triage-systems-08-13.md) · **Size:** M · **Needs:** owner resolutions below · **Status:** open

## Scope and proposed resolutions

T-105 leaves the two whole rows in [the decision log](../05-plan/DECISIONS.md).
These proposals do not authorize a simulation change; the owner resolves them
before implementation. Keep unrelated rules, constants and budgets unchanged.

| Item | Evidence | Proposed resolution |
|---|---|---|
| D-109 | The row promises support for nonzero initial cavern fauna. `src/systems/animals/spawn.ts:177` only performs daily spawning after breach; the spawn path never consumes the `initial` field carried by `facts.ts:49`. | Honor the recorded initial population once on the first breach, with saved completion state. Test a nonzero initial population and repeated breach/save/load; retain daily spawning afterward. |
| D-070 | The row promises `ItemReleased` for every live reservation released. `src/systems/jobs/steps.ts:121` releases an equipped fetched tool directly and emits only `ToolEquipped`; `board.ts:525` is the release path that emits `ItemReleased`. | Route the tool release through the board, emit exactly one release with the job id, and test that the carried tool still remains unavailable to searches. |
| Catalog mirrors | The event catalog's prose and systems 11/13 specify the real names. Its generated field cells and `src/core/event-types.ts` still call the payload `type` for job events and `ItemCreated`/`ItemDestroyed`; real emitters use `jobType`/`itemType` (`jobs/board.ts:339`, `items/api.ts:489,665`). | Bring those cells and their generated mirror to the real names through the existing export script. Extend the exact catalog comparison if needed; preserve actual simulation events. Coordinate with T-120's separate building/creature field regeneration. |

## Verification and closure

After the owner resolves the first two rows, implement only those resolutions,
edit every affected spec section, and pin each change with a T-130 regression.
Record any predicted golden movement in a `golden:` commit paragraph. Delete
only the resolved exact rows, run the checks in
[agent-workflow.md](../process/agent-workflow.md), and close the task normally.
