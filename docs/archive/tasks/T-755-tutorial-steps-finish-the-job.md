# T-755 — The tutorial's steps pass before the thing works: a stockpile that takes nothing, a farm with no crop, Bedroom for Build, nine steps paused

**Closed:** 2026-11-25, in 8ee83cc4,5576f017.

**Source:** playtest 2026-11-25 (newcomer) ([report](../../../reports/data/2026-11-25-playtest-5.md), finding 1) · **Size:** S · **Needs:** — · **Status:** open

## Why

A newcomer who does exactly what the tutorial box says ends it with a fortress that does not work. Main menu, `[t] Tutorial`, at 1280 × 800:

- **Step 5 (`stockpile`)** says "Open Zones with [z], choose a stockpile with [s], and drag a rectangle over open floor". Doing that makes "Stockpile #1 · 21 tiles" whose settings read "[p] Preset [Nothing ▼] / Takes nothing: choose a Preset." The step's check (`stockpile_made`: a stockpile exists) passes at once and step 6 replaces the text, so nothing tells the player to choose a Preset. Nothing is ever hauled to that stockpile (`09-tutorial-stockpile.png`). Help's Start page says it ("a new stockpile takes nothing"); the tutorial does not.
- **Step 6 (`workshop`)** says "Open Build with [b] (from the zones menu, Esc first)". From a new zone's settings, one `Esc` goes back to the Zones menu, where `b` is **Bedroom**: the status row read "Bedroom · drag a rectangle". It takes two `Esc` to close Zones (`10-tutorial-workshops.png`).
- **Step 8 (`farm`)** says "Its settings then show: choose its crop for each season". The check (`farm_plot_made`) passes as soon as the plot exists, so the step-9 labors text replaces the crop instruction while the plot's four seasons read "none" (`13-tutorial-farm.png`).
- **Steps 3 to 9 all run paused.** Time is first explained in step 10 (`speed`). Until then the dig blinks, the workshop stays a plan, and placing an order says "No carpenter's workshop is built yet: [b] Build > Workshops" about the workshop the player has just placed. Only step 6 hints at it ("Dwarves build it once time runs").

Steps 3 and 6 have smaller troubles too. Step 3 ("Go down a level with [<] into the rock") makes a box under the grass that no one can reach ("Dig: 30 designated · no dwarf can reach it yet", `07-tutorial-dig-box.png`); step 4's stair shaft then reaches it. On the tutorial's forest site the workshop's ghost was refused on 7 of 8 spots tried, because of trees (finding 2, its own work file).

## What to do

Decisions:

- **The `speed` step moves to third**, after `look` and before `dig`, so the player knows time from the first job on. It keeps its text and its check. The `dig` text ends: "They start once time runs: [Space]."
- **`stockpile` asks for the preset.** Text: "Hauled goods need a place. Open Zones with [z], choose a stockpile with [s], and drag a rectangle over open floor. A new stockpile takes nothing: choose its Preset with [p] (Everything will do)." Check `stockpile_made` becomes: a stockpile exists that accepts at least one item category.
- **`workshop` says how to leave Zones.** Text: "Close Zones with Esc (twice from a zone's settings), then open Build with [b] and [w] for the workshops. …" (the rest unchanged).
- **`farm` waits for the crop.** Check `farm_plot_made` becomes: a farm plot exists with a crop chosen for the current season.
- **`dig` keeps the player on the surface**: "Open Designate with [d]: Dig is chosen. Click one corner of a box on a hillside or rock face, then the opposite corner (or Enter twice). Dwarves dig into rock from the side; the marked tiles blink while the work waits for a miner." The next step (stairs) teaches going down.
- The site rule, the step count (11) and the other steps are unchanged.

Spec: `03-content/ui-keymap-and-screens.md` § Tutorial (the order and the texts), `ui-screens/menus-and-world.md` § Tutorial (the two checks' "Done when"); `tutorial.json` and `strings.json` follow.

## Done

- [ ] Tests (`describe` with the task id): the steps run in the new order; a stockpile with the `Nothing` preset leaves the stockpile step open and choosing `Everything` passes it; a farm plot with no crop for the current season leaves the farm step open and choosing one passes it; a rebound `[p]` and `Esc` show as rebound in the texts.
- [ ] The tutorial e2e spec walks the new order to the end.
- [ ] UI only: no world hash moves and no sweep is needed.
