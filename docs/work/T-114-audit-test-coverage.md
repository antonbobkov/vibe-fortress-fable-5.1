# T-114 — Audit: do the scripted playthroughs cover the game's major features?

**Source:** the owner, 2026-10-06 (the first of three audit/fix loops) · **Size:** M · **Needs:** T-113 · **Status:** open

**Who:** an Opus subagent, or Codex on `gpt-6-astra` at high effort. Not Gemini ([`../../agents/README.md`](../../agents/README.md)).

## Why

The long scripted runs are what tell us the game works as a whole: the browser specs in `test/e2e/` (above all `full-year`), and the headless scenarios `year_one` and `three_years` with the 20-seed sweep. Unit tests and the acceptance scenarios cover rules one at a time. The question for this audit is narrower: **does a simulated playthrough actually exercise each major feature of the game, through the real commands and the real UI, and would it notice if that feature broke?**

This audit goes first of the three, because the bug hunt (T-115) aims better once the untested areas are known.

## What to do

Audit only. Change no source, test or spec file.

1. Build the feature list from the spec, not from the tests:
   - every system in `docs/02-systems/`;
   - every screen and panel in `docs/03-content/ui-keymap-and-screens.md`;
   - every command in `docs/04-implementation/command-catalog.md`;
   - the player-facing chains in `docs/03-content/balance.md` (food, drink, metal, trade, defence, immigration, rooms and mood, health, the Deep).
2. For each feature, find where a scripted playthrough exercises it, and how:
   - which script (an e2e spec, `year_one`, `three_years`, the sweep);
   - whether it goes through the real UI, through commands, or by writing state directly;
   - whether an assertion would fail if the feature broke, or the script would pass anyway;
   - whether it ever runs at perils 2 and 4, on a generated map, and past year one.
3. Measure where you can instead of reading. Run the playthroughs with a recorder that counts commands sent by type, events emitted by type, recipes completed, building types built, job types completed and UI actions taken. Then list every command, event, recipe, building, job type, panel and screen that no playthrough ever touches. Keep the recorder out of the repository unless it is clean and reusable.
4. Note the features that only an acceptance scenario or a unit test covers, with the test that does. They are covered, but not by a playthrough.

## Deliverable

A new dated report, `reports/audits/<YYYY-MM-DD>-playthrough-coverage.md`:

- a summary of the largest gaps, ranked by how much game sits behind each;
- the feature table: feature → script → through UI, command or direct state → asserted or only run → perils and years reached;
- the "never touched" lists from step 3;
- recommended additions, each sized: new steps in an existing playthrough, a new e2e spec, or a new long scenario (for example a military and siege year, a trade and caravan year, a health and hospital run, the Deep);
- anything that looks like a bug found along the way, described with its evidence and not fixed.

## Follow-up

For each recommended addition worth doing, add a `T-1nn` row to [`../backlog.md`](../backlog.md) with this report as its source, and a work file. Those fix tasks run before T-115 starts, so that the bug hunt has the new playthroughs to use.

## Done

- The report exists; every system, panel and command appears in its table.
- The follow-up rows are in the backlog.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
