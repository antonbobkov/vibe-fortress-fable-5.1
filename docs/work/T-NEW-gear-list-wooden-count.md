# T-NEW — The weapon list counts training weapons as stock

**Source:** T-654 (the armed line counts wooden weapons apart; `test/unit/ui/t654-armed-line-wood.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-654 the Military panel's armed line counts training weapons apart from real ones (`Armed 6 of 6 (6 wooden)`), and its stock line leaves free training weapons out, so a spare wooden sword no longer hides `No sword in stock`. The `[w] weapon` list under it still counts them with the real ones. In T-654's test fortress, a spare oak training sword makes the list read `sword (1, current)` while the stock line under the armed line says `No sword in stock`. The list says which of its weapons are tools (`axe (1, a tool)`) but not which are wooden.

## What to do

Have each weapon list row say how many of its free weapons are training weapons, as it does for tools: for example `sword (1, wooden)`, `sword (3, one wooden)`, `sword (4, 2 wooden)`. `weaponStock` in `src/ui/panels/gear.ts` already returns the count (`training`). Pick wording that reads well next to the tool note when a row has both (an `any` row can have both).

Spec: `ui-screens/panels.md` § Military (the `[w] weapon` list).

## Done

A UI test: with a spare training sword free and no real sword, the list's sword row says the one sword is wooden; with an iron sword added, it counts two, one wooden.
