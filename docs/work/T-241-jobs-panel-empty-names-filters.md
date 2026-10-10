# T-241 — The Jobs panel: its empty line, job names, filters and labor priority row

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../reports/audits/2026-10-10-ui-audit-follow-up.md) (§5.5, 7.3, new finding N4) · **Size:** M · **Needs:** — · **Status:** open

## Why

Jobs is where a player looks when nothing happens. On this build it shows no line at all when there are no jobs, names a build job by its coordinates, has no filter, and its labor priority row reads `Anim 5 Anim 5 Brew 5`. Stocks also lacks the filter row its wireframe shows.

## Reproduction

Seed `audit-1`, default embark, paused. Open Jobs (`j`): only `0 open · 0 claimed · 0 blocked` and the column header (report shot 11d). Build, Furniture, drag five tables, run 60 ticks, open Jobs: rows read `Build (28,25,z37` and `waiting: 1 t`; there is no `/filter` row; the bottom row reads `Anim 5 Anim 5 Brew 5 Butc 5` (shot 11e). Open Stocks (`s`): the first row is `► food`, with no filter row (shot 15a).

## What the spec says

- [`panels.md`](../04-implementation/ui-screens/panels.md) § Jobs: the wireframe has `/filter: ____  [l]abor [s]tate`, rows such as `Build bed` and `Dig (52,31,z30)`, and the labor priority row `Min 5 Wood 5 Build 5 …`.
- [`11-jobs-and-labor.md`](../02-systems/11-jobs-and-labor.md) § Player-facing behavior: "Filters by labor and state."
- `src/ui/strings.ts` has `ui.jobs.empty` ("No jobs. Designate [d], build [b] or order [o]."). It is drawn at `src/ui/panels/jobs.ts:110`, and the table's list then blanks the same row (`src/ui/widgets/list.ts:38`).
- `panels.md` § Stocks: the wireframe starts with `/filter: ____`.

## What to do

**Decisions.**
- The empty line is drawn after the table, inside its first body row.
- The job column names the target: a job on a building says the building type ("Build bed", "Build carpenter's workshop"), a haul says the item ("Haul log"), and only a job on a bare tile (dig, channel, smooth, engrave, chop, gather) gives coordinates. The target column stays clickable to centre the map.
- The filter row is `/filter: ____  [S-l] labor: all  [S-s] state: all`. `/` focuses the text field (matches the job name or the worker); `[S-l]` cycles all labors that have a job in the list; `[S-s]` cycles all, open, claimed, blocked. The letters are on Shift because `l` and `s` are panel letters (D-U2). The wireframe changes to these captions. Stocks gets the same `/filter` text field.
- The labor priority row lists only labors whose priority is not the default, with full names ("Mining 2 · Hauling 7"); when all are at the default it says "All labors at priority 5: change them in the labor manager ([l], Enter)."

1. Amend `panels.md` § Jobs and § Stocks, and 11 § Player-facing behavior if its wording needs it.
2. Implement in `src/ui/panels/jobs.ts` and `src/ui/panels/stocks.ts`.
3. Tests, `describe('T-241 …')`: empty Jobs shows its line; a build job row names the building; each filter narrows the list; the priority row with defaults and with one change; Stocks filter.

## Done

- The reproduction shows the empty line, `Build table`, the filter row, and a readable priority row.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
