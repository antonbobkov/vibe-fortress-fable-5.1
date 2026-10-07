# T-126 — `content:export` no longer reproduces three committed content files

**Source:** found while doing T-125, 2026-10-07 · **Size:** S–M · **Needs:** — · **Status:** open

## What is wrong

`npm run content:export` generates `src/content/*.json` from the tables in `docs/03-content/`. Run on master today it rewrites three files it should leave alone:

- **`thoughts.json`:** three thoughts go from `event: "CreatureDied"` back to `"DwarfDied"`. The code was fixed and the source table was not (T-117 covers the event name).
- **`strings.json`:** eight `announce.*` strings (caravan arrived, departed, lost and waiting, trade completed, immigrants arrived, immigration skipped, reputation changed) are deleted. They exist only in the JSON.
- **`palette.json`:** about a dozen colours lose their `alt` value, and some `hex` values change. The colour-blind alternates exist only in the JSON.

So the specification tables are behind the game, and anyone who regenerates content for an unrelated change silently undoes three fixes. `content:check` does not notice.

## Decision

The committed JSON is what the game ships and what the tests pass with, so it is the rule. The source tables are brought to it.

## What to do

1. For each of the three files, change the source table in `docs/03-content/` (or the exporter, if the table has no column for the field, as with `alt`) until `content:export` reproduces the committed JSON exactly.
2. Run the export over every table and confirm `git status` is clean.
3. Add the check to the gate: a script or test that runs the export into a temporary directory and fails on any difference from `src/content/`. Wire it into `content:check`, or add it beside it in [`../process/agent-workflow.md`](../process/agent-workflow.md)'s verification commands.
4. If T-117 has not landed, leave the `DwarfDied` wording elsewhere to it; fix only the thoughts table here.

## Done

- `npm run content:export` leaves the working tree clean.
- The new check fails when a JSON file is edited by hand, and passes on master.
- The verification commands are green.
