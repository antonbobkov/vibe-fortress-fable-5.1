# T-340 — The Depot panel names a stack of goods in the singular

**Closed:** 2026-10-16, in 746a3f2, 21b2da1.

**Source:** review of T-332 (the stored depot buffer said "10 easy meal"; the trade session says "10 easy meals") · **Size:** S · **Needs:** — · **Status:** open

## Why

A row of the Depot panel prints `{count} {item name}` with the item's singular name, so a stack reads "10 easy meal  100 ☼" (`src/ui/panels/depot.ts`, the row label). The trade session prints the plural ("10 easy meals"). The naming rule of T-279 (an item stack is named in the plural when its count is above one) is not applied here.

## What to do

**Decisions.**
- The Depot row names a stack with `materialItemName` of `src/ui/messages.ts`, the call the trade session makes: the material and the item type's name, in the type's `plural` for a count above one and the singular for one. (`pluralName` is the creature rule and is not used for items; `24-ui-and-input.md` already says that every list that names items names them by material and type.)

1. `panels.md` § Depot and `24-ui-and-input.md` already say how items are named; no spec edit.
2. Implement in `src/ui/panels/depot.ts`.
3. Tests, `describe('T-340 …')`: a stack of ten and a stack of one in the Depot panel; extend `test/unit/ui/t332-panels-trade.test.ts` (its depot row reads "10 easy meals").

## Done

- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
