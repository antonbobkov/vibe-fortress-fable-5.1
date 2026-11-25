# T-NEW — Import leaves the Load cursor on the old save, so Enter loads the wrong fortress

**Source:** playtest 2026-11-25 (peril 4) ([report](../../reports/data/2026-11-25-playtest-4.md), finding 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

The Load screen held one save, "Vein Hearth · Day 13 of Summer, Year 1", which was selected. I pressed `[i] Import` and chose a later save of the same fortress (Day 20 of Autumn). It was listed at the top, but the ▶ stayed on the Summer save, now on the second row, so `Enter` loaded Day 13 of Summer. I only noticed because the date was wrong. Importing the same file again left the cursor on the earlier copy (`46-load-after-import.png`). The import a player has just made is almost always the one they want to open.

`src/ui/screens/load.ts` keeps the selection by id (`selected`), and the import does not change it.

## What to do

Decisions:

- **After a successful import, the selection moves to the imported save**, and its thumbnail shows. A failed import leaves the selection where it was.

Spec: `ui-screens/menus-and-world.md` § Load (Import: "the imported save is selected").

## Done

- [ ] Tests (`describe` with the task id): with one save selected, importing a second puts the ▶ on the imported one and `Enter` loads it (its world hash). A failed import keeps the old selection. Extend `test/e2e/export-import.spec.ts` to import with a second save present, or write a jsdom unit test of the Load screen.
- [ ] UI only: no world hash moves and no sweep is needed.
