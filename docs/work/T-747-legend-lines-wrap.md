# T-747 — The legend cuts its lines at the screen's edge: "The last dwarf, Gunnar Cop"

**Source:** playtest 2026-11-25 (peril 4) ([report](../../reports/data/2026-11-25-playtest-4.md), finding 3) · **Size:** S · **Needs:** — · **Status:** open

## Why

A peril-4 fortress (`playtest-1125-p4c`, "Emberstair") fell silent on Day 24 of Autumn, Year 1, after the player met a raid of 11 on Calm with three soldiers. The legend then opened at 1280 × 800, which is 80 columns (`43-c-legend.png`). Its epitaph ended at the screen's edge: "The hall fell silent on Day 24 of Autumn, Year 1. The last dwarf, Gunnar Cop". The rest of the dwarf's name and the cause were gone, and no "»" marked the cut. Three of the 23 last words were cut too: "… the largest stack is 6 turnip in Stockpi", "! 3 dwarves are fighting 3 gloam archers, 5 gloam warriors and a gloam cap", and the raid's arrival line, "… The alert is Calm: [m] [3] sends". The legend is the one screen a player reads to find out how the fortress ended, and its last sentence is the one that is cut.

`src/ui/screens/legend.ts` draws each line sliced to `cols − 4` characters. `ui-screens/menus-and-world.md` § Legend shows the fall and the last dwarf on separate lines ("Fell on Day 4 of Winter, Year 4." / "The last dwarf, Solveig Deephand, died of her wounds."). The record writes them as one sentence pair on one line.

## What to do

Decisions:

- **Every legend line wraps at the screen's width**, at word boundaries. A continuation is indented two cells under the line's own text: a last word's continuation lines up after its "!! " or "! " mark, and a milestone's after its date.
- **The cause starts its own line after the date sentence.** "The hall fell silent on Day 24 of Autumn, Year 1." is one line and "The last dwarf, Gunnar Copperroot, …" the next, as the spec's picture has it.
- The scroll counts wrapped rows: the scroll line's total, `PageDown`, `End` and the clamp of T-720 work on them.
- The Legends list's rows and the world-map region panel's fortress names keep one row each, and end in "»" when cut (T-703's rule).

Spec: `ui-screens/menus-and-world.md` § Legend (the lines wrap, the picture's two cause lines), 24 § The legend record if it says how the cause is laid out.

## Done

- [ ] Tests (`describe` with the task id, jsdom): a record whose cause, one milestone and two last words are longer than 76 cells shows every word on screen at 80 columns, with each continuation indented. The cause's last-dwarf sentence starts a new row. `End` reaches the last wrapped row and the scroll line's total counts wrapped rows. A Legends list row too long for its row ends in "»".
- [ ] UI only: no world hash moves and no sweep is needed.
