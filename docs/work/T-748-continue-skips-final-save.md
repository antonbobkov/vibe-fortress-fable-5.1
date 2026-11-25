# T-748 — Continue reopens a fallen fortress, and nothing on screen says it has ended

**Source:** playtest 2026-11-25 (peril 4) ([report](../../reports/data/2026-11-25-playtest-4.md), finding 4) · **Size:** S · **Needs:** — · **Status:** open

## Why

"Emberstair" (`playtest-1125-p4c`) fell on Day 24 of Autumn, Year 1, and its legend showed. After `Esc` the main menu offered "[c] Continue (Emberstair · Year 1)". Continue loaded the fortress's `final-` save (`44-continue-fallen.png`). The map showed 0 dwarves, paused, with the status bar and the panel keys as in play, and the last death line was in the strip twice ("!! Gunnar Copperroot has been killed by a gloam captain." ×2). `Space` and stepping did not move the date. Nothing said that the fortress had fallen or that this was a view-only record. On the Load screen the same save sat under "Finished" as "Emberstair · Day 24 of Autumn, Year 1 · 0 dwarves · 4,563 ☼" (`45-load-after-fall.png`), which reads like any save. The spec's picture shows "Coldvein Hold · fell in Year 4 (view only)".

`continueNewest` and `newestSaveSummary` (`src/app/game.ts`) take the save with the highest tick of any kind, and the final save is written at the fall, so it is always the newest. A player who comes back the next day and presses Continue lands on a dead, frozen fortress, with no sign of why the game will not run.

## What to do

Decisions:

- **Continue skips final saves.** It loads the newest save that is not a `final` one, and its summary in the menu names that save. With only final saves left, Continue is hidden.
- **The Load screen's Finished rows say how the fortress ended**: "Emberstair · fell in Year 1 (view only)". A retired fortress reads "retired in Year n" and an abandoned one "abandoned in Year n", taken from the save header's end, or from the legend record when the header has no end.
- **A view-only fortress says so.** While a final save is open, the status bar's message row reads "Emberstair fell on Day 24 of Autumn, Year 1. View only: [Esc] menu." (`ui.final_view`), in place of the speed and pause marks, and `Space` shows the same line rather than doing nothing.
- The last log line shows once in the strip of a loaded final save.

Spec: `ui-screens/menus-and-world.md` § Main menu (Continue), § Load (the Finished row), 24 § The legend record (the view-only save as the player sees it).

## Done

- [ ] Tests (`describe` with the task id): with a manual save (tick 1,000) and a final save (tick 2,000), the main menu's Continue summary and load pick the manual one. With only the final save, Continue is hidden. The Load screen's Finished row reads "fell in Year 1 (view only)". A loaded final save shows the view-only line in the status bar, `Space` keeps it there, and the strip's last line is not doubled.
- [ ] UI and app only: no world hash moves and no sweep is needed.
