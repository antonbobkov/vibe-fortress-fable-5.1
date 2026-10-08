# T-102 — Interfaces: real entries instead of the 27 implementation notes

**Source:** [`docs-restructure.md`](docs-restructure.md) § Where deltas are accumulating (item 2), § One-time migration (step 2) · **Size:** S · **Needs:** — · **Status:** open

**Closed:** implemented by commit `bc18701` on branch `docs-a`.

## Why

27 lines that start `Implementation note:` sit in the specification next to the text they amend: 26 in `docs/02-systems/` (one per system document, four in `13-items-and-storage.md`, two in `22-pathfinding-and-spatial.md`, none in `01` and `23`) and one in `docs/04-implementation/schemas/system-state.md`. Most say "reader additions: … audited in DECISIONS D-220" instead of listing those readers in the Interfaces section above them. They are deltas pinned beside the spec, and they date from the rule that agents could not edit it.

## What to do

1. For every note inside an `## Interfaces` section, write what it says into the section itself, in the section's own form:
   - `reader additions:` become entries under `### Reader`, each with its signature and a one-line meaning taken from the code;
   - `events additions:` become entries under `### Events emitted`, and `commands additions:` entries under `### Commands`;
   - `reader/events/commands references:` name things the section mentions but another system owns. Reword the entry so that it is clearly a reference (or move it to the consuming subsection), so the check no longer needs the subtraction.
2. For a note outside an Interfaces section (and the one in `system-state.md`), fold its content into the paragraph, table or schema it amends, as plain spec text with no id and no date.
3. Delete every `Implementation note:` line.
4. `scripts/interface-check.mjs`: remove the note parsing in `documentedInterfaces` (the `Implementation note:` skip, the set-delta loop and the older `items.`/`pathing.` fallback), and fail on any line in `docs/00-` … `docs/04-` that starts with `Implementation note:`, naming the file and line.
5. `test/unit/interface-check.test.ts`: its first case feeds a note through `documentedInterfaces`. Rewrite that case for the new behaviour and add one for the failure.

No game rule, constant or `src/` behaviour changes. If a note and the code disagree, stop on that note and report it.

## Spec touched

Every `docs/02-systems/NN-*.md` that holds a note, and `docs/04-implementation/schemas/system-state.md`. List them in the commit body.

## Done

- `grep -rn "^Implementation note:" docs/` finds nothing.
- `npm run interface:check` reports 24 documents and 0 differences, and fails when a note is put back.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green. World hashes and render goldens do not move.
- The decision-log rows that only record these notes (D-220 among them) are left for the triage task that owns them. Say in the final message which rows are now redundant.
