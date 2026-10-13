# T-251 — A placed building does not look refused; trade stacks merchant goods and answers a paused request

Closed by `T-251: show placement success and group merchant stacks`.

## Progress, 2026-10-12

The decided UI changes are implemented. Three corrected reproductions failed before the fix: placement immediately looked blocked, twelve matching merchant cage entities appeared as separate rows, and the paused broker request had no notice. Placement holds the ghost hidden across the whole footprint, including while another notice replaces the success text; a rejected placement releases the hold. Merchant grouping keeps type/material/quality separate and distributes selections to the underlying ids; totals use their individual prices. Depot requests announce the broker journey and pause hint, retaining the action row.

Five T-251 tests pass, together with the affected UI suites: 108 tests. The hotkey table includes held-placement feedback. All six static checks passed (`t251-final-static2` logs under ignored `.vite/task-resume/`). The official `golden:update -- render/m7-trade-ui` selector passes all 17 golden files / 71 tests; only merchant plural naming changed, with world hashes unchanged. `test/unit/ui/u04-drag-place.test.ts` updates only the post-click status string to include "Bed placed", retaining its stock count and order shortcut. The trade browser spec navigates grouped rather than raw item rows and adds pending-request notice/action-row assertions; trade completion and reputation assertions are unchanged.

Completed verification: `npm test` passes 288 files / 2538 tests (626.71 s); the WHOLE `npm run test:e2e` passes 25 tests (4.1 min), including the updated trade scenario. Screenshots were restored. Before and after full-year end-state lines are identical: 6 living, no hunger/thirst deaths, hash `008a55e9dabe420b`; complete lines are in the commit body. All six static checks pass, with docs:check rerun at closure. The master merge before this task changed no src/ or full-year fixture files. No long fixture was tuned.

**Source:** T-111 and its report, [`../../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../../reports/audits/2026-10-10-ui-audit-follow-up.md) (new findings N6, N7; R14) · **Size:** M · **Needs:** — · **Status:** open

## Why

- Right after a click places a building, the ghost under the pointer turns red over the new building and the status row says "blocked: something is built here". Success still reads as failure, as in the first audit's § 2.
- In a trade session each merchant item has its own row, so twelve rows say `1 pine cage`, each with its own `[-] 0 [+]`. The spec groups merchant goods as stacks.
- With a caravan at the depot, `[S-t]` while paused says nothing, and the depot panel loses its action row until time runs.

## Reproduction

- Placement: seed `audit-1`, default embark, paused. `b`, `w`, Carpenter's workshop, click a floor tile: the ghost is red and the status row reads "Carpenter's workshop · blocked: something is built here" (report shot 09f).
- Trade: the trade e2e fixture (`?start=flat-test&embark=default`, a depot completed, run until a caravan is at the depot, a broker). Click the depot, `Shift+T` while paused: no message, and the panel shows only its title (shot 18e2). Run until the session opens: the merchant column lists `1 pine cage` twelve times (shot 18f).

## What the spec says

- [`fortress-screen.md`](../../04-implementation/ui-screens/fortress-screen.md) § Build tool: the ghost shows whether the next click can place.
- [`trade-session.md`](../../04-implementation/ui-screens/trade-session.md): "The left column shows merchant goods grouped as stacks with their *price*".
- [`20-trade-and-caravans.md`](../../02-systems/20-trade-and-caravans.md): a session opens when the broker reaches the depot.

## What to do

**Decisions.**
- After a placement, the ghost is not drawn until the pointer leaves the placed footprint, and the status row says "Carpenter's workshop placed" (or "Table x5 placed …" as now for a drag) until then.
- The trade session groups merchant goods that share item type, material and quality into one row with the count (`12 pine cages`); `+`/`-` choose how many of the stack to take, within the count, and `Home`/`End` take none or all. The offer sends the matching item ids.
- `[S-t]` with a caravan at the depot says "The broker is on the way to the depot." (and, while paused, adds "· [Space] resumes"); the depot panel keeps its action row.

1. Amend `fortress-screen.md` § Build tool, `trade-session.md`, and `panels.md` § Depot if its rows change.
2. Implement in `src/ui/screens/fortress.ts` and `src/ui/panels/build.ts` (ghost), `src/ui/screens/trade_session.ts` (stacks), `src/ui/panels/depot.ts` (message).
3. Tests, `describe('T-251 …')`: ghost hidden after a placement; a stacked merchant row and a partial take; the trade request message. Extend `test/e2e/trade-session.spec.ts` only if its existing steps change.

## Done

- The reproductions show no red ghost after a placement, stacked merchant goods, and a message on `[S-t]`.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
