# T-NEW — The sidebar cuts off the number or word a line is there to give

**Source:** playtest 2026-11-24 ([report](../../reports/data/2026-11-24-playtest.md), finding 5) · **Size:** M · **Needs:** — · **Status:** open

## Why

In an hour of play at 1280 × 800 (the 36-column sidebar), many lines were cut with `»` or by a rule just before the part a player needs. A long name ending in `»` is the spec's rule (`fortress-screen.md`: "a name that does not fit ends with `»`"); these are not names, they are the facts themselves:

| Where | What shows | What is lost | Screenshot |
|---|---|---|---|
| Zones, selected zone rule | `─── Selected: Stockpile #1 (21 t─`, `Farm plot #1 (4 t)─` | "tiles" | `16-stockpile.png` |
| Zones list rows | `Stockpile #1 (Everything)    21 t` | "tiles" | |
| Stockpile editor help | `↑↓ select  ←→ expand  Space togg»` | what Space does | `16-stockpile.png` |
| Zones status | `Tab next zone · Enter its settin»` | "settings" | |
| Farm plot | `[ cabbage ▼ ]10 see»`, `Crops: 0 growing, 0 ready, 4 emp»` | "seeds", "empty" | |
| Pasture | `Capacity: 35 grass / 0 grazers (»` | how many it feeds (T-NEW pasture task rewrites this line) | `37-pasture.png` |
| Jobs, the selected job's reason | `…it may need more skill, a tool another »` | who holds the only pick, the line T-661 added to say so | `31-jobs.png` |
| Build, categories | `[c] Constructi»` | the category | `33-workshops.png` |
| Build, workshop rows | `Butcher's shop 1 table+1 st» (0)`, `Kennel 2 logs+1 chain or ro» (5)` | the second input | `33-workshops.png` |
| Stocks, value column | `seed  99  149»`, `container 26 316»` | the value's unit and digits | `59-stocks.png` |
| Orders, add order | `Where    any carpenter's works»` | "workshop" | |
| Creature view, thoughts | `-1 I have not talked to anyone»` | the thought | |
| Wagon (building panel) | `medical 9: brightleaf x5, splint` / `x4` | wraps between a name and its count | `23-wagon.png` |

## What to do

Decision: a line in a fixed-width panel never cuts a number, a unit or the key fact; it shortens its label, wraps under itself, or drops a redundant word, case by case:

- Zone rule and list: `(21 tiles)` always whole; shorten the rule's dashes, or move the count to its own line `21 tiles · Usage 0/21` (the stockpile editor already has a Usage line, so the rule can drop the count).
- Help and status lines: wrap to a second row (the stockpile editor has free rows), or shorten ("Space toggles").
- Farm: the seed count reads `(10)` after the crop; the crops line becomes two lines or `0 growing · 0 ripe · 4 empty`.
- Jobs: the reason wraps over as many rows as it needs (the list above has room); the holder's name is never cut.
- Build: the category row gives each category its width (`[c] Build walls` or two rows); the rows of a long input list wrap the inputs under the name, as the Workshop panel's recipe rows already do (T-646).
- Stocks: the value column is wide enough for five digits and `☼`; the count and value never end in `»`.
- Orders and the thought list: wrap under themselves.
- Building contents: break between entries, never inside `splint x4`.

Add a check that finds such cuts: a unit test that draws each panel named above with a long fixture (a 5-digit value, a 3-digit tile count, the longest labels) at 36 columns and fails on a `»` or a cut rule in any line that is not a name.

Spec: `ui-screens/fortress-screen.md` and `ui-screens/panels.md` where they draw these lines (the wireframes are wider than the sidebar; say how each fits 36 columns).

## Done

- [ ] Tests: the width test above, over Zones (stockpile, farm, pasture), Jobs, Build, Stocks, Orders, the creature view's thoughts and the building panel.
- [ ] e2e screenshots of the panels looked at; no raw keys, no cut facts. UI only: no world hash moves.
