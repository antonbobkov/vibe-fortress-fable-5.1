# T-150 — `full-year` plays its year through the real UI

**Source:** T-114 and its report, [`../../reports/audits/2026-10-08-playthrough-coverage.md`](../../reports/audits/2026-10-08-playthrough-coverage.md) (gap 3; bugs 4 and 5) · **Size:** M · **Needs:** — · **Status:** in progress (t-150)

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
- **Food margin:** Make the fortress one a sensible player would run: enough farm plots for the population by the spec's own figure (`docs/03-content/balance.md`: food chain 0.25 plants per farm tile per day, 0.48 food units and 0.77 drinks per dwarf per day), a cook and a brewer with standing orders, a barrel order when the still is built. Assertions: on the last day meals + plant food >= 10 days for living dwarves, drink >= 10 days, and no `Starving` event occurred all year.
- **Wild animals:** Kept on (do not switch them off). If a threat is announced, respond through the UI as a player would. If a civilian is killed by a hungry predator despite sensible response, record details in Progress, mark that single assertion `test.fixme` naming task T-212.
- **Bugs:** Any game bug discovered when executing keymap actions is filed in `docs/backlog.md` (T-200 to T-209) and `docs/work/T-20n-<slug>.md` with exact keys pressed and reader output; the hook is then used for that one step naming the task.

## What to do

1. Rewrite the setup blocks of `test/e2e/full-year.spec.ts` as UI steps. Keep the tracker, the checkpoints, the three screenshots and the rule-based assertions.
2. Add the trade, the death assertion and the four small uses above.
3. Correct the `full-year` sentence of `testing-strategy.md` § E2E harness so that it says what the spec does: played through the UI, time stepped through the hook after the first day.
4. Run `npm run test:e2e`.

## Progress

### 2026-10-10 (Stage 1)
- Moved shared E2E helpers (`ui`, `tilePixel`, `clickTile`, `dragTiles`, `textCell`, `clickText`) into `test/e2e/helpers.ts`.
- Updated `build-and-stockpile.spec.ts`, `zones-editor.spec.ts`, and `farm-plot-and-orders.spec.ts` to import them from `./helpers`.
- Remaining `applyCommand` calls in `full-year.spec.ts`: 23. Remaining `submit` calls: 0.
- `full-year.spec.ts` runtime: ~47.0s.
- Whole E2E suite passes (24 tests, ~3.1m).

### 2026-10-10 (Stage 2)
- Converted all 23 fortress setup `applyCommand` calls to UI keyboard and mouse actions:
  - Surface stockpile dragged with `Shift+P` preset `[Everything]`.
  - Surface turnip and barley farm plots created and configured via `textCell`.
  - Dig designations: 6-level entrance stairwell (`d`, `w`), 8x4 cave room on `wz - 2`, 5x5 stone hall on `wz - 3`.
  - Tree chopping: 10 closest trees to wagon designated plus west-edge barrier at `x: 0..3, y: 16..20` cleared to ensure caravan access.
  - Workshops placed: Carpenter, Mason, Still, Kitchen via `placeBuilding`.
  - Special buildings placed: Hearth and Trade depot via `placeBuilding('Shift+S', ...)`.
  - Zones created: Meeting area and Bedrooms via UI drag.
  - Underground cave farm plot (8x4) created on `wz - 2` with dimcap set for 4 seasons.
  - Mountainhome anvil requested via `c` diplomacy panel.
  - Work orders added via `addWorkOrder`: barrels (maintain 20), blocks (once 4), brew drink (maintain 100), easy meals (maintain 60).
- Fixed food margin requirement (T-150 decision a):
  - Fixed meal stock reading to count `easy_meal`, `fine_meal`, and `lavish_meal` (instead of non-existent item id `'meal'`).
  - Day 112 stocks: 95 food (45 easy meals + 50 plant food) >= 57.6 (10 days for 12 dwarves).
  - Day 112 drink: 103 >= 92.4 (10 days for 12 dwarves).
  - 0 starving events throughout the year.
- Verified caravan arrivals: Hillfolk caravan at Day 45, Wildwood caravan at Day 73, Mountainhome scheduled Day 129.
- 0 dwarf deaths all year (12 living dwarves at end).
- Remaining `applyCommand` calls: 0. Remaining `submit` calls: 0.
### 2026-10-10 (Stage 3)
- Merged `master` into `t-150`.
- Ran the first game day through the real browser frame loop at 4× (`Space`, `+`, `+`), polling until `calendar.tick >= 1200` and asserting day 1 elapsed through the real frame loop. Time after day 1 is stepped with `h.step`.
- Trade depot configured with non-flammable stone/granite, clearing surrounding trees to prevent wildfire spread.
- Food margins comfortably met: 140 cave crops planted, 156 harvests, Day 112 stocks: 96 drink, 59 meals, 93 plant food (152 total food), 0 starving events all year.
- Wild animal predator encounter: on Day 42, civilian Ragnhild Deepbrook died to wildlife predator hunting (killer 50331774, bled out); per Decision b, recorded details in Progress and marked assertion `test.fixme` naming task T-212.
- Remaining `applyCommand` calls: 0. Remaining `submit` calls: 0.
- `full-year.spec.ts` runtime: ~1.2m.

## Done

- `full-year.spec.ts` contains no `applyCommand` and no `submit` call.
- It asserts a completed trade, no dwarf death, and an equal hash across the save and load.
- `npm run test:e2e` is green, and the verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
