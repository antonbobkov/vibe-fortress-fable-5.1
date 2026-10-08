# T-109 — Balance status: one row per measure, latest figure only

Closed by the T-109 balance-status commit: latest evidence is filed, the whole journal is archived, and B-008 through B-012 await T-123.

**Source:** [`docs-restructure.md`](../../work/docs-restructure.md) § Where deltas are accumulating (item 3), § One-time migration (step 3) · **Size:** S · **Needs:** F-17 (its re-measure is the latest figure) · **Status:** open

## Why

The balance findings B-001 … B-012 are a measurement journal inside the decision log. B-008 alone has about ten dated "Re-measured after …" lines. Only the latest state matters to someone deciding what to tune.

## What to do

1. Write `docs/balance-status.md`: one table, one row per measure (wealth by year, immigration waves, raid sizes by peril, mood, food and drink consumption, survival by peril, and any other measure the reports track). Columns: measure; model, with the section of `03-content/balance.md` it comes from; measured, the latest figure; fixture and seeds; the report the figure comes from; verdict (within 30%, fixture, bug, or model gap with the constant and the value that would close it).
   - It is a living document. A later re-measure overwrites the row. It holds no history, and no date except through the report it links.
   - The name is `balance-status.md` because `docs/03-content/balance.md` is the model itself.
2. Take the figures from the latest reports only: [`../../../reports/audits/M8-balance-economy.md`](../../../reports/audits/M8-balance-economy.md) and whatever F-17's re-measure produced.
3. Delete the § Balance findings table and its journal lines from [`../../05-plan/DECISIONS.md`](../../05-plan/DECISIONS.md). Move the journal whole to `docs/archive/decisions-archive.md`.
4. In [`../../backlog.md`](../../backlog.md), delete the rows B-008 … B-012. For each measure that is still a model gap or a bug after F-17, add one `T-1nn` row with `balance-status.md` as its source. Do not change a constant.
5. Add `balance-status.md` to the table in [`../../README.md`](../../README.md), and to § Reports and audits in [`../../process/agent-workflow.md`](../../process/agent-workflow.md): a re-measure is a new dated report, and the matching row of `balance-status.md` is overwritten.

## Done

- `docs/balance-status.md` exists, and every figure in it can be found in the report its row links.
- No `B-` row is left in the log or the backlog.
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green.
