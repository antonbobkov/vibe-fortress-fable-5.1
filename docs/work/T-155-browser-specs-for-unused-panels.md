# T-155 — Browser specs for the panels and screens that are only opened

**Source:** T-114 and its report, [`../../reports/audits/2026-10-08-playthrough-coverage.md`](../../reports/audits/2026-10-08-playthrough-coverage.md) (gap 7; the screens and panels table) · **Size:** L · **Needs:** — · **Status:** open

## Why

`panels-open-and-close` opens every panel and checks its title. Nothing else in `test/e2e/` touches the stocks, jobs, animals, threats, population, mood, log, look or help panels. The legend screen is never reached and no fortress is retired. The embark screen is used only for "Balanced preset, Enter". These panels have jsdom unit tests, which do not show that the key reaches the panel, the command reaches the simulation and the screen shows the result.

## Decisions

- **Four new specs.** None changes an existing spec, and none changes `full-year` (T-150).
  1. `panels-act.spec.ts`, on `?start=flat-test&embark=default` with a few items and buildings set up through the hook:
     - stocks: forbid an item type, mark one for dumping, mark a metal item for melting; assert the item flags through the reader;
     - jobs: cancel a job and change another's priority; assert through the jobs reader;
     - orders: remove and reorder a work order, toggle one standing order;
     - units: give a title, shift a dwarf's sleep hour;
     - population: change the cap; assert through the immigration reader;
     - mood, threats, log and look: assert that each shows a line that matches the reader (a dwarf's mood tier, the renown, a logged announcement after a filter change, the material of the tile under the cursor);
     - overlays: toggle each overlay and assert that the cell buffer changes;
     - map: `Ctrl+Z` undoes a designation batch; `Delete` on a selection cancels a planned building and removes a zone; a rectangle selection forbids items.
  2. `animals-panel.spec.ts`, same start with tame animals from the embark: mark and unmark for slaughter, assign to a pasture, set a breeding cap, toggle a huntable species; assert through the animals and foraging readers.
  3. `embark-custom.spec.ts`: on the embark screen, change a skill, reroll and rename a dwarf, change a supply count and an animal count, rename the fortress, embark; assert the arrived party and stock through the readers.
  4. `retire-and-legend.spec.ts`: play a few hundred ticks, retire through the game menu and its confirmation, assert the legend screen, return to the main menu, open Legends and assert that the fortress is listed.
- **Setup through the hook is allowed** for state only (spawned items, finished buildings), as in the existing specs. Every action under test is a key press or a mouse action.
- **Each spec saves a screenshot** as the harness requires.

## What to do

1. Write the four specs. Put shared helpers in `test/e2e/helpers.ts`.
2. Add them to the suite list in `testing-strategy.md` § E2E harness.
3. A panel action that has no effect or shows a raw string key is a bug: file a row with the screenshot named, and leave the assertion in as a `test.fixme` naming the row.
4. Run `npm run test:e2e`.

## Progress (2026-10-10)

- Done:
  - `retire-and-legend.spec.ts`: plays a few hundred ticks, retires through the game menu and its confirmation, asserts the legend screen, returns to the main menu, opens Legends and asserts that the fortress is listed.
  - `embark-custom.spec.ts`: changes a skill, rerolls and renames a dwarf, changes supply and animal counts, renames the fortress, embarks and asserts the arrived party and stocks through the readers.
  - `animals-panel.spec.ts`: marks and unmarks for slaughter, assigns to pasture, sets breeding cap, toggles huntable species on the wild tab; asserts through animals and foraging readers.
- Remaining:
  - `panels-act.spec.ts`

## Done

- The four specs pass in `npm run test:e2e`.
- Every panel of `03-content/ui-keymap-and-screens.md` § Fortress panels has at least one browser assertion on an effect, and the legend screen is reached.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
