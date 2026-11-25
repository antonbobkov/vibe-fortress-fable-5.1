# T-703 — The sidebar cuts off the number or word a line is there to give

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

- [x] **The rule**, 24 § Input model (the `»` line): only a name, or a list of entries each whole one step away, may end with `»`; a line that gives a fact wraps under itself (a number kept with its word), puts the fact before the label, or drops a redundant word; no widget clips without the mark. The widgets now keep it: a rule's cut title and a dropdown's cut value end with `»`, a table cell is marked by default, the tree's right-hand fact takes the cells it needs from the name, `wrapLabel` wraps a line under itself, a no-break space keeps a count with its word.
- [x] **The scan**, `test/unit/ui/t703-sidebar-fit.test.ts`: every registered panel, the zone inspectors (stockpile, farm, pasture), each Build category, Stocks, Jobs with a long reason, Add order (carpenter and craftsdwarf), the creature view and the wagon's panel, drawn by the fortress screen at 80 × 50 over a fortress with a 120-tile stockpile and plot, 120 seeds, five-digit values, long names and thoughts. It fails on a `»` whose text is not a name and on any text clipped bare or written past the screen's edge. Two marks stay, listed in the test: the labor grid's "more columns" `»` and the Mood table's list of top thoughts.
- [x] **The playtest's lines**, same file: the zone rule `─── Stockpile #1 · 120 tiles ───` and list rows `… 120 tiles` whole, `Tab next zone · Enter settings` and `↑↓ select  ←→ open  Space toggle` fit; the farm row's `(120)` with its tooltip "120 seeds of it in stock" and `0 growing · 0 ripe · 120 empty`; the Jobs reason whole over five rows with the holder's name; `[c] Constructions` whole and `Butcher's shop` / `  1 table+1 stone (0)`; `198  14,850 ☼` in Stocks; `Where    any craftsdwarf's` / `workshop`; the thought `-1 I have not talked to anyone` / `in a while.`; the wagon's `medical 21: bandage ×9,` / `brightleaf ×5, splint ×4, soap ×3`. Also wrapped: Population's eligibility, Threats' attention line, the Jobs empty hint, the Mood summary's thoughts. The pasture was already fixed by T-700.
- [x] Spec: 24 § Input model; `panels.md` § Zones (lists, rule, farm rows, crops line), § Jobs, § Add order, § Building, § Stocks, § Population, § Mood; `fortress-screen.md` § Sidebar open (facts wrap), § Build tool (category columns, wrapped rows).
- [x] UI only: no world hash moves; no render golden moved.
