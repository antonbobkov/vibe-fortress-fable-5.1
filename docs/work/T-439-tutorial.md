# T-439 — A step-by-step scripted tutorial

**Source:** the owner, 2026-10-23 (first play session) · **Size:** L · **Needs:** T-437, T-441 · **Status:** open

## Why

The owner wants new players walked through the basics at the start of a game.

## Decisions

1. **When.** A "Tutorial" choice on the main menu (and offered on the first ever New world) starts a tutorial fortress on a fixed, friendly seed: temperate forest, peril 0, a river, soil and trees.
2. **Steps.** A sequence, each with a short instruction, a highlight of the relevant UI or map area, and a completion check read from the simulation or the UI:
   1. Move the view and change z-level.
   2. Look at a tile and a dwarf, with the look panel.
   3. Designate a dig with a two-click rectangle (T-441), and watch it blink while queued (T-437).
   4. Dig stairs down.
   5. Make a stockpile.
   6. Build a workshop.
   7. Queue an order.
   8. Make a farm plot.
   9. Set labors.
   10. Pause and change speed.
   11. Save.
   Each step waits for the player. It can be skipped. The whole tutorial can be ended at any time.
3. **Data.** The steps are content (a new content table): the text through strings, and the checks named from a fixed set of predicates in code.
4. **Determinism.** The tutorial changes no simulation rule. It only reads state and highlights.
5. Write the spec first: a new tutorial section in the menus doc.

## Done

- A unit test per step predicate.
- An e2e test that plays the whole tutorial through by commands and checks each step completes.
- The gates pass.
