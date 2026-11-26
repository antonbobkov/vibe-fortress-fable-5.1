# T-775 — The Build list breaks "(no mechanism)" in the middle of the word

**Source:** playtest 2026-11-25 (military) ([report](../../reports/data/2026-11-25-playtest-6.md), finding 8) · **Size:** S · **Needs:** — · **Status:** open

## Why

Build › Traps, with no mechanism in stock (`playtest-1125-p3m`, Spring 28, Year 2, the 36-column sidebar at 1280 × 800), reads (`13-build-traps-wrap.png`):

```
Cage trap
  1 mechanism+1 cage (no mechanis
  m)
Stone-fall trap
  1 mechanism+1 stone (no mechani
  sm)
Weapon trap
  1 mechanism+1 weapon (no mechan
  ism)
```

Build › Mechanisms has "Drawbridge / n block+1 mechanism (no mechani / sm)". These are the rows a player reads when planning a gate's traps and its bridge, and the word that breaks is the one that says what to make.

The cause is in `buildRowLines` (`src/ui/panels/build.ts`): when a row does not fit, it joins each input to its number and the count to the last input with no-break spaces, so "1 mechanism+1 cage (no mechanism)" becomes one 33-cell token in a 31-cell row, and the wrapper cuts it where the row ends. The comment says '"(no stone)" is not cut', which holds only while the token fits.

## What to do

Decisions:

- **The count may go to its own row.** The no-break space between the last input and the count is an ordinary space, so a row that does not fit puts "(no mechanism)" on the next row: "1 mechanism+1 cage" / "(no mechanism)". Inside the count the spaces stay no-break, and each input stays whole with its number, as now.
- **A token longer than the row is still cut**, but only one that is longer alone (an input name of more than a row's cells), never two joined tokens.
- **Made in the work (2026-11-25):** the inputs of a row ("1 mechanism+1 cage") stay one word, as before: the `+` is not a break. Every list of inputs in the six categories fits a 29-cell hanging row, and the test over all six at 31 cells would catch one that did not. Where the inputs fit beside the name, the name keeps them on its first row ("Cage trap 1 mechanism+1 cage" / "(no mechanism)"); a longer one goes under the name ("Weapon trap" / "1 mechanism+1 weapon" / "(no mechanism)").

Spec: `ui-screens/fortress-screen.md` § Build tool (a sentence on how a row too long for its line wraps).

## Done

- [x] Tests (`describe` with the task id): the Traps rows at 31 cells with no mechanism wrap as "1 mechanism+1 cage" / "(no mechanism)", and no row of Build's six categories at 31 cells has a line that ends inside a word.
- [x] UI only: no world hash moves.
