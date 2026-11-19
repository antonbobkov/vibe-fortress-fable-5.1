# Wireframes: Fortress Panels

**Owner:** `ui/panels/*` · **Depends on:** [`fortress-screen.md`](fortress-screen.md), the owning system documents

All panels are `SIDEBAR_COLS` (36) wide; shown here at that width. Each has a title row that ends with `[x]`, a button that closes the panel as `Esc` does with no tool armed (the key that opens each panel is in the Hotkey column of the fortress panels table, and Help lists it), an optional filter row, content, a separator and an action row. While a filter is in use the title row shows it, `Units · filter: xxx (3 of 80)` (Jobs the same with its job counts, Log with the entries of its tab, Stocks without counts); the filter ends when the panel closes.

A panel letter ([`ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md) § Fortress panels) always opens or closes its panel, whatever panel is open. An accelerator on one of those letters is therefore `Shift`+letter, written `[S-m]`; an accelerator on a free letter is written `[w]`. Every action row is clickable.

## Zones (z)

```
│ Zones                          [x]  │
│ [S-s] Stockpile [S-f] Farm plot     │
│ [S-p] Pasture   [S-b] Bedroom       │
│ [S-d] Dining    [h] Hearth          │
│ [S-o] Hospital  [r] Barracks        │
│ [S-a] Archery   [S-m] Meeting       │
│ [S-t] Tomb      [S-u] Dump          │
│ [i] Fishing     [g] Gather          │
│ [S-c] Sanctum   [S-k] Compost       │
│ ─ Drag a rectangle.                │
│ Usable tiles show ▒, others x.     │
│ ── Selected: Farm plot #3 (24 t)   │
│►Spring  [dimcap      ▾]  14 seeds   │
│ Summer  [dimcap      ▾]  14 seeds   │
│ Autumn  [sweetroot   ▾]  0 seeds    │
│ Winter  [dimcap      ▾]  14 seeds   │
│ Crops: 18 growing, 4 ready, 2 empty │
│ Fertilize: on (12 in stock)         │
│ Too cold to grow: 4 of 24 tiles are │
│ under 2°C for dimcap.               │
│ Rock 3 levels below the surface     │
│ stays warm all year.                │
│ ↑↓ season · Enter choose crop       │
│ [S-a] all seasons                   │
│ [w] fertilize                       │
│ [x] remove zone  [S-e] resize       │
```

The type list uses names that fit a 16-cell column (Dining, Hearth, Meeting, Archery, Fishing, Gather, Sanctum, Compost); the full names stay in the tool prompt ("Dining hall · drag a rectangle") and in a zone's own name. After a drag the status row says what was made: "Stockpile #2 made: 12 tiles.", or, when tiles were left out, "Farm plot #1 made: 9 tiles (6 left out: 6 belong to another zone)." The reasons are counted per kind (another zone, not walkable, not soil, not beside deep water). The line and the selection come as soon as the zone exists: at once while paused, when the `CreateZone` takes effect (24 § Input model), and at the next tick while time runs. The new zone is selected, so its inspector shows, and the tool stays chosen but idle: `Enter`, the arrows and the digits go to the inspector (a farm plot's `Enter` opens the season's crop list) until the pointer is pressed on the map again or the type's key is pressed again. A press on the map starts the next rectangle at once, so several zones in a row are one drag each; `Esc` or a right click drops the idle tool and keeps the zone selected. A drag where no tile qualifies sends nothing and says why: the tiles another zone holds, counted per reason as above ("Stockpile: none of the 20 tiles qualify (20 belong to another zone)."), or, when no tile is another zone's, the rule ("Bedroom: none of the 4 tiles qualify (floor that no other zone holds)."). While a zone is selected and the tool is idle, status row 2 reads "Selected: Farm plot #3 (24 t)".

A farm plot's four season rows work by keyboard as well as by mouse. `↑` `↓` move the highlight (`►` before the season) over the rows; it starts on the current season each time a plot is selected. `Enter` opens the highlighted row's crop list, in which `↑` `↓` and `Enter` choose and `Esc` closes it without a change; the list is as wide as the panel allows. `Shift+A`, or a click on `[S-a] all seasons`, sets the highlighted row's crop for every season in which that crop can grow (when the row is `none` it clears all four). With a farm plot selected `Shift+A` is this key and not the Archery zone type; `[y]` returns to the type list. A crop with no seeds in stock is listed with `(no seeds)` after its name, and the figure after a row reads `14 seeds`, in red at 0. When tiles of the plot are below the minimum temperature of the crop standing on them (of the current season's crop on an empty tile), a red note under the crop count says how many ("Too cold to grow: 4 of 24 tiles are under 2°C for dimcap.", for the species with most such tiles), followed by a dim line, "Rock 3 levels below the surface stays warm all year." (`NEAR_SURFACE_DEPTH`); with no cold tile the note is absent. On a surface plot a red note under it says when a season's crop cannot ripen before its growing seasons end: the current season's crop sown today ("Sown now, strawberry cannot ripen before its seasons end: it needs 28 days, 9 are left.") and each other season's crop sown on its first day ("Sown in summer, strawberry … 25 are left at most."); 07 § Player-facing behavior gives the reckoning. The wireframe shows the cold note, which is not always there. Under the crop count the plot's `fertilize` setting and the units tagged `fertilizer` in stock ("Fertilize: off (0 in stock)"); `w`, a click on the line or on `[w] fertilize` turns it on or off (07 § Fertilizer). A selected compost heap shows the items on it waiting to turn ("Turning: 4 items", 13 § The compost heap).

A stockpile made while paused can be configured immediately, before its `ZoneChanged` is dispatched. While its record is absent, the inspector reads the same empty filter, zero wanted containers, no links and `HAUL_PRIORITY` defaults as the item system, without creating state during drawing. Every editor action uses those defaults until a command creates the record; a deleted zone still reports that it is unavailable.

Selecting a stockpile or room replaces the type list with its inspector; `[y] zone types` returns to the list. With no zone tool active, `Enter` selects the zone at the map cursor or centre; a click on its map tiles does the same.

```
│ [y] zone types                    │
│ ── Selected: Stockpile #1 (30 t)   │
│ [S-p] Preset [Food ▾]              │
│ [g] tree  [q] settings             │
│ [v] materials                     │
│ ▸ Food          [■]               │
│ ▸ Drink         [□]               │
│ ▸ Seed          [▪]               │
│ Barrels wanted [-]   8 [+]         │
│ Bags wanted    [-]   4 [+]         │
│ Bins wanted    [-]   0 [+]         │
│ Priority       [-]   5 [+]         │
│ Min quality    [-]   0 [+]         │
│ Max quality    [-]   5 [+]         │
│ Materials [any]  Quality 0–5       │
│ Priority 5    Links: none          │
│ Usage 22/30 tiles                 │
│ ↑↓ select ←→ expand Space toggle  │
│ [x] remove zone  [S-e] resize      │
```

The preset header names the preset the filter equals; a filter that equals none reads `Custom`, and an empty filter, which a new stockpile has, reads `Nothing`, with the line "Takes nothing: choose a Preset." under the header in the alert colour (13 § Stockpiles: a new stockpile accepts nothing). A stockpile's name in the log uses the same word ("Stockpile #1 (Nothing)"). The preset header opens a dropdown rather than cycling with the thirteen presets. Arrows highlight and Enter chooses; letters jump to the next matching preset without accelerator captions; the help line says "letters jump". A click chooses the same option. Esc closes without applying.

The links line names source stockpiles (for example `Links: Stockpile #2, Stockpile #4`) with `[i] link` and `[x] unlink` on the following line when needed to fit the sidebar. Link enters map picking: the status says "Link Stockpile #1: click the stockpile it takes from · [Esc] cancel". Click another stockpile or press Enter at its map cursor tile to submit `LinkStockpile` with `on: true`; any other tile, the same stockpile or a non-stockpile zone explains that only another stockpile can be a source, and leaves picking active. Esc or right click cancels. Unlink opens the linked-source list; arrows or a click select and centre on a source. Enter or its unlink button submits `LinkStockpile` with `on: false` for that source only; Esc or Cancel returns without changing links. Panel letters still switch panels in both modes. An empty source list explains that there are no links.

In the stockpile inspector, `[Del] remove zone` uses Delete and its clickable footer action with the usual default-No confirmation; `[x]` is reserved for unlink. Other zone inspectors keep `[x] remove zone`. Help lists all these controls.

In the category tree, arrows select and expand/collapse (Left on a collapsed child selects its parent), and Space toggles the tri-state checkbox. In numeric settings, arrows or Tab/Shift+Tab choose a field; Left/Right or +/- adjust it, just like the mouse buttons. The fields submit `SetStockpileContainers`, `SetStockpilePriority` and `SetStockpileFilter`, preserving unrelated settings. Counts stay non-negative, priority stays 1–9, and quality stays 0–5 with minimum no greater than maximum; a refused adjustment explains why in the status row.

The materials checklist replaces the settings until Esc: arrows select, Space or Enter toggles, and a click does the same. Any toggles between all material classes and none. Panel hotkeys retain their panel action in every state. Help lists every action, and hovering a truncated value shows its full text.

A room inspector shows current tier and score parts, named missing requirements, and its enclosure count:

```
│ [y] zone types                    │
│ ── Selected: Bedroom #2 (9 t)      │
│ Modest room (score 24)             │
│ Tiles 9 Walls 2 Furniture 4 Size 9 │
│ Not enclosed: 3 open border tiles │
│ Needs a bed                       │
│ Owner: nobody                     │
│ [S-o] owner…                      │
│ [x] remove zone  [S-e] resize      │
```

Open border tiles on the viewed level are highlighted using the room's existing same-z eight-neighbour enclosure rule; the inspector only reads and never recomputes stored room state. Missing requirements say Needs a bed / a table with a chair / the hearth inside / a chest / a coffin / a rune circle, as appropriate. A bedroom's owner button or Shift+O opens the same Nobody/dwarf picker as the building panel; arrows and Enter or a click submit `AssignRoom`, Esc cancels. A missing built bed or pending room registration is explained in the status row.

A sanctum's inspector is 25's sanctum panel: the room lines, then the glowcap in stock, the mishap chance of a new apprentice, each apprentice with its level and rune and, under it, the sessions left today and its own mishap chance, the last mishap, and the apprentice button:

```
│ [y] zone types                    │
│ ── Selected: Sanctum #1 (12 t)     │
│ Room: Bare (score 15)              │
│ tiles 12 walls 0 furn. 0 size 12   │
│ Enclosed                          │
│ Requirements met                  │
│ Glowcap in stock: 14              │
│ Mishaps, new apprentice: one sessi│
│ Urist: Runecraft 3, rune 2/15      │
│   1 sessions left today; mishaps o│
│ Last mishap: singed (Urist), today │
│ [S-o] apprentices…                │
│ [x] remove zone  [S-e] resize      │
```

`Shift+O` or a click on the button opens the apprentice picker: a title with the count ("Apprentices of Sanctum #1 (1/4):") and every adult dwarf, `●` for an apprentice and `○` for the rest. `Enter` or a click adds or removes the dwarf through `SetSanctumApprentices`, and the picker stays open; a fifth is refused in the status row. `Esc` closes it.

## Jobs (j)

```
│ Jobs                           [x]  │
│ 42 open · 18 claimed · 6 blocked    │
│ /filter: ____                      │
│ Pri Job              Who / reason   │
│  1  Dig (52,31,z30)  Ketil Ironvein │
│  3  Build bed        Orm Ashbrow    │
│  5  Haul turnip      —              │
│  5  Build bed        waiting: 1 bed │
│  5  Dig (60,40,z29)  no path        │
│  5  Dig ×19          no path        │
│  6  Haul stone ×12   —              │
│ ─────────────────────────────────── │
│ [Enter] center  [S-p] priority      │
│ [x] cancel  [o] standing orders     │
│ ── Labor priorities (1–9) ───────── │
│ Mining 2 · Hauling 7                  │
```

Below the job list, "Orders waiting (n) [Tab]" lists the work orders that no job serves, three rows at a time, one row each with the reason the Orders panel shows ("x1 Mail shirt · no forge", "x3 Door · waiting for log (0)"); the Jobs text filter applies to those rows, and a click on a row opens Orders with that order selected. By keyboard, `Tab` moves the cursor (`►`) between the job list and these rows when there are any (with none it is the sidebar key); `↑` `↓` move over them, scrolling the rest into view, and `Enter` opens Orders with the order selected, as the click does.

Jobs names a building target by its type (Build bed, Build carpenter's workshop), an item target by its item name (Haul log), and a creature target by its own name or else its species (Hunt wild horse, Carry patient Liv Hammerfall). A job type with no name of its own in the strings reads as its id in words with a capital (Plant, Carry patient). Only bare-tile jobs show coordinates. Click the job name or press Enter to centre its target. A blocked batch is one row: two or more jobs next to each other in the list, blocked for the same reason, of one type and priority, each on a bare tile, show as the job's name and their count (`Dig ×19`) with the reason. While it is selected, the line under the list gives the box their tiles span and the level or levels (`19 jobs over (59,51)–(63,53), z27. [Enter] list them.`) before the reason's long text. `Enter` on it opens it to its rows and centres the first; the opened rows stay open while their jobs last (presentation state, not saved). `[S-p]` and `[x]` on the batch's row act on every job of it. With no rows, the first table body row says "No jobs. Designate [d], build [b] or order [o]."

The filter controls wrap onto three rows at sidebar width: `/filter`, `[S-l] labor: all`, `[S-s] state: all`. `/` or clicking the field focuses text matching the job name or worker, ignoring case. Enter or Esc finishes typing without closing the panel. Shift-L or clicking the labor row cycles all and the labors with jobs in registry order; Shift-S or clicking the state row cycles all, open, claimed, blocked. Claimed includes fetching, travelling, working and completing. Filters combine; changing one resets selection. The summary counts all current jobs. Labor priorities show only non-default priorities, using full names separated by dots. With all defaults, the line reads "All labors at priority 5: change them in the labor manager ([l], Enter)."

## Labors (l)

```
│ Labors                         [x]  │
│            Min Woo Coo Car Mas Cra… │
│ Ketil I.   ■   ■   ■   □   ■   □   │
│ Brynja C.  □   □   ■   □   □   □   │
│ Orm A.     □   ■   ■   ■   □   ■   │
│ …                                   │
│ ─ click to toggle · shift-click:   │
│   whole column · [S-a] all on/off  │
│ [Enter] labor manager: all labors  │
```

The quick view's whole-row action turns every labor of the selected dwarf on unless all are on, then turns every labor off. Shift-click on a column applies the same rule across its dwarves. The panel is the quick view: each column head is three letters, unique among the labors (the first three letters of a one-word name, "Bre"; the first two letters of the first word and the initial of the second for a two-word name, "AnC", "AnT"), and a column is four cells wide. The columns that do not fit scroll with `←` `→`, the rows scroll with the selection, and hovering a column head names the labor. `Enter`, or a click on the last row, opens the labor manager.

## Labor manager

A full-window screen over the fortress (`labor_manager`), opened with `Enter` in the labors panel or with `Shift+L` in the units panel while dwarves are marked. The simulation keeps its speed under it.

```
 Labor manager                                                      [Esc] close
 Ranulf Ashwall, Miner · Animal training: on · priority 5 · skill 6 (Competent)
 2 of 40 marked          A A B B C C C C C F F G H H H L M M M M S S T T W
                         n n r u a l o o r a i e a e u e a e e i m m e r o
                         i i e t r e n o a r s m u r n a s c d n e i x a o
                         m m w c p a s k f m h   l b t t o h i i l t t d d
                         a a i h e n t i t i i c i a i h n a c n t h i i c
                         l l n e n i r n s n n u n l n e r n i g i i l n u
                             g r t n u g   g g t g i g r y i n   n n e g t
                         c t   y r g c         t   s       c e   g g s   t
   Dwarf                 a r     y   t         i   m       s             i
   Priority 1–9          5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5
 • Embla Ashhold         ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■     █
 • Ranulf Ashwall        ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■     │
   Orm Ironward          ■ ∙ ∙ ∙ ■ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ■ ∙ ∙ ∙ ∙ ∙ ∙ ■ ∙ ∙ ∙ ∙ ∙     │
   Vigdis Bearroot       ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ■ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙ ∙     │
   …
 ──────────────────────────────────────────────────────────────────────────────
 [Space] mark  [*] mark all  [Enter] toggle  [a] whole row  [c] whole column
 [-] priority down  [+] priority up  [t] templates
 Miner: 12 labors changed for 2 dwarves.
```

- **Rows**: every dwarf, scrolling with the cursor, `PageUp`/`PageDown`, `Home`/`End` and the wheel; a scrollbar column on the right. A child's row is dim: children take no labors, an action skips them and the status line says how many.
- **Columns**: every labor under its name written downward (cut to `LABOR_HEADER_ROWS`, 9, within which every name is unique; a window of at least `LABOR_TALL_WINDOW_ROWS`, 55, rows writes each name in full, and the head area grows to the longest name). A column is 2 to 4 cells wide by the room there is; when the labors do not all fit, the columns scroll with the cursor (`«` `»` mark more). Row 2 names the dwarf and the labor at the cursor, or under the mouse, in full, with the cell's state, the labor's priority and the dwarf's skill in it ("skill 6 (Competent)", or "no skill"); hovering a head shows the labor's name.
- **Cells**: `■` on, `∙` off. A cell's colour shows the dwarf's skill in that labor's skill (the best of the skills the content table ties to the labor): `text_dim` for none, the normal colour for levels 1 to 4, `text_value` from `LABOR_SKILL_VALUE_LEVEL` (5) to 9, `text_good` from `LABOR_SKILL_GOOD_LEVEL` (10); the colourblind palette uses the same four names. A child's cells stay dim. `Enter` or a click toggles the cell; `[a]` the cursor's whole row; `[c]`, or a shift-click on a head, the whole column for the marked dwarves, or for everyone when none is marked.
- **Letter jump**: a typed letter moves the labor cursor to the next column whose name starts with it, wrapping (`m` goes to Masonry, Mechanics, Medicine, Mining in turn). `a`, `c` and `t` keep their meanings; their jump is `Shift` and the letter.
- **Marks**: `Space` or a click left of a name marks a row (`•`), a shift-click on a name marks the range from the last mark, `Shift`+`↑`/`↓` mark the rows they pass, `*` marks all or none. An action on a marked row applies to every marked dwarf.
- **Priority row**: the labor priorities 1–9. `+`/`-` or a digit set the cursor labor's priority; a click on a number adds one, a shift-click takes one (`SetLaborPriority`). At a limit nothing is sent and the status line says the range.
- **Templates** (`[t]`, then `1`–`6`, or `↑↓` and `Enter`, or a click): Miner, Hauler only, Farmer, Crafter, Soldier, Everything off. A template turns exactly its labors on, and every other labor off, for the marked dwarves (or the cursor's dwarf); only the cells that differ are sent (`SetLabor`). The menu shows what the highlighted template turns on; the exact labor sets are in 11's Player-facing behavior.
- The last row says what the last action did, or why it did nothing. A change shows at once and is confirmed by the simulation at the next command phase; a pending value is removed when its reader agrees or a tick has passed.
- Every key row is a row of buttons, so each action has a mouse path.

## Orders (o)

```
│ Orders                         [x]  │
│ [S-n] new order  all workshops      │
│ ── Carpenter's workshop #1 ──────── │
│ ▶×3 Bed · in progress               │
│  ≥10 Barrel · stocked (12)          │
│  ×5 Door · waiting for log (0)      │
│ ── Any workshop ─────────────────── │
│  ≥40 Brew drink · no still          │
│ ── Finished ─────────────────────── │
│  ×2 Chair · done                    │
│ ─────────────────────────────────── │
│ In progress: a dwarf is at work on  │
│ it.                                 │
│ Count [-] 3 [+] [+/-] Shift ±10     │
│ [S-m] once  [S-p] priority 5        │
│ [S-f] any material ▼                │
│ [x] remove [r] repeat [S-↑↓] move   │
│ ── Standing orders ──────────────── │
│ [■] Harvest                         │
│ [■] Collect Products                │
│ [■] Butcher                         │
│ [■] Haul Refuse                     │
│ [■] Rearm Traps                     │
│ [■] Melt Marked                     │
```

- Opened with `o` the list shows every order in the fortress under its workshop's name ("Any workshop" for the global orders); opened from a workshop (`[S-o] its orders`) it shows that workshop's orders only.
- Status comes from the workshop's current job and `isRunnable` per candidate workshop. A keep threshold compares `orderStock`, the count the workshop itself compares (12 § Work orders): the output type of the material its recipe sets, else of the order's material filter, so "stocked (n)" is what stops the order.
- A row is the count (`×N` for `once`, `≥N` for `keep ≥ N`), the recipe and the order's status: `in progress`, `queued`, `waiting for <input> (<available>)`, `waiting for fuel`, `no <workshop type>`, `suspended`, `stocked (<in stock>)`, `done`. The selected order's status is written in full on the two lines under the rule, with where to get a missing input.
- `[x]` and `Delete` ask before removing an order, and the game keeps running behind the question. The answer removes the order that was asked about, found again by its serial (a global order) or by its recipe, mode, threshold, priority and material (the nearest such order to its old place; its count is not compared, because it falls while the order runs). If it has finished or is gone, the status row says "That order has finished." and nothing is removed.
- `+`/`-` (and `=`) change the selected order's count by 1, with `Shift` by 10, within 1–999: `remaining` of a `once` order, the threshold of a `keep ≥ N` order. While an order is selected they are not the game-speed keys. `[S-m]` toggles `once` / `keep in stock`, `[S-p]` steps the priority, `[S-f]` opens the material list, `Shift+↑↓` reorder within the workshop's queue. A transform order (setting a stone, 25) shows `set in: any` beside the material: a click steps its target type through the recipe's input 0 alternatives and back to `any`. Its mode stays `once`: `[S-m]` says "Setting a stone is a once order: there is nothing to keep in stock.", and the picker adds it as `once`. Its material list offers the classes of those alternatives.
- `[S-n]` opens "Add order" (below). `[r]` adds the selected order again with the count it was placed with; on a `done` row it orders the finished order again. `[x]` removes the order after `c_remove_order`; on a `done` row it clears the row.
- The last `ORDER_FINISHED_MAX` (3) finished `once` orders stay as `done` rows, each with the count it was placed with (an order removed before it finished is forgotten, so a later order of the same recipe keeps its own count), and the last `ORDER_RECENT_MAX` (5) ordered recipes lead the picker. Both are presentation state: not saved, and empty in a new or loaded fortress.
- With no orders: "No work orders. [S-n] adds one, or click a workshop on the map."

### Add order

```
│ Orders                         [x]  │
│ Add order                           │
│ Find [ doo____________________ ]    │
│ ── Recent ───────────────────────── │
│ ● Bed                               │
│ ── Furniture ────────────────────── │
│ ▶● Door · carpenter's workshop      │
│  ○ Door · forge                     │
│  ○ Door · mason's workshop          │
│ ─────────────────────────────────── │
│   Quantity [-]   5 [+]              │
│   Mode     once: make 5             │
│   Material any material             │
│ ▶ Where    any carpenter's workshop │
│ [Enter] add [Tab] next [Esc] back   │
```

- Letters type into `Find` (a filter on the recipe names; `Backspace` deletes). `↑↓` and `PageUp`/`PageDown` move in the list. Recipes are grouped by the top category of what they make, "Recent" first; `●` marks a recipe some workshop can run now, `○` one it cannot. Two recipes of the same name say which workshop type makes them.
- Digits type the quantity; `+`/`-` step it by 1 and with `Shift` by 10 (1–999). A first digit `0` does nothing, so the quantity is never 0. `PageUp`/`PageDown` move the list by a screen.
- Within a filter's matches the recipes are ranked: those a built workshop can make now, then those whose workshop exists but lacks an input, then those with no workshop; inside each group the order is the category order. A recipe with no workshop is dim with "· no forge" after its name, or "· kitchen not built yet" while a workshop of its type is placed and not yet built. A `○` recipe whose workshop is built names what it lacks after its name, from the workshop's waiting reason: "○ Tallow candles · no tallow", "· no fuel". Each change to the filter highlights the first listed recipe of the best rank, so a recipe a workshop can make now is highlighted before one with no workshop whose category comes first. `Enter` adds the highlighted recipe only after the player has typed a filter or moved the highlight with a key or a click (or the picker opened on a recipe); otherwise the status row says "Type a name or choose a recipe."
- The order is accepted even when nothing can make it yet, and the status row says so in the same line: "Ordered: x1 Mail shirt. No forge is built yet: [b] Build > Workshops.", or, when a workshop exists but an input is missing, "Ordered: x5 Barrel. Waiting for log (0 in stock)."
- `Tab` / `Shift+Tab` move the `▶` between the fields; `←→` change the focused one: the quantity, the mode (`once: make N` / `keep ≥ N in stock`), the material (any, a class, or one material the recipe takes) and, for a global order, the workshop (any of the recipe's type, or one of them). A click on a field changes it.
- Opened from a workshop the picker lists that workshop's recipes and `Where` is fixed to it.
- `Enter` (or a second click on the selected recipe) submits `AddWorkOrder` and closes the picker; the status row confirms ("Ordered: ×5 Door · Carpenter's workshop #1"). `Esc` closes it without ordering.

## Workshop

Opened by a click on a finished workshop.

```
│ Workshop                            │
│ Carpenter's workshop #1             │
│ Worker: any                         │
│ Suspended · magma powered           │
│ ── Recipes ──────────────────────── │
│ ── Container ───────────────────── │
│ ● Barrel                            │
│ ── Furniture ───────────────────── │
│ ● Bed                               │
│ ○ Door                              │
│ …                                   │
│ ── Orders (2) ───────────────────── │
│ ×3 Bed · in progress                │
│ ≥10 Barrel · stocked (12)           │
│                                     │
│ [S-n] new order  [S-o] its orders   │
│ [S-f] material  [w] worker          │
│ [S-s] suspend  [x] take apart       │
│ Needs fuel — order at a wood        │
│ furnace                             │
```

- The recipes use the Add order picker's output-category headings and alphabetical category order, with the content recipe order inside each category. The picker alone adds its Recent group. A `○` recipe names what this workshop lacks for it, as the picker does ("○ Tallow candles · no tallow"). `↑↓` selects a recipe and scrolls the list; `Enter` opens Add order on it. Clicking the scrollbar browses the list.
- `[S-n]`, or a click on a recipe, opens "Add order" for this workshop (on the clicked recipe). `[S-o]` opens the Orders panel on this workshop's orders; `[S-f]` opens the material list of its first order.
- `[S-s]` suspends after `c_suspend_workshop` and resumes without asking; `[x]` takes the workshop apart after `c_deconstruct_workshop` (it has orders) or `c_deconstruct_building`.
- The last two lines say why the workshop is idle (`12` § Operation 3).

## Building

Opened by a click on any building that is not a finished workshop or the depot (those keep their panels), or by `Enter` in Look on its tile. Right click on a building still opens Look.

```
│ Building                            │
│ Door #3                             │
│ Oak · built                         │
│ Open now: it locks when the alert   │
│ is Hearth.                          │
│ ── Mode                             │
│ ○ Open                              │
│ ○ Locked                            │
│ ○ No pets                           │
│ ● Lock on alert                     │
│ Look at the tile                    │
│ [x] take apart                      │
│                                     │
│ Open until the alert is Hearth,     │
│ then locked once the civilians are  │
│ in.                                 │
```

The panel is a list: `↑` `↓` move the cursor over the lines that act, `Enter` or a click activates one, and the last three rows explain the cursor's line. The first two lines are the name with its ordinal and the material and state (`built`, `planned`, `being built`, `to be taken apart`). What follows depends on the building:

- **Planned or being built**: why it waits, in the words of the Jobs panel (`Waiting: 1 door — order at a carpenter's workshop`); `Priority 5 · set 1 2 3 4 5 6 7 8 9` (`1`–`9` or a click on a digit, planned only: `SetBuildingPriority`); `[x] cancel the plan` (`CancelBuilding`). Nothing else is offered until it is built.
- **Door, hatch**: the modes as a list with the current one marked `●` (`SetDoorMode`: Open, Locked, No pets, Lock on alert; `SetHatchMode`: Open, Locked). A door set to lock on alert says whether it is locked now.
- **Trap**: `Trap: armed` (or spent, jammed) and the modes Enemies only / Everyone (`SetTrapMode`).
- **Lever**: `Lever: off`, `[y] pull` (`PullLever`), then the links.
- **Pressure plate**: `Plate: not pressed`, the trigger as a list (Enemies and wild creatures / Any creature, dwarves too / Water / Magma) and `← → smallest size 0 (a dwarf is 60)` or `← → depth 1 of 7 or more`; `←` `→` or a click on an arrow change the number (`SetPlateTrigger`). Then the links.
- **Links** (lever, plate): `── Linked to (2)`, a line per target with its state (`→ Drawbridge #1: lowered`; `Enter` centres the map on it), a dim line per link a mechanic has still to make (`… Door #2: waiting: 1 mechanism`), `[i] link to…` and `[r] unlink` (the target under the cursor, or the only one: `UnlinkMechanism`). A linked target's own panel lists what works it (`← Lever #1`).
- **Cage**: `Holds a wolf` or `Empty`; `[r] release` (`ReleaseCage`, after `c_release_cage`) and `[g] tame` (`TameCaged`).
- **Bed** (any building tagged `sleep`: a bed, a stone bed, a pallet): `Owner: Urist (Bedroom #2)`, and `[w] owner…`, which assigns the bedroom zone the bed stands in (`AssignRoom`). A bed in no bedroom says so and how to make one. Then, for a wooden bed, `Made up: linen bedding, feather pillow` or `Not made up` with `Wants: bedding, pillow` for what it lacks (a featherbed's pieces are named after their feathers, the rest after their cloth), and for every bed `Rests at 110%` (14 § Beds).
- **A `container` building** (the wagon, a chest): `Holds:`, then one line per top category of the stocks tree, in its order, with the units it holds there by item type, counting what lies inside the barrels and bags it holds and those containers too: `food 60: easy meal ×10, plant ×40, raw meat ×10`, `container 16: barrel ×5, bag ×9, bucket ×2`; a category whose one type has the category's name reads `drink 60`. A line wraps over up to three rows. With nothing in it, `Holds nothing`. While it holds anything, `[v] see the items` opens Look on the tile where they lie (the wagon's centre) at the `Items` tab.
- **A building with wants** (14 § Building wants): `Holds: …` or `Holds nothing yet`, and `Wants: …` for what it lacks. While it holds anything, `[h] take out what it holds` (`ReleaseHeld`): it drops on the tile, and haulers bring the nearest again unless it is forbidden.
- **Coffin**: `Kept for anyone` / `Kept for Urist` / `Holds a body`, and `[w] keep for…` (`AssignCoffin`).
- Every built building: `Look at the tile` and `[x] take apart` (after `c_deconstruct_building`).

`[i] link to…` replaces the list with the buildings that can be linked, and the status bar reads `Link Lever #1: click a door, hatch, floodgate, drawbridge, spike trap or cage · [Esc] cancel`:

```
│ Link Lever #1 to:                   │
│ Drawbridge #1: lowered              │
│ Door #3: locks on alert             │
│                                     │
│ Click the target on the map, or     │
│ Enter here. Esc cancels.            │
```

A left click on the map picks the building there; `↑` `↓` move the cursor (the map centres on each candidate) and `Enter` picks it; `Esc` or a right click goes back. A wrong pick says why (nothing there, not a kind that links, not finished, linked already, the lever itself) and the choice stays open. A link is made by a mechanic with one mechanism; with none in stock the message says where to order one.

`[w]` replaces the list with `Nobody` and the dwarves, the current owner marked `●`; `Enter` or a click chooses, `Esc` goes back.

Every action that cannot be done says why on the status row (an empty cage, a coffin that holds a body, a mode that is set already, a building not finished).

## Stocks (s)

```
│ Stocks                         [x]  │
│ /filter: ____                       │
│ ▸ food        412   1,880 ☼         │
│   ▸ meal       96   2,400 ☼         │
│   ▸ plant/raw 210     240 ☼         │
│ ▸ drink       184     420 ☼         │
│ ▸ stone       340     560 ☼         │
│ ▸ bar          38     870 ☼         │
│   ▸ metal  iron 30 · copper 8       │
│ ▸ weapon        9   1,120 ☼         │
│ …                                   │
│ 52 rot within 3 days                │
│ Usable 396 of 412: 12 reserved,     │
│   4 carried                         │
│ Wealth 18,450 ☼   (buildings 3,200) │
│ [S-f] forbid  [S-d] dump            │
│ [S-m] melt  [S-t] to depot          │
```

The line under the tree speaks of the selected row's rot (24 § Panels): a stack by its name, stage and days left, `turnip ×20 · stale, rots in 4 days`; a type or category that holds perishable stacks by the units under it that rot within `ROT_ALERT_DAYS`, `52 rot within 3 days`, in the alert colour when there are any; empty for anything else. A stack that is stale or rots within `ROT_ALERT_DAYS` has its name in the alert colour.

The `STOCKS_USE_ROWS` rows under it say how many units of the selected row (a stack, a type, or every type under a category) a build, an order or a workshop can have now, which is 13's available count, and why the rest cannot, each reason with its units: `Usable 4 of 21: 11 at the depot, 3 forbidden, 1 carried, 2 reserved`. The reasons are, in this order, at the trade depot (`11 at the depot`), forbidden, in use (installed furniture, a cage that holds a creature), owned, carried, reserved and not recovered (foreign loot); a unit with several counts under the first. The line wraps with a two-cell indent; one longer than its rows ends with `»` and has the rest as a tooltip. It is dim, in the alert colour when none of the row can be used, and empty when all of it can. It reads the items as they are now, so a forbid made while paused shows at once, while the tree's counts and values are taken once a tick.

`/` or clicking the filter field focuses a case-insensitive search of category paths, item names and material labels. Enter or Esc finishes typing. Matching descendants keep their ancestors visible and expand while the filter is set; clearing the filter restores the saved tree expansion. Filtering changes visible rows, while category actions keep applying to their selected category.

Stocks actions apply to the selected category, type or individual stack. Forbid and dump toggle all applicable items; turn on when any selected item lacks the mark, otherwise clear all. Melt considers only eligible metal items and uses the same consistent toggle. A mixed-material type sends individual metal-item commands, while an all-metal type sends one type command. Nonmetal stacks cannot be marked for melt. Marking for dump or melt goes through the default-No confirmation; clearing marks and forbidding do not ask. Every action has a key caption and a clickable row.

## Depot

The selected built depot keeps its goods list and action row (`[S-m] move`, `[r] remove`, `[S-t] trade`) while a trade request waits. When a caravan is at the depot, requesting trade by key or click says "The broker is on the way to the depot."; while paused it adds "· [Space] resumes". The request sends `TradeOpen`; the modal opens only when the broker reaches the depot. A refused request keeps its specific refusal message; while a caravan waits at its edge and cannot reach the depot, the refusal is the waiting caravan's line ("The Hillfolk caravan cannot reach Trade depot #1 from the west edge: …", 20 § Movement step 2).

The goods list groups the stacks at the depot as the trade session's merchant column does: one row per item type, material and quality, with the summed count and value ("11 barley straw  11 ☼"), named in the plural above one; `[r] remove` takes every stack of the selected row back. Under the title, in the alert colour, a line says when caravans cannot reach the depot: the waiting caravan's line while one waits for it in vain, else "Hillfolk caravans from the west edge cannot reach it: a caravan needs a way on foot, with no deep water or drop." naming each civilization whose edge reaches none of its tiles (20 § Movement step 6). The warning wraps over at most `DEPOT_WARNING_ROWS` rows (24 § Tuning constants); a longer one ends with `…` and has its full text as a tooltip. While the panel is open, the map marks where the way breaks (20 § Movement step 6: the waiting caravan's gap, else the gap of each civilization named) with `x` on the alert colour, on both sides of the gap, on their own level; a click on the warning centres the map on the caravan's side of the first gap.

## Military (m)

```
│ Military                       [x]  │
│ Alert: (•) Calm ( ) Watchful ( ) Hearth │
│ Calm: everyone works.               │
│ Squads                              │
│ ▶ The Hearthguard  3/6  train       │
│   The Cold Bolts   2/6  active      │
│ [+] new squad  [x] disband          │
│ ── The Hearthguard ─────────────── │
│ Leader  Halvar Grimshield (Warden)  │
│         [S-l] pick  [S-n] rename    │
│ Mode    [off] [train] [active]      │
│ Members Halvar G., Einar R., Tova E.│
│         [S-a] add  [r] remove       │
│ Armed 2 of 3 · unarmed: Tova E.     │
│ No axe in stock: order one at a     │
│   forge [o] or buy one.             │
│ Gear [w] weapon [axe ▾]             │
│   [g] armor [metal ▾]               │
│   [S-j] ranged □                   │
│   [S-d] draughts: draught of mending│
│ Station (60,28,z31)                 │
│         [S-s] set  [S-c] clear      │
│ Patrol none [S-p] add [y] clear     │
│ Orders [S-k] kill [S-f] follow      │
│ Barracks #2  [S-b] change           │
```

Choosing a station, a patrol point, or the creature or dwarf of a kill or follow order waits for the map: a click picks the tile, or the arrows move the map cursor and `Enter` picks the tile at it. `Enter` on a tile with no creature says "No creature there." ("No dwarf there." for a follow order). A kill order on a tile that holds several creatures takes the most hostile: a raider or monster before a wild animal, a wild animal before any other, and a fortress creature (the dog fighting the raider it stands on) only when nothing else is there.

The line under the alert row says what the current alert does, wrapped in up to three rows: "Calm: everyone works.", "Watch: squads stand to; civilians work." or "Hearth: civilians stop work and shelter in the hall or behind a door; Lock on alert doors shut." Under a Hearth alert, while some civilian has no shelter (10's `dwarves.unsheltered()`: 19 § Hearth alert retreat found no hearth hall, no indoor tile behind a door and no bedroom for it), a line in the alert colour under it says how many and what to do: "No shelter: 7 dwarves keep working in the open. Make a Hearth hall [z] or a room behind a door.", or, when the fortress has a hearth hall (14's `hearthHallTiles`), "No shelter: 2 dwarves keep working, unable to reach the hall or a room behind a door." (such dwarves work as under a Watchful alert, 10 § Behavior selection step 2) With no squad, two dim lines under "No squads yet: [+] makes one." say what a first squad needs: "A squad of three with iron spears and a kill order holds off boars." (a club does not stop a boar).

`[S-a] add` and `[r] remove` open a multi-select list in place of the squad's details; `[S-l] pick` (the leader, among the members) and `[S-b]` (the barracks zones, with "None" first) open a single-choice list:

```
│ ─── Add: 2 marked, 4 free ───────── │
│ • Ketil Ironvein                    │
│ • Brynja Coldhammer                 │
│   Orm Ashbrow                       │
│ [Space] mark  [*] all               │
│ [Enter] choose  [Esc] cancel        │
```

- The add list gives each dwarf's best combat skill after the name, the highest level among the skills with a military profession, ties by the skill table's order (`Hrolf Stonehold  Crossbow 3`; the name alone with none). The remove list gives each member's weapon after the name, named as the inspector names it (`Liv Hammerfall  iron spear`), or `unarmed`.
- `Space` or a click marks a row (`•`), `*` marks all (as many as the squad has room for) or none, and `Enter` adds or removes every marked dwarf in one `SetSquadMembers`; with none marked, `Enter` takes the cursor's row. An add list takes no more marks than the squad has free places, and a full squad, an empty squad or no free adult says so on the status row instead of opening an empty list.
- A member who can use the channel it holds (`runecraft` 1 or more) has the channel's glyph after its name in the members line: `Tova E. ⌠`.
- Under the members' keys, a squad with members has its armed line: how many members hold a weapon, then who holds none and who holds one that is not of the squad's choice, wrapped under it: `Armed 1 of 3 · unarmed: Liv H., Hrolf S.`, `Armed 3 of 3 · no spear: Hrolf S.`. The weapon a member holds is its `Equipment` weapon, or else the tool it works with when that is a weapon of a class (16 § Equipment: a miner fights with the pick). A weapon is of the squad's choice when the preference is `any` or names its class, and, for a ranged squad, when it is a launcher; a ranged squad whose class has no launcher takes any launcher (16 § Equipment), so its choice is any launcher; a channel is always of the choice. The line is in the alert colour while any member holds no weapon or one not of the choice, and in the normal colour otherwise. While it is in the alert colour and no weapon of the choice is free in stock but tools (a pick or an axe, which a worker who lacks one takes first), a line in the alert colour under it says what to do: `No spear in stock: order one at a forge [o] or buy one.`, naming the workshops that make the class, training weapons aside, as the block messages name them (24 § Announcements); for `any` (`weapon`, or `ranged weapon` for a ranged squad) and for a class made in more than three places, `No weapon in stock: order one [o] or buy one.`
- `[w] weapon` and `[g] armor` (or their dropdown captions) replace the squad details with a single-choice list. The weapon list offers `any` and every weapon class in content but a channel's (25); armor offers `any`, `metal`, `leather`. Each row counts what is in stock and free for it (13's available count: not forbidden, reserved, owned, carried or at the depot): the weapons of the class (`any`: of every class, launchers only for a ranged squad and no launcher for another), saying which of them are tools (`axe (1, a tool)`, `pick (2, all tools)`, `axe (3, one a tool)`, `axe (4, 2 tools)`); the armor pieces of the preference, shields aside (`metal`: of a metal; `leather`: of leather, and the scale pieces; `any`: all). The current value adds `current` (`spear (0, current)`) and is selected initially. `↑↓` moves, `Enter` or a clicked row sends `SetSquadEquipment`, preserving the other preferences; `Esc` or the cancel caption leaves them unchanged.
- `[S-d] draughts` (or its caption) opens the squad's draught checklist (25 § Draughts): every draught a soldier drinks, in content order, each `■` with its place in the list or `□` ("draught of quickness (2)"), and under the list, wrapped in two rows, the selected draught's trigger in words ("Drunk when a raid or an ambush arrives.", "Drunk when hit while below half blood."). `Enter` or a clicked row adds the draught at the end of the list or takes it out, through `SetSquadEquipment`, and closes the checklist; `Esc` leaves the list unchanged. The line reads `none` while nothing is listed, and wraps under its caption when the list is longer than the panel.
- The leader list sends `SetSquadLeader`; `[S-n]` opens the text input and sends `RenameSquad`.
- The barracks list sends `SetZoneSetting { key: squad }`: the zone the squad had lets go and the chosen one takes it; "None" clears it. Without a barracks zone the status row says to make one in Zones. Changing the assignment moves training to that barracks, including for a squad that has already trained. The barracks row shows the assigned zone; with none assigned, the zone the squad trains at by default (16 § Training: the one it last trained at while that zone stands, else the first barracks) marked "(default)", read from the zones, so a barracks made while paused shows at once. A squad on `train` with no barracks zone at all trains nothing: the row reads "No barracks: the squad cannot train. [z] Barracks, then [S-b]." in the alert colour.
- Setting a squad with members to `train` with no barracks zone says the same on the status row; with a barracks, while a member holds no weapon, it says "Unarmed members train dodging only: see the Armed line." (16 § Training: an unarmed member gains no weapon skill).
- The new keys are on `Shift` because `l`, `b`, `n` and `d` are panel hotkeys.
- A key of the squad panel with no squad does nothing but say "No squad yet: [+] makes one." in the status row. A mode of work (`train` or `active`) set on a squad with no members is set, and the status row says "The Hearthguard has no members: [S-a] adds them."
- While a station, a patrol point, a kill order or a follow order waits for the map, the status row says what to do ("Station: click or press Enter on a floor tile · [Esc] cancel", "Patrol point: click or press Enter on a floor tile · [Esc] cancel", "Kill order: click or press Enter on a creature · [Esc] cancel", "Follow order: click or press Enter on a dwarf · [Esc] cancel") and drops any older line. A tile the squad cannot stand on sends nothing, says "The squad cannot stand there: pick a floor tile." and keeps the pick armed; the prompt returns when the pointer moves.

## Animals (n)

```
│ Animals                                       [x]  │
│ [1] Tame (14)  [2] Wild (23)                       │
│ Species   Name    Pasture  Cond  Tr                │
│ ▶ cow     —       #1       ▓▓░ 38                  │
│   cow     —       #1       ▓░░ 12                  │
│   dog     Bramble —        —    war                │
│   cat     Sooty   —        —                       │
│   chicken ×4      —        —                       │
│ ────────────────────────────────────────────────── │
│ [S-p] pasture  [S-s] slaughter                    │
│ [S-c] cap [S-a] assign [S-n] name                  │
│ [S-t] train                                        │
│ ── Wild ────────────────────────────────────────── │
│ deer ×5   [■] hunt   seen NE                       │
│ wolf ×3   [□] hunt   seen N                        │
```

The Tame tab offers a clickable `[S-t] train` row below the existing actions, visible at the normal sidebar width. It opens War/Hunting; arrows select and Enter submits, or click a choice. Esc or its Cancel button returns to the list. The Tr status shows training while a job exists, including retraining an animal that already has a role, otherwise war, hunting or blank. With no selected tame animal, or a non-trainable species, the normal message path explains the refusal. All panel letters keep their usual behavior inside both choice rows; Help lists this action and its controls.

The clickable `[S-c] cap` action opens an inline number field for the selected species. Digits replace its initial value and then append; Backspace removes the last digit. `+`/`-` step by one, or ten with Shift, clamped to 0–100 without wrapping. Enter or Set sends `SetBreedingCap`; Esc or Cancel discards the edit. The field's minus and plus controls are clickable. Letters still open panels, cancelling the cap edit when leaving Animals; the editor never changes game speed or tabs with its numeric keys. Help lists its controls.

## Threats (t)

```
│ Threats                        [x]  │
│ Peril 2 · Renown 14.6               │
│ Active: none                        │
│ Raids possible from Spring, Year 2  │
│ Ambushes possible from Autumn, Yr 1 │
│ Thieves: frequent                   │
│ ── Wildlife ────────────────────── │
│ bear ×1  near the hall              │
│ wolf ×3  far                        │
│ ── Caverns ─────────────────────── │
│ 1: breached at (84,73,z22)          │
│    monsters 4                       │
│ 2: sealed                           │
│ ── The Deep ────────────────────── │
│ Pressure ▓▓▓░░░░░░░ 30 / 50 (lvl 0) │
│ "Something below has not yet       │
│  noticed."                          │
```

The Wildlife section lists one row per dangerous species on the map (08 § Registrations) with its count and "near the hall" when one of them is within `NEAR_DWARF_RADIUS` of a dwarf on its level, else "far"; it is absent when none is on the map. With a row there, "Active: none" reads "Active: wildlife" (a hostile creature in view still reads "Active: n hostile creatures").

## Civilizations (c)

```
│ Civilizations                  [x]  │
│ Mountainhome  rep +12  spring       │
│ Hillfolk      rep  +4  summer  here!│
│ Wildwood      rep  −6  autumn       │
│ Gloam         (raiders)             │
│ ── Hillfolk ────────────────────── │
│ Last brought: cheese, wool cloth,   │
│  seeds, 2 sheep                     │
│ Requests [+]                        │
│  1. iron bars  ★★★                  │
│  2. wool cloth ★★                   │
│ Reputation log                      │
│  +3 trade (Summer 1) · −2 wood…     │
│ [S-d] depot  [S-t] trade now        │
```

The reputation log lists the civilization's changes newest first, as many as fit above the footer, each with its reason in words and its date as the log writes it: `-50 caravan member killed (Sp 3)`, `+5 a year passed (Sp 1)`, `+3 trade (Su 2)`, `-2 offered wood`, `no depot`, `gift`, `bandit killed`, `bandit caged`, `caravan lost`; a reason with no words reads `other`.

"Last brought" names the goods of the civilization's last caravan, each kind once by its name and with its count when it came more than once ("leather ×4, goat, dung ×3"); an animal is named by its species.

Depot panel (from a selected depot): items at the depot with values, `[S-m] move` opens the stocks tree in selection mode, `[S-t] trade` (enabled when a caravan is present). In selection mode `Space` or `Enter` marks the eligible stacks under the tree row, `[S-t]` submits one `MoveToDepot` command for everything marked, and `Esc` discards the selection. The requests editor lists the item ids of the content registry in registry order (the UI never invents an id) and submits only on `Enter`. An item the civilizations never sell (20 § Never sold) is refused on `Enter` with the status line "The {civ} do not trade in that." (`ui.trade.not_traded`), and nothing is submitted.

## Population (p)

```
│ Population                     [x]  │
│ 23 dwarves (2 children)             │
│ Cap [-] 80 [+]                      │
│ Hall spirit: Content (71)           │
│ Next evaluation: Autumn             │
│ Eligible: yes                       │
│ Last wave: 6 in Summer, Year 2      │
│ Waves so far: 3                     │
```

## Mood (e)

```
│ Mood                           [x]  │
│ Hall spirit ♥ Content (71)          │
│ Name         Tier     Top thoughts  │
│ Ketil Ironve Fine     +5 Had a fi»  │
│ Brynja Coalb Content  +8 Slept in»  │
│ Halvar Grimf Unhappy  -15 Lost a »  │
│ [Enter] inspect  [S-s] sort tier    │
```

Top thoughts that do not fit their column end with `»`, and the cell's tooltip has them all.

## Log (a)

```
│ Log                            [x]  │
│ [1] All [2] Alerts [3] Combat       │
│ /filter: ____                       │
│ Su 12 ! Gloam scouts seen (E)     █ │
│ Su 12 ☼ Wild beasts will come. Dig│ │
│       a hall into rock, put a door│ │
│       on it, click the door and   │ │
│       choose Lock on alert. Make a│ │
│       squad in [m] and arm it with│ │
│       iron spears: clubs lose to  │ │
│       boars. Order a kill when a  │ │
│       beast comes.                │ │
│ Su 11 ! The cow is starving       │ │
│ Su 10 Stockpile #2 is full ×3     │ │
│ …                                 │ │
│ [Enter] center on it                │
```

Each entry starts with its day in the dim text colour: the first two letters of the season and the day of the season ("Sp 8"), with the year before them ("Y1 Sp 8") for a line of an earlier year than the present one. The dates are padded to the width of the longest one on the screen so that the texts line up. An entry wraps under its own text, never under the date column, over as many rows as it needs: the hint above is one entry of eight rows. The panel opens on the newest entry. `↑` `↓` select an entry and `PageUp` `PageDown` move a page of entries; a chosen entry is inverted over all its rows (none is until the first key or click), and `Enter` or a click on any of its rows centres the map on its focus and marks that tile (24 § Announcements and the log). When the entries do not all fit, the last column is a scrollbar over the entries. The log strip at the bottom of the fortress screen shows no dates.

`/` or a click on the `/filter` field focuses it; while it has focus letters, digits and `Space` are text, `Backspace` deletes, and `Enter` or `Esc` finishes typing without closing the panel, as in Jobs and Stocks. The list keeps the entries of the chosen tab whose text, as the panel shows it (with the `!` prefix and the `×n` count), contains the typed text, ignoring case; the title reads `Log · filter: wolf (2 of 41)`, counting the tab's entries. Each change to the text selects the newest matching entry, unmarked. With no match the list reads "No entry matches the filter." The text is cleared when the panel closes.

## Overlays (f)

```
│ Overlays                       [x]  │
│ [■] designations  [□] priority digits│
│ [■] zones         [□] fluid levels  │
│ [□] temperature   [□] jobs          │
│ [■] squad stations                  │
│ [□] stockpile usage  [□] light      │
│ Debug: [□] connectivity [□] paths   │
│        [□] chunks                   │
```

The panel lists the overlays the compositor draws, in the order of 23 § Compositor step 8, with the debug overlays under the `Debug:` label. `↑` and `↓` move the selection and `Enter` toggles the selected overlay; a click toggles too.

## Help (?)

Three tabs: `Keys` (the keymap table grouped by context, live from the keymap; under a panel's heading, after its rows, come the few lines that say what the rows do not: the mouse's way, typing in a field, the keys inside a dropdown or a list, ranges and limits, so a panel is listed once and a key appears once, as its binding has it now), `Legend` (glyphs and colors by category, generated from content: terrain, fluids, creatures, items, buildings, overlays; Terrain has a row for each tree glyph naming the species drawn with it ("↑  tree: ash, birch, stalk fern"), the outdoor grass `'` `` ` `` beside the `"` row, and "`*` flowers on grass (outdoors)" just before "`*` web (white)", each drawn in a typical colour of its thing; under Overlays three lines say what a designation's blink means: blinking, waiting for a worker; pulsing brighter, a worker is on it; steady, blocked, or Reduced motion is on) and `Start` (how to begin). `1` `2` `3` or a click choose the tab. The first time Help opens in a fortress it opens on `Start`; later it opens on the tab it was left at.

Nothing in Help is cut: a line that does not fit the panel wraps, with a hanging indent under its description. `Keys` writes a Shift key the way the panels do (`[S-n]`) and starts with the line "S- is Shift". `PageDown` and `PageUp` move a page less one line, and the foot of the panel reads "page 2/7".

`Start` reads, wrapped: "1. Dig in: [d], drag over a rock face. Dwarves dig from the side. 2. Storage: [z] Stockpile, drag on floor, then choose its Preset: a new stockpile takes nothing. 3. Wood: [d] Chop tree. 4. Workshops: [b] Workshops; then orders with [o]. Build a carpenter's workshop and a still first. 5. Food: [z] Farm plot on soil; pick a crop for each season. 6. Beds: order beds, place them [b], draw a Bedroom over each. 7. Safety: a door on your hall set to Lock on alert, and a squad [m] with iron spears. 8. Space pauses. [?] opens this help."

Every panel that shows an `[S-x]` caption ends with one dim line, "S- is Shift", when its last row is free.

## Debug (F12)

A sidebar panel. Entity counts use `EntityReader.countOfKind`; path request counts use `requestsServed` and `requestsPending`. These are O(1) presentation counters and are not saved.

Per-system timing table (avg, worst), entity counts by kind, active fluid tiles, path requests served and pending, jobs by state, seed and tick, and buttons: `[S-d] dump save`, `[r] replay season log`, `[h] hash world`.
