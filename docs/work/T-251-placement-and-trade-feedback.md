# T-251 — A placed building does not look refused; trade stacks merchant goods and answers a paused request

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../reports/audits/2026-10-10-ui-audit-follow-up.md) (new findings N6, N7; R14) · **Size:** M · **Needs:** — · **Status:** open

## Why

- Right after a click places a building, the ghost under the pointer turns red over the new building and the status row says "blocked: something is built here". Success still reads as failure, as in the first audit's § 2.
- In a trade session each merchant item has its own row, so twelve rows say `1 pine cage`, each with its own `[-] 0 [+]`. The spec groups merchant goods as stacks.
- With a caravan at the depot, `[S-t]` while paused says nothing, and the depot panel loses its action row until time runs.

## Reproduction

- Placement: seed `audit-1`, default embark, paused. `b`, `w`, Carpenter's workshop, click a floor tile: the ghost is red and the status row reads "Carpenter's workshop · blocked: something is built here" (report shot 09f).
- Trade: the trade e2e fixture (`?start=flat-test&embark=default`, a depot completed, run until a caravan is at the depot, a broker). Click the depot, `Shift+T` while paused: no message, and the panel shows only its title (shot 18e2). Run until the session opens: the merchant column lists `1 pine cage` twelve times (shot 18f).

## What the spec says

- [`fortress-screen.md`](../04-implementation/ui-screens/fortress-screen.md) § Build tool: the ghost shows whether the next click can place.
- [`trade-session.md`](../04-implementation/ui-screens/trade-session.md): "The left column shows merchant goods grouped as stacks with their *price*".
- [`20-trade-and-caravans.md`](../02-systems/20-trade-and-caravans.md): a session opens when the broker reaches the depot.

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
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
