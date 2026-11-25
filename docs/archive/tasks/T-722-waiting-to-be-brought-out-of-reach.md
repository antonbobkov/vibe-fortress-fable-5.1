# T-722 — A job whose inputs are all in stock but out of reach says they are "to be brought"

**Closed:** 2026-11-25, in 1fc3bf92,55a725e9.

**Source:** T-717 ([work file](T-717-stoneless-site-names-the-stone.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-717 made a job blocked `missing_input` name the input that is short (13 `countAvailable` below what it still needs), and, when every input is counted available, the first undelivered one as "waiting: 1 barrel to be brought". But 11 § Blocked jobs keeps a job blocked `missing_input` while an input counted available lies out of reach of every worker who could take it. Such a job then reads "to be brought" although nobody can bring it: the player is told to wait for hauling when a door, a forbidden tile or a flooded tunnel is the cause. Work orders already have their own line for this ("Skipped: charcoal out of reach", `ui.block.out_of_reach`); building jobs do not.

## What to do

Decisions:

- **When every input of a `missing_input` job is counted available, the line says whether the first undelivered one can be reached**: "waiting: 1 barrel to be brought" when some unit of it is in a connectivity label a worker with the job's labor shares (22's labels, as 11 § Assignment reads them); otherwise "waiting: 1 barrel, out of reach" with the long line "… Every one in stock is out of reach: open a door, unforbid a way, or move it." One rule for buildings, workshop jobs and the Jobs panel (`jobBlockText` in `src/ui/messages.ts`).
- The check reads labels only (no path search), so it stays cheap enough for the Jobs table, which asks for the short line on every visible row.

Spec: `ui-screens/panels.md` § Jobs (the paragraph on a job blocked for its inputs), 11 § Player-facing behavior.

Decisions taken in the work:

- **The reach test is the blocked retry's own search**, not a separate label test per worker: 11's new reader `jobs.unfoundInput(id)` runs the search `retryBlocked` runs for a `missing_input` job (from the job's first stand tile, labels only, nothing reserved) and returns the first input it does not find. The line says "out of reach" exactly when the retry would leave the job blocked, and "to be brought" when the retry will open it. The board's `inputsAvailable` now calls the same split-out helper, unchanged in behaviour.
- **The input named is the one the search does not find**, not always the first undelivered one (they differ only when the first is in reach and a later one is not).
- Long line: "waiting: 1 barrel, out of reach — none in stock can be reached: open a door, unforbid a way, or move one within reach". Where the unit lies is not given: no reader names an out-of-reach unit's place without a second search over the stock.
- A job read without its id (a synthetic job in a test) is never read as out of reach.

## Done

- [x] Tests (`describe` with the task id, `test/unit/ui/t722-input-out-of-reach.test.ts`): a still whose only barrel is walled in (labels cut as by a locked door) reads "out of reach" and its job stays blocked across retries; with the wall gone it reads "to be brought" and the retry opens the job; a barrel in reach from the start reads "to be brought".
- [x] UI only; world hashes unchanged (the retry's search is split out, not changed).
- [x] Spec: 11 § Reader and § Player-facing behavior, `panels.md` § Jobs.
