# T-142 — The trade job outlives its caravan and its broker

Closed by the T-142: keep trade jobs with the caravan stay and current broker commit.

**Source:** T-123 and its report, [`../../../reports/audits/2026-10-08-economy-at-default-priority.md`](../../../reports/audits/2026-10-08-economy-at-default-priority.md) (§ The trade job outlives its caravan and its broker) · **Size:** S · **Needs:** — · **Status:** open

## Why

`TradeOpen` creates the job `trade:<depot>` and writes the Broker of that moment into it as the assigned worker (`src/systems/trade/index.ts:254–266`). Nothing cancels the job when the caravan leaves, when the Broker dies or when the title passes to another dwarf. A job with an assigned worker is offered to that worker only (`src/systems/jobs/board.ts:737–739`).

Measured: the job created on day 125 for a Broker who died on day 140 was still open on day 293. `TradeOpen` returned ok at five later visits and created nothing, because the key already existed. No session could open for 196 days.

## Decision

- **The trade job belongs to one caravan stay.** It is cancelled when the caravan leaves the depot.
- **It follows the title.** If the assigned Broker dies, loses the title or has `trading` turned off, the job is re-issued for the present Broker, or for any dwarf with the labor when there is none.
- **`TradeOpen` with a job already waiting returns ok and repairs the job's worker.**

## What to do

1. Amend `20` § Trading, the `TradeOpen` line, with the three rules.
2. Implement in `trade/index.ts`: the caravan's state change, `CreatureDied`, `TitleAssigned`.
3. Unit tests: the job is gone after the caravan leaves; a dead Broker's job passes to the new Broker within the same stay.

## Done

- The tests pass, with `describe('T-142 …')`.
- `interface:check` passes if `20` subscribes to a new event.
