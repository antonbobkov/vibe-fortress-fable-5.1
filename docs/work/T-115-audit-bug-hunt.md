# T-115 — Audit: bug hunt

**Source:** the owner, 2026-10-06 (the second of three audit/fix loops) · **Size:** L · **Needs:** T-114 and the fix tasks it produces · **Status:** open

## Why

Every long measurement so far has turned up real defects that no test caught: raiders that never left, a door lock that never reached pathfinding, hostile gear counted as wealth, crafts losing their quality, a job producing output from inputs it no longer held, a save that diverged one tick after loading. Each was found by accident, while measuring something else. This audit looks for them on purpose.

## What to do

Audit only. Find, reproduce and describe; fix nothing. A bug here is a place where the code does not do what the spec says, or where the game reaches a state it cannot recover from. A balance number that is off is not a bug, and neither is a missing feature.

Hunt in these ways, and say in the report which way found each bug:

1. **Invariant probes over long runs.** Run the playthroughs (including the ones T-114 added) at perils 0, 2 and 4 with checkers that run every N ticks:
   - no dwarf frozen with no target and no activity;
   - no job claimed by a dead or absent worker;
   - no item reserved by a job that no longer exists;
   - no item in two places;
   - no party active past its limits;
   - no alert held with no hostile present;
   - no need above its maximum;
   - wealth and stock counts equal a recount;
   - no entity at an impassable tile;
   - no command accepted that leaves the state it should have rejected.
2. **Save and load anywhere.** Save and load at random ticks during those runs, including while paused, mid-job, mid-combat, mid-trade and during an alert. Compare the world hash with the unsaved run for the next thousand ticks.
3. **Determinism.** The same seed and the same commands give the same hashes across two runs, and with the commands issued in the same ticks through the UI and headless.
4. **Command fuzzing.** Send every command in the catalog with boundary and malformed arguments: ids that do not exist, wrong kinds, zero and maximum sizes, tiles off the map, entities that died that tick. Every one must be rejected with a reason or applied cleanly, and never throw or corrupt state.
5. **Spec against code, by reading.** For the systems the earlier diagnoses found weakest (11 jobs, 12 workshops, 13 items, 16 combat, 18 threats, 19 defence, 22 pathing), read each rule in the spec and find the code that implements it. List the rules with no implementation, and the code paths with no rule.
6. **The UI under abuse.** Rapid input, a resize in the middle of a drag, every panel opened at every screen size the spec allows, text fields with long and unusual input, and the modal screens opened from each other.

For each bug, give:

- a minimal reproduction (a seed and commands, or a small test file kept outside the repository);
- what happens, and what the spec says, with the section;
- how often it occurs;
- how bad it is: **breaks a fortress**, **wrong result**, or **cosmetic**.

## Deliverable

A new dated report, `reports/audits/<YYYY-MM-DD>-bug-hunt.md`:

- a ranked list of confirmed bugs, each with its reproduction;
- a separate list of suspected ones that could not be reproduced, with what was seen;
- the probes written, with the ones worth keeping as permanent tests.

## Follow-up

Add one `T-1nn` row per confirmed bug that breaks a fortress or gives a wrong result, and group the cosmetic ones into a single task. Each row has this report as its source and a work file that carries the reproduction. Add a task to turn the worthwhile probes into permanent tests. Those fix tasks run before T-116 starts.

## Done

- The report exists, and every confirmed bug has a reproduction that a second agent can run.
- The follow-up rows are in the backlog.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
