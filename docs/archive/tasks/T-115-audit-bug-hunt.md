# T-115 — Audit: bug hunt

Closed by `T-115: bug hunt, first version of the report`, `T-115: bug hunt, long runs, save and load, determinism, follow-up tasks`, `T-115: the spec read against the code, and the two save cases left over` and `T-115: follow-up rows T-180 to T-187, and the task is closed`. The reports are [`reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) and [`reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md); their follow-ups are T-160 to T-177 and T-180 to T-187.

**Source:** the owner, 2026-10-06 (the second of three audit/fix loops) · **Size:** L · **Needs:** — (order changed 2026-10-08: the bug hunt runs in parallel with the T-150 … T-157 coverage tasks, so that night-time strong-model hours are not left idle; it writes its own probes where a playthrough is missing) · **Status:** open

**Who:** an Opus subagent, or Codex on `gpt-6-astra` at high effort. Not Gemini ([`../../agents/README.md`](../../../agents/README.md)).

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
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green.

## Progress

**2026-10-08.** Report: [`../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md), at commit `afdbe66`. Fifteen confirmed bugs (one breaks a fortress), twelve cosmetic ones; follow-up rows T-160 to T-177 are in the backlog.

- **Done:** way 1 (invariant probes over the three-year fixture at perils 0, 2 and 4 and over `year_one`), way 2 (save and load: 33 forks in the long runs, 5 in `year_one`), way 3 headless (two processes per seed), way 4 (all 78 commands, 68,010 trials).
- **Done in part:** way 5. Read: the tuning constants of 11, 12, 13, 16, 18, 19 and 22 against their uses, the death consumers, the stealth and outcome rules of 18, the events with no emitter. **Remaining:** the rule-by-rule reading of those seven documents.
- **Moved:** way 6, the UI under abuse, goes to T-116. The browser ports were in use by another agent on the night of the run. The second half of way 3 (the same commands through the UI and headless) goes with it.
- **Also remaining from way 2:** a save while paused with commands applied by the paused command phase, and a save with a trade session open.

The task closes when the remaining reading is done or is given its own row.

**2026-10-09.** Report: [`../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../../reports/audits/2026-10-09-bug-hunt-spec-reading.md), at commit `d29ea8e`. The rule-by-rule reading of 11, 12, 13, 16, 18, 19 and 22 is done, and so are the two save cases left from way 2 (paused with commands applied; a trade session open). Six more confirmed bugs (one breaks a fortress), twelve cosmetic ones and eighteen rules to write down or remove; follow-up rows T-180 to T-187 are in the backlog. Way 6, the UI under abuse, and the UI half of way 3 (the same commands through the UI and headless) were not done here: they are part of T-116 (item 7 of its work file). The task is closed.
