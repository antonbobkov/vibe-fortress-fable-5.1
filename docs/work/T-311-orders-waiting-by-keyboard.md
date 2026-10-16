# T-311 — The "Orders waiting" rows in Jobs can be reached by keyboard

**Source:** T-276 (the decision "`Enter` on a row opens Orders with that order selected"; only the click is done) · **Size:** S · **Needs:** — · **Status:** open

## Why

The Jobs panel lists up to three work orders that no job serves, and a click on a row opens Orders on that order. The rows are not in the job list's cursor, so a player with the keyboard cannot reach them.

## What to do

**Decisions.**
- `Tab` in the Jobs panel moves the cursor between the job list and the "Orders waiting" rows; on a waiting row `↑↓` move and `Enter` opens Orders with that order selected, as the click does.
- The section lists every waiting order, scrolling when more than three do not fit.

1. Amend `panels.md` § Jobs.
2. Implement in `src/ui/panels/jobs.ts` and `src/ui/screens/fortress.ts` (the Jobs keys).
3. Tests, `describe('T-311 …')`: `Tab` reaches a waiting row, `Enter` opens Orders on it.

## Done

- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.

## Decisions made in the work

- The cursor on a waiting row is drawn inverted with a `►` in the margin; the job list keeps its own highlight, since the detail line under the list still follows it.
- The section title reads "Orders waiting (n) [Tab]" so the key is found; `Tab` is the sidebar key again when no order waits.
- Only three rows show; the window follows the cursor, so a fourth or later order is reached by `↓`.
