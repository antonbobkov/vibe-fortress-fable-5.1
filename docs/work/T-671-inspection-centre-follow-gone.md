# T-671 — Centre and follow the thing in view, and say when it is gone

**Source:** [the inspection design](../../reports/designs/2026-11-21-inspection-and-follow.html), § 8 third task · **Size:** M · **Needs:** T-670 · **Status:** done

## Why

Watching a dwarf means panning by hand; the one centring key is in Units and jumps once (design § 1).

## What to do

Build the design's third task: `[S-c]` centre and `[S-f]` follow in the creature and item views (§ 4: follow keeps the thing inside the middle half of the map view and changes level with it; status row 2 says what is followed; every way of moving the view ends it, zoom, pause, speed and panel scroll do not), and the gone states of § 5 (died, used up or merged, hidden, left the map), which keep the title, give the last place and end follow. If T-674's keymap proposal has landed, use its keys.

## Done

- [x] Unit tests of the follow box on a moving creature, of each way that ends follow, and of each gone state: `test/unit/ui/t671-centre-follow-gone.test.ts` (the box on one axis; a dwarf that potters leaves the view still, one that walks off drags it to the box edge, down a level the view follows; an item followed through its carrier; follow ends with an arrow, `Shift`+arrow, either level key, `Home`, a middle drag, edge scrolling, the wheel or `Shift`+wheel over the map, a log line, job or danger jump, `Esc`, `k`, another panel, another thing, hiding the sidebar; it stays through zoom, pause, speed, `PageDown`, the wheel over the panel; the dead dwarf with its day, cause, last place and body link, a creature that left the map, a hostile out of sight that comes back when seen, a stack used up with its last carrier as a link, a stack merged into another that takes the view).
- [x] Keys: `c` centre and `f` follow in the creature and item views (keymap rows `look_panel/centre` and `look_panel/follow_view`, rebindable), every key of the three views a footer button (`[c] center  [f] follow ■ on` / `[h] here  [Bksp] back  [Tab] link`; a gone view `[c] center  [h] that tile` / `[Bksp] back  [Tab] link`; the tile list's `[Enter]`). The parity scenario checks `c` and `f` in a creature view, and `look-creature-scroll` checks follow and its end in the browser.
- [x] Docs: 24 § Inspection (centre and follow, when the thing is gone) and § Input model, `ui-keymap-and-screens.md` § Look panel, the fortress-screen wireframes (foot keys, a dead dwarf's view).

- [x] Coordinator addition: a container's `Holds` line groups its stacks by kind and material (`12 ale`), each group a link to its first stack (test in the same file).

Deviations: the follow-off mark is the word `off` (the CP437 font has no `□`). 13's `items.merge` emits no event, so the view finds the stack an item merged into by its type and material on its last tile (follow-up T-NEW-items-merge-event). `c` and `f` are Look's keys only in the creature and item views: in the tile list they keep their other meanings (Civilizations, Overlays, a map selection's forbid), which the e2e specs `trade-session` and `panels-act` rely on.
