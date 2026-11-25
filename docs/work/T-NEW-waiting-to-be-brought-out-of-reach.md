# T-NEW — A job whose inputs are all in stock but out of reach says they are "to be brought"

**Source:** T-717 ([work file](T-717-stoneless-site-names-the-stone.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-717 made a job blocked `missing_input` name the input that is short (13 `countAvailable` below what it still needs), and, when every input is counted available, the first undelivered one as "waiting: 1 barrel to be brought". But 11 § Blocked jobs keeps a job blocked `missing_input` while an input counted available lies out of reach of every worker who could take it. Such a job then reads "to be brought" although nobody can bring it: the player is told to wait for hauling when a door, a forbidden tile or a flooded tunnel is the cause. Work orders already have their own line for this ("Skipped: charcoal out of reach", `ui.block.out_of_reach`); building jobs do not.

## What to do

Decisions:

- **When every input of a `missing_input` job is counted available, the line says whether the first undelivered one can be reached**: "waiting: 1 barrel to be brought" when some unit of it is in a connectivity label a worker with the job's labor shares (22's labels, as 11 § Assignment reads them); otherwise "waiting: 1 barrel, out of reach" with the long line "… Every one in stock is out of reach: open a door, unforbid a way, or move it." One rule for buildings, workshop jobs and the Jobs panel (`jobBlockText` in `src/ui/messages.ts`).
- The check reads labels only (no path search), so it stays cheap enough for the Jobs table, which asks for the short line on every visible row.

Spec: `ui-screens/panels.md` § Jobs (the paragraph on a job blocked for its inputs), 11 § Player-facing behavior.

## Done

- [ ] Tests (`describe` with the task id): a still whose only barrel lies behind a locked door reads "out of reach"; with the door open it reads "to be brought".
- [ ] UI only; world hashes unchanged.
