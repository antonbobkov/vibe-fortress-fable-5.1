# T-150 — `full-year` plays its year through the real UI

**Source:** T-114 and its report, [`../../reports/audits/2026-10-08-playthrough-coverage.md`](../../reports/audits/2026-10-08-playthrough-coverage.md) (gap 3; bugs 4 and 5) · **Size:** M · **Needs:** — · **Status:** open

## Why

`test/e2e/full-year.spec.ts` is the only browser test that plays for longer than a few game days. It uses the real UI up to the embark. After that it sends every command through `host.world.applyCommand` inside `page.evaluate` (23 call sites), never opens a panel, and advances time with `h.step`. [`../process/testing-strategy.md`](../process/testing-strategy.md) § E2E harness says browser tests "never call `submit` except to set up state faster".

So no test shows that a player can run a fortress for a year with the keyboard and the mouse. The spec also never trades, and it does not assert that no dwarf died although its comment says it does.

## Decisions

- **Every player action in `full-year` goes through keys and the mouse.** That covers the stockpile, the farm plots and their crops, the stairwell, the dig designations, the tree felling, the workshops, the hearth, the zones, the depot, the work orders and the requests. The existing specs already contain helpers for most of them (`build-and-stockpile`, `designate-by-drag`, `farm-plot-and-orders`, `drag-place`, `zones-editor`); move the shared ones into `test/e2e/helpers.ts`.
- **Time may still advance with `h.step`.** A year at 4× through the frame loop is too slow for a test. The spec runs the first game day through the real frame loop at 4× (`Space`, `+`, `+`, then waiting on the calendar) and asserts that the calendar advanced, and steps the rest.
- **Reading state through the hook is allowed**, as everywhere in the suite: to find free tiles, to wait for a building, to collect the events.
- **The spec trades once.** When the Hillfolk caravan stands at the depot it marks goods through the depot panel, opens the session and completes one offer through the trade screen, as `trade-session` does. It asserts one `TradeCompleted`.
- **The spec asserts that no dwarf died**, by counting `CreatureDied` events of faction `fortress` whose species is the dwarf.
- **It also uses, once each and with an assertion on the result:** the jobs panel (the list shows a dig job), the stocks panel (the drink count matches the reader), `Ctrl+Z` on a designation, and a quick save followed by a quick load in mid-summer with the world hash equal before and after.

## What to do

1. Rewrite the setup blocks of `test/e2e/full-year.spec.ts` as UI steps. Keep the tracker, the checkpoints, the three screenshots and the rule-based assertions.
2. Add the trade, the death assertion and the four small uses above.
3. Correct the `full-year` sentence of `testing-strategy.md` § E2E harness so that it says what the spec does: played through the UI, time stepped through the hook after the first day.
4. Run `npm run test:e2e`.

## Done

- `full-year.spec.ts` contains no `applyCommand` and no `submit` call.
- It asserts a completed trade, no dwarf death, and an equal hash across the save and load.
- `npm run test:e2e` is green, and the verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
